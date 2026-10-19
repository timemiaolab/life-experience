import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { DIMS } from '../../src/data/identity.ts';

export const MIN_STORY_CHARS = 30;
export const MAX_STORY_CHARS = 2000;

export interface ExperienceDoc {
  file: string;
  title: string;
  origin: string;
  profession: string;
  region: string;
  age: string;
  city?: string;
  story: string;
  /** 公开姓名或常用网名（整理稿） */
  name?: string;
  /** 整理者，如「编辑部」 */
  curatedBy?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourcePublisher?: string;
  sourceDate?: string;
}

const ALIAS: Record<string, string> = {
  title: 'title',
  标题: 'title',
  origin: 'origin',
  出身: 'origin',
  profession: 'profession',
  职业: 'profession',
  region: 'region',
  地区: 'region',
  age: 'age',
  年龄段: 'age',
  'age band': 'age',
  city: 'city',
  城市: 'city',
  name: 'name',
  handle: 'name',
  contributor: 'name',
  姓名: 'name',
  署名: 'name',
  curatedby: 'curatedBy',
  curator: 'curatedBy',
  整理: 'curatedBy',
  sourceurl: 'sourceUrl',
  source: 'sourceUrl',
  url: 'sourceUrl',
  来源: 'sourceUrl',
  sourcetitle: 'sourceTitle',
  来源标题: 'sourceTitle',
  sourcepublisher: 'sourcePublisher',
  publisher: 'sourcePublisher',
  出版: 'sourcePublisher',
  出处: 'sourcePublisher',
  sourcedate: 'sourceDate',
  publishedat: 'sourceDate',
  日期: 'sourceDate',
  发表日期: 'sourceDate',
};

const ALLOWED = 'title, origin/出身, profession/职业, region/地区, age/年龄段, city，以及可选来源字段 name/handle、curatedBy/整理、source/sourceUrl、sourceTitle、publisher/sourcePublisher、sourceDate';

function charCount(s: string): number {
  return [...s.replace(/\s+/g, '')].length;
}

function normalizeDate(raw: string): string {
  const parts = raw
    .replace(/年/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .split('-')
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length >= 3) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  if (parts.length === 2) return `${parts[0]}-${parts[1].padStart(2, '0')}`;
  return raw;
}

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const text = raw.replace(/^\uFEFF/, '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('缺少 YAML 头（须以 --- 开始和结束）');
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx < 0) throw new Error(`无法解析的 YAML 行：${line}`);
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    const canon = ALIAS[key.toLowerCase()] ?? ALIAS[key];
    if (!canon) throw new Error(`未知字段「${key}」。允许：${ALLOWED}`);
    meta[canon] = val;
  }
  return { meta, body: m[2].trim() };
}

export function validateExperience(raw: string, file: string): { ok: true; doc: ExperienceDoc } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = basename(file);
  if (name === 'TEMPLATE.md') {
    return { ok: false, errors: ['TEMPLATE.md 是模板，请复制后改名再投稿（例如 2026-10-19-我的一件事.md）'] };
  }
  if (/^YYYY-MM-DD/i.test(name) || /bian-ti\.md$/i.test(name)) {
    errors.push(`「${name}」是占位文件名。请改成今天的日期加简短拼音或英文，例如 2026-10-19-bei-caiyuan.md（不要用 YYYY-MM-DD-bian-ti.md）`);
  }
  if (!/^[a-zA-Z0-9._\u4e00-\u9fff-]{1,80}\.md$/.test(name)) {
    errors.push('文件名只能含字母、数字、中文、点、下划线和短横线，并以 .md 结尾');
  }
  let meta: Record<string, string> = {};
  let body = '';
  try {
    const parsed = parseFrontMatter(raw);
    meta = parsed.meta;
    body = parsed.body;
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
  const title = (meta.title || '').trim();
  if (!title) errors.push('缺少 title（标题）');
  if (title.length > 40) errors.push('标题请不超过 40 字');

  const required = ['origin', 'profession', 'region', 'age'] as const;
  const labels: Record<string, string> = { origin: '出身', profession: '职业', region: '地区', age: '年龄段' };
  for (const k of required) {
    if (!meta[k]?.trim()) errors.push(`缺少 ${k}（${labels[k]}）`);
  }
  for (const d of DIMS) {
    const v = meta[d.key]?.trim();
    if (!v) continue;
    if (!d.custom && !d.options.includes(v)) {
      errors.push(`${d.name}「${v}」不在可选值中：${d.options.join('、')}`);
    }
  }
  const n = charCount(body);
  if (n < MIN_STORY_CHARS) errors.push(`正文太短（${n} 字），至少 ${MIN_STORY_CHARS} 字：发生了什么？后来怎么做的？学到了什么？`);
  if (n > MAX_STORY_CHARS) errors.push(`正文太长（${n} 字），请压缩到 ${MAX_STORY_CHARS} 字以内`);
  if (/```|<\s*script/i.test(body)) errors.push('正文请不要包含代码块或脚本（只讲经历）');

  const sourceUrl = (meta.sourceUrl || '').trim();
  if (sourceUrl && !/^https?:\/\/\S+$/i.test(sourceUrl)) {
    errors.push('sourceUrl 须为 http(s) 链接');
  }
  const sourceDate = (meta.sourceDate || '').trim();
  if (sourceDate && !/^\d{4}([-.\/年]\d{1,2}([-.\/月]\d{1,2}日?)?)?$/.test(sourceDate)) {
    errors.push('sourceDate 请写成 YYYY-MM-DD 或 2024.03.16 这样的日期');
  }

  if (errors.length) return { ok: false, errors };
  const doc: ExperienceDoc = {
    file: name,
    title,
    origin: meta.origin.trim(),
    profession: meta.profession.trim(),
    region: meta.region.trim(),
    age: meta.age.trim(),
    story: body,
  };
  if (meta.city?.trim()) doc.city = meta.city.trim();
  if (meta.name?.trim()) doc.name = meta.name.trim();
  if (meta.curatedBy?.trim()) doc.curatedBy = meta.curatedBy.trim();
  else if (sourceUrl) doc.curatedBy = '编辑部';
  if (sourceUrl) doc.sourceUrl = sourceUrl;
  if (meta.sourceTitle?.trim()) doc.sourceTitle = meta.sourceTitle.trim();
  if (meta.sourcePublisher?.trim()) doc.sourcePublisher = meta.sourcePublisher.trim();
  if (sourceDate) doc.sourceDate = normalizeDate(sourceDate);
  return { ok: true, doc };
}

export function readExperience(path: string): ReturnType<typeof validateExperience> {
  return validateExperience(readFileSync(path, 'utf8'), path);
}
