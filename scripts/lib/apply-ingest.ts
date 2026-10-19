import type { Contribution, GNode, Link } from '../../src/types.ts';
import { anonymize } from '../../src/ai/anonymize.ts';
import type { GraphFile } from './graph-io.ts';
import { nextId, normalizeGraph } from './graph-io.ts';
import type { ExperienceDoc } from './parse-experience.ts';
import { parseTempRef, type IngestExtraction } from './schema.ts';
import { cosine } from './llm.ts';
import type { EmbeddingsFile } from './graph-io.ts';

export interface MergeNote {
  kind: 'scene' | 'principle' | 'idea' | 'meaning';
  action: 'merge' | 'new';
  id: string;
  title: string;
  existingTitle?: string;
  nearestId?: string;
  similarity?: number;
}

export interface ApplyResult {
  graph: GraphFile;
  contributionId: string;
  notes: MergeNote[];
  newNodeIds: string[];
}

export function textForEmbed(n: GNode): string {
  return `${n.title} ${n.desc ?? ''} ${(n.keywords ?? []).join(' ')}`.trim();
}

export function nearest(
  vec: number[] | undefined,
  layer: GNode['layer'],
  graph: GraphFile,
  embeddings: EmbeddingsFile,
): { id: string; title: string; similarity: number } | null {
  if (!vec) return null;
  let best: { id: string; title: string; similarity: number } | null = null;
  for (const n of graph.nodes) {
    if (n.layer !== layer) continue;
    const ev = embeddings.vectors[n.id];
    if (!ev) continue;
    const s = cosine(vec, ev);
    if (!best || s > best.similarity) best = { id: n.id, title: n.title, similarity: s };
  }
  return best;
}

function resolveRef(
  raw: string,
  created: string[],
  existing: Set<string>,
  mergeIds: (string | undefined)[],
): string {
  const temp = parseTempRef(raw);
  if (temp != null) {
    if (mergeIds[temp]) return mergeIds[temp]!;
    if (created[temp]) return created[temp];
    throw new Error(`临时 id ${raw} 无法解析`);
  }
  if (!existing.has(raw) && !created.includes(raw)) throw new Error(`节点 id ${raw} 不存在`);
  return raw;
}

