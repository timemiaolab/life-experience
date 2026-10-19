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
  encoding?: 'f16le-b64' | 'json';
  vectors: Record<string, number[]>;
}

/** IEEE-754 binary16 (little-endian) helpers so embeddings.json stays one line per id. */
function floatToF16(f: number): number {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, f);
  const x = dv.getUint32(0);
  const s = (x >>> 16) & 0x8000;
  const e = ((x >>> 23) & 0xff) - 127 + 15;
  const m = x & 0x7fffff;
  if (e <= 0) {
    if (e < -10) return s;
    return s | ((m | 0x800000) >> (14 - e));
  }
  if (e === 0xff - 127 + 15) return s | 0x7c00 | (m ? 0x200 : 0);
  if (e > 30) return s | 0x7c00;
  return s | (e << 10) | (m >>> 13);
}

function f16ToFloat(h: number): number {
  const s = (h & 0x8000) << 16;
  let e = (h >> 10) & 0x1f;
  let m = h & 0x3ff;
  if (e === 0) {
    if (m === 0) {
      const dv = new DataView(new ArrayBuffer(4));
      dv.setUint32(0, s);
      return dv.getFloat32(0);
    }
    e = 1;
    while ((m & 0x400) === 0) {
      m <<= 1;
      e--;
    }
    m &= 0x3ff;
    e = e - 15 + 127;
  } else if (e === 31) {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setUint32(0, s | 0x7f800000 | (m << 13));
    return dv.getFloat32(0);
  } else {
    e = e - 15 + 127;
  }
  const dv = new DataView(new ArrayBuffer(4));
  dv.setUint32(0, s | (e << 23) | (m << 13));
  return dv.getFloat32(0);
}

export function encodeVecF16(vec: number[]): string {
  const buf = Buffer.alloc(vec.length * 2);
  for (let i = 0; i < vec.length; i++) buf.writeUInt16LE(floatToF16(vec[i]), i * 2);
  return buf.toString('base64');
}

export function decodeVecF16(b64: string): number[] {
  const buf = Buffer.from(b64, 'base64');
  const out: number[] = [];
  for (let i = 0; i + 1 < buf.length; i += 2) out.push(f16ToFloat(buf.readUInt16LE(i)));
  return out;
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
    const raw = JSON.parse(readFileSync(path, 'utf8')) as {
      model?: string;
      dim?: number;
      encoding?: string;
      vectors?: Record<string, unknown>;
    };
    const vectors: Record<string, number[]> = {};
    for (const [id, v] of Object.entries(raw.vectors ?? {})) {
      if (Array.isArray(v) && v.every((x) => typeof x === 'number')) vectors[id] = v as number[];
      else if (typeof v === 'string') vectors[id] = decodeVecF16(v);
    }
    return {
      model: raw.model || 'gemini-embedding-001',
      dim: raw.dim || 768,
      encoding: 'f16le-b64',
      vectors,
    };
  } catch {
    return { model: 'gemini-embedding-001', dim: 768, encoding: 'f16le-b64', vectors: {} };
  }
}

export function saveEmbeddings(data: EmbeddingsFile, path = EMBEDDINGS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const keys = Object.keys(data.vectors).sort();
  const lines = [
    '{',
    `  "model": ${JSON.stringify(data.model)},`,
    `  "dim": ${data.dim},`,
    '  "encoding": "f16le-b64",',
    '  "vectors": {',
  ];
  keys.forEach((k, i) => {
    const comma = i < keys.length - 1 ? ',' : '';
    lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(encodeVecF16(data.vectors[k]))}${comma}`);
  });
  lines.push('  }', '}', '');
  writeFileSync(path, lines.join('\n'));
}
