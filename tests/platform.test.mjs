import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.at(-1);
const slice = (a, b) => { const i = js.indexOf(a), j = js.indexOf(b); assert.ok(i >= 0 && j > i, `marker missing: ${a}`); return js.slice(i, j); };

test('內嵌 JavaScript 語法正確', () => {
  assert.ok(js, '找不到內嵌 script');
  assert.doesNotThrow(() => new Function(js));
});

test('HTML 靜態結構：id 不重複、導覽按鈕引號正確', () => {
  const body = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepEqual(dup, [], `重複 id: ${dup}`);
  assert.ok(!/onclick="showPage\("/.test(html), 'onclick 引號巢狀錯誤');
  for (const p of ['dashboard', 'records', 'map', 'prediction', 'audit', 'backup'])
    assert.ok(ids.includes(p), `缺少頁面 ${p}`);
});

test('外部資源僅限允許網域且為固定版本', () => {
  const urls = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  for (const u of urls) assert.match(u, /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/[^/]+\/\d+\.\d+\.\d+\//, u);
  assert.ok(!/(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9]{16,}/i.test(html), '疑似硬編碼金鑰');
});

const helpers = slice('const esc=', 'const lsGet');
const engine = slice('const UNRES=', 'let aiLayer=null;');
const api = new Function(`var events=[]; const rain3d=()=>0;\n${helpers}\n${engine}\nreturn {esc,csvSafe,hasPII,toD,fmt,normCdf,analyze,hotspots,setEvents:e=>{events=e}};`)();

test('安全工具：跳脫、CSV 公式注入、個資偵測', () => {
  assert.equal(api.esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.equal(api.csvSafe('=1+1'), "'=1+1");
  assert.equal(api.csvSafe('中山路'), '中山路');
  assert.ok(api.hasPII('A123456789') && api.hasPII('0912-345-678'));
  assert.ok(!api.hasPII('中山路一段 234 號'));
});

test('常態分布 CDF 近似正確', () => {
  assert.ok(Math.abs(api.normCdf(0) - 0.5) < 1e-3);
  assert.ok(Math.abs(api.normCdf(1.96) - 0.975) < 2e-3);
});

const mk = (pipeId, dates, extra = {}) => dates.map(date => ({ pipeId, date, district: '桃園區', road: 'x', type: '油脂堵塞', result: '已恢復通水', cause: '油脂', lat: 24.99, lng: 121.31, ...extra }));
const base = Date.UTC(2025, 0, 1);
const dAt = n => new Date(base + n * 864e5).toISOString().slice(0, 10);

test('預測引擎：機率範圍、單筆資料不當機、逾期與近期差異', () => {
  const ev = [...mk('A', [0, 90, 180, 270, 360].map(dAt)), ...mk('B', [dAt(10)])];
  const last = api.toD(dAt(360));
  const early = api.analyze(ev, last + 5 * 864e5, 90).find(r => r.pipeId === 'A');
  const due = api.analyze(ev, last + 80 * 864e5, 30).find(r => r.pipeId === 'A');
  const early30 = api.analyze(ev, last + 5 * 864e5, 30).find(r => r.pipeId === 'A');
  assert.ok(due.p > early30.p, '接近預期間隔時 30 天內再發機率應較高');
  for (const r of api.analyze(ev, last, 90)) {
    assert.ok(r.p >= 0 && r.p <= 0.99); assert.ok(Number.isInteger(r.risk) && r.risk >= 0 && r.risk <= 100);
    assert.ok(r.p10 <= r.med && r.med <= r.p90);
  }
  assert.ok(Math.abs(early.med - 90) < 20, `中位間隔應接近 90 天，實得 ${early.med}`);
  const b = api.analyze(ev, last, 90).find(r => r.pipeId === 'B');
  assert.match(b.grade, /極低/);
});

test('空間熱區：正規化至 [0,1]，點數不足回傳空陣列', () => {
  const pts = mk('A', [0, 30, 60, 90].map(dAt));
  const h = api.hotspots(pts, api.toD(dAt(100)));
  assert.ok(h.cells.length > 0 && Math.max(...h.cells.map(c => c.n)) === 1);
  assert.deepEqual(api.hotspots(pts.slice(0, 2), api.toD(dAt(100))).cells, []);
});
