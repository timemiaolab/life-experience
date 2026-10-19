import { DIMS, emptyFilter } from '../data/identity';
import type { Filter } from '../types';

/** Parse shareable `?origin=农村,县城&age=95后` query into a filter. */
export function readFilterQuery(search = typeof window !== 'undefined' ? window.location.search : ''): Filter {
  const f = emptyFilter();
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const d of DIMS) {
    const raw = q.getAll(d.key).join(',');
    if (!raw) continue;
    const vals = raw.split(',').map((s) => s.trim()).filter(Boolean);
    f[d.key] = [...new Set(vals)];
  }
  return f;
}

export function writeFilterQuery(f: Filter): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const d of DIMS) url.searchParams.delete(d.key);
  for (const d of DIMS) {
    const vals = f[d.key] ?? [];
    if (vals.length) url.searchParams.set(d.key, vals.join(','));
  }
  const qs = url.searchParams.toString();
  const next = `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== cur) history.replaceState(null, '', next);
}
