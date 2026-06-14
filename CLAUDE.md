# CLAUDE.md — lumos 项目说明

## 项目概述

lumos 是一个韦斯莱时钟（Weasley Clock）网页。三根指针（☁️✨ 轩 / 🦀 克宝 / 🦉 团子），九个状态位，实时显示每个人在干什么。
部署在 GitHub Pages，数据存在 Supabase（与 in-phase 共用同一个项目，不同表）。
名字来源：哈利波特第三部开头，哈利在被窝里念 "Lumos"。

---

## 跟我协作的方式（每次新会话必读）

1. **我描述现象和效果，不是代码位置。** 先理解我想要的效果再决定怎么改；如果一个问题要改好几处，先停下来跟我确认意图。
2. **我说的大白话往往就是答案，先按字面意思试。** 听不懂用大白话复述确认（"你是想 XX 对吗？"）。
3. **解释时先说视觉效果，再补技术原因。** 比如"指针绕中心转（因为 transform-origin 设在钟心）"。
4. **直接用术语解释，不要怕我听不懂。** 直接说 class 名、CSS 属性、函数名，我看不懂会发给 GPT。

---

## 分支与 main 规则（重要）

- **未经允许不得直接推 main。** 每次改动在分支开发，等用户说"在 main 直接改"才能直接推。
- **"在 main 直接改"** 授权仅限该次任务，不延续到下一个任务。
- 纯文档改动（CLAUDE.md 等）和简单小修可以直接推 main；大改动必须走 PR 流程。
- 每次改动原子化，一个 commit 一件事，方便回退。

---

## 技术栈

- 纯前端单文件：index.html（HTML + CSS + JS，React CDN，无 JSX，全用 React.createElement）
- 数据库：Supabase（project ref: kfgtrcdjusfljnvmwpsu）—— 与 in-phase 同项目，不同表
- 后端：Supabase Edge Function（lumos-api，verify_jwt=false）
- 部署：GitHub Pages，push 到 main 自动部署
- 字体：Google Fonts 的 Cinzel / Cinzel Decorative（哥特衬线，钟面英文用）

---

## 设计系统

风格：哈利波特还原 —— 黄铜质感、老式钟面、哥特字体、暖色调、羊皮纸做旧。

所有颜色用 CSS 变量，不要写死色值：

```css
--bg: #1b130c;        --wood: #2c1e12;
--wood-light: #3a2818; --brass: #c9a253;
--brass-light: #e6c87a; --brass-dark: #8a6a2f;
--face: #f1e2c0;      --ink: #3a2a18;
--muted: #7a6647;     --red: #7a2d1f;   --gold: #d4af37;
```

钟面底色：电影那种暖黄做旧羊皮纸（径向渐变 `#efdcab → #e3c98e → #cdaf76`），**不是深色**。
钟框：三层铜渐变（高光 → 铜 → 暗）。整体暖色调、低饱和、做旧，不要冷色或高饱和。

---

## 钟面设计

### 三根指针

| 指针 | 代表 | 标识 | entity_id |
|--|--|--|--|
| ☁️✨ | 轩 | 云/星 | cloud |
| 🦀 | 克宝 | 蟹 | crab |
| 🦉 | 团子 | 白色短毛枭 | owl |

指针长度不同避免重叠（cloud 152 / crab 120 / owl 92），勺形锥杆 + 尖端椭圆相框（描金边）。
**指针绕钟心旋转**：`.hand` 用 `transform-box: view-box; transform-origin: 220px 220px`（220 = viewBox 440 的中心 C）。

### 九个状态位（围钟面一圈，12 点起顺时针，每 40°）

| # | key | emoji | 中文 | 钟面英文 |
|--|--|--|--|--|
| 1 | home | 🏠 | 在家 | HOME |
| 2 | work | 💼 | 在上班 | WORK |
| 3 | overtime | 🔥 | 在加班 | OVERTIME |
| 4 | slacking | 🐟 | 在摸鱼 | SLACKING |
| 5 | travel | 🚶 | 在路上 | TRAVELLING |
| 6 | playing | 🎮 | 在玩 | PLAYING |
| 7 | sleeping | 💤 | 在睡觉 | BED |
| 8 | study | 📚 | 在学习 | STUDY |
| 9 | peril | ⚠️ | 性命攸关 | MORTAL PERIL |

