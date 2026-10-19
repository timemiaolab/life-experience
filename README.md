# 人生经验社区 · LIFE//EXPERIENCE

> 借一段你没走过的路。

一个**公共、由社区共同维护**的人生经验主页（前端原型）。不同身份的人——农村出来的孩子、大山里考出来的孩子、县城和三线城市出来的年轻人、程序员、老师、护士、外卖骑手、创业者、学生……——分享自己**真实经历过的一件事**和从中学到的东西；AI 把这些故事整理成一棵五层的人生树：

```
生活&工作（领域） → 场景 → 原则 → 理念 → 人生意义
          总结 ↓ 提炼 ↓ 升华 ↓        ↑ 检查 ↑ 优化 ↑ 影响
```

这样，别人就能「借用」自己没有机会亲身经历的人生经验。

> ⚠ **示例数据声明**：`src/data/seed.ts` 中的 22 条投稿、身份与故事全部为**虚构的演示内容**，不代表任何真实个人，页面上的人数也只是这些示例投稿的计数，**不构成任何统计结论**。「有用」票数从 0 开始，不预置任何数字。

---

## 功能

| 功能 | 说明 |
| --- | --- |
| 侧栏模型图 | 纵向图：生活&工作 → 场景 → 原则 → 理念 → 人生意义，左侧正向「总结 / 提炼 / 升华」，右侧反馈「检查 / 优化 / 影响」；点击层级跳转到对应列并闪烁，数字随筛选变化 |
| 五层人生树 | 发光渐变 SVG 曲线 + 流动虚线连接各层；悬停高亮整条上下游路径，点击锁定并打开详情 |
| **身份筛选** | 出身 / 职业 / 地区 / 年龄段四个维度的多选 chip（维度内为「或」，维度间为「且」）。只显示匹配贡献者的场景，以及从这些场景可达的原则 / 理念 / 意义 |
| 支持者标注 | 每个原则 / 理念 / 意义显示「N人 · 农村出身 k」，筛选时额外显示「/共 M」；原则下方有按出身着色的分布条 |
| 详情面板 | 点击原则：支持人数、**四个维度的身份分布**、所有**原始故事**（可展开）、上下游节点；点击场景：投稿者身份与原文 |
| 「有用」投票 | 原则可投「有用」，再次点击取消（本机记录，存 localStorage） |
| **讲一件事** | 低门槛投稿：选身份标签 + 写一段大白话故事 → 「AI 整理」→ 预览确认页（可编辑场景标题/描述/领域/标签，可把每条原则改为「合并到已有某原则」或「作为新原则」，可选新原则挂到哪个理念，可调整原则与场景的对应）→ 确认后新节点「出生」动画 + 新连线描边动画，合并到的已有原则闪烁 |
| 脱敏 | 本地自动隐藏手机号、座机、邮箱、身份证号、银行卡号、微信/QQ；提示可能的真实姓名、住址、机构名 |
| 持久化 | 全部数据存 `localStorage`（key：`life-experience.v1`）；支持「导出」JSON 与「重置示例」 |

## 快速开始

需要 Node.js ≥ 20.19（已在 Node 20 / 24 下测试）。

```bash
npm install
npm run dev       # 开发服务器：http://localhost:5173
npm run build     # 类型检查 + 生产构建（输出到 dist/）
npm run preview   # 预览构建产物：http://localhost:4173
```

打开页面后点右上角 **「＋ 讲一件事」→「填入示例」→「AI 整理 ›」**，即可在不配置任何 Key 的情况下体验完整的整理 → 合并 → 确认流程（默认使用离线 mock AI）。

## 目录结构

```
life-experience/
├── index.html
├── package.json / vite.config.ts / tsconfig*.json
├── .env.example               # 真实 LLM 配置示例
├── public/favicon.svg
└── src/
    ├── main.tsx               # 入口
    ├── App.tsx                # 页面布局 & 交互状态（筛选、选中、悬停、新节点动画）
    ├── types.ts               # 领域模型：Identity / Contribution / GNode / AppData / Filter
    ├── data/
    │   ├── seed.ts            # ⚠ 示例数据（虚构）+ 「填入示例」用的故事
    │   └── identity.ts        # 身份维度与选项、出身配色
    ├── lib/
    │   └── graph.ts           # 索引、路径遍历、筛选视图、支持者统计、分层排序
    ├── ai/
    │   ├── organizer.ts       # ★ 对外入口 organize(story, identity, existingGraph)
    │   ├── types.ts           # Organizer 接口 & OrganizeResult 结构
    │   ├── mock.ts            # 离线 mock：分段 + 经验句抽取 + bigram 相似度合并
    │   ├── llm.ts             # OpenAI 兼容 chat/completions + 严格 JSON schema 校验
    │   ├── anonymize.ts       # 本地脱敏
    │   └── text.ts            # 中文字符 bigram / Dice / 分句工具
    ├── store/
    │   └── store.tsx          # React Context + useReducer，localStorage 持久化、提交、投票、导出、重置
    ├── components/
    │   ├── Sidebar.tsx        # 纵向模型图
    │   ├── FilterBar.tsx      # 身份筛选
    │   ├── TreeView.tsx       # 五层树 + SVG 连线（基于 offsetLeft/Top 计算，不受 hover/动画 transform 影响）
    │   ├── DetailPanel.tsx    # 详情面板（身份分布、原始故事、有用投票）
    │   ├── SubmitStory.tsx    # 讲一件事：填写 → AI 整理 → 预览确认
    │   └── Toast.tsx
    └── styles/app.css         # 赛博朋克主题（网格、扫描线、glitch 标题、霓虹）
```

