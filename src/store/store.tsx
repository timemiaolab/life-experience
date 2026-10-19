import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { SEED_VERSION, seedClone } from '../data/seed';
import type { AppData, Contribution, GNode, Identity, Link } from '../types';
import type { PrincipleDraft, SceneDraft } from '../ai/types';
import { fetchApprovedGraph, submitStory } from '../lib/api';
import { supabase } from '../lib/supabase';

export const STORE_KEY = 'life-experience.v1';
const MY_VOTES_KEY = 'life-experience.myVotes';

export interface CommitPayload {
  identity: Identity;
  story: string;
  engine: 'mock' | 'llm';
  scenes: SceneDraft[];
  principles: PrincipleDraft[];
}

export interface CommitResult { 
  nodeIds: string[]; 
  linkKeys: string[]; 
  focusId: string | null; 
  contributionId: string;
  submitted?: boolean; // true when submitted to Supabase instead of local commit
}

type Action =
  | { type: 'commit'; payload: CommitPayload; ids: CommitIds }
  | { type: 'vote'; id: string }
  | { type: 'reset' }
  | { type: 'replace'; data: AppData }
  | { type: 'load_supabase'; data: AppData };

interface CommitIds { cid: string; sceneIds: string[]; principleIds: (string | null)[] }

function loadFromLocalStorage(): AppData {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as AppData;
      if (d && d.version === SEED_VERSION && Array.isArray(d.nodes) && Array.isArray(d.links) && Array.isArray(d.contributions)) {
        return { ...d, votes: d.votes ?? {}, myVotes: d.myVotes ?? [] };
      }
    }
  } catch { /* 数据损坏时回退到示例 */ }
  return seedClone();
}

function loadMyVotes(): string[] {
  try {
    const raw = localStorage.getItem(MY_VOTES_KEY);
    if (raw) {
      const votes = JSON.parse(raw);
      if (Array.isArray(votes)) return votes;
    }
  } catch { /* ignore */ }
  return [];
}

function saveMyVotes(votes: string[]) {
  try {
    localStorage.setItem(MY_VOTES_KEY, JSON.stringify(votes));
  } catch { /* ignore */ }
}

/** 把整理结果写入图：投稿 → 场景 → 原则（合并 / 新建）→ 理念 */
export function applyCommit(d: AppData, p: CommitPayload, ids: CommitIds): { data: AppData; result: CommitResult } {
  const now = new Date().toISOString().slice(0, 10);
  const nodes: GNode[] = [...d.nodes];
  const links: Link[] = [...d.links];
  const has = (a: string, b: string) => links.some((l) => l[0] === a && l[1] === b);
  const newNodes: string[] = [];
  const newLinks: string[] = [];
  const addLink = (a: string, b: string) => { if (!has(a, b)) { links.push([a, b]); newLinks.push(`${a}>${b}`); } };

  p.scenes.forEach((s, i) => {
    const sid = ids.sceneIds[i];
    nodes.push({ id: sid, layer: 'scene', title: s.title.trim(), desc: s.desc.trim(), tag: s.tag.trim() || '未分类', contributionId: ids.cid, createdAt: now, user: true });
    newNodes.push(sid);
    addLink(s.areaId, sid);
  });
  let focus: string | null = null;
  p.principles.forEach((pr, i) => {
    let pid: string;
    if (pr.action === 'merge' && pr.existingId && nodes.some((n) => n.id === pr.existingId)) {
      pid = pr.existingId;
    } else {
      pid = ids.principleIds[i]!;
      nodes.push({ id: pid, layer: 'principle', title: pr.title.trim(), desc: pr.desc.trim(), createdAt: now, user: true, keywords: [] });
      newNodes.push(pid);
      if (pr.ideaId) addLink(pid, pr.ideaId);
    }
    focus ??= pid;
    pr.sceneIndexes.forEach((si) => { const sid = ids.sceneIds[si]; if (sid) addLink(sid, pid); });
  });
  const contribution: Contribution = { id: ids.cid, identity: p.identity, story: p.story, createdAt: now, sceneIds: ids.sceneIds.slice(0, p.scenes.length), engine: p.engine };
  return {
    data: { ...d, nodes, links, contributions: [...d.contributions, contribution] },
    result: { nodeIds: newNodes, linkKeys: newLinks, focusId: focus ?? ids.sceneIds[0] ?? null, contributionId: ids.cid },
  };
}

