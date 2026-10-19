/** 五层人生树：领域 → 场景 → 原则 → 理念 → 人生意义 */
export type Layer = 'area' | 'scene' | 'principle' | 'idea' | 'meaning';

/** 身份维度 */
export type IdentityDim = 'origin' | 'profession' | 'region' | 'age';

/** 贡献者的身份标签（匿名，不含任何可识别个人信息） */
export interface Identity {
  /** 出身：农村 / 大山 / 县城 / 三线城市 / 二线城市 / 一线城市 */
  origin: string;
  /** 职业：程序员 / 教师 / 护士 ... */
  profession: string;
  /** 大区：华北 / 华东 / ... */
  region: string;
  /** 年龄段：00后 / 95后 ... */
  age: string;
  /** 可选：城市或省份（只做展示，不参与筛选） */
  city?: string;
}

/** 公开来源（整理稿，非本人投稿） */
export interface ContributionSource {
  url: string;
  title: string;
  publisher: string;
  date: string;
}

/** 一次「讲一件事」的投稿 */
export interface Contribution {
  id: string;
  identity: Identity;
  /** 已脱敏的原始故事 */
  story: string;
  createdAt: string;
  /** 由该投稿产生的场景 */
  sceneIds: string[];
  /** 示例数据标记 */
  demo?: boolean;
  /** 整理引擎：mock / llm / seed / curated */
  engine?: 'mock' | 'llm' | 'seed' | 'curated';
  /** 公开姓名或常用网名（整理稿使用来源中的署名） */
  name?: string;
  /** 整理者署名，如「编辑部」 */
  curatedBy?: string;
  source?: ContributionSource;
}

export interface GNode {
  id: string;
  layer: Layer;
  title: string;
  desc?: string;
  /** 场景的子标签，如 #理财 */
  tag?: string;
  /** 场景所属投稿 */
  contributionId?: string;
  /** 原则的关键词（供离线 mock 相似度合并使用） */
  keywords?: string[];
  createdAt?: string;
  /** 用户新增 */
  user?: boolean;
  demo?: boolean;
}

export type Link = [string, string];

export interface AppData {
  version: number;
  contributions: Contribution[];
  nodes: GNode[];
  links: Link[];
  /** 原则 id → 「有用」票数 */
  votes: Record<string, number>;
  /** 本机已投过「有用」的原则 */
  myVotes: string[];
  /** 总贡献者数 (distinct contributors) */
  contributorCount?: number;
}

export type Filter = Record<IdentityDim, string[]>;

export const EMPTY_FILTER: Filter = { origin: [], profession: [], region: [], age: [] };
