/**
 * 真实 LLM 整理器：OpenAI 兼容的 POST {BASE_URL}/chat/completions。
 * ⚠ 仅供本地演示：VITE_ 变量会被打包进前端，Key 对所有访问者可见。生产请走后端代理。
 */
import type { AppData, Identity } from '../types';
import { anonymize } from './anonymize';
import { clip } from './text';
import type { Organizer, OrganizeResult, PrincipleDraft, SceneDraft } from './types';

export interface LlmConfig { baseUrl: string; apiKey: string; model: string }

export function llmConfigFromEnv(): LlmConfig | null {
  const env = import.meta.env;
  const baseUrl = (env.VITE_LLM_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const apiKey = (env.VITE_LLM_API_KEY ?? '').trim();
  const model = (env.VITE_LLM_MODEL ?? '').trim();
  return baseUrl && apiKey && model ? { baseUrl, apiKey, model } : null;
}

/** 要求模型严格输出的 JSON 结构 */
export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scenes', 'principles', 'warnings'],
  properties: {
    scenes: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'desc', 'areaId', 'tag'],
        properties: {
          title: { type: 'string', description: '≤24 字，具体事件，不含说教' },
          desc: { type: 'string', description: '≤120 字，发生了什么' },
          areaId: { type: 'string', description: '必须是给定领域 id 之一' },
          tag: { type: 'string', description: '2–4 字子标签，如 理财/健康/求职' },
        },
      },
    },
    principles: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['action', 'existingId', 'title', 'desc', 'similarity', 'sceneIndexes', 'ideaId'],
        properties: {
          action: { type: 'string', enum: ['merge', 'new'] },
          existingId: { type: ['string', 'null'], description: 'merge 时为已有原则 id，否则 null' },
          title: { type: 'string', description: '≤24 字，可执行的行动原则' },
          desc: { type: 'string', description: '≤80 字' },
          similarity: { type: 'number', minimum: 0, maximum: 1 },
          sceneIndexes: { type: 'array', items: { type: 'integer', minimum: 0 } },
          ideaId: { type: 'string', description: '必须是给定理念 id 之一' },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' }, description: '隐私或内容提醒，没有则为空数组' },
  },
} as const;

function buildMessages(story: string, identity: Identity, d: AppData) {
  const pick = (layer: string) => d.nodes.filter((n) => n.layer === layer).map((n) => ({ id: n.id, title: n.title, desc: n.desc ?? '' }));
  const context = { areas: pick('area'), principles: pick('principle'), ideas: pick('idea'), meanings: pick('meaning') };
  const system = [
    '你是「人生经验社区」的整理助手。用户会用一段口语化的中文讲述自己真实经历的事。',
    '你的任务：把故事拆成 1–3 个「场景」（具体发生的事），并为每个场景提炼「原则」（可执行的行动建议）。',
    '规则：',
    '1. 原则若与已有原则意思相近，必须 action="merge" 并给出 existingId，避免重复；确实是新经验才 action="new"。',
    '2. 新原则必须通过 ideaId 挂到一个已有理念；areaId 必须是已有领域 id。',
    '3. 不要编造故事里没有的内容；去除任何可识别个人身份的信息（姓名、电话、单位全称、住址）。',
    '4. 只输出一个 JSON 对象，不要 Markdown，不要解释。JSON Schema 如下：',
    JSON.stringify(OUTPUT_SCHEMA),
  ].join('\n');
  const user = JSON.stringify({ identity, story, existing: context });
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/** 严格校验模型输出；任何不合法都会抛错，从而回退到 mock */
export function validate(raw: unknown, d: AppData): { scenes: SceneDraft[]; principles: PrincipleDraft[]; warnings: string[] } {
  const ids = (layer: string) => new Set(d.nodes.filter((n) => n.layer === layer).map((n) => n.id));
  const areas = ids('area'), principles = ids('principle'), ideas = ids('idea');
  const fail = (m: string): never => { throw new Error(`LLM 输出不符合 schema：${m}`); };
  const isStr = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
  if (!raw || typeof raw !== 'object') fail('不是对象');
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.scenes) || o.scenes.length < 1 || o.scenes.length > 3) fail('scenes');
  if (!Array.isArray(o.principles) || o.principles.length < 1 || o.principles.length > 3) fail('principles');
  const scenes: SceneDraft[] = (o.scenes as Record<string, unknown>[]).map((s, i) => {
    if (!isStr(s.title) || !isStr(s.desc) || !isStr(s.tag)) fail(`scenes[${i}] 字段缺失`);
    if (!areas.has(String(s.areaId))) fail(`scenes[${i}].areaId 不存在`);
    return { title: clip(String(s.title), 24), desc: clip(String(s.desc), 120), areaId: String(s.areaId), tag: clip(String(s.tag), 6) };
  });
  const ps: PrincipleDraft[] = (o.principles as Record<string, unknown>[]).map((p, i) => {
    if (p.action !== 'merge' && p.action !== 'new') fail(`principles[${i}].action`);
    if (!isStr(p.title) || typeof p.desc !== 'string') fail(`principles[${i}] 字段缺失`);
    if (p.action === 'merge' && !principles.has(String(p.existingId))) fail(`principles[${i}].existingId 不存在`);
    if (!ideas.has(String(p.ideaId))) fail(`principles[${i}].ideaId 不存在`);
    const idxs = Array.isArray(p.sceneIndexes) ? p.sceneIndexes.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < scenes.length) : [];
    if (!idxs.length) fail(`principles[${i}].sceneIndexes`);
    const sim = typeof p.similarity === 'number' ? Math.max(0, Math.min(1, p.similarity)) : 0;
    return {
      action: p.action as 'merge' | 'new',
      existingId: p.action === 'merge' ? String(p.existingId) : undefined,
      nearestId: principles.has(String(p.existingId)) ? String(p.existingId) : undefined,
      title: clip(String(p.title), 24), desc: clip(String(p.desc), 80), similarity: sim, sceneIndexes: idxs, ideaId: String(p.ideaId),
    };
  });
  const warnings = Array.isArray(o.warnings) ? o.warnings.filter(isStr).map(String) : [];
  return { scenes, principles: ps, warnings };
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('LLM 未返回 JSON');
  return JSON.parse(t.slice(a, b + 1));
}

export function createLlmOrganizer(cfg: LlmConfig, timeoutMs = 30000): Organizer {
  return {
    name: 'llm',
    async organize(story, identity, graph): Promise<OrganizeResult> {
      // 先在本地脱敏，再发给模型
      const an = anonymize(story);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({
            model: cfg.model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: buildMessages(an.text, identity, graph),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const content: unknown = json?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error('响应中没有 message.content');
        const v = validate(extractJson(content), graph);
        return { engine: 'llm', anonymizedStory: an.text, warnings: [...an.warnings, ...v.warnings], scenes: v.scenes, principles: v.principles };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
