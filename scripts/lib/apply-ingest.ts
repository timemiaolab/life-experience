import type { Contribution, GNode, Link } from '../../src/types.ts';
import { anonymize } from '../../src/ai/anonymize.ts';
import type { GraphFile } from './graph-io.ts';
import { nextId, normalizeGraph } from './graph-io.ts';
import type { ExperienceDoc } from './parse-experience.ts';
import type { IngestExtraction } from './schema.ts';
import { cosine } from './llm.ts';
import type { EmbeddingsFile } from './graph-io.ts';

export interface MergeNote {
  kind: 'principle' | 'idea' | 'meaning';
  action: 'merge' | 'new';
  id: string;
  title: string;
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
): { id: string; similarity: number } | null {
  if (!vec) return null;
  let best: { id: string; similarity: number } | null = null;
  for (const n of graph.nodes) {
    if (n.layer !== layer) continue;
    const ev = embeddings.vectors[n.id];
    if (!ev) continue;
    const s = cosine(vec, ev);
    if (!best || s > best.similarity) best = { id: n.id, similarity: s };
  }
  return best;
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
  const hasLink = (a: string, b: string) => links.some((l) => l[0] === a && l[1] === b);
  const addLink = (a: string, b: string) => { if (!hasLink(a, b)) links.push([a, b]); };
  const today = new Date().toISOString().slice(0, 10);
  const { text: story } = anonymize(doc.story);

  const cid = nextId('c', graph.contributions.map((c) => c.id));
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
    if (near) notes.push({ kind: 'principle', action: 'new', id: sid, title: s.title, nearestId: near.id, similarity: near.similarity });
  });

  for (const p of extraction.principles) {
    let pid: string;
    if (p.action === 'merge' && p.existingId) {
      pid = p.existingId;
      notes.push({ kind: 'principle', action: 'merge', id: pid, title: p.title, nearestId: p.existingId });
    } else {
      pid = nextId('p', ids());
      nodes.push({ id: pid, layer: 'principle', title: p.title, desc: p.desc, createdAt: today, keywords: [] });
      newNodeIds.push(pid);
      addLink(pid, p.ideaId);
      notes.push({ kind: 'principle', action: 'new', id: pid, title: p.title });
    }
    for (const si of p.sceneIndexes) {
      const sid = sceneIds[si];
      if (sid) addLink(sid, pid);
    }
  }

  for (const idea of extraction.ideas) {
    if (idea.action === 'merge' && idea.existingId) {
      notes.push({ kind: 'idea', action: 'merge', id: idea.existingId, title: idea.title, nearestId: idea.existingId });
      continue;
    }
    const iid = nextId('i', ids());
    nodes.push({ id: iid, layer: 'idea', title: idea.title, desc: idea.desc, createdAt: today });
    newNodeIds.push(iid);
    addLink(iid, idea.meaningId);
    notes.push({ kind: 'idea', action: 'new', id: iid, title: idea.title });
  }

  for (const meaning of extraction.meanings) {
    if (meaning.action === 'merge' && meaning.existingId) {
      notes.push({ kind: 'meaning', action: 'merge', id: meaning.existingId, title: meaning.title, nearestId: meaning.existingId });
      continue;
    }
    const mid = nextId('m', ids());
    nodes.push({ id: mid, layer: 'meaning', title: meaning.title, desc: meaning.desc, createdAt: today });
    newNodeIds.push(mid);
    notes.push({ kind: 'meaning', action: 'new', id: mid, title: meaning.title });
  }

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
    engine: 'llm',
  };

  const next: GraphFile = normalizeGraph({
    version: graph.version,
    contributions: [...graph.contributions, contribution],
    nodes,
    links,
    votes: graph.votes,
  });
  return { graph: next, contributionId: cid, notes, newNodeIds };
}
