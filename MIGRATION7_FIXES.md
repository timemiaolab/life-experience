# Migration 7 Fixes - Final Summary

**Commit**: 4b92b9f - fix: migration 7 - avoid DROP is_admin, fix grants order, ensure idempotency  
**Status**: Ready for live deployment

---

## ✅ All Issues Fixed

### 1. DROP is_admin() Dependency Error
**Problem**: `cannot drop function is_admin() because other objects depend on it` (RLS policies use it)

**Fix**: Use `CREATE OR REPLACE FUNCTION is_admin() ... SET search_path = public` instead of DROP+CREATE
- Line 24: Changed from DROP FUNCTION to CREATE OR REPLACE
- Preserves existing function dependencies (policies)
- Adds `SET search_path = public` as required

### 2. REVOKE/GRANT Order for refresh_vote_counts
**Problem**: REVOKE/GRANT were wiped when function was recreated

**Fix**: Moved REVOKE/GRANT statements AFTER DROP+CREATE
- Lines 203-204: REVOKE/GRANT now come after function creation
- Ensures permissions are applied to the new function

### 3. Insufficient REVOKE for anon
**Problem**: Supabase grants anon directly, so PUBLIC-only revoke isn't enough

**Fix**: Explicitly revoke from anon and PUBLIC
- Line 203: `REVOKE ... FROM PUBLIC, anon, authenticated`
- Lines 218-219: `REVOKE ... FROM PUBLIC, anon`
- Line 231: `REVOKE SELECT ON vote_counts FROM PUBLIC, anon, authenticated`

### 4. public_vote_counts Security Definer Warning
**Problem**: View without security_invoker triggers advisor warning

**Fix**: Added `WITH (security_invoker = true)` to view definition
- Line 236: `CREATE VIEW public_vote_counts WITH (security_invoker = true)`
- View now runs with caller's permissions (safe for anon access)

### 5. Idempotency - Policy Already Exists
**Problem**: Second run fails on "policy already exists"

**Fix**: Added DROP for both old and new policy names
- Line 209: `DROP POLICY IF EXISTS "Anyone can delete own votes"`
- Line 210: `DROP POLICY IF EXISTS "Users can delete own votes"`
- Handles migration from old to new policy name

### 6. Migration 5 - Schema/Table Order
**Problem**: CREATE TABLE before CREATE SCHEMA (cosmetic issue)

**Fix**: Reordered statements in 20240101000005
- Line 6: `CREATE SCHEMA` now comes first
- Line 9: `CREATE TABLE` comes after schema creation

### 7. deploy.yml - Tracking Insert Failure
**Problem**: Warning on tracking insert failure, should be critical error

**Fix**: Changed to `exit 1` if tracking row insert fails
- Critical failure now stops deployment
- Prevents silent migration tracking corruption

---

## 🧪 Verification Summary

### Local Testing with PostgreSQL 16 + pgvector
```bash
# Environment
- PostgreSQL 16.15 (Ubuntu)
- pgvector 0.6.0
- Mock auth schema created

# Tests Performed
✅ All migrations 0-7 applied successfully
✅ Idempotency: Applied all migrations twice (migration 7 tested after fixes)
✅ Seed counts verified: 3 areas, 25 scenes, 11 principles, 5 ideas, 3 meanings, 83 links
✅ TypeScript typecheck: PASS
✅ Vite build: PASS (507.36 kB)
```

### RLS Policy Tests (As anon role)
```sql
✅ Can read nodes (47 nodes)
✅ Can read links (83 links)
✅ CANNOT insert nodes (permission denied - expected)
✅ CANNOT read submissions (insufficient privilege - expected)
✅ CANNOT read vote_counts materialized view (insufficient privilege - expected)
✅ CAN read public_vote_counts view (works as expected)
✅ CAN call submit_story RPC (creates contributor + submission)
✅ CANNOT call approve_proposal (insufficient privilege - expected)
```

---

## 📦 Migration 7 Changes

**File**: `supabase/migrations/20240101000007_security_fixes.sql`

### Key Changes:
1. **Line 24**: `CREATE OR REPLACE FUNCTION is_admin()` (not DROP)
2. **Lines 38-202**: Recreate approve_proposal and reject_proposal functions
3. **Lines 185-204**: refresh_vote_counts with admin check, REVOKE/GRANT after creation
4. **Lines 209-213**: Votes DELETE policy with both DROP statements
5. **Lines 218-219**: REVOKE from PUBLIC and anon explicitly
6. **Lines 231-238**: Secure vote_counts, create public_vote_counts with security_invoker
7. **Lines 241-249**: Comments for all functions

---

## 🔧 Deployment Instructions

### Option A: Apply Migration 7 Manually (Recommended First Time)
In Supabase Dashboard → SQL Editor:
1. Copy contents of `supabase/migrations/20240101000007_security_fixes.sql`
2. Paste and run
3. Verify: `SELECT * FROM supabase_migrations.schema_migrations WHERE version LIKE '%0007%';`

### Option B: Let GitHub Actions Apply It
- Merge PR #1
- GitHub Actions will automatically apply migration 7
- Check Actions tab for status

### Verification After Deployment
```sql
-- 1. Check all migrations applied
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- Should show: 20240101000000 through 20240101000007

-- 2. Test anon can't read submissions
SET ROLE anon;
SELECT count(*) FROM submissions;  -- Should fail: insufficient privilege
RESET ROLE;

-- 3. Test anon can't read vote_counts
SET ROLE anon;
SELECT count(*) FROM vote_counts;  -- Should fail: insufficient privilege
RESET ROLE;

-- 4. Test anon CAN read public_vote_counts
SET ROLE anon;
SELECT count(*) FROM public_vote_counts;  -- Should work
RESET ROLE;

-- 5. Test submit_story RPC
SET ROLE anon;
SELECT submit_story(
  '{"origin":"验证","profession":"验证","region":"验证","age":"验证"}'::jsonb,
  '验证故事提交功能是否正常工作。需要至少三十个字符。'
);
-- Should return: sub_xxxxx
RESET ROLE;
```

---

## 📊 File Changes

### Modified (3 files)
```
supabase/migrations/20240101000005_migration_tracking.sql  # Reordered: schema before table
supabase/migrations/20240101000007_security_fixes.sql      # All fixes listed above
.github/workflows/deploy.yml                               # Fail on tracking insert error
```

### Added (2 files)
```
FIXES_SUMMARY.md           # Comprehensive fix documentation
supabase/test_setup.sql    # Mock Supabase environment for local testing
```

---

## ✅ Ready for Production

All migration 7 issues resolved:
- ✅ No DROP of is_admin()
- ✅ REVOKE/GRANT order fixed
- ✅ Explicit revokes from anon
- ✅ security_invoker view
- ✅ Idempotent (both policy names dropped)
- ✅ CI passing
- ✅ Tested with real PostgreSQL + pgvector

**Next**: Apply migration 7 to live database (see deployment instructions above)

**PR**: https://github.com/timemiaolab/life-experience/pull/1  
**Commits**: 
- e71a3ee - Initial Phase 1
- 2c86ea7 - Fixes round 1
- 4b92b9f - Migration 7 fixes (this update)
