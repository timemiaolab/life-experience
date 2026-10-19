import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { EMPTY_FILTER, type Filter, type Layer } from './types';
import { useStore } from './store/store';
import { LAYERS, buildIndex, computeView, filterActive, orderLayers, walk } from './lib/graph';
import { Sidebar } from './components/Sidebar';
import { FilterBar } from './components/FilterBar';
import { TreeView } from './components/TreeView';
import { DetailPanel } from './components/DetailPanel';
import { Toast } from './components/Toast';

const SubmitStory = lazy(() => import('./components/SubmitStory'));

export default function App() {
  const { data, vote, reset, exportJson } = useStore();
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [fresh] = useState<Set<string>>(() => new Set());
  const [flashLayer, setFlashLayer] = useState<{ k: Layer; t: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; t: number } | null>(null);
  const [scrollTarget] = useState<{ id: string; t: number } | null>(null);
  const say = (text: string) => setToast({ text, t: Date.now() });

  const idx = useMemo(() => buildIndex(data), [data]);
  const view = useMemo(() => computeView(data, idx, filter), [data, idx, filter]);
  const order = useMemo(() => orderLayers(data.nodes, idx), [data.nodes, idx]);
  const filterOn = filterActive(filter);

  const sel = selected && view.visible.has(selected) ? selected : null;
  const focusId = locked ? sel : (hovered || sel);
  const focusSet = useMemo(() => {
    const up = (i: string) => (idx.ups.get(i) ?? []).filter((x) => view.visible.has(x));
    const dn = (i: string) => (idx.downs.get(i) ?? []).filter((x) => view.visible.has(x));
    const path = (id: string) => [id, ...walk(id, up), ...walk(id, dn)];
    if (focusId) return new Set(path(focusId));
    return null;
  }, [focusId, idx, view.visible]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(LAYERS.map((l) => [l.key, 0])) as Record<Layer, number>;
    for (const n of data.nodes) if (view.visible.has(n.id)) c[n.layer]++;
    return c;
  }, [data.nodes, view.visible]);

  const contributorTotal = data.contributions.length;

  const handleSelect = useCallback((id: string | null) => {
    if (id === null) {
      setSelected(null);
      setLocked(false);
    } else if (selected === id && locked) {
      setSelected(null);
      setLocked(false);
    } else {
      setSelected(id);
      setLocked(true);
    }
  }, [selected, locked]);

  const handleCanvasClick = useCallback(() => {
    if (locked) {
      setSelected(null);
      setLocked(false);
    }
  }, [locked]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && locked) {
        setSelected(null);
        setLocked(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [locked]);

  const node = sel ? idx.byId.get(sel) ?? null : null;

  return (
    <div className="app">
      <Sidebar
        counts={counts}
        activeLayer={(focusId && idx.byId.get(focusId)?.layer) || flashLayer?.k || null}
        onJump={(k) => { setFlashLayer({ k, t: Date.now() }); window.setTimeout(() => setFlashLayer((f) => (f && Date.now() - f.t >= 1500 ? null : f)), 1600); }}
        people={{ matched: view.matchedContribs.size, total: contributorTotal }}
      />
      <main>
        <header>
          <div className="ttl">
            <h1 className="glitch" data-text="人生经验社区">人生经验社区</h1>
            <div className="en">
              SCENE <span>›</span> PRINCIPLE <span>›</span> IDEA <span>›</span> MEANING
              <small>借一段你没走过的路</small>
            </div>
          </div>
          <div className="tools">
            <span className="hint">
              {locked ? '🔒 已锁定 · 点击其他卡片切换 · Esc/点空白解锁' : '悬停预览 · 点击锁定高亮'}
            </span>
            <button type="button" className="btn mag" data-testid="open-submit" onClick={() => setSubmitOpen(true)}>＋ 讲一件事</button>
            <button type="button" className="btn ghost" onClick={exportJson} title="导出当前数据为 JSON">导出</button>
            <button type="button" className="btn ghost" title="清除本地「有用」标记"
              onClick={() => { if (confirm('清除本机「有用」标记并恢复视图？')) { reset(); setSelected(null); setLocked(false); setFilter(EMPTY_FILTER); say('已恢复'); } }}>重置</button>
          </div>
        </header>
        <FilterBar filter={filter} onChange={setFilter} contributions={data.contributions} matched={view.matchedContribs.size} />
        <div className="body">
          <TreeView
            data={data} idx={idx} view={view} order={order} focusSet={focusSet}
            selected={sel} locked={locked} onSelect={handleSelect} onHover={setHovered} onCanvasClick={handleCanvasClick}
            fresh={fresh} scrollTarget={scrollTarget} flashLayer={flashLayer} originFilter={filter.origin} filterOn={filterOn}
          />
          <DetailPanel node={node} data={data} idx={idx} view={view} filterOn={filterOn} onSelect={handleSelect} locked={locked}
            onVote={(id) => { const had = data.myVotes.includes(id); vote(id); say(had ? '已取消「有用」' : '已标记为「有用」· 保存在本地'); }} />
        </div>
      </main>
      {submitOpen && (
        <Suspense fallback={null}>
          <SubmitStory open={submitOpen} onClose={() => setSubmitOpen(false)} />
        </Suspense>
      )}
      <Toast msg={toast} />
    </div>
  );
}
