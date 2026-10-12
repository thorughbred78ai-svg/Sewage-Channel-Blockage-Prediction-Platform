import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = rd('../site/index.html');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).at(-1);

test('內嵌 JavaScript 語法正確', () => assert.doesNotThrow(() => new Function(js)));

test('結構：六個頁面、id 不重複、無內嵌 onclick、預設空白資料', () => {
  const body = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), []);
  for (const p of ['dashboard', 'records', 'map', 'prediction', 'audit', 'backup']) assert.ok(ids.includes('p-' + p), p);
  assert.ok(!/\sonclick=/.test(html));
  assert.ok(!/if\(!ev\.length&&!localStorage/.test(js), '不得自動載入示範資料');
  assert.ok(!/(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9]{16,}/i.test(html));
});

const seg = js.slice(0, js.indexOf('// ===== 繪製 ====='));
const api = new Function('localStorage', 'document', 'alert', `${seg}
return { esc, csvSafe, hasPII, clean, cleanRain, ncdf, analyze, heat, toD, fmt, setEv: e => { ev = e; cache = {}; } };`)(
  { getItem: () => null, setItem() {} }, { querySelector: () => null }, () => {});

test('安全工具與資料驗證', () => {
  assert.equal(api.esc('<b onx="1">'), '&lt;b onx=&quot;1&quot;&gt;');
  assert.equal(api.csvSafe('=SUM(A1)'), "'=SUM(A1)");
  assert.ok(api.hasPII('A123456789') && api.hasPII('0912345678') && !api.hasPII('中山路 12 號'));
  const r = api.clean([{ date: '2026-02-30x', district: 'a', pipeId: 'p' }, { date: '2026-02-10', district: '桃園區', pipeId: 'P1', lat: 10, lng: 10, type: '亂填' }, null]);
  assert.equal(r.length, 1); assert.equal(r[0].lat, null); assert.equal(r[0].type, '其他');
  assert.equal(api.cleanRain([{ date: '2026-01-01', district: 'x', mm: -1 }, { date: '2026-01-01', district: 'x', mm: 5 }]).length, 1);
});

test('範本檔：空白為 0 筆，範例為 1 筆有效', () => {
  const b = JSON.parse(rd('../templates/backup_blank.json')), e = JSON.parse(rd('../templates/backup_example.json'));
  assert.equal(api.clean(b.events).length, 0); assert.equal(api.clean(e.events).length, 1);
  assert.equal(api.cleanRain(e.rain).length, 1);
});

const dAt = n => new Date(Date.UTC(2025, 0, 1) + n * 864e5).toISOString().slice(0, 10);
const mk = (id, ds) => api.clean(ds.map(date => ({ date, district: '桃園區', road: 'x', pipeId: id, lat: 24.99, lng: 121.3, type: '油脂堵塞', result: '已恢復通水' })));

test('預測引擎：空資料、機率與風險範圍、單筆資料', () => {
  assert.deepEqual(api.analyze([], api.toD(dAt(0)), 90), []);
  const ev = [...mk('A', [0, 90, 180, 270, 360].map(dAt)), ...mk('B', [dAt(10)])], last = api.toD(dAt(360));
  const near = api.analyze(ev, last + 80 * 864e5, 30).find(r => r.pipeId === 'A'), early = api.analyze(ev, last + 5 * 864e5, 30).find(r => r.pipeId === 'A');
  assert.ok(near.p > early.p);
  for (const r of api.analyze(ev, last, 90)) { assert.ok(r.p >= 0 && r.p <= .99 && r.risk >= 0 && r.risk <= 100 && r.p10 <= r.med && r.med <= r.p90); }
  assert.ok(Math.abs(early.med - 90) < 20);
  assert.match(api.analyze(ev, last, 90).find(r => r.pipeId === 'B').grade, /極低/);
});

test('空間熱區：點數不足為 null，足夠時正規化', () => {
  api.setEv(mk('A', [0, 30].map(dAt))); assert.equal(api.heat(), null);
  api.setEv(mk('A', [0, 30, 60, 90].map(dAt)));
  const h = api.heat(); assert.ok(h && Math.max(...h.cells.map(c => c.n)) === 1);
});
