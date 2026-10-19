#!/usr/bin/env bash
# 投稿校验：
# - 未改 experiences/*.md → 成功跳过（代码 PR 保持绿灯）
# - 同时改了代码和 experiences/ → 视为代码 PR，跳过「只能改投稿」规则
# - 只改 experiences/*.md → 强制恰好一篇合法 Markdown
set -euo pipefail
BASE="${BASE_REF:-${GITHUB_BASE_REF:-main}}"
if ! [[ "$BASE" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "非法 BASE_REF"
  exit 1
fi
git fetch origin "$BASE" --depth=50 >/dev/null 2>&1 || true
CHANGED=$(git diff --name-only "origin/${BASE}...HEAD" || git diff --name-only HEAD~1 || true)
if [ -z "$CHANGED" ]; then
  echo "没有文件变更，跳过投稿校验。"
  exit 0
fi
echo "变更文件："
echo "$CHANGED"
EXP=$(echo "$CHANGED" | grep -E '^experiences/.*\.md$' || true)
NON_EXP=$(echo "$CHANGED" | grep -v -E '^experiences/.*\.md$' || true)
if [ -z "$EXP" ]; then
  echo "没有 experiences/*.md 变更，跳过投稿校验。"
  exit 0
fi
if [ -n "$NON_EXP" ]; then
  echo "本 PR 同时改了非投稿文件，视为代码 PR，跳过「只能改 experiences/*.md」规则。"
  exit 0
fi
mapfile -t FILES < <(echo "$EXP")
if [ "${#FILES[@]}" -ne 1 ]; then
  echo "投稿校验失败："
  echo "投稿 Pull Request 一次只能新增/修改一篇 experiences/*.md，当前 ${#FILES[@]} 篇。"
  exit 1
fi
npx tsx scripts/validate-experience.ts --changed "${FILES[@]}"
