# 贡献指南 · CONTRIBUTING

感谢你愿意把走过的路借给后来的人。本仓库是**纯静态**站点：经历用 Markdown 投稿，AI 在 GitHub Actions 里整理进 `data/graph.json`，站长审核合并后自动部署。

---

## 投稿一篇经历（给非程序员）

请只提交**经历文本**，不要提交代码。

1. 打开仓库：https://github.com/timemiaolab/life-experience  
2. 进入 [`experiences/`](https://github.com/timemiaolab/life-experience/tree/main/experiences) 目录  
3. 点 **Add file → Create new file**  
4. 文件名例如：`2026-10-19-被裁员时卡里没钱.md`（不要叫 `TEMPLATE.md`）  
5. 把 [`TEMPLATE.md`](./experiences/TEMPLATE.md) 的内容复制进去，填写 YAML 头和正文（30–2000 字）  
6. 提交：GitHub 网页会**自动打开 Pull Request**

YAML 头字段：

| 字段 | 中文 | 说明 |
| --- | --- | --- |
| `title` | 标题 | 一句话 |
| `origin` / `出身` | 出身 | 农村 / 大山 / 县城 / 三线城市 / 二线城市 / 一线城市 |
| `profession` / `职业` | 职业 | 可自填 |
| `region` / `地区` | 地区 | 华北 / 华东 / 华南 / 华中 / 西南 / 西北 / 东北 |
| `age` / `年龄段` | 年龄段 | 00后 / 95后 / 90后 / 85后 / 80后 / 70后 |
| `city` | 城市 | 可选 |

投稿 PR **只能改** `experiences/*.md`。校验工作流不需要密钥；失败时会用中文说明原因。

### 站长审核一次即可

- **同一仓库的分支 PR**：整理脚本会把 `data/graph.json` 的改动推回这条 PR。你只审查、合并这一条。  
- **Fork PR**：脚本用 `pull_request_target` **只检出 main 上的代码**，把投稿 md 当纯数据读入，在本仓库开一条 `ingest/pr-编号` 收录 PR（含 md + 图谱 JSON）。请合并收录 PR，原投稿 PR 可关闭。  
- Fork PR **拿不到** API 密钥，所以整理必须走 `pull_request_target`，且绝不执行投稿分支里的代码。

合并 main 之后，`deploy.yml` 会重新构建并发布 GitHub Pages。

---

## 改代码

1. Fork / 拉分支（不要和投稿混在同一个 PR）  
2. `npm ci && npm run dev`  
3. `npm run typecheck && npm run build`  
4. 打开 Pull Request，走 CI

图谱源文件是 `data/graph.json`（pretty、稳定排序）。构建时会复制一份紧凑版到站点；前端在**构建期 import** 这份 JSON（无额外请求，哈希随 JS 缓存）。`data/embeddings.json` 只给整理脚本用，**不会**打进网站。

本地试整理（不会写仓库，除非去掉 `--dry-run`）：

```bash
cp experiences/TEMPLATE.md /tmp/sample.md
# 改 /tmp/sample.md 后：
npx tsx scripts/ingest.ts --dry-run --mock-response /tmp/mock-extract.json /tmp/sample.md
```

需要真实模型时，在仓库 Secrets 配置 `GEMINI_API_KEY`（主）和 `SILICONFLOW_API_KEY`（备用）。都缺失时工作流会明确失败。

---

## 数据库迁移

`supabase/migrations/` 已保留，但**部署不再应用迁移**，前端也不再访问 Supabase。