## AI 整理是怎么工作的

统一入口 `src/ai/organizer.ts`：

```ts
organize(story: string, identity: Identity, existingGraph: AppData): Promise<OrganizeResult>
```

返回：脱敏后的原文、提醒、1–3 个场景草稿、若干原则草稿（每条为 `merge`（含 `existingId`）或 `new`（含 `ideaId`），并附相似度）。

- **默认：离线 MOCK**（`src/ai/mock.ts`，无需任何 Key）
  1. 本地脱敏；
  2. 以「还有一次 / 另外 / 此外…」切分为多个场景，用含「突然 / 第一次 / 被 / 结果…」的分句生成场景标题；
  3. 找「后来才明白 / 我才知道 / 所以 / 一定要…」所在的经验句，去掉引导语后作为候选原则；
  4. 与每条已有原则计算 **字符 bigram Dice 系数 + 关键词命中**，得分 ≥ 0.30 则合并，否则作为新原则，并挂到最相近的理念。
- **可选：真实 LLM**（`src/ai/llm.ts`）——见下一节。调用失败、超时或输出不符合 schema 时**自动回退到 mock**，并在预览页提示原因。

## 启用真实 LLM（OpenAI 兼容接口）

1. 复制配置：`cp .env.example .env.local`
2. 填写：
   ```bash
   VITE_LLM_BASE_URL=https://api.openai.com/v1   # 任意 OpenAI 兼容服务，如 DeepSeek / 通义 / Moonshot / 本地 Ollama(…/v1)
   VITE_LLM_API_KEY=sk-...
   VITE_LLM_MODEL=gpt-4o-mini
   ```
3. 重启 `npm run dev`，右上角徽标变为 `AI:LLM`。

请求为 `POST {BASE_URL}/chat/completions`，带 `response_format: { type: "json_object" }`；system prompt 内嵌严格的 JSON Schema（见 `OUTPUT_SCHEMA`），并把已有的领域 / 原则 / 理念 / 意义列表作为上下文，要求模型优先合并相似原则。返回结果会经过 `validate()` 逐字段校验（id 必须存在、数量范围、类型等）。**故事在发送前已在本地脱敏。**

> 🔐 **安全提醒（重要）**：`VITE_` 前缀的变量会被**打包进前端 JS**，任何能打开页面的人都能在浏览器里看到你的 API Key。这种方式**只适合本机演示**，请勿部署到公网。下一步应当把 LLM 调用移到后端代理（见路线图），前端只调用 `/api/organize`。另外，部分服务商不允许浏览器跨域直连（CORS），这时也需要后端代理。

## 路线图

**后端（推荐 Java 技术栈：Spring Boot 3 + PostgreSQL 16 + pgvector）**

- [ ] **API 与 LLM 代理**：`POST /api/organize`（Spring Boot 调用 LLM，Key 只在服务端，限流 + 超时 + 重试）；前端新增一个 `Organizer` 实现即可切换，无需改 UI。
- [ ] **数据模型**：`contribution`、`node`（layer 枚举）、`link`、`vote`、`identity_tag` 表；用 Flyway 管理迁移；JPA / MyBatis 均可。
- [ ] **pgvector 相似原则合并**：为原则（标题 + 描述 + 代表性场景）生成 embedding 存 `vector` 列，建 HNSW 索引；新故事的候选原则先 `ORDER BY embedding <=> :q LIMIT 5` 召回，再交给 LLM 做「合并 / 新建」判断，阈值可运营调优。
- [ ] **审核（moderation）**：投稿先进入 `PENDING`；服务端再次脱敏（正则 + NER 识别姓名/机构）、敏感词与内容安全接口、人工审核后台；原则合并需审核员确认，避免「被一条故事带偏」。
- [ ] **登录与身份**：手机号 / 微信登录（Spring Security + JWT / Sa-Token），身份标签自愿填写、只公开到「城市 + 年龄段」级别；一人一票防刷，「有用」投票服务端计数。
- [ ] **社区功能**：原则下的「我也经历过」追加故事、评论、举报；按身份订阅（如「只看大山出来的孩子」）；原则 / 理念的版本历史与合并记录。
- [ ] **前端**：分页 / 虚拟化渲染（节点多了以后）、移动端布局、可分享的筛选链接（URL 参数）、无障碍。

## 技术说明

- Vite + React 19 + TypeScript（strict），无 UI 库，纯 CSS；运行时依赖只有 `react` / `react-dom`。
- 字体栈：`Noto Sans SC, PingFang SC, Microsoft YaHei …`，等宽标签使用系统等宽字体，不依赖外网字体，离线可用。
- 连线坐标基于 `offsetLeft/offsetTop` 计算并在尺寸变化（ResizeObserver）、筛选、详情面板开合时重算。
