import type { AppData, Contribution, Filter, GNode, Identity, IdentityDim, Layer, Link } from '../types';
import { displayIdentityValue } from '../data/identity';

export const LAYERS: { key: Layer; name: string; en: string; color: string; prefix: string }[] = [
  { key: 'area', name: '工作&生活', en: 'L0 // DOMAIN', color: '#39ff9c', prefix: 'DOM' },
  { key: 'scene', name: '场景', en: 'L1 // SCENE', color: '#00f0ff', prefix: 'SCN' },
  { key: 'principle', name: '原则', en: 'L2 // PRINCIPLE', color: '#ff2bd6', prefix: 'PRN' },
  { key: 'idea', name: '理念', en: 'L3 // IDEA', color: '#fcee0a', prefix: 'IDE' },
  { key: 'meaning', name: '人生意义', en: 'L4 // MEANING', color: '#b98cff', prefix: 'MNG' },
];
export const LI: Record<Layer, number> = { area: 0, scene: 1, principle: 2, idea: 3, meaning: 4 };
export const layerOf = (k: Layer) => LAYERS[LI[k]];

export interface Index {
  byId: Map<string, GNode>;
  ups: Map<string, string[]>;
  downs: Map<string, string[]>;
  contrib: Map<string, Contribution>;
}

export function buildIndex(d: AppData): Index {
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const ups = new Map<string, string[]>();
  const downs = new Map<string, string[]>();
  for (const [a, b] of d.links) {
    if (!byId.has(a) || !byId.has(b)) continue;
    if (!downs.has(a)) downs.set(a, []);
    if (!ups.has(b)) ups.set(b, []);
    downs.get(a)!.push(b);
    ups.get(b)!.push(a);
  }
  return { byId, ups, downs, contrib: new Map(d.contributions.map((c) => [c.id, c])) };
}

export function walk(id: string, next: (id: string) => string[]): Set<string> {
  const out = new Set<string>();
  const st = [id];
  while (st.length) {
    const c = st.pop()!;
    for (const n of next(c)) if (!out.has(n)) { out.add(n); st.push(n); }
  }
  return out;
}

export const filterActive = (f: Filter) => Object.values(f).some((v) => v.length > 0);

/** 维度内 OR，维度间 AND */
export function matchIdentity(idt: Identity, f: Filter): boolean {
  return (Object.keys(f) as IdentityDim[]).every((k) => f[k].length === 0 || f[k].includes(idt[k]));
}

export interface View {
  /** 当前可见的节点 */
  visible: Set<string>;
  /** 节点 → 支持它的投稿（受筛选影响） */
  support: Map<string, Set<string>>;
  /** 节点 → 支持它的投稿（全部） */
  supportAll: Map<string, Set<string>>;
  matchedContribs: Set<string>;
}

function propagate(d: AppData, idx: Index, sceneOk: (s: GNode) => boolean) {
  const support = new Map<string, Set<string>>();
  const add = (id: string, cid: string) => {
    if (!support.has(id)) support.set(id, new Set());
    support.get(id)!.add(cid);
  };
  for (const s of d.nodes) {
    if (s.layer !== 'scene' || !s.contributionId || !sceneOk(s)) continue;
    add(s.id, s.contributionId);
    for (const x of walk(s.id, (i) => idx.downs.get(i) ?? [])) add(x, s.contributionId);
    for (const a of idx.ups.get(s.id) ?? []) add(a, s.contributionId);
  }
  return support;
}

export function computeView(d: AppData, idx: Index, f: Filter): View {
  const active = filterActive(f);
  const matched = new Set(d.contributions.filter((c) => !active || matchIdentity(c.identity, f)).map((c) => c.id));
  const supportAll = propagate(d, idx, () => true);
  const support = active ? propagate(d, idx, (s) => matched.has(s.contributionId!)) : supportAll;
  const visible = new Set<string>();
  for (const n of d.nodes) {
    if (!active) { visible.add(n.id); continue; }
    if (support.has(n.id)) visible.add(n.id);
  }
  return { visible, support, supportAll, matchedContribs: matched };
}

/** 统计一组投稿在某个身份维度上的分布（降序） */
export function breakdown(cids: Iterable<string>, idx: Index, dim: IdentityDim): [string, number][] {
  const m = new Map<string, number>();
  for (const c of cids) {
    const v = idx.contrib.get(c)?.identity[dim];
    if (v) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** 按上下游重心排序，减少连线交叉 */
export function orderLayers(nodes: GNode[], idx: Index): Record<Layer, GNode[]> {
  const res = {} as Record<Layer, GNode[]>;
  const pos = new Map<string, number>();
  const byLayer = (k: Layer) => nodes.filter((n) => n.layer === k);
  const bary = (ids: string[], fallback: number) => {
    const p = ids.map((x) => pos.get(x)).filter((x): x is number => x !== undefined);
    return p.length ? p.reduce((s, x) => s + x, 0) / p.length : fallback;
  };
  const place = (k: Layer, list: GNode[]) => { res[k] = list; list.forEach((n, i) => pos.set(n.id, i)); };
  const sortBy = (list: GNode[], key: (n: GNode, i: number) => number) =>
    list.map((n, i) => ({ n, i, k: key(n, i) })).sort((a, b) => a.k - b.k || a.i - b.i).map((o) => o.n);

  place('area', byLayer('area'));
  // 场景：先按领域分组
  place('scene', sortBy(byLayer('scene'), (n) => bary(idx.ups.get(n.id) ?? [], 1e6)));
  place('principle', sortBy(byLayer('principle'), (n) => bary(idx.ups.get(n.id) ?? [], 1e6)));
  // 回扫：在同一领域内，按下游原则重心微调场景顺序
  place('scene', sortBy(res.scene, (n, i) => {
    const area = bary(idx.ups.get(n.id) ?? [], 1e6);
    return area * 1e4 + bary(idx.downs.get(n.id) ?? [], i);
  }));
  place('principle', sortBy(res.principle, (n) => bary(idx.ups.get(n.id) ?? [], 1e6)));
  place('idea', sortBy(byLayer('idea'), (n) => bary(idx.ups.get(n.id) ?? [], 1e6)));
  place('meaning', sortBy(byLayer('meaning'), (n) => bary(idx.ups.get(n.id) ?? [], 1e6)));
  return res;
}

export function codeOf(n: GNode, all: GNode[]): string {
  const list = all.filter((x) => x.layer === n.layer);
  return `${layerOf(n.layer).prefix}-${String(list.indexOf(n) + 1).padStart(2, '0')}`;
}

export const linkKey = (l: Link) => `${l[0]}>${l[1]}`;

export const identityText = (i: Identity) => [
  i.origin ? displayIdentityValue('origin', i.origin) : '',
  i.profession ? displayIdentityValue('profession', i.profession) : '',
  i.city || (i.region ? displayIdentityValue('region', i.region) : ''),
  i.age ? displayIdentityValue('age', i.age) : '',
].filter(Boolean).join(' · ');
