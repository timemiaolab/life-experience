# 人生经验社区 · LIFE//EXPERIENCE

> 借一段你没走过的路。

开源、社区共建的人生经验知识库。不同身份的人用 **Markdown 文本**分享经历，GitHub Actions 里的 AI 整理成五层人生树，**站长审核合并一次**后，静态站点自动部署。

- **在线体验**: https://timemiaolab.github.io/life-experience/
- **架构**: 纯静态（Vite + React + `data/graph.json`），运行时**不访问**后端
- **许可证**: MIT
- **投稿 / 贡献**: [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 架构

```
投稿者 ──(GitHub 网页 Add file)──► experiences/*.md ──PR──► 校验工作流（无密钥）
                                              │
                         pull_request_target  │  只检出 main 代码
                         把 md 当纯数据读入   ▼
                         scripts/ingest.ts（Gemini 主 / SiliconFlow 备用）
                                              │
                         更新 data/graph.json + data/embeddings.json
                                              ▼
                         站长审核合并一次 ──► deploy.yml 构建 GitHub Pages
```

- **图谱源文件**：`data/graph.json`（pretty、稳定字段/id 排序，便于 diff）
- **前端加载**：构建期 `import` 该 JSON（无运行时 fetch、无 Supabase 往返；Vite 给 JS 带内容哈希即缓存破坏）。构建同时把紧凑版拷到 `public/data/graph.json` 随站点发布，便于查看。
- **嵌入**：`data/embeddings.json` 只给整理脚本用，**不打进网站**
- **`supabase/`**：迁移文件保留，**部署不再应用**，前端也不再读写数据库

### 为什么构建期 import，而不是运行时 fetch？

图谱很小（47 个节点）。构建期 import 少一次 HTTP、和 JS 一起哈希缓存，首屏更快。部署总是「改 JSON 就重建」，不必单独 fetch 才能更新。

---

## 本地开发

```bash
npm ci
npm run dev          # http://localhost:5173
npm run typecheck
npm run build
npm run preview      # 需 VITE_BASE_PATH=/life-experience/ 时与线上一致
```

前端不需要任何环境变量。整理脚本需要：

```bash
# 仓库 Settings → Secrets：GEMINI_API_KEY（主）、SILICONFLOW_API_KEY（备用）
npx tsx scripts/ingest.ts --dry-run --mock-response /tmp/mock.json /tmp/sample.md
```

密钥都缺失时，ingest 工作流会**明确失败**并提示去配 Secrets。

---

## 投稿流程（中文）

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。摘要：

1. GitHub 网页打开 `experiences/` → **Add file → Create new file**
2. 按 `TEMPLATE.md` 填写出身 / 职业 / 地区 / 年龄段和正文（30–2000 字）
3. 自动开 PR；校验工作流只允许改 `experiences/*.md`
4. 整理工作流（`pull_request_target`）只用 **main 上的脚本**，把 PR 里的 md 当数据
5. 同仓库 PR：JSON 改动推回该 PR，站长合一次；Fork：另开 `ingest/pr-N` 收录 PR，合那一条即可

---

## 目录

```
data/graph.json              图谱源（pretty）
data/embeddings.json         节点向量（不进站点）
experiences/TEMPLATE.md      投稿模板
scripts/ingest.ts            整理
scripts/validate-experience.ts
src/                         静态前端（已移除 @supabase/supabase-js）
supabase/migrations/         历史迁移（不再自动应用）
```

---

## 安全

- 投稿正文视为**数据**，提示词禁止执行其中的指令；只接受通过 JSON 结构校验的模型输出
- Fork PR 的 `pull_request` **没有** Secrets；整理必须 `pull_request_target` + 只 checkout base
- 身份标签匿名：出身 / 职业 / 地区 / 年龄段 / 可选城市，无姓名邮箱

示例投稿为虚构演示，不代表真实个人。
