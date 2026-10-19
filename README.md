# 人生经验社区 · LIFE//EXPERIENCE

> 借一段你没走过的路。

**开源、社区共建的人生经验知识库**。不同身份的人分享真实经历，AI 整理成五层人生树，管理员审核后公开。完全免费：Supabase 免费层 + 无服务器部署。

- **在线体验**: https://timemiaolab.github.io/life-experience/
- **项目状态**: Phase 1 已完成（Supabase 后端 + GitHub Pages 部署）
- **技术栈**: Vite 8 + React 19 + TypeScript (strict) + Supabase + GitHub Actions
- **许可证**: MIT
- **贡献指南**: [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## ✨ 特性

### Phase 1（当前版本）

- ✅ **Supabase 后端**：pgvector + RLS + 迁移管理
- ✅ **五层人生树**：生活&工作 → 场景 → 原则 → 理念 → 人生意义
- ✅ **身份筛选**：出身 / 职业 / 地区 / 年龄段（匿名，无 PII）
- ✅ **AI 整理**：离线 mock（无需 Key）或真实 LLM（本地开发）
- ✅ **提交故事**：匿名提交到 Supabase，等待 AI 整理和审核
- ✅ **CI/CD**：GitHub Actions 自动构建、部署到 GitHub Pages、应用数据库迁移
- ✅ **离线可用**：未配置 Supabase 时回退到本地示例数据

### Phase 2（规划中）

- 🔄 **Edge Function AI 流水线**：Gemini API + SiliconFlow 备用（已配置 secrets）
- 🔄 **pgvector 相似度合并**：嵌入向量 + HNSW 索引优化原则合并
- 🔄 **管理员审核控制台**：批准/拒绝提案，原子写入图
- 🔄 **防垃圾**：Cloudflare Turnstile + 内容安全检查

### Phase 3（未来）

- ⏳ 「有用」投票（服务端计数）
- ⏳ 全文搜索
- ⏳ 可分享的筛选链接

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────┐
│  GitHub Pages (前端)                                 │
│  React 19 + Vite 8 + TypeScript                    │
│  - 赛博朋克主题 UI                                   │
│  - 五层树可视化 (SVG)                                │
│  - 身份筛选 + 详情面板                               │
│  - 离线 mock AI（本地启发式）                        │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS (anon JWT)
                  ▼
┌─────────────────────────────────────────────────────┐
│  Supabase (免费层)                                   │
│  - PostgreSQL 16 + pgvector (768 维)                │
│  - RLS 策略（anon 只读 + 插入提交）                  │
│  - Edge Functions (Phase 2: AI 整理)                │
│  - Management API (迁移应用)                        │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 前置要求

- Node.js >= 20.19
- Git

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/timemiaolab/life-experience.git
cd life-experience

# 安装依赖
npm install

# 启动开发服务器
npm run dev
# 访问 http://localhost:5173

# 类型检查
npm run typecheck

# 生产构建
npm run build
npm run preview
```

### 环境变量

复制 `.env.example` 为 `.env.local`（本地开发可选）：

```bash
cp .env.example .env.local
```

**Supabase 配置**（生产环境已内置）：
```bash
VITE_SUPABASE_URL=https://fivighqyyxlhjhicuwvv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdmlnaHF5eXhsaGpoaWN1d3Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzQ5MDQsImV4cCI6MjEwNzk1MDkwNH0.Yu3o2jvrBa4VTC5dpIajjNBJltUyxkyKLze9PhxB5Uw
```

**LLM 配置**（可选，仅本地开发，生产环境使用 Edge Function）：
```bash
VITE_LLM_BASE_URL=https://api.openai.com/v1
VITE_LLM_API_KEY=sk-...
VITE_LLM_MODEL=gpt-4o-mini
```

> ⚠️ **安全提醒**: `VITE_` 前缀会打包进前端 JS，不要在生产环境暴露 API Key！Phase 2 将 LLM 调用移到 Edge Function。

### 本地验证 Supabase 迁移

使用 Docker + PostgreSQL 16 + pgvector：

```bash
# 启动 PostgreSQL
docker run --name life-exp-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=life_experience \
  -p 5432:5432 \
  -d ankane/pgvector:latest

# 应用迁移
for f in supabase/migrations/*.sql; do
  echo "Applying $f..."
  docker exec -i life-exp-pg psql -U postgres -d life_experience < "$f"
done

# 验证
docker exec -it life-exp-pg psql -U postgres -d life_experience \
  -c "SELECT layer, count(*) FROM nodes GROUP BY layer ORDER BY layer;"

# 清理
docker stop life-exp-pg && docker rm life-exp-pg
```

详见 [`supabase/README.md`](./supabase/README.md)。

---

## 📦 部署

### 自动部署（推荐）

推送到 `main` 分支时，GitHub Actions 自动：

1. ✅ 构建前端并部署到 GitHub Pages
2. ✅ 应用新的 Supabase 迁移（需配置 secrets）

### 手动配置步骤（仓库所有者）

#### 1. 启用 GitHub Pages

在仓库 **Settings > Pages**：
- Source: **GitHub Actions**

#### 2. 添加 Repository Secrets

在仓库 **Settings > Secrets and variables > Actions**，添加：

- **`SUPABASE_ACCESS_TOKEN`** （必需）
  - 从 [Supabase Dashboard > Account > Access Tokens](https://supabase.com/dashboard/account/tokens) 获取
  - 权限：需要 `projects:write` 以应用迁移
  - 用途：通过 Management API 执行迁移 SQL

如果 secrets 未配置，部署工作流会跳过迁移并显示警告。

#### 3. 推送触发部署

```bash
git push origin main
```

查看部署状态：
- **Actions** 标签页
- 部署成功后访问：`https://<username>.github.io/life-experience/`

---

## 🗂️ 目录结构

```
life-experience/
├── .github/
│   └── workflows/
│       ├── ci.yml              # PR 检查：typecheck + build
│       └── deploy.yml          # 部署：GitHub Pages + 迁移
├── supabase/
│   ├── config.toml             # Supabase 本地配置
│   ├── migrations/             # 数据库迁移（按顺序应用）
│   │   ├── 20240101000000_enable_pgvector.sql
│   │   ├── 20240101000001_create_core_tables.sql
│   │   ├── 20240101000002_setup_rls_policies.sql
│   │   ├── 20240101000003_approval_functions.sql
│   │   └── 20240101000004_seed_demo_data.sql
│   └── README.md               # 迁移说明和 RLS 策略
├── src/
│   ├── ai/                     # AI 整理引擎
│   │   ├── organizer.ts        # 统一入口
│   │   ├── mock.ts             # 离线启发式
│   │   ├── llm.ts              # OpenAI 兼容接口
│   │   ├── anonymize.ts        # 本地脱敏
│   │   └── types.ts
│   ├── components/
│   │   ├── FilterBar.tsx       # 身份筛选
│   │   ├── TreeView.tsx        # 五层树 + SVG 连线
│   │   ├── DetailPanel.tsx     # 详情 + 投票
│   │   ├── SubmitStory.tsx     # 讲一件事表单
│   │   └── Sidebar.tsx         # 模型图
│   ├── data/
│   │   ├── seed.ts             # 示例数据（虚构）
│   │   └── identity.ts         # 身份维度定义
│   ├── lib/
│   │   ├── graph.ts            # 图索引 + 筛选 + 路径遍历
│   │   ├── supabase.ts         # Supabase 客户端
│   │   └── api.ts              # Supabase API 调用
│   ├── store/
│   │   └── store.tsx           # React Context + Supabase 集成
│   ├── styles/
│   │   └── app.css             # 赛博朋克主题
│   ├── App.tsx                 # 主应用
│   ├── main.tsx                # 入口
│   └── types.ts                # 领域模型
├── .env.example                # 环境变量示例
├── package.json
├── vite.config.ts
├── tsconfig.json
├── README.md                   # 本文件
├── CONTRIBUTING.md             # 贡献指南
└── LICENSE                     # MIT
```

---

## 🔐 安全与隐私

### 数据隐私

- ✅ **无 PII**：只存储身份标签（出身 / 职业 / 地区 / 年龄段），不收集姓名、邮箱、手机号等
- ✅ **匿名提交**：提交时本地脱敏（正则 + 提示），存储前服务端再次脱敏（Phase 2）
- ✅ **审核机制**：所有提交需管理员审核后才公开

### 数据库安全

- ✅ **RLS (Row Level Security)**：匿名用户只能读取已审核数据和插入提交
- ✅ **SECURITY DEFINER 函数**：原子批准提案，防止部分写入
- ✅ **公开密钥**：前端只使用 `anon` JWT，无写入已审核数据权限
- 🔒 **Service Role Key**：仅服务端（Edge Function、CI/CD）持有

---

## 🛠️ 技术说明

### 前端

- **框架**: Vite 8 + React 19 + TypeScript (strict)
- **样式**: 纯 CSS（无 UI 库），赛博朋克主题
- **字体**: 系统字体栈（Noto Sans SC / PingFang SC），无外网依赖
- **SVG 连线**: 基于 `offsetLeft/offsetTop` 计算，ResizeObserver 自动更新

### 后端

- **数据库**: Supabase PostgreSQL 16 + pgvector (768 维)
- **嵌入模型**: Gemini text-embedding-004 (outputDimensionality=768)
  - 注意：BGE-m3 使用 1024 维，本项目为了兼容 Gemini 选择 768 维
- **Edge Functions**: Deno + Supabase Functions CLI (Phase 2)
- **迁移管理**: SQL 文件 + Management API + 追踪表

### AI 整理

- **Phase 1**: 前端本地 mock（启发式分句 + bigram 相似度）或可选 LLM
- **Phase 2**: Edge Function 调用 Gemini API（主） + SiliconFlow（备用）
  - Secrets 已配置：`GEMINI_API_KEY`, `SILICONFLOW_API_KEY`, `SILICONFLOW_BASE_URL=https://api.siliconflow.com/v1`

---

## 📋 路线图

### ✅ Phase 1：Supabase 后端 + 部署（已完成）

- [x] Supabase 迁移（pgvector + RLS + 审核函数）
- [x] 前端读取已审核图数据
- [x] 提交故事到 Supabase
- [x] GitHub Actions CI/CD
- [x] GitHub Pages 部署
- [x] 本地迁移验证文档

### 🔄 Phase 2：Edge Function AI 流水线

- [ ] Edge Function：`POST /functions/v1/organize`
  - Gemini API（主，已配置 `GEMINI_API_KEY`）
  - SiliconFlow 备用（已配置 `SILICONFLOW_API_KEY` + `SILICONFLOW_BASE_URL`）
- [ ] pgvector 相似度搜索优化合并
- [ ] 管理员审核控制台（React 前端）
- [ ] Cloudflare Turnstile 防垃圾
- [ ] 服务端二次脱敏（NER + 敏感词）

### ⏳ Phase 3：社区功能

- [ ] 「有用」投票（服务端计数）
- [ ] 全文搜索（PostgreSQL `tsvector`）
- [ ] 可分享筛选链接（URL 参数）
- [ ] 移动端优化
- [ ] 无障碍支持

---

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

**快速链接**：
- [Issue Tracker](https://github.com/timemiaolab/life-experience/issues)
- [Pull Requests](https://github.com/timemiaolab/life-experience/pulls)
- [Discussions](https://github.com/timemiaolab/life-experience/discussions)

---

## 📄 许可证

MIT © 2026 [timemiaolab](https://github.com/timemiaolab)

---

## ⚠️ 示例数据声明

`src/data/seed.ts` 和 `supabase/migrations/20240101000004_seed_demo_data.sql` 中的所有投稿、身份与故事均为**虚构的演示内容**，不代表任何真实个人，不构成任何统计结论。页面上的人数也只是这些示例投稿的计数，不具有统计意义。
