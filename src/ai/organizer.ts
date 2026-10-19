/**
 * AI 整理入口：organize(story, identity, existingGraph)
 *  - 配置了 VITE_LLM_BASE_URL / VITE_LLM_API_KEY / VITE_LLM_MODEL → 走真实 LLM
 *  - 否则（或 LLM 出错）→ 回退到离线 mock
 * 以后接入后端时，只需新增一个调用 /api/organize 的 Organizer 实现即可。
 */
import type { AppData, Identity } from '../types';
import { createLlmOrganizer, llmConfigFromEnv } from './llm';
import { mockOrganizer } from './mock';
import type { Organizer, OrganizeResult } from './types';

export type { Organizer, OrganizeResult, PrincipleDraft, SceneDraft } from './types';

const cfg = llmConfigFromEnv();
const llm: Organizer | null = cfg ? createLlmOrganizer(cfg) : null;

export const activeEngine = (): 'llm' | 'mock' => (llm ? 'llm' : 'mock');
export const engineLabel = () => (cfg ? `LLM · ${cfg.model}` : 'MOCK · 离线启发式');

export async function organize(story: string, identity: Identity, existingGraph: AppData): Promise<OrganizeResult> {
  if (llm) {
    try {
      return await llm.organize(story, identity, existingGraph);
    } catch (e) {
      const r = await mockOrganizer.organize(story, identity, existingGraph);
      const reason = e instanceof Error ? e.message : String(e);
      return { ...r, fallbackReason: reason, warnings: [`LLM 调用失败（${reason}），已回退到离线 mock`, ...r.warnings] };
    }
  }
  return mockOrganizer.organize(story, identity, existingGraph);
}
