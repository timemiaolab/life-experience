import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { DIMS, FILTER_VISIBLE_ROWS, ORIGIN_COLORS, emptyFilter, type DimDef } from '../data/identity';
import type { Contribution, Filter } from '../types';
import { filterActive } from '../lib/graph';

interface Props {
  filter: Filter;
  onChange: (f: Filter) => void;
  contributions: Contribution[];
  matched: number;
}

function DimRow({
  d, filter, contributions, onChange,
}: {
  d: DimDef;
  filter: Filter;
  contributions: Contribution[];
  onChange: (f: Filter) => void;
}) {
  const clipRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(0);
  const [open, setOpen] = useState(false);
  const selected = filter[d.key] ?? [];

  const count = (v: string) => contributions.filter((c) => c.identity[d.key] === v).length;
  const extra = [...new Set(contributions.map((c) => c.identity[d.key]))].filter((v) => !d.options.includes(v));
  const opts = [...d.options, ...extra].filter((v) => count(v) > 0 || selected.includes(v));

  const toggle = (v: string) => {
    const cur = filter[d.key] ?? [];
    onChange({ ...filter, [d.key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const clear = () => onChange({ ...filter, [d.key]: [] });

  const measure = useCallback(() => {
    const wrap = chipsRef.current;
    if (!wrap) return;
    const chips = [...wrap.querySelectorAll<HTMLElement>('[data-chip]')];
    if (!chips.length) {
      setHidden(0);
      return;
    }
    const rowTop = chips[0].offsetTop;
    let n = 0;
    for (const c of chips) if (c.offsetTop - rowTop > 3) n++;
    setHidden((prev) => (prev === n ? prev : n));
  }, []);

  useLayoutEffect(() => {
    const wrap = chipsRef.current;
    const clip = clipRef.current;
    if (!wrap) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    if (clip) ro.observe(clip);
    return () => ro.disconnect();
  }, [measure, opts.length, open]);

  return (
    <>
      <span className="fb-l">{d.name}<i>{d.en}</i></span>
      <div className={`fb-chips-clip${open ? ' open' : ''}`} ref={clipRef}>
        <div className="fb-chips" ref={chipsRef}>
          {opts.map((v) => {
            const on = selected.includes(v);
            const c = d.key === 'origin' ? ORIGIN_COLORS[v] ?? '#00f0ff' : '#00f0ff';
            const id = `flt-${d.key}-${v}`;
            return (
              <label
                key={v}
                className={`chipbtn${on ? ' on' : ''}`}
                style={{ ['--pc' as string]: c }}
                data-dim={d.key}
                data-val={v}
                data-chip=""
                htmlFor={id}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(v)}
                />
                {v}<em>{count(v)}</em>
              </label>
            );
          })}
        </div>
      </div>
      <div className="fb-meta">
        {selected.length > 0 && <span className="fb-sel">{selected.length} 项</span>}
        {hidden > 0 && (
          <button
            type="button"
            className="fb-link"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '收起' : `展开 (+${hidden})`}
          </button>
        )}
        <button type="button" className="fb-link" disabled={!selected.length} onClick={clear}>清空</button>
      </div>
    </>
  );
}

/** 身份筛选：维度来自 DIMS；维内多选（或），维间（且）。 */
export function FilterBar({ filter, onChange, contributions, matched }: Props) {
  const [more, setMore] = useState(false);
  const extra = Math.max(0, DIMS.length - FILTER_VISIBLE_ROWS);
  const rows = more || extra === 0 ? DIMS : DIMS.slice(0, FILTER_VISIBLE_ROWS);
  const active = filterActive(filter);

  return (
    <div className="filterbar" data-testid="filterbar">
      <div className="fb-dims">
        {rows.map((d) => (
          <DimRow
            key={d.key}
            d={d}
            filter={filter}
            contributions={contributions}
            onChange={onChange}
          />
        ))}
        {extra > 0 && (
          <button
            type="button"
            className="fb-more"
            data-testid="more-filters"
            aria-expanded={more}
            onClick={() => setMore((m) => !m)}
          >
            {more ? '收起筛选' : `更多筛选 (+${extra})`}
          </button>
        )}
      </div>
      <div className="fb-r">
        <span className="fb-stat">
          {active ? <>匹配 <b>{matched}</b> / {contributions.length} 位贡献者</> : <>全部 <b>{contributions.length}</b> 位贡献者</>}
        </span>
        <button
          type="button"
          className="btn ghost sm"
          disabled={!active}
          onClick={() => onChange(emptyFilter())}
        >
          清空筛选
        </button>
      </div>
    </div>
  );
}
