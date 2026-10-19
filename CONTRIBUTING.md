# 贡献指南 · CONTRIBUTING

感谢你考虑为「人生经验社区」贡献！这是一个开源、社区共建的项目，我们欢迎所有形式的贡献。

---

## 🌟 如何贡献

### 1. 报告 Bug

在 [Issues](https://github.com/timemiaolab/life-experience/issues) 页面创建新 issue，包括：
- **环境信息**：浏览器版本、操作系统、Node.js 版本（如涉及构建）
- **复现步骤**：详细的操作步骤
- **预期行为**：你期望发生什么
- **实际行为**：实际发生了什么
- **截图/日志**（可选）

### 2. 功能建议

在 [Discussions](https://github.com/timemiaolab/life-experience/discussions) 或 Issues 中提出：
- **用例**：描述你想解决的问题
- **提议方案**：你的想法（技术细节可选）
- **替代方案**：其他可能的实现方式

### 3. 提交代码

1. **Fork 仓库**并克隆到本地：
   ```bash
   git clone https://github.com/YOUR_USERNAME/life-experience.git
   cd life-experience
   git checkout -b feature/your-feature-name
   ```

2. **安装依赖**：
   ```bash
   npm install
   ```

3. **开发**：
   ```bash
   npm run dev
   # 访问 http://localhost:5173
   ```

4. **测试**：
   ```bash
   # 类型检查
   npm run typecheck
   
   # 构建测试
   npm run build
   npm run preview
   ```

5. **提交**：
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**：
   - 标题简洁明了，如 `feat: add identity filter reset button`
   - 描述改动内容、动机、相关 issue
   - 确保 CI 通过（typecheck + build）

---

## 📐 开发规范

### 代码风格

- **TypeScript**: 严格模式（`strict: true`），避免 `any`
- **React**: 函数组件 + Hooks，避免类组件
- **命名**:
  - 组件：PascalCase (`FilterBar.tsx`)
  - 函数/变量：camelCase (`buildIndex`, `nodeId`)
  - 常量：UPPER_SNAKE_CASE (`STORE_KEY`)
  - 类型：PascalCase (`AppData`, `GNode`)
- **注释**:
  - 函数头部用 JSDoc 注释复杂逻辑
  - 避免显而易见的注释（如 `// set x to 5`）
  - 用中文或英文都可，保持一致

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响逻辑）
- `refactor`: 重构（不改变功能）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链配置

**示例**：
```
feat(filter): add reset button to clear all filters

- Add a reset icon button next to filter bar
- Clear all selected chips on click
- Update FilterBar component tests

Closes #42
```

### 文件结构

- **组件**: `src/components/` - 每个组件一个文件
- **工具函数**: `src/lib/` - 纯函数，无副作用
- **类型定义**: `src/types.ts` 或组件文件内
- **样式**: `src/styles/app.css` - 统一 CSS 文件，按模块分块
- **迁移**: `supabase/migrations/` - 命名格式 `YYYYMMDDHHMMSS_description.sql`

---

## 🗃️ 数据库迁移

### 创建新迁移

1. **命名规则**：`YYYYMMDDHHMMSS_description.sql`
   ```bash
   # 例如
   supabase/migrations/20240102103000_add_user_preferences.sql
   ```

2. **幂等性**：迁移必须可以安全地多次运行
   ```sql
   -- ✅ 好
   CREATE TABLE IF NOT EXISTS my_table (...);
   ALTER TABLE my_table ADD COLUMN IF NOT EXISTS my_column TEXT;
   
   -- ❌ 坏
   CREATE TABLE my_table (...);
   ALTER TABLE my_table ADD COLUMN my_column TEXT;
   ```

3. **RLS 策略**：
   ```sql
   DROP POLICY IF EXISTS "policy_name" ON table_name;
   CREATE POLICY "policy_name" ON table_name ...;
   ```

4. **测试**：
   ```bash
   # 本地 Docker 验证
   docker run --name test-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d ankane/pgvector
   docker exec -i test-pg psql -U postgres < supabase/migrations/YOUR_MIGRATION.sql
   
   # 验证结果
   docker exec -it test-pg psql -U postgres -c "\d your_table"
   
   # 清理
   docker stop test-pg && docker rm test-pg
   ```

5. **提交**：迁移文件和相关前端代码一起提交

---

## 🎨 UI/UX 贡献

### 设计原则

- **赛博朋克主题**：霓虹色（cyan / magenta / violet）、网格背景、扫描线
- **无障碍**：足够的对比度、键盘导航、屏幕阅读器友好
- **性能**：大数据集下流畅（虚拟化、节流、防抖）
- **移动端友好**：响应式布局（Phase 3）

### 颜色变量

在 `src/styles/app.css` 中定义：
```css
--bg: #050811;       /* 深蓝黑背景 */
--cyan: #00f0ff;     /* 青色主题色 */
--mag: #ff2bd6;      /* 品红强调色 */
--vio: #b066ff;      /* 紫色次强调色 */
--grn: #09f582;      /* 绿色成功色 */
--yel: #fcee0a;      /* 黄色警告色 */
```

---

## 🧪 测试（Phase 2+）

目前没有自动化测试，贡献测试基础设施非常欢迎！

**优先级**：
1. **E2E 测试**：Playwright 覆盖关键用户流程（提交故事、筛选、投票）
2. **单元测试**：Vitest 覆盖纯函数（`lib/graph.ts`, `ai/text.ts`）
3. **组件测试**：React Testing Library

---

## 📚 文档贡献

- **README.md**: 项目概览、快速开始、部署
- **supabase/README.md**: 数据库结构、迁移说明、RLS 策略
- **代码注释**: JSDoc 注释复杂函数
- **示例**: `src/data/seed.ts` 中的示例数据

---

## 🤔 需要帮助？

- **技术问题**: 在 [Discussions > Q&A](https://github.com/timemiaolab/life-experience/discussions/categories/q-a) 提问
- **设计讨论**: 在 [Discussions > Ideas](https://github.com/timemiaolab/life-experience/discussions/categories/ideas) 分享
- **实时交流**: [Issue 评论区](https://github.com/timemiaolab/life-experience/issues)

---

## 🙏 致谢

感谢所有贡献者！你的每一次提交、每一个 issue、每一次讨论都在让这个社区更好。

- 贡献者列表: [Contributors](https://github.com/timemiaolab/life-experience/graphs/contributors)
- 特别感谢: 所有提供反馈和建议的用户

---

## 📄 许可证

通过贡献代码，你同意将你的贡献按照 MIT 许可证授权给本项目。
