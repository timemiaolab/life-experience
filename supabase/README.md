# Supabase Backend（已停用运行时）

> **2026-10：** 站点改为纯静态。前端不再读写 Supabase；GitHub Pages 的 `deploy.yml` **不再应用本目录迁移**。保留迁移文件仅作历史与数据参考，请勿在新流程中依赖这些表。

# Supabase Backend

人生经验社区的 Supabase 后端配置和数据库迁移。

## 项目信息

- **项目引用 (Ref)**: `fivighqyyxlhjhicuwvv`
- **项目 URL**: `https://fivighqyyxlhjhicuwvv.supabase.co`
- **嵌入向量维度**: 768
  - 兼容：Gemini text-embedding-004 (outputDimensionality=768)
  - 注意：BGE-m3 使用 1024 维，本项目选择 768 维以支持 Gemini API

## 数据库结构

### 核心表

1. **contributors** - 贡献者身份标签（无 PII）
   - 字段：origin, profession, region, age, city（可选）
   
2. **nodes** - 五层图节点（area / scene / principle / idea / meaning）
   - 字段：id, layer, title, description, tag, keywords[], contribution_id
   
3. **principle_embeddings** - 原则的嵌入向量（用于相似度合并）
   - 字段：principle_id, embedding (vector 768), embedding_model
   - 索引：HNSW 索引用于余弦相似度搜索
   
4. **links** - 层级间的有向边
   - 字段：from_id, to_id
   - 唯一约束：(from_id, to_id)
   
5. **submissions** - 用户提交的原始故事
   - 字段：id, contributor_id, story, status, ai_output (jsonb)
   - 状态：pending / processing / ai_done / approved / rejected
   
6. **proposals** - AI 整理后等待审核的合并提案
   - 字段：id, submission_id, proposal_data (jsonb), approved, reviewed_by
   
7. **votes** - 「有用」投票
   - 字段：principle_id, voter_fingerprint
   - 唯一约束：(principle_id, voter_fingerprint)
   
8. **admins** - 管理员授权表
   - 字段：user_id (UUID), email

### 物化视图

- **vote_counts** - 原则的投票统计（缓存）
  - 使用 `refresh_vote_counts()` 函数刷新

## RLS 安全策略

### 匿名用户（anon）
- ✅ 可以读取所有已审核的图数据（contributors, nodes, links, embeddings, vote_counts）
- ✅ 可以插入 submissions（但不能读取其他人的提交）
- ✅ 可以插入/删除 votes（通过 fingerprint 防重）
- ❌ 不能修改已审核的图数据
- ❌ 不能读取/修改 proposals

### 管理员
- ✅ 所有匿名用户权限
- ✅ 可以读取所有 submissions 和 proposals
- ✅ 可以更新 submissions 和 proposals
- ✅ 可以插入/更新 nodes, links, embeddings（通过审核流程）
- ✅ 可以授予其他用户管理员权限

## 迁移文件

迁移文件按顺序应用，每个迁移都是**幂等的**（可以安全地多次运行）：

1. **20240101000000_enable_pgvector.sql** - 启用 pgvector 扩展
2. **20240101000001_create_core_tables.sql** - 创建核心表和索引
3. **20240101000002_setup_rls_policies.sql** - 设置 RLS 策略
4. **20240101000003_approval_functions.sql** - 审核流程的 SECURITY DEFINER 函数
5. **20240101000004_seed_demo_data.sql** - 导入示例数据（标记为 demo=true）
6. **20240101000005_migration_tracking.sql** - 迁移追踪表（防止重复执行）
7. **20240101000006_submit_story_rpc.sql** - 提交故事的 RPC 函数（anon 可调用）
8. **20240101000007_security_fixes.sql** - 安全修复（RLS、函数权限、auth.uid()）

## 本地验证

### 使用 Docker + PostgreSQL + pgvector

```bash
# 启动 PostgreSQL 16 with pgvector
docker run --name life-exp-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=life_experience \
  -p 5432:5432 \
  -d ankane/pgvector:latest

# 等待数据库启动
sleep 5

# 应用迁移
for f in supabase/migrations/*.sql; do
  echo "Applying $f..."
  docker exec -i life-exp-pg psql -U postgres -d life_experience < "$f"
done

# 验证表结构
docker exec -it life-exp-pg psql -U postgres -d life_experience \
  -c "\dt" \
  -c "SELECT count(*) FROM nodes;" \
  -c "SELECT layer, count(*) FROM nodes GROUP BY layer ORDER BY layer;"
```

### 使用 Supabase CLI（如果已安装）

```bash
# 启动本地 Supabase
supabase start

# 迁移会自动应用
supabase db reset

# 查看迁移状态
supabase migration list
```

### RLS 策略验证

```sql
-- 测试匿名用户只能读取已审核数据
SET ROLE anon;

-- 应该成功
SELECT count(*) FROM nodes;
SELECT count(*) FROM links;

-- 应该返回空（因为没有自己的提交）
SELECT count(*) FROM submissions;

-- 应该失败（没有权限）
INSERT INTO nodes (id, layer, title) VALUES ('test', 'area', 'Test');

-- 切换回 postgres 角色
RESET ROLE;
```

## 生产部署

**已停用。** `deploy.yml` 只构建静态前端并发布 GitHub Pages，**不再应用本目录迁移**。保留文件仅作历史参考。

## 审核函数

### approve_proposal(proposal_id, admin_user_id)

原子地批准一个提案，将其数据写入图：
- 插入 contributor（如果不存在）
- 插入 nodes
- 插入 links
- 更新 proposal.approved = true
- 更新 submission.status = 'approved'

### reject_proposal(proposal_id, admin_user_id, reason)

拒绝一个提案：
- 更新 proposal.approved = false
- 更新 submission.status = 'rejected'
- 记录拒绝原因

## Phase 2 预览

Phase 2 将添加：
- Edge Function 用于 AI 整理（调用 Gemini/SiliconFlow API）
- 管理员审核控制台（React 前端）
- pgvector 相似度搜索优化合并
- Cloudflare Turnstile 反垃圾
