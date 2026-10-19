/**
 * 离线 MOCK 整理器：无需任何 Key。
 * 思路：
 *  1. 本地脱敏；
 *  2. 按“还有一次 / 另外 / 后来又”等转折词把故事切成 1–3 个场景；
 *  3. 在每段里找“后来才明白 / 所以 / 一定要 …”这类“经验句”作为候选原则；
 *  4. 候选原则与已有原则做「字符 bigram Dice + 关键词命中」相似度，超过阈值即合并；
 *  5. 新原则挂到最相近的已有理念。
 */
import type { AppData, GNode, Identity } from '../types';
import { anonymize } from './anonymize';
import { bigrams, clauses, clip, dice, keywordScore, normalize, splitSentences } from './text';
import type { Organizer, OrganizeResult, PrincipleDraft, SceneDraft } from './types';

export const MERGE_THRESHOLD = 0.3;

const SEGMENT_MARKERS = /^(还有一次|还有一件事|另外|另一件事|此外|再后来|第二件事|第三件事|又有一次|再说一件)[，,：:]?/;
const LESSON_MARKERS = /(后来才明白|后来我明白|我才明白|才明白|我才知道|才知道|现在我明白了|现在我明白|我明白了|我学会了|学会了|我的体会是|体会是|教训是|经验是|所以|一定要|千万|宁可|与其|不要|别再|记住)/;
const KEEP_MARKERS = /^(一定要|千万|宁可|与其|不要|别再|记住)$/;
const CONTACT = /(联系我|加我|\[[^\]]*已隐藏\])/;
const EVENT_WORDS = /(突然|第一次|结果|发现|查出|被|亏|罚|晕|吵|裁员|辞职|失败|关门|没想到|出了|进了|考上|升|拿到|丢)/;

const TAGS: [string, RegExp][] = [
  ['理财', /(存|钱|工资|裁员|理财|投资|贷|借|收益|房租)/],
  ['健康', /(身体|体检|医院|医生|熬夜|加班到|作息|睡|疼|病)/],
  ['家庭', /(父母|爸|妈|家里|家人|孩子|老婆|老公)/],
  ['学习', /(学习|自学|周记|复盘|读书|课程|英语|考证|练习)/],
  ['求学', /(高考|志愿|考研|大学|专业|学长)/],
  ['求职', /(面试|offer|简历|找工作|招聘)/],
  ['创业', /(创业|开店|合伙|生意|电商)/],
  ['租房', /(租房|房东|中介|押金)/],
  ['沟通', /(吵|误解|沟通|差评|投诉|情绪)/],
  ['职场', /(同事|领导|老板|公司|项目|升职)/],
];

function stripMarkers(s: string) {
  return s.replace(SEGMENT_MARKERS, '').trim();
}

/** 1. 切分场景段落 */
function segment(story: string): string[] {
  const paras = story.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const segs: string[] = [];
  for (const p of paras) {
    for (const s of splitSentences(p)) {
      // 只含联系方式的句子不进入场景
      if (CONTACT.test(s) && normalize(s.replace(/\[[^\]]*已隐藏\]/g, '')).length < 20) continue;
      if (!segs.length || SEGMENT_MARKERS.test(s)) segs.push(s);
      else segs[segs.length - 1] += s;
    }
  }
  // 丢掉只有联系方式等无内容的段
  const useful = segs.filter((s) => normalize(s.replace(/\[[^\]]*已隐藏\]/g, '')).length >= 12);
  return (useful.length ? useful : segs).slice(0, 3);
}

/** 2. 场景标题：取“事件感”最强的分句（必要时拼上下一分句） */
function sceneTitle(seg: string): string {
  const sents = splitSentences(stripMarkers(seg)).filter((s) => !LESSON_MARKERS.test(s));
  const cl = clauses((sents.length ? sents : [seg]).join('，'));
  let best = 0, bestScore = -1;
  cl.forEach((c, i) => {
    const sc = (EVENT_WORDS.test(c) ? 2 : 0) + (c.length >= 5 ? 1 : 0) - i * 0.05 - (/^我(从|是|在)/.test(c) ? 1 : 0);
    if (sc > bestScore) { bestScore = sc; best = i; }
  });
  let t = cl[best] ?? seg;
  if (cl[best + 1] && t.length + cl[best + 1].length <= 22) t += '，' + cl[best + 1];
  return clip(t, 24);
}

/** 3. 经验句 → 候选原则 */
function lessonOf(seg: string): { title: string; sentence: string } {
  const sents = splitSentences(stripMarkers(seg));
  const lessonSents = sents.filter((s) => LESSON_MARKERS.test(s));
  const sentence = lessonSents.length ? lessonSents[lessonSents.length - 1] : sents[sents.length - 1] ?? seg;
  let body = sentence.replace(/[。！？!?\n]+$/, '');
  // 反复去掉“后来才明白，”“所以我的体会是：”这类引导语
  for (let k = 0; k < 4; k++) {
    const m = body.match(LESSON_MARKERS);
    if (!m || m.index === undefined || m.index > 8) break;
    // “一定要/千万/宁可”是原则本体的一部分，保留
    if (KEEP_MARKERS.test(m[0])) { body = body.slice(m.index); break; }
    const after = body.slice(m.index + m[0].length).replace(/^[，,：:\s]+/, '');
    if (!after) break;
    body = after;
  }
  const cl = clauses(body);
  let title = cl[0] ?? body;
  // 两个短分句合起来更完整，例如“该停就要停”
  if (cl[1] && title.length + cl[1].length <= 22) title += '，' + cl[1];
  return { title: clip(title, 24), sentence };
}

