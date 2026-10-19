import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { AppData, Contribution, GNode, Identity, Layer, Link } from '../../src/types.ts';

const LAYER_ORDER: Layer[] = ['area', 'scene', 'principle', 'idea', 'meaning'];

export const ROOT = resolve(import.meta.dirname, '../..');
export const GRAPH_PATH = resolve(ROOT, 'data/graph.json');
export const EMBEDDINGS_PATH = resolve(ROOT, 'data/embeddings.json');

export interface GraphFile {
  version: number;
  contributions: Contribution[];
  nodes: GNode[];
  links: Link[];
  votes: Record<string, number>;
}

export interface EmbeddingsFile {
  model: string;
  dim: number;
  vectors: Record<string, number[]>;
}

function sortIdentity(id: Identity): Identity {
  const out: Identity = {
    origin: id.origin,
    profession: id.profession,
    region: id.region,
    age: id.age,
  };
  if (id.city) out.city = id.city;
  return out;
}

function sortContribution(c: Contribution): Contribution {
  const out: Contribution = {
    id: c.id,
    identity: sortIdentity(c.identity),
    story: c.story,
    createdAt: c.createdAt,
    sceneIds: [...c.sceneIds].sort(),
  };
  if (c.demo) out.demo = true;
  if (c.engine) out.engine = c.engine;
  return out;
}

function sortNode(n: GNode): GNode {
  const out: GNode = { id: n.id, layer: n.layer, title: n.title };
  if (n.desc) out.desc = n.desc;
  if (n.tag) out.tag = n.tag;
  if (n.keywords && n.keywords.length) out.keywords = [...n.keywords];
  if (n.contributionId) out.contributionId = n.contributionId;
  if (n.createdAt) out.createdAt = n.createdAt;
  if (n.demo) out.demo = true;
  if (n.user) out.user = true;
  return out;
}

export function normalizeGraph(data: AppData | GraphFile): GraphFile {
  const nodes = [...data.nodes]
    .map(sortNode)
    .sort((a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer) || a.id.localeCompare(b.id, 'en'));
  const contributions = [...data.contributions]
    .map(sortContribution)
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const links = [...data.links]
    .map(([a, b]) => [a, b] as Link)
    .sort((a, b) => a[0].localeCompare(b[0], 'en') || a[1].localeCompare(b[1], 'en'));
  const votes: Record<string, number> = {};
  for (const k of Object.keys(data.votes ?? {}).sort()) {
    const n = data.votes[k];
    if (n) votes[k] = n;
  }
  return { version: data.version, contributions, nodes, links, votes };
}

export function prettyGraph(data: AppData | GraphFile): string {
  return `${JSON.stringify(normalizeGraph(data), null, 2)}\n`;
}

export function compactGraph(data: AppData | GraphFile): string {
  return JSON.stringify(normalizeGraph(data));
}

export function loadGraph(path = GRAPH_PATH): GraphFile {
  return JSON.parse(readFileSync(path, 'utf8')) as GraphFile;
}

export function saveGraph(data: AppData | GraphFile, path = GRAPH_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, prettyGraph(data));
}

export function toAppData(g: GraphFile): AppData {
  return { ...g, myVotes: [], contributorCount: g.contributions.length };
}

export function nextId(prefix: string, existing: Iterable<string>): string {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const id of existing) {
    const m = id.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(prefix === 'c' || prefix === 's' ? 2 : 1, '0')}`;
}

export function loadEmbeddings(path = EMBEDDINGS_PATH): EmbeddingsFile {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as EmbeddingsFile;
  } catch {
    return { model: 'text-embedding-004', dim: 768, vectors: {} };
  }
}

export function saveEmbeddings(data: EmbeddingsFile, path = EMBEDDINGS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const keys = Object.keys(data.vectors).sort();
  const vectors: Record<string, number[]> = {};
  for (const k of keys) vectors[k] = data.vectors[k];
  writeFileSync(path, `${JSON.stringify({ model: data.model, dim: data.dim, vectors }, null, 2)}\n`);
}
