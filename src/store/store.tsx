import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { SEED, SEED_VERSION, seedClone } from '../data/seed';
import type { AppData } from '../types';

const MY_VOTES_KEY = 'life-experience.myVotes';

type Action = { type: 'vote'; id: string } | { type: 'reset' };

function loadMyVotes(): string[] {
  try {
    const raw = localStorage.getItem(MY_VOTES_KEY);
    if (raw) {
      const votes = JSON.parse(raw) as unknown;
      if (Array.isArray(votes) && votes.every((x) => typeof x === 'string')) return votes;
    }
  } catch { /* ignore */ }
  return [];
}

function saveMyVotes(votes: string[]) {
  try { localStorage.setItem(MY_VOTES_KEY, JSON.stringify(votes)); } catch { /* ignore */ }
}

function initialData(): AppData {
  const data = seedClone();
  return { ...data, version: SEED_VERSION, myVotes: loadMyVotes(), contributorCount: data.contributions.length };
}

function reducer(d: AppData, a: Action): AppData {
  switch (a.type) {
    case 'vote': {
      const mine = d.myVotes.includes(a.id);
      const n = Math.max(0, (d.votes[a.id] ?? 0) + (mine ? -1 : 1));
      const newVotes = mine ? d.myVotes.filter((x) => x !== a.id) : [...d.myVotes, a.id];
      saveMyVotes(newVotes);
      return { ...d, votes: { ...d.votes, [a.id]: n }, myVotes: newVotes };
    }
    case 'reset':
      try { localStorage.removeItem(MY_VOTES_KEY); } catch { /* ignore */ }
      return { ...seedClone(), myVotes: [], contributorCount: SEED.contributions.length };
  }
}

interface Ctx {
  data: AppData;
  vote: (id: string) => void;
  reset: () => void;
  exportJson: () => void;
}
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, initialData);

  const api = useMemo<Ctx>(() => ({
    data,
    vote: (id) => dispatch({ type: 'vote', id }),
    reset: () => dispatch({ type: 'reset' }),
    exportJson: () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `life-experience-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  }), [data]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore 必须在 StoreProvider 内使用');
  return c;
}
