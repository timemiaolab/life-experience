import type { GraphFile } from './graph-io.ts';

export interface ExtractedScene {
  title: string;
  desc: string;
  areaId: string;
  tag: string;
}

export interface ExtractedPrinciple {
  action: 'merge' | 'new';
  existingId?: string;
  title: string;
  desc: string;
  sceneIndexes: number[];
  ideaId: string;
  similarity?: number;
  nearestId?: string;
  nearestTitle?: string;
}

export interface ExtractedIdea {
  action: 'merge' | 'new';
  existingId?: string;
  title: string;
  desc: string;
  meaningId: string;
}

export interface ExtractedMeaning {
  action: 'merge' | 'new';
  existingId?: string;
  title: string;
  desc: string;
}

export interface IngestExtraction {
  scenes: ExtractedScene[];
  principles: ExtractedPrinciple[];
  ideas: ExtractedIdea[];
  meanings: ExtractedMeaning[];
}

const MAX_TITLE = 40;
const MAX_DESC = 400;
const TEMP_REF = /^new:(\d+)$/;
const BAD_SCENE = /^(学到的)?经验$|^感悟$|^心得$|^体会$|^总结$|^原则$|^理念$|^人生意义$|^道理$/;

export function parseTempRef(id: string): number | null {
  const m = TEMP_REF.exec(id);
  return m ? Number(m[1]) : null;
}

function isRec(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  if (/[\u0000-\u0008]/.test(s)) return null;
  return s;
}

