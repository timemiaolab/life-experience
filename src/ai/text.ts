/** 中文友好的轻量文本工具：字符 bigram + Dice 系数 */

const PUNCT = /[\s，。！？、；：,.!?;:“”"'‘’（）()【】\[\]《》<>…—\-·~～]/g;

export const normalize = (s: string) => s.replace(PUNCT, '').toLowerCase();

export function bigrams(s: string): Set<string> {
  const t = normalize(s);
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  if (t.length === 1) out.add(t);
  return out;
}

/** 过于常见、没有区分度的 bigram */
const STOP = new Set(['我们', '自己', '一个', '的时', '时候', '没有', '就是', '什么', '因为', '所以', '但是', '后来', '现在', '已经', '这个', '那个', '还是', '可以', '一定', '不是', '也不', '他们', '起来', '一下', '真的', '觉得']);

export function dice(a: Set<string>, b: Set<string>): number {
  let inter = 0, na = 0, nb = 0;
  for (const x of a) if (!STOP.has(x)) { na++; if (b.has(x)) inter++; }
  for (const x of b) if (!STOP.has(x)) nb++;
  return na + nb === 0 ? 0 : (2 * inter) / (na + nb);
}

/** 关键词命中率（命中 3 个及以上视为满分） */
export function keywordScore(text: string, keywords: string[] = []): { score: number; hits: string[] } {
  const hits = keywords.filter((k) => text.includes(k));
  return { score: Math.min(1, hits.length / 3), hits };
}

export function splitSentences(s: string): string[] {
  return s
    .split(/(?<=[。！？!?；;\n])/)
    .map((x) => x.trim())
    .filter((x) => x.replace(PUNCT, '').length > 0);
}

export const clauses = (s: string) => s.split(/[，,、：:；;。！？!?]/).map((x) => x.trim()).filter(Boolean);

export function clip(s: string, n: number) {
  const t = s.trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}