const TAG_AREA: Record<string, string> = { 理财: 'a2', 健康: 'a2', 家庭: 'a2', 租房: 'a2', 学习: 'a3', 求学: 'a3', 求职: 'a1', 创业: 'a1', 职场: 'a1', 沟通: 'a1' };

function areaOf(seg: string, areas: GNode[]): string {
  const byTag = TAG_AREA[tagOf(seg)];
  if (byTag && areas.some((a) => a.id === byTag)) return byTag;
  let best = areas[0]?.id ?? 'a1', bestScore = -1;
  for (const a of areas) {
    const s = keywordScore(seg, a.keywords).hits.length;
    if (s > bestScore) { bestScore = s; best = a.id; }
  }
  return best;
}

const tagOf = (seg: string) => TAGS.find(([, re]) => re.test(seg))?.[0] ?? '生活';

/** 4. 与已有原则的相似度 */
export function principleSimilarity(lesson: string, seg: string, p: GNode): number {
  const pText = `${p.title}${p.desc ?? ''}`;
  const d = Math.max(dice(bigrams(lesson), bigrams(p.title)), dice(bigrams(lesson), bigrams(pText)) * 0.9);
  const k = keywordScore(lesson + seg, p.keywords).score;
  const kl = keywordScore(lesson, p.keywords).score;
  return Math.min(1, 0.45 * d + 0.35 * k + 0.2 * kl + (d > 0.5 ? 0.2 : 0));
}

function nearestIdea(text: string, d: AppData, principleIdeas: Map<string, string[]>, nearestPid?: string): string {
  const ideas = d.nodes.filter((n) => n.layer === 'idea');
  if (!ideas.length) return '';
  let best = ideas[0].id, bs = -1;
  for (const i of ideas) {
    let s = dice(bigrams(text), bigrams(`${i.title}${i.desc ?? ''}`)) + 0.3 * keywordScore(text, i.keywords).score;
    if (nearestPid && principleIdeas.get(nearestPid)?.includes(i.id)) s += 0.15;
    if (s > bs) { bs = s; best = i.id; }
  }
  return best;
}

export function mockOrganize(story: string, _identity: Identity, d: AppData): OrganizeResult {
  const an = anonymize(story);
  const warnings = [...an.warnings];
  const areas = d.nodes.filter((n) => n.layer === 'area');
  const principles = d.nodes.filter((n) => n.layer === 'principle');
  const principleIdeas = new Map<string, string[]>();
  for (const [a, b] of d.links) {
    if (!principleIdeas.has(a)) principleIdeas.set(a, []);
    principleIdeas.get(a)!.push(b);
  }

  const segs = segment(an.text);
  if (normalize(an.text).length < 30) warnings.push('故事有点短，补充一下“当时发生了什么、后来怎么做的”会更有参考价值');

  const scenes: SceneDraft[] = segs.map((seg) => ({
    title: sceneTitle(seg),
    desc: clip(stripMarkers(seg).replace(/\n/g, ''), 120),
    areaId: areaOf(seg, areas),
    tag: tagOf(seg),
  }));

  const drafts: PrincipleDraft[] = [];
  segs.forEach((seg, si) => {
    const { title, sentence } = lessonOf(seg);
    let nearest: GNode | undefined, sim = 0;
    for (const p of principles) {
      const s = principleSimilarity(title, seg, p);
      if (s > sim) { sim = s; nearest = p; }
    }
    const merge = !!nearest && sim >= MERGE_THRESHOLD;
    // 同一条故事里多段指向同一原则时，合并为一条草稿
    const dup = drafts.find((x) => merge && x.action === 'merge' && x.existingId === nearest!.id);
    if (dup) { dup.sceneIndexes.push(si); return; }
    drafts.push({
      action: merge ? 'merge' : 'new',
      existingId: merge ? nearest!.id : undefined,
      nearestId: nearest?.id,
      title,
      desc: clip(sentence.replace(/\n/g, ''), 80),
      similarity: Math.round(sim * 100) / 100,
      sceneIndexes: [si],
      ideaId: nearestIdea(title + seg, d, principleIdeas, nearest?.id),
    });
  });

  return { engine: 'mock', anonymizedStory: an.text, warnings, scenes, principles: drafts };
}

export const mockOrganizer: Organizer = {
  name: 'mock',
  async organize(story, identity, graph) {
    // 模拟一点“思考”时间，便于展示整理动画
    await new Promise((r) => setTimeout(r, 650));
    return mockOrganize(story, identity, graph);
  },
};
