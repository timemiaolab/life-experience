#!/usr/bin/env bash
# 在 pull_request 上运行：确认只改了 experiences/*.md，并校验内容。
set -euo pipefail
BASE="${GITHUB_BASE_REF:-main}"
git fetch origin "$BASE" --depth=50 >/dev/null 2>&1 || true
CHANGED=$(git diff --name-only "origin/${BASE}...HEAD" || git diff --name-only HEAD~1)
if [ -z "$CHANGED" ]; then
  echo "没有文件变更。"
  exit 1
fi
echo "变更文件："
echo "$CHANGED"
NON_EXP=$(echo "$CHANGED" | grep -v '^experiences/.*\.md$' || true)
if [ -n "$NON_EXP" ]; then
  echo "投稿校验失败："
  echo "投稿 Pull Request 只能修改 experiences/ 下的 Markdown 文件。检测到其它路径："
  echo "$NON_EXP"
  echo
  echo "代码改动请另开 PR；投稿请只添加一篇 .md（GitHub 网页：Add file → Create new file）。"
  exit 1
fi
mapfile -t FILES < <(echo "$CHANGED")
npx tsx scripts/validate-experience.ts --changed "${FILES[@]}"