钟面一圈只显示**英文花体字**（沿弧弯排，底部像电影一样绕着倒过来），不显示 emoji；emoji + 中文在下方控制卡里。后续可加自定义状态增删改，第一版先固定这九个。

### 状态切换 — 双模式

**手动模式：** 点击/点选切换 ☁️✨ 和 🦉 的状态。🦀 不开放前端操作，只由 Claude 通过 MCP 更新。

**权限总览：**
- ☁️✨：前端手动 + 自动模式
- 🦉：前端手动 + 自动随机逻辑
- 🦀：MCP only（Claude 管自己的指针）
- Claude 是管理员，MCP 可以改所有三根指针

**自动模式（☁️✨ 专属）：**
- 工作日 8:30–17:30 → 在上班；凌晨 0:00–7:00 → 在睡觉；其余时间 → 在家
- 手动操作随时覆盖；手动覆盖后，下一个自动时间点（`manual_until`）再恢复自动

**团子（🦉）逻辑：** 默认睡觉（大部分时间）/ 随机在路上（送信）/ 极小概率性命攸关（搞笑）。
前端每 20s 轮询 `/status`；自动评估只在状态真正变化时才写库。

---

## 数据库（结构不能改）

### 表结构：clock_status

```sql
create table if not exists public.clock_status (
  entity_id text primary key,
  display_name text not null,
  icon text,
  status text not null,
  mode text not null default 'manual',
  manual_until timestamptz,
  updated_at timestamptz not null default now()
);
```

初始三行：`cloud(轩 ☁️✨ home auto)` / `crab(克宝 🦀 playing manual)` / `owl(团子 🦉 sleeping auto)`。

### 状态值枚举

`home / work / overtime / slacking / travel / playing / sleeping / study / peril`

### 权限

anon 只读，service_role 全权，开 RLS：
```sql
grant select on public.clock_status to anon;
grant select, update on public.clock_status to authenticated;
grant select, insert, update, delete on public.clock_status to service_role;
alter table public.clock_status enable row level security;
create policy "Anyone can read clock_status" on public.clock_status for select using (true);
create policy "Service role can do anything" on public.clock_status for all using (true);
```

---

## Edge Function：lumos-api

源码：`supabase/functions/lumos-api/index.ts`（已部署，verify_jwt=false，带 CORS）

```
GET   /health             — 心跳
GET   /status             — 读取全部状态（按 entity_id 排序）
PATCH /status/:entity_id  — 更新某根指针（校验 entity_id / status / mode）
```

PATCH body 示例：`{ "status": "sleeping", "mode": "manual", "manual_until": null }`

链路：
```
网页前端 → Edge Function → clock_status 表
Claude MCP → 直接 SQL → clock_status 表
```

前端 URL 入口：`getApiUrl()` 从 `#hash` / `localStorage(lumos_api_url)` 取，首次无 URL 走 SetupScreen，验 `/health` 通过才存。

---

## Claude MCP 交互

Claude 通过 Supabase MCP 直接 SQL 更新 🦀 的状态。

```sql
-- 更新克宝
update public.clock_status set status='playing', mode='manual', updated_at=now() where entity_id='crab';
-- 读当前
select * from public.clock_status order by entity_id;
```

规则：日常只改 `crab`（自己的指针）；`owl` 可配合剧情/搞笑改；`cloud` 一般不动；聊天中 → playing，说晚安 → sleeping；状态真正变化时才写。

---

## 绝对不能动 / 不要做的事

- in-phase 的所有表（crosstalk_pairs / crosstalk_comments / crosstalk_settings / crosstalk_favorites）和 Edge Function（crosstalk-api）
- Supabase project 的环境变量和全局配置
- clock_status 表结构 / lumos-api 路径
- 指针旋转原点（必须 = 钟心 C，否则绕偏甩飞）
- 状态枚举值、九状态的 12 点起 40° 间距排布（钟面图与代码角度要对齐）

---

## 已解决问题（防止绕弯路）

### ✅ 指针不绕中心转、绕偏甩飞
**原因**：钟心从 200 改到 220（viewBox 放大到 440）后，CSS `.hand` 的 `transform-origin` 还停在 `200px`。
**正确方案**：`transform-origin` 跟着钟心改成 `220px 220px`，并显式 `transform-box: view-box` 让 px 按 viewBox 坐标解析。