function reducer(d: AppData, a: Action): AppData {
  switch (a.type) {
    case 'commit': return applyCommit(d, a.payload, a.ids).data;
    case 'vote': {
      const mine = d.myVotes.includes(a.id);
      const n = Math.max(0, (d.votes[a.id] ?? 0) + (mine ? -1 : 1));
      const newVotes = mine ? d.myVotes.filter((x) => x !== a.id) : [...d.myVotes, a.id];
      saveMyVotes(newVotes);
      return { ...d, votes: { ...d.votes, [a.id]: n }, myVotes: newVotes };
    }
    case 'reset': return seedClone();
    case 'replace': return a.data;
    case 'load_supabase': {
      // Merge Supabase data with local myVotes
      return { ...a.data, myVotes: loadMyVotes() };
    }
  }
}

interface Ctx {
  data: AppData;
  commit: (p: CommitPayload) => Promise<CommitResult>;
  vote: (id: string) => void;
  reset: () => void;
  exportJson: () => void;
  loading: boolean;
  usingSupabase: boolean;
}
const StoreCtx = createContext<Ctx | null>(null);

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, loadFromLocalStorage);
  const [loading, setLoading] = useState(true);
  const [usingSupabase, setUsingSupabase] = useState(false);

  // Load data from Supabase on mount (fallback to localStorage)
  useEffect(() => {
    async function loadData() {
      if (!supabase) {
        setLoading(false);
        setUsingSupabase(false);
        return;
      }

      const result = await fetchApprovedGraph();
      if (result.success && result.data) {
        dispatch({ type: 'load_supabase', data: result.data });
        setUsingSupabase(true);
      } else {
        console.warn('Failed to load from Supabase, using local seed:', result.error);
        setUsingSupabase(false);
      }
      setLoading(false);
    }

    loadData();
  }, []);

  // Persist to localStorage only when not using Supabase
  useEffect(() => {
    if (!usingSupabase) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* 存储满或被禁用 */ }
    }
  }, [data, usingSupabase]);

  const api = useMemo<Ctx>(() => ({
    data,
    loading,
    usingSupabase,
    commit: async (payload) => {
      // If Supabase is configured, submit to backend
      if (supabase && usingSupabase) {
        const result = await submitStory({
          identity: payload.identity,
          story: payload.story,
        });

        if (result.success) {
          // Return a result indicating submission succeeded
          return {
            nodeIds: [],
            linkKeys: [],
            focusId: null,
            contributionId: result.submissionId || '',
            submitted: true,
          };
        } else {
          console.error('Failed to submit to Supabase:', result.error);
          // Fall through to local commit
        }
      }

      // Local commit (when Supabase unavailable or submission failed)
      const ids: CommitIds = {
        cid: uid('c'),
        sceneIds: payload.scenes.map(() => uid('s')),
        principleIds: payload.principles.map((p) => (p.action === 'new' ? uid('p') : null)),
      };
      const { result } = applyCommit(data, payload, ids);
      dispatch({ type: 'commit', payload, ids });
      return result;
    },
    vote: (id) => dispatch({ type: 'vote', id }),
    reset: () => { 
      try { 
        localStorage.removeItem(STORE_KEY); 
        localStorage.removeItem(MY_VOTES_KEY);
      } catch { /* ignore */ } 
      dispatch({ type: 'reset' }); 
    },
    exportJson: () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `life-experience-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  }), [data, loading, usingSupabase]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore 必须在 StoreProvider 内使用');
  return c;
}
