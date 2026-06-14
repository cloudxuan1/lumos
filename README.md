# lumos

韦斯莱时钟（Weasley Clock）网页。三根指针（☁️✨ 轩 / 🦀 克宝 / 🦉 团子），九个状态位，实时显示每个人在干什么。

- 纯前端单文件 `index.html`（React CDN + `React.createElement`，无构建步骤）
- 数据存 Supabase（`clock_status` 表），后端为 Edge Function `lumos-api`
- 部署在 GitHub Pages（根目录 `.nojekyll`）

详见 `CLAUDE.md`。
