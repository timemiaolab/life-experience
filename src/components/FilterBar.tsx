import { DIMS, ORIGIN_COLORS } from '../data/identity';
import type { Contribution, Filter, IdentityDim } from '../types';
import { filterActive } from '../lib/graph';

interface Props {
  filter: Filter;
  onChange: (f: Filter) => void;
  contributions: Contribution[];
  matched: number;
}

/** 身份筛选：维度内多选（或），维度之间（且） */
export function FilterBar({ filter, onChange, contributions, matched }: Props) {
  const count = (dim: IdentityDim, v: string) => contributions.filter((c) => c.identity[dim] === v).length;
  const toggle = (dim: IdentityDim, v: string) => {
    const cur = filter[dim];
    onChange({ ...filter, [dim]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const active = filterActive(filter);
  return (
    <div className="filterbar" data-testid="filterbar">
      <div className="fb-dims">
        {DIMS.map((d) => {
          const extra = [...new Set(contributions.map((c) => c.identity[d.key]))].filter((v) => !d.options.includes(v));
          const opts = [...d.options, ...extra].filter((v) => count(d.key, v) > 0 || filter[d.key].includes(v));
          return (
            <div className="fb-dim" key={d.key}>
              <span className="fb-l">{d.name}<i>{d.en}</i></span>
              {opts.map((v) => {
                const on = filter[d.key].includes(v);
                const c = d.key === 'origin' ? ORIGIN_COLORS[v] ?? '#00f0ff' : '#00f0ff';
                return (
                  <button
                    key={v}
                    type="button"
                    className={`chipbtn${on ? ' on' : ''}`}
                    style={{ ['--pc' as string]: c }}
                    data-dim={d.key}
                    data-val={v}
                    aria-pressed={on}
                    onClick={() => toggle(d.key, v)}
                  >
                    {v}<em>{count(d.key, v)}</em>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="fb-r">
        <span className="fb-stat">
          {active ? <>匹配 <b>{matched}</b> / {contributions.length} 位贡献者</> : <>全部 <b>{contributions.length}</b> 位贡献者</>}
        </span>
        <button type="button" className="btn ghost sm" disabled={!active} onClick={() => onChange({ origin: [], profession: [], region: [], age: [] })}>清空筛选</button>
      </div>
    </div>
  );
}
