import { useCallback, useMemo, useRef, useState } from 'react';
import { EMPTY_FILTER, type Filter, type Layer } from './types';
import { useStore, type CommitPayload } from './store/store';
import { LAYERS, buildIndex, computeView, filterActive, matchIdentity, orderLayers, walk } from './lib/graph';
import { Sidebar } from './components/Sidebar';
import { FilterBar } from './components/FilterBar';
import { TreeView } from './components/TreeView';
import { DetailPanel } from './components/DetailPanel';
import { SubmitStory } from './components/SubmitStory';
import { Toast } from './components/Toast';
import { activeEngine } from './ai/organizer';

export default function App() {
  const { data, commit, vote, reset, exportJson } = useStore();
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [flashLayer, setFlashLayer] = useState<{ k: Layer; t: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; t: number } | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ id: string; t: number } | null>(null);
  const freshTimer = useRef<number>(0);

  const say = (text: string) => setToast({ text, t: Date.now() });
  const idx = useMemo(() => buildIndex(data), [data]);
  const view = useMemo(() => computeView(data, idx, filter), [data, idx, filter]);
  const order = useMemo(() => orderLayers(data.nodes, idx), [data.nodes, idx]);
  const filterOn = filterActive(filter);

  const sel = selected && view.visible.has(selected) ? selected : null;
  const focusId = hovered || sel;
  const focusSet = useMemo(() => {
    const up = (i: string) => (idx.ups.get(i) ?? []).filter((x) => view.visible.has(x));
    const dn = (i: string) => (idx.downs.get(i) ?? []).filter((x) => view.visible.has(x));
    const path = (id: string) => [id, ...walk(id, up), ...walk(id, dn)];
    if (focusId) return new Set(path(focusId));
    // 刚提交的故事：高亮所有新场景的完整路径
    const freshScenes = [...fresh].filter((id) => idx.byId.get(id)?.layer === 'scene' && view.visible.has(id));
    return freshScenes.length ? new Set(freshScenes.flatMap(path)) : null;
  }, [focusId, idx, view.visible, fresh]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(LAYERS.map((l) => [l.key, 0])) as Record<Layer, number>;
    for (const n of data.nodes) if (view.visible.has(n.id)) c[n.layer]++;
    return c;
  }, [data.nodes, view.visible]);

  const onConfirm = useCallback((p: CommitPayload) => {
    const r = commit(p);
    setSubmitOpen(false);
    if (filterActive(filter) && !matchIdentity(p.identity, filter)) setFilter(EMPTY_FILTER);
    const merged = p.principles.filter((x) => x.action === 'merge').map((x) => 'merged:' + x.existingId);
    setFresh(new Set([...r.nodeIds, ...r.linkKeys, ...merged]));
    window.clearTimeout(freshTimer.current);
    freshTimer.current = window.setTimeout(() => setFresh(new Set()), 8000);
    setSelected(null);
    setScrollTarget({ id: r.nodeIds[0], t: Date.now() });
    const m = p.principles.filter((x) => x.action === 'merge').length;
    say(`已加入人生树：${p.scenes.length} 个场景 · 合并 ${m} 条 · 新原则 ${p.principles.length - m} 条 · 已保存到本地`);
  }, [commit, filter]);

  const node = sel ? idx.byId.get(sel) ?? null : null;

  return (
    <div className="app">
      <Sidebar
        counts={counts}
        activeLayer={(focusId && idx.byId.get(focusId)?.layer) || flashLayer?.k || null}
        onJump={(k) => { setFlashLayer({ k, t: Date.now() }); window.setTimeout(() => setFlashLayer((f) => (f && Date.now() - f.t >= 1500 ? null : f)), 1600); }}
        people={{ matched: view.matchedContribs.size, total: data.contributions.length }}
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
            <span className="hint">悬停查看路径 · 点击查看故事</span>
            <span className={`eng-badge ${activeEngine()}`} title="AI 整理引擎">AI:{activeEngine().toUpperCase()}</span>
            <button type="button" className="btn mag" data-testid="open-submit" onClick={() => setSubmitOpen(true)}>＋ 讲一件事</button>
            <button type="button" className="btn ghost" onClick={exportJson} title="导出当前数据为 JSON">导出</button>
            <button type="button" className="btn ghost" title="清除本地修改，恢复示例数据"
              onClick={() => { if (confirm('清除本地修改并恢复示例数据？')) { reset(); setSelected(null); setFilter(EMPTY_FILTER); say('已恢复示例数据'); } }}>重置示例</button>
          </div>
        </header>
        <FilterBar filter={filter} onChange={setFilter} contributions={data.contributions} matched={view.matchedContribs.size} />
        <div className="body">
          <TreeView
            data={data} idx={idx} view={view} order={order} focusSet={focusSet}
            selected={sel} onSelect={setSelected} onHover={setHovered}
            fresh={fresh} scrollTarget={scrollTarget} flashLayer={flashLayer} originFilter={filter.origin} filterOn={filterOn}
          />
          <DetailPanel node={node} data={data} idx={idx} view={view} filterOn={filterOn} onSelect={setSelected}
            onVote={(id) => { const had = data.myVotes.includes(id); vote(id); say(had ? '已取消「有用」' : '已标记为「有用」· 保存在本地'); }} />
        </div>
      </main>
      <SubmitStory open={submitOpen} data={data} onClose={() => setSubmitOpen(false)} onConfirm={onConfirm} />
      <Toast msg={toast} />
    </div>
  );
}
