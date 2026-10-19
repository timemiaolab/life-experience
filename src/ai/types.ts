import type { AppData, Identity } from '../types';

/** AI 整理出的一个场景草稿 */
export interface SceneDraft {
  title: string;
  desc: string;
  /** 所属领域节点 id（a1 工作 / a2 生活 / a3 成长 …） */
  areaId: string;
  tag: string;
}

/** AI 整理出的一条原则草稿 */
export interface PrincipleDraft {
  /** merge：合并进已有原则；new：新建原则 */
  action: 'merge' | 'new';
  /** action=merge 时，被合并的已有原则 id */
  existingId?: string;
  /** 原则标题（new 时为新原则标题；merge 时为 AI 从故事里提炼出的原句，便于作者核对） */
  title: string;
  desc: string;
  /** 与最相近已有原则的相似度 0–1 */
  similarity: number;
  /** 最相近的已有原则（即使未合并也给出，便于作者手动改为合并） */
  nearestId?: string;
  /** 由哪些场景（SceneDraft 下标）支撑 */
  sceneIndexes: number[];
  /** action=new 时挂到哪个已有理念 */
  ideaId: string;
}

export interface OrganizeResult {
  engine: 'mock' | 'llm';
  /** 若尝试 LLM 失败而回退到 mock，这里写原因 */
  fallbackReason?: string;
  /** 已脱敏的故事 */
  anonymizedStory: string;
  /** 隐私 / 质量提醒 */
  warnings: string[];
  scenes: SceneDraft[];
  principles: PrincipleDraft[];
}

export interface Organizer {
  readonly name: 'mock' | 'llm';
  organize(story: string, identity: Identity, existingGraph: AppData): Promise<OrganizeResult>;
}
