# CLAUDE.md — lumos 项目说明

## 项目概述

lumos 是一个韦斯莱时钟（Weasley Clock）网页。三根指针（☁️✨ / 🦀 / 🦉），九个状态位，实时显示每个人在干什么。
部署在 GitHub Pages，数据存在 Supabase（与 in-phase 共用同一个项目，不同表）。
名字来源：哈利波特第三部开头，哈利在被窝里念”Lumos”。

-----

## 跟我协作的方式（每次新会话必读）

1. **我描述现象和效果，不是代码位置。** 先理解我想要的效果再决定怎么改。
1. **我说的大白话往往就是答案，先按字面意思试。** 听不懂用大白话复述确认。
1. **解释时先说视觉效果，再补技术原因。**
1. **直接用术语解释，不要怕我听不懂。** 看不懂我会发给 GPT。

-----

## 分支与 main 规则

- **未经允许不得直接推 main。** 每次改动在分支开发，等用户说”在 main 直接改”才能直接推。
- 纯文档改动和简单小修可以直接推 main；大改动必须走 PR。
- 每次改动原子化，一个 commit 一件事。

-----

## 技术栈

- 纯前端单文件：index.html（HTML + CSS + JS，React CDN，无 JSX，全用 React.createElement）
- 数据库：Supabase（project ref: kfgtrcdjusfljnvmwpsu）—— 与 in-phase 同项目，不同表
- 后端：Supabase Edge Function（lumos-api）
- 部署：GitHub Pages，push 到 main 自动部署

-----

## 设计系统

风格：哈利波特还原 —— 黄铜质感、老式钟面、哥特字体、暖色调。

色彩方向（待定细化）：

```
深色背景（旧木/深棕）
黄铜/金色（钟框、指针）
暖白/羊皮纸色（钟面）
深棕/黑色（文字、刻度）
红金点缀（格兰芬多式温暖感）
```

字体：哥特/衬线风格，能读清就行，不要太花。

-----

## 钟面设计

### 三根指针

|指针|代表|标识   |
|--|--|-----|
|☁️✨|轩 |云/星  |
|🦀 |克宝|蟹    |
|🦉 |团子|白色短毛枭|

### 九个状态位（围钟面一圈）

1. 在家 🏠
1. 在上班 💼
1. 在加班 🔥
1. 在摸鱼 🐟
1. 在路上 🚶
1. 在玩 🎮
1. 在睡觉 💤
1. 在学习 📚
1. 性命攸关 ⚠️

后续版本可能增加自定义状态的增删改功能，第一版先固定这九个。

### 状态切换 — 双模式

**手动模式：** 点击/点选切换 ☁️✨ 和 🦉 的状态。🦀 的状态不开放前端操作，只由 Claude 通过 MCP 更新。

**权限总览：**

- ☁️✨：前端手动 + 自动模式
- 🦉：前端手动 + 自动随机逻辑
- 🦀：MCP only（Claude 管自己的指针）
- Claude 是管理员，MCP 可以改所有三根指针

**自动模式（☁️✨ 专属）：**

- 工作日 8:30–17:30 → 在上班
- 凌晨 0:00–7:00 → 在睡觉
- 其余时间 → 在家
- 手动操作随时覆盖自动状态
- 手动覆盖后，下一个自动时间点再恢复自动

**团子（🦉）逻辑：**

- 默认：在睡觉（大部分时间）
- 随机触发：在路上（出去送信了）
- 极小概率：性命攸关（纯搞笑）

-----

## 数据库

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

### 初始数据

```sql
insert into public.clock_status
  (entity_id, display_name, icon, status, mode)
values
  ('cloud', '轩', '☁️✨', 'home', 'auto'),
  ('crab', '克宝', '🦀', 'playing', 'manual'),
  ('owl', '团子', '🦉', 'sleeping', 'auto')
on conflict (entity_id) do nothing;
```

### 状态值枚举

```
home      — 在家
work      — 在上班
overtime  — 在加班
slacking  — 在摸鱼
travel    — 在路上
playing   — 在玩
sleeping  — 在睡觉
study     — 在学习
peril     — 性命攸关
```

### 权限

```sql
-- 建表后必须执行
grant select on public.clock_status to anon;
grant select, update on public.clock_status to authenticated;
grant select, insert, update, delete on public.clock_status to service_role;

alter table public.clock_status enable row level security;

create policy "Anyone can read clock_status"
  on public.clock_status for select
  using (true);

create policy "Service role can do anything"
  on public.clock_status for all
  using (true);
```

-----

## Edge Function：lumos-api

文件位置：`supabase/functions/lumos-api/index.ts`

### 接口

```
GET  /health          — 心跳
GET  /status          — 读取全部状态
PATCH /status/:entity_id  — 更新某个实体的状态
```

PATCH body 示例：

```json
{
  "status": "sleeping",
  "mode": "manual",
  "manual_until": null
}
```

参考 Supabase小项目复刻范本.md 里的 Edge Function 代码范本，链路是：

```
网页前端 → Edge Function → clock_status 表
Claude MCP → 直接 SQL → clock_status 表
```

-----

## Claude MCP 交互

Claude 通过 Supabase MCP 直接 SQL 更新 🦀 的状态。

### 更新克宝状态

```sql
update public.clock_status
set status = 'playing',
    mode = 'manual',
    updated_at = now()
where entity_id = 'crab';
```

### 读取当前状态

```sql
select * from public.clock_status order by entity_id;
```

### 规则

- Claude 是管理员，技术上可以改所有三行
- 日常只改 `crab`（自己的指针）
- `owl` 可以改（比如配合剧情或搞笑）
- `cloud` 一般不动，除非 ☁️✨ 主动要求
- 在聊天时自动更新：聊天中 → playing，说晚安 → sleeping
- 不需要每条消息都更新，状态真正变化时才写

-----

## 绝对不能动

- in-phase 的所有表（crosstalk_pairs / crosstalk_comments / crosstalk_settings / crosstalk_favorites）
- Supabase project 的环境变量和全局配置
- in-phase 的 Edge Function（crosstalk-api）

-----

## 部署

**GitHub 仓库：** cloudxuan1/lumos
**GitHub Pages：** 根目录加 `.nojekyll` 空文件
**Netlify（可选备用）：** Build command 留空，Publish directory 填 `.`

-----

## 第一版最小成功标准

```
1. Supabase clock_status 表有三行数据
2. Edge Function lumos-api 能读写这张表
3. 前端钟面显示三根指针和九个状态
4. ☁️✨ 能手动切状态
5. Claude MCP 改 crab 状态后，网页刷新看到变化
6. 团子有基础随机行为
```