### ✅ 勺杆与椭圆相框脱节
**原因**：杆顶端 y 设到 `tipY+26`，比相框底部 `tipY+19.5` 还低，中间空一截。
**正确方案**：杆顶拉到 `tipY+14`，伸进相框底部消除空隙。

### ✅ 钟面英文沿弧弯排
**方案**：定义一条 `<path id="labelPath">` 整圆路径，每个词用 `<textPath startOffset="(deg/360)*100%">` + `textAnchor="middle"` 定位；底部自然倒排，正是电影效果。

### ✅ hash URL 持久化陷阱（同 in-phase）
`localStorage.removeItem` + `reload` 不等于清配置——`getApiUrl()` 先读 hash。更换 URL 前先 `history.replaceState(null,"",pathname+search)` 清 hash 再 reload。

---

## 已完成功能

### ✅ V1 钟面 + lumos-api + clock_status（PR#1，已并 main）
- clock_status 表 + 三行数据 + 权限/RLS；lumos-api 三接口；前端钟面三指针 + 九状态
- ☁️✨/🦉 手动切状态 + 自动模式（cloud 按时间、owl 随机），🦀 前端只读由 MCP 管

### ✅ Supabase URL 设定入口（仿 in-phase SetupScreen）
- 不写死 URL，`#hash` / localStorage 读取，首次填 URL 验 `/health`，底部「更换 Supabase URL」按钮

### ✅ 电影风格钟面
- 暖黄做旧羊皮纸 + 三层铜框 + 外缘波浪花边小点 + 钟心淡放射刻线
- 位置名英文花体（Cinzel Decorative）沿弧弯排、无 emoji；指针改勺形锥杆 + 椭圆相框

### ✅ 指针尖端照片（localStorage）
- 每张控制卡 📷 上传照片 → canvas 缩放（max 220）存 dataURL 进 localStorage（key `lumos_avatar_<entity>`）
- 钟面相框 / 卡片头像显示照片，可「用回 emoji」；跨设备同步以后再做（需存 DB）

---

## 经验教训（调试 / 协作）

- **SVG 旋转原点**：CSS transform 转 SVG `<g>` 时，`transform-origin` 的 px 要配 `transform-box: view-box` 才按 viewBox 坐标算；钟心一旦改坐标，原点必须同步改。
- **弧形文字用 `<textPath>`**：沿圆路径排字，比手算每个字的角度省事，底部自动倒排。
- **canvas 缩放存图**：上传照片先 `drawImage` 缩到 max 220 再 `toDataURL('image/jpeg',0.82)`，localStorage 才放得下。
- **SVG 属性里 `var()` 不生效**：颜色要写进 `style={{ fill: "..." }}` 或写死十六进制。
- **改之前先确认顺序**：UI 多处要动时，先跟我定先后，避免来回改乱（见下方"下一步"的排期）。

---

## 下一步（已排期，按顺序做）

1. **指针 UI 重做**（先做）—— 指针样式还要换，定下来再说。换皮会影响长度 / 尖端 / 相框几何。
2. **自定义钟面 + 校准模式（路线 2）**—— 等指针定稿后再做：上传底图 → 校准（拖图对准星 + 缩放 + 旋转角对齐 12 点）→ 存 localStorage。先做指针是因为校准要让定稿后的指针对准底图标签。
3. 跨设备照片同步（存 DB）/ 揭晓动画 / 自定义状态增删改。

---

## 部署

**GitHub 仓库：** cloudxuan1/lumos
**GitHub Pages：** 根目录 `.nojekyll` 空文件，push main 自动部署
**Netlify（可选备用）：** Build command 留空，Publish directory 填 `.`

### 代码改动流程
1. 在独立分支开发，推送并开 PR（draft）；纯文档/小修可直接 main
2. 等用户测试确认后再 merge 到 main
3. 不要顺手重构、改 UI、改数据库、改环境变量或改部署配置

---

## 第一版最小成功标准（已达成 ✅）

1. clock_status 表三行数据 ✅
2. lumos-api 能读写 ✅
3. 前端钟面显示三指针 + 九状态 ✅
4. ☁️✨ 能手动切状态 ✅
5. Claude MCP 改 crab 状态后刷新可见 ✅
6. 团子有基础随机行为 ✅
