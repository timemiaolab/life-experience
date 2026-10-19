#!/usr/bin/env npx tsx
/**
 * PR 校验：投稿 PR 只能改 experiences/*.md，且 front matter / 字数合法。
 * 无 secrets。失败时打印中文原因。
 *
 *   npx tsx scripts/validate-experience.ts --changed file1.md file2.md
 *   npx tsx scripts/validate-experience.ts experiences/foo.md
 */
import { basename } from 'node:path';
import { readExperience } from './lib/parse-experience.ts';

const args = process.argv.slice(2).filter((a) => a !== '--changed');
const files = args.filter((a) => !a.startsWith('--'));

function fail(msg: string): never {
  console.error(`投稿校验失败：\n${msg}`);
  process.exit(1);
}

if (!files.length) {
  fail('没有检测到 experiences/*.md 变更。请用 GitHub 网页「Add file → Create new file」在 experiences/ 下新增一篇 Markdown。');
}

const notMd = files.filter((f) => !f.replace(/\\/g, '/').startsWith('experiences/') || !f.endsWith('.md'));
if (notMd.length) {
  fail(`投稿 Pull Request 只能修改 experiences/ 下的 Markdown 文件。这些路径不符合要求：\n${notMd.map((f) => `- ${f}`).join('\n')}\n\n代码改动请另开 PR；投稿请只添加一篇 .md。`);
}

if (files.some((f) => basename(f) === 'TEMPLATE.md')) {
  fail('请不要修改 TEMPLATE.md。复制它、改名后再填写你的经历。');
}

const errors: string[] = [];
for (const f of files) {
  const r = readExperience(f);
  if (!r.ok) errors.push(`${basename(f)}：\n  - ${r.errors.join('\n  - ')}`);
}
if (errors.length) fail(errors.join('\n\n'));

console.log(`校验通过：${files.length} 篇投稿。`);
