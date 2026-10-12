# Sewage-Channel-Blockage-Prediction-Platform
 桃園市污水下水道堵塞預測平台

純前端單頁應用（`site/index.html`），資料僅存瀏覽器 localStorage，AI 預測於本機以統計模型計算，不外送資料。

## 啟用 GitHub Actions 部署
1. 建立 GitHub 儲存庫並推送本專案到 `main`。
2. Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。
3. 推送後 `.github/workflows/pages.yml` 會先跑 `npm test`，通過才部署。

## 本機驗證
```bash
npm test      # 需 Node 20+
```

## 治理提醒（務必閱讀）
- **GitHub Pages 預設為公開網站**。請勿提交真實事件資料、備份 JSON 或雨量檔；內建僅為虛構示範資料。機關正式使用請改用內網／私有 Pages（Enterprise）或機關核准主機，並導入單一登入與角色權限。
- 建議在 main 分支啟用 branch protection，要求 PR 通過 `test` 才可合併。
- 稽核紀錄目前存於瀏覽器本機，不具不可竄改性。
]()