export function applyExtraction(
  graph: GraphFile,
  doc: ExperienceDoc,
  extraction: IngestExtraction,
  embeddings: EmbeddingsFile,
  sceneVecs: (number[] | undefined)[],
): ApplyResult {
  const notes: MergeNote[] = [];
  const newNodeIds: string[] = [];
  const nodes: GNode[] = graph.nodes.map((n) => ({ ...n }));
  const links: Link[] = graph.links.map((l) => [l[0], l[1]]);
  const ids = () => nodes.map((n) => n.id);
  const byId = () => new Map(nodes.map((n) => [n.id, n]));
  const hasLink = (a: string, b: string) => links.some((l) => l[0] === a && l[1] === b);
  const addLink = (a: string, b: string) => { if (!hasLink(a, b)) links.push([a, b]); };
  const today = (doc.sourceDate && /^\d{4}-\d{2}-\d{2}$/.test(doc.sourceDate))
    ? doc.sourceDate
    : new Date().toISOString().slice(0, 10);
  const { text: story } = anonymize(doc.story);

  const cid = nextId('c', graph.contributions.map((c) => c.id));
  const existingMeaning = new Set(graph.nodes.filter((n) => n.layer === 'meaning').map((n) => n.id));
  const existingIdea = new Set(graph.nodes.filter((n) => n.layer === 'idea').map((n) => n.id));

  const meaningCreated: string[] = [];
  const meaningMerge: (string | undefined)[] = [];
  for (const meaning of extraction.meanings) {
    if (meaning.action === 'merge' && meaning.existingId) {
      const ex = byId().get(meaning.existingId);
      meaningMerge.push(meaning.existingId);
      meaningCreated.push('');
      notes.push({
        kind: 'meaning', action: 'merge', id: meaning.existingId,
        title: meaning.title, existingTitle: ex?.title ?? meaning.existingId,
        nearestId: meaning.existingId,
      });
      continue;
    }
    const mid = nextId('m', [...ids(), ...meaningCreated.filter(Boolean)]);
    meaningCreated.push(mid);
    meaningMerge.push(undefined);
    nodes.push({ id: mid, layer: 'meaning', title: meaning.title, desc: meaning.desc, createdAt: today });
    newNodeIds.push(mid);
    notes.push({ kind: 'meaning', action: 'new', id: mid, title: meaning.title });
  }

  const ideaCreated: string[] = [];
  const ideaMerge: (string | undefined)[] = [];
  for (const idea of extraction.ideas) {
    if (idea.action === 'merge' && idea.existingId) {
      const ex = byId().get(idea.existingId);
      ideaMerge.push(idea.existingId);
      ideaCreated.push('');
      notes.push({
        kind: 'idea', action: 'merge', id: idea.existingId,
        title: idea.title, existingTitle: ex?.title ?? idea.existingId,
        nearestId: idea.existingId,
      });
      continue;
    }
    const iid = nextId('i', [...ids(), ...ideaCreated.filter(Boolean)]);
    ideaCreated.push(iid);
    ideaMerge.push(undefined);
    const meaningId = resolveRef(idea.meaningId, meaningCreated, existingMeaning, meaningMerge);
    nodes.push({ id: iid, layer: 'idea', title: idea.title, desc: idea.desc, createdAt: today });
    newNodeIds.push(iid);
    addLink(iid, meaningId);
    notes.push({ kind: 'idea', action: 'new', id: iid, title: idea.title });
  }

  const sceneIds: string[] = [];
  extraction.scenes.forEach((s, i) => {
    const sid = nextId('s', [...ids(), ...sceneIds]);
    sceneIds.push(sid);
    const near = nearest(sceneVecs[i], 'scene', graph, embeddings);
    nodes.push({
      id: sid,
      layer: 'scene',
      title: s.title,
      desc: s.desc,
      tag: s.tag,
      contributionId: cid,
      createdAt: today,
    });
    newNodeIds.push(sid);
    addLink(s.areaId, sid);
    notes.push({
      kind: 'scene', action: 'new', id: sid, title: s.title,
      nearestId: near?.id, existingTitle: near?.title, similarity: near?.similarity,
    });
  });

  for (const p of extraction.principles) {
    let pid: string;
    if (p.action === 'merge' && p.existingId) {
      pid = p.existingId;
      const ex = byId().get(pid);
      notes.push({
        kind: 'principle', action: 'merge', id: pid,
        title: p.title, existingTitle: ex?.title ?? pid,
        nearestId: pid, similarity: p.similarity,
      });
    } else {
      pid = nextId('p', ids());
      const ideaId = resolveRef(p.ideaId, ideaCreated, existingIdea, ideaMerge);
      nodes.push({ id: pid, layer: 'principle', title: p.title, desc: p.desc, createdAt: today, keywords: [] });
      newNodeIds.push(pid);
      addLink(pid, ideaId);
      notes.push({
        kind: 'principle', action: 'new', id: pid, title: p.title,
        similarity: p.similarity, nearestId: p.nearestId, existingTitle: p.nearestTitle,
      });
    }
    for (const si of p.sceneIndexes) {
      const sid = sceneIds[si];
      if (sid) addLink(sid, pid);
    }
  }

  const curated = !!(doc.curatedBy || doc.sourceUrl);
  const contribution: Contribution = {
    id: cid,
    identity: {
      origin: doc.origin,
      profession: doc.profession,
      region: doc.region,
      age: doc.age,
      city: doc.city,
    },
    story,
    createdAt: today,
    sceneIds,
    engine: curated ? 'curated' : 'llm',
  };
  if (doc.name) contribution.name = doc.name;
  if (doc.curatedBy) contribution.curatedBy = doc.curatedBy;
  if (doc.sourceUrl) {
    contribution.source = {
      url: doc.sourceUrl,
      title: doc.sourceTitle || doc.title,
      publisher: doc.sourcePublisher || '',
      date: doc.sourceDate || today,
    };
  }

  const next: GraphFile = normalizeGraph({
    version: graph.version,
    contributions: [...graph.contributions, contribution],
    nodes,
    links,
    votes: graph.votes,
  });
  return { graph: next, contributionId: cid, notes, newNodeIds };
}

export function formatNote(n: MergeNote): string {
  const sim = n.similarity != null ? `，相似度 ${(n.similarity * 100).toFixed(0)}%` : '';
  if (n.action === 'merge') {
    const existing = n.existingTitle ?? n.title;
    const extracted = n.existingTitle && n.existingTitle !== n.title ? `（模型标题「${n.title}」）` : '';
    return `合并${n.kind} ${n.id}「${existing}」${extracted}${sim}`;
  }
  const near = n.nearestId ? ` ← ${n.nearestId}${n.existingTitle ? `「${n.existingTitle}」` : ''}` : '';
  return `新建${n.kind} ${n.id}「${n.title}」${near}${sim}`;
}
