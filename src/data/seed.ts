import type { AppData, Identity } from '../types';
import graph from '../../data/graph.json';

export const SEED_VERSION = graph.version;

export const SEED: AppData = {
  version: graph.version,
  contributions: graph.contributions as AppData['contributions'],
  nodes: graph.nodes as AppData['nodes'],
  links: graph.links as AppData['links'],
  votes: graph.votes,
  myVotes: [],
  contributorCount: graph.contributions.length,
};

export const seedClone = (): AppData => structuredClone(SEED);

/** 投稿模板里的示例（虚构） */
export const SAMPLE_STORY = {
  identity: { origin: '农村', profession: '程序员', region: '华东', age: '95后', city: '杭州' } as Identity,
  story:
    '我从农村出来，在杭州做程序员第三年。去年公司突然裁员，我卡里只剩三千块，房租还要交两个月，那段时间特别慌，面试都不敢挑。后来才明白，一定要先存够半年的生活费，再考虑换手机换电脑这些。',
};
