import { useState } from 'react';
import type { AppData, Contribution, GNode } from '../types';
import { LI, LAYERS, breakdown, codeOf, identityText, layerOf, type Index, type View } from '../lib/graph';
import { DIMS, ORIGIN_COLORS, displayIdentityValue } from '../data/identity';

interface Props {
  node: GNode | null;
  data: AppData;
  idx: Index;
  view: View;
  filterOn: boolean;
  locked: boolean;
  onSelect: (id: string | null) => void;
  onVote: (id: string) => void;
}

function engineBadge(c: Contribution): string {
  if (c.demo) return 'DEMO';
  if (c.engine === 'llm') return 'LLM';
  if (c.engine === 'curated') return '整理';
  if (c.engine === 'seed') return 'DEMO';
  return 'USER';
}

function Story({ c, scenes, onSelect }: { c: Contribution; scenes: GNode[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const who = [c.name, identityText({ ...c.identity, origin: '' })].filter(Boolean).join(' · ');
  return (
    <div className="story">
      <div className="st-h">
        <span className="og" style={{ ['--oc' as string]: ORIGIN_COLORS[c.identity.origin] ?? '#00f0ff' }}>{displayIdentityValue('origin', c.identity.origin)}</span>
        <span className="st-id">{who}</span>
        <em>{engineBadge(c)} · {c.createdAt}</em>
      </div>
      {(c.curatedBy || c.source) && (
        <div className="st-meta">
          {c.curatedBy ? <span>整理：{c.curatedBy}</span> : null}
          {c.source?.url ? (
            <a className="src" href={c.source.url} target="_blank" rel="noopener noreferrer" data-testid="source-link">
              来源{c.source.title ? ` · ${c.source.title}` : ''}
            </a>
          ) : null}
        </div>
      )}
      {scenes.map((s) => <div key={s.id} className="st-scene" onClick={() => onSelect(s.id)}>↳ {s.title}</div>)}
      <p className={open ? '' : 'clamp4'}>{c.story}</p>
      {c.story.length > 80 && <button type="button" className="lnk" onClick={() => setOpen(!open)}>{open ? '收起' : '展开原文'}</button>}
    </div>
  );
}

export function DetailPanel({ node: n, data, idx, view, filterOn, locked, onSelect, onVote }: Props) {
  if (!n) return <div className="detail" data-testid="detail" />;
  const L = layerOf(n.layer);
  const ups = (idx.ups.get(n.id) ?? []).map((x) => idx.byId.get(x)!).filter(Boolean);
  const downs = (idx.downs.get(n.id) ?? []).map((x) => idx.byId.get(x)!).filter(Boolean);
  const sup = view.support.get(n.id) ?? new Set<string>();
  const supAll = view.supportAll.get(n.id) ?? new Set<string>();
  const pill = (m: GNode) => (
    <span key={m.id} className={`pill${view.visible.has(m.id) ? '' : ' dim'}`} style={{ ['--pc' as string]: layerOf(m.layer).color }} onClick={() => onSelect(m.id)}>
      {m.title}
    </span>
  );
  const contribs = [...sup].map((c) => idx.contrib.get(c)!).filter(Boolean);
  const scenesOf = (c: Contribution) =>
    c.sceneIds.map((s) => idx.byId.get(s)!).filter((s) => s && (n.layer === 'scene' ? s.id === n.id : walkDown(s.id).has(n.id)));
  const walkDown = (id: string) => {
    const out = new Set<string>(); const st = [id];
    while (st.length) { const c = st.pop()!; for (const x of idx.downs.get(c) ?? []) if (!out.has(x)) { out.add(x); st.push(x); } }
    return out;
  };
  const voted = data.myVotes.includes(n.id);
  const li = LI[n.layer];

  return (
    <div className={`detail${locked ? ' open' : ''}`} data-testid="detail">
      <div className="dp" style={{ ['--c' as string]: L.color }}>
        <div className="top">
          <span>{L.en} · {codeOf(n, data.nodes)}</span>
          <button type="button" className="x" title="关闭 (Esc)" onClick={() => onSelect(null)}>✕</button>
        </div>
        <h2>{n.title}</h2>
        <div className="date">{n.layer === 'scene' ? `#${n.tag || '未分类'} · ` : ''}{n.createdAt ?? '—'}{n.user ? ' · 社区新增' : n.demo ? ' · 示例数据' : ''}</div>
        <div className="bar" />
        {n.desc && <><h4>描述 DESCRIPTION</h4><p>{n.desc}</p></>}

        {n.layer !== 'area' && (
          <div className="stats">
            <div><b>{sup.size}</b><span>{filterOn ? '当前筛选下支持者' : '位贡献者支持'}</span></div>
            {filterOn && <div><b>{supAll.size}</b><span>全部支持者</span></div>}
            {n.layer === 'principle' && (
              <button type="button" className={`vote${voted ? ' on' : ''}`} onClick={() => onVote(n.id)} data-testid="vote">
                ▲ 有用 <b>{data.votes[n.id] ?? 0}</b>
              </button>
            )}
          </div>
        )}

        {n.layer !== 'area' && n.layer !== 'scene' && sup.size > 0 && (
          <>
            <h4>身份分布 IDENTITY{filterOn ? ' · 当前筛选' : ''}</h4>
            {DIMS.map((d) => {
              const rows = breakdown(sup, idx, d.key);
              return (
                <div className="bd" key={d.key}>
                  <span className="bd-l">{d.name}</span>
                  <div className="bd-r">
                    {rows.map(([v, k]) => (
                      <span key={v} className="bd-i" title={`${v} ${k}人`}>
                        <i style={{ width: `${(k / sup.size) * 100}%`, background: d.key === 'origin' ? ORIGIN_COLORS[v] ?? 'var(--c)' : 'var(--c)' }} />
                        <em>{v} {k}</em>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {n.layer !== 'area' && contribs.length > 0 && (
          <>
            <h4>{n.layer === 'scene' ? '原始故事 STORY' : `原始故事 STORIES · ${contribs.length}`}</h4>
            {(n.layer === 'meaning' || n.layer === 'idea' ? contribs.slice(0, 6) : contribs).map((c) => (
              <Story key={c.id} c={c} scenes={scenesOf(c)} onSelect={onSelect} />
            ))}
            {(n.layer === 'meaning' || n.layer === 'idea') && contribs.length > 6 && <div className="none">…… 还有 {contribs.length - 6} 个故事，点击上游原则查看</div>}
          </>
        )}

        {n.layer === 'area' && (
          <><h4>包含场景 SCENES · {downs.length}</h4><div className="pills">{downs.map(pill)}</div></>
        )}
        {n.layer !== 'area' && (
          <>
            <h4>上游 {LAYERS[li - 1].name} ⟵</h4>
            {ups.length ? <div className="pills">{ups.map(pill)}</div> : <div className="none">— 无 —</div>}
          </>
        )}
        {n.layer !== 'meaning' && n.layer !== 'area' && (
          <>
            <h4>下游 ⟶ {LAYERS[li + 1].name}</h4>
            {downs.length ? <div className="pills">{downs.map(pill)}</div> : <div className="none">— 尚未提炼 —</div>}
          </>
        )}
      </div>
    </div>
  );
}