export function validateExtraction(raw: unknown, graph: GraphFile): { ok: true; value: IngestExtraction } | { ok: false; error: string } {
  if (!isRec(raw)) return { ok: false, error: '模型输出不是对象' };
  const scenesIn = raw.scenes;
  const principlesIn = raw.principles;
  if (!Array.isArray(scenesIn) || scenesIn.length < 1 || scenesIn.length > 4) {
    return { ok: false, error: 'scenes 须为 1–4 个对象' };
  }
  if (!Array.isArray(principlesIn) || principlesIn.length < 1 || principlesIn.length > 6) {
    return { ok: false, error: 'principles 须为 1–6 个对象' };
  }
  const ideasIn = Array.isArray(raw.ideas) ? raw.ideas : [];
  const meaningsIn = Array.isArray(raw.meanings) ? raw.meanings : [];
  if (ideasIn.length > 3) return { ok: false, error: 'ideas 最多 3 个' };
  if (meaningsIn.length > 2) return { ok: false, error: 'meanings 最多 2 个' };

  const areaIds = new Set(graph.nodes.filter((n) => n.layer === 'area').map((n) => n.id));
  const principleIds = new Set(graph.nodes.filter((n) => n.layer === 'principle').map((n) => n.id));
  const ideaIds = new Set(graph.nodes.filter((n) => n.layer === 'idea').map((n) => n.id));
  const meaningIds = new Set(graph.nodes.filter((n) => n.layer === 'meaning').map((n) => n.id));

  const scenes: ExtractedScene[] = [];
  for (let i = 0; i < scenesIn.length; i++) {
    const s = scenesIn[i];
    if (!isRec(s)) return { ok: false, error: `scenes[${i}] 不是对象` };
    const title = str(s.title, MAX_TITLE);
    const desc = str(s.desc, MAX_DESC);
    const areaId = str(s.areaId, 32);
    const tag = str(s.tag, 12) ?? '未分类';
    if (!title || !desc || !areaId) return { ok: false, error: `scenes[${i}] 缺少有效 title/desc/areaId` };
    if (!areaIds.has(areaId)) return { ok: false, error: `scenes[${i}].areaId「${areaId}」不存在` };
    if (BAD_SCENE.test(title)) {
      return { ok: false, error: `scenes[${i}]「${title}」不是场景（请写具体发生的事，不要用「学到的经验」这类抽象标题）` };
    }
    scenes.push({ title, desc, areaId, tag });
  }

  const meanings: ExtractedMeaning[] = [];
  for (let i = 0; i < meaningsIn.length; i++) {
    const x = meaningsIn[i];
    if (!isRec(x)) return { ok: false, error: `meanings[${i}] 不是对象` };
    const action = x.action === 'merge' || x.action === 'new' ? x.action : null;
    if (!action) return { ok: false, error: `meanings[${i}].action 须为 merge 或 new` };
    const title = str(x.title, MAX_TITLE);
    const desc = str(x.desc, MAX_DESC);
    if (!title || !desc) return { ok: false, error: `meanings[${i}] 缺少 title/desc` };
    if (action === 'merge') {
      const existingId = str(x.existingId, 32);
      if (!existingId || !meaningIds.has(existingId)) return { ok: false, error: `meanings[${i}].existingId 无效` };
      meanings.push({ action, existingId, title, desc });
    } else {
      meanings.push({ action, title, desc });
    }
  }

  const ideas: ExtractedIdea[] = [];
  for (let i = 0; i < ideasIn.length; i++) {
    const x = ideasIn[i];
    if (!isRec(x)) return { ok: false, error: `ideas[${i}] 不是对象` };
    const action = x.action === 'merge' || x.action === 'new' ? x.action : null;
    if (!action) return { ok: false, error: `ideas[${i}].action 须为 merge 或 new` };
    const title = str(x.title, MAX_TITLE);
    const desc = str(x.desc, MAX_DESC);
    if (!title || !desc) return { ok: false, error: `ideas[${i}] 缺少 title/desc` };
    if (action === 'merge') {
      const existingId = str(x.existingId, 32);
      if (!existingId || !ideaIds.has(existingId)) return { ok: false, error: `ideas[${i}].existingId 无效` };
      ideas.push({ action, existingId, title, desc, meaningId: str(x.meaningId, 32) ?? existingId });
    } else {
      const meaningId = str(x.meaningId, 32);
      if (!meaningId) return { ok: false, error: `ideas[${i}].meaningId 无效` };
      const temp = parseTempRef(meaningId);
      if (temp != null) {
        if (temp < 0 || temp >= meanings.length) {
          return { ok: false, error: `ideas[${i}].meaningId「${meaningId}」指向的本轮 meaning 不存在` };
        }
      } else if (!meaningIds.has(meaningId)) {
        return { ok: false, error: `ideas[${i}].meaningId 无效` };
      }
      ideas.push({ action, title, desc, meaningId });
    }
  }

  const principles: ExtractedPrinciple[] = [];
  for (let i = 0; i < principlesIn.length; i++) {
    const p = principlesIn[i];
    if (!isRec(p)) return { ok: false, error: `principles[${i}] 不是对象` };
    const action = p.action === 'merge' || p.action === 'new' ? p.action : null;
    if (!action) return { ok: false, error: `principles[${i}].action 须为 merge 或 new` };
    const title = str(p.title, MAX_TITLE);
    const desc = str(p.desc, MAX_DESC);
    const ideaId = str(p.ideaId, 32);
    const sceneIndexes = Array.isArray(p.sceneIndexes) ? p.sceneIndexes.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < scenes.length) : [];
    if (!title || !desc) return { ok: false, error: `principles[${i}] 缺少 title/desc` };
    if (!sceneIndexes.length) return { ok: false, error: `principles[${i}] 至少关联一个 sceneIndexes` };
    if (action === 'merge') {
      const existingId = str(p.existingId, 32);
      if (!existingId || !principleIds.has(existingId)) return { ok: false, error: `principles[${i}].existingId 无效` };
      principles.push({ action, existingId, title, desc, sceneIndexes, ideaId: ideaId ?? 'i1' });
    } else {
      if (!ideaId) return { ok: false, error: `principles[${i}].ideaId 无效` };
      const temp = parseTempRef(ideaId);
      if (temp != null) {
        if (temp < 0 || temp >= ideas.length) {
          return { ok: false, error: `principles[${i}].ideaId「${ideaId}」指向的本轮 idea 不存在` };
        }
      } else if (!ideaIds.has(ideaId)) {
        return { ok: false, error: `principles[${i}].ideaId 无效` };
      }
      principles.push({ action, title, desc, sceneIndexes, ideaId });
    }
  }

  const sceneLinked = new Set<number>();
  for (const p of principles) for (const si of p.sceneIndexes) sceneLinked.add(si);
  for (let i = 0; i < scenes.length; i++) {
    if (!sceneLinked.has(i)) {
      return { ok: false, error: `孤立节点：scenes[${i}]「${scenes[i].title}」未连到任何原则` };
    }
  }

  const ideaTargets = new Set(principles.map((p) => p.ideaId));
  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    if (idea.action !== 'new') continue;
    const ref = `new:${i}`;
    const used = ideaTargets.has(ref) || (idea.existingId ? ideaTargets.has(idea.existingId) : false);
    if (!used) return { ok: false, error: `孤立节点：ideas[${i}]「${idea.title}」没有被任何新原则引用（用 ideaId: "new:${i}"）` };
  }

  const meaningTargets = new Set(ideas.filter((x) => x.action === 'new').map((x) => x.meaningId));
  for (let i = 0; i < meanings.length; i++) {
    const m = meanings[i];
    if (m.action !== 'new') continue;
    if (!meaningTargets.has(`new:${i}`)) {
      return { ok: false, error: `孤立节点：meanings[${i}]「${m.title}」没有被任何新理念引用（用 meaningId: "new:${i}"）` };
    }
  }

  for (const p of principles) {
    if (p.action !== 'new') continue;
    const temp = parseTempRef(p.ideaId);
    if (temp != null && ideas[temp]?.action === 'merge' && ideas[temp].existingId) {
      p.ideaId = ideas[temp].existingId!;
    }
  }

  return { ok: true, value: { scenes, principles, ideas, meanings } };
}

export const EXTRACT_JSON_INSTRUCTIONS = `只输出一个 JSON 对象，不要 Markdown。字段：
{
  "scenes": [{ "title": string, "desc": string, "areaId": "a1"|"a2"|"a3", "tag": string }],
  "principles": [{ "action": "merge"|"new", "existingId": string, "title": string, "desc": string, "sceneIndexes": number[], "ideaId": string }],
  "ideas": [{ "action": "merge"|"new", "existingId": string, "title": string, "desc": string, "meaningId": string }],
  "meanings": [{ "action": "merge"|"new", "existingId": string, "title": string, "desc": string }]
}
规则：
- scenes 1–4，必须是具体发生的事，禁止「学到的经验 / 感悟 / 心得」这类抽象标题。
- principles 1–6；每个 scene 必须被至少一个 principle.sceneIndexes 引用。
- 本轮新建或合并的 idea / meaning 用临时 id：「new:0」表示 ideas[0] / meanings[0]（含本轮 merge）。principle.ideaId 与 idea.meaningId 可写已有 id 或 new:N。
- 每个 new principle 必须连到一个 idea；每个 new idea 必须连到一个 meaning；禁止孤儿节点。
- merge 必须带已有 existingId。title≤40字，desc≤400字。`;
