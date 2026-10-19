import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AppData, GNode, Layer } from '../types';
import { LAYERS, breakdown, codeOf, layerOf, linkKey, type Index, type View } from '../lib/graph';
import { ORIGIN_COLORS, originLabel } from '../data/identity';

interface Props {
  data: AppData;
  idx: Index;
  view: View;
  order: Record<Layer, GNode[]>;
  focusSet: Set<string> | null;
  selected: string | null;
  locked: boolean;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onCanvasClick: () => void;
  fresh: Set<string>;
  scrollTarget: { id: string; t: number } | null;
  flashLayer: { k: Layer; t: number } | null;
  originFilter: string[];
  filterOn: boolean;
}

interface Geo { key: string; a: string; b: string; d: string; x1: number; y1: number; x2: number; y2: number; ca: string; cb: string }

/** 相对 root 的偏移（不受 transform 影响，悬停/出生动画不会让连线错位） */
function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0, y = 0;
  let e: HTMLElement | null = el;
  while (e && e !== root) {
    x += e.offsetLeft; y += e.offsetTop;
    e = e.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

export function TreeView(p: Props) {
  const { data, idx, view, order, focusSet, selected, locked, fresh } = p;
  const innerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLDivElement>());
  const [geo, setGeo] = useState<{ w: number; h: number; links: Geo[] }>({ w: 0, h: 0, links: [] });
  
  // Zoom state
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem('tree-zoom');
    return saved ? parseFloat(saved) : 1;
  });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0, moved: false });
  
  // Save zoom to localStorage
  useEffect(() => {
    localStorage.setItem('tree-zoom', zoom.toString());
  }, [zoom]);
  
  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const handleZoomFit = () => {
    const container = innerRef.current?.parentElement;
    if (!container || !geo.w || !geo.h) return;
    const pw = container.clientWidth - 80;
    const ph = container.clientHeight - 80;
    const scale = Math.min(pw / geo.w, ph / geo.h, 1);
    setZoom(scale);
    setPan({ x: 0, y: 0 });
  };
  
  // Wheel zoom with Ctrl/Cmd (plain wheel uses native scrolling)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Zoom around cursor
        e.preventDefault();
        
        const container = innerRef.current?.parentElement;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const oldZoom = zoom;
        const factor = Math.exp(-e.deltaY * 0.002);
        const newZoom = Math.max(0.3, Math.min(2.5, oldZoom * factor));
        
        const zoomChange = newZoom / oldZoom;
        setPan((p) => ({
          x: mouseX - (mouseX - p.x) * zoomChange,
          y: mouseY - (mouseY - p.y) * zoomChange,
        }));
        setZoom(newZoom);
      }
      // Plain wheel (no Ctrl/Cmd): let native overflow:auto scrolling handle it
    };
    const el = innerRef.current?.parentElement;
    if (el) el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el?.removeEventListener('wheel', handleWheel);
  }, [zoom]);
  
  // Pinch zoom via pointer events
  const pinchState = useRef<{ dist: number; zoom: number; pan: { x: number; y: number } } | null>(null);
  useEffect(() => {
    const container = innerRef.current?.parentElement;
    if (!container) return;
    
    const pointers = new Map<number, PointerEvent>();
    
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') pointers.set(e.pointerId, e);
    };
    
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pointers.set(e.pointerId, e);
      
      if (pointers.size === 2) {
        const [p1, p2] = Array.from(pointers.values());
        const dx = p2.clientX - p1.clientX;
        const dy = p2.clientY - p1.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (!pinchState.current) {
          pinchState.current = { dist, zoom, pan };
        } else {
          const scale = dist / pinchState.current.dist;
          const newZoom = Math.max(0.3, Math.min(2.5, pinchState.current.zoom * scale));
          
          const rect = container.getBoundingClientRect();
          const centerX = ((p1.clientX + p2.clientX) / 2) - rect.left;
          const centerY = ((p1.clientY + p2.clientY) / 2) - rect.top;
          
          const zoomChange = newZoom / zoom;
          setPan({
            x: centerX - (centerX - pinchState.current.pan.x) * zoomChange,
            y: centerY - (centerY - pinchState.current.pan.y) * zoomChange,
          });
          setZoom(newZoom);
        }
      }
    };
    
    const handlePointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchState.current = null;
    };
    
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerUp);
    
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [zoom, pan]);
  
  // Pan handlers with movement threshold
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't start pan on cards or buttons
    if (target.closest('.node, button, .zoom-controls')) return;
    
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
    e.preventDefault();
  };
  
  useEffect(() => {
    if (!isPanning) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      
      // Movement threshold: 5px
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        panStart.current.moved = true;
        setIsDragging(true);
      }
      
      if (panStart.current.moved) {
        const container = innerRef.current?.parentElement;
        const grid = gridRef.current;
        if (!container || !grid) return;
        
        // Clamp based on actual grid bounds to ensure at least one card visible
        // Use min(200px, 25% of viewport) as the minimum visible threshold
        const minVisible = Math.min(200, container.clientWidth * 0.25, container.clientHeight * 0.25);
        
        // Get grid's actual bounding box (content without padding)
        const gridBounds = grid.getBoundingClientRect();
        const gridWidth = gridBounds.width * zoom;
        const gridHeight = gridBounds.height * zoom;
        
        // Clamp so at least minVisible of grid stays within container
        const maxX = container.clientWidth - minVisible;
        const maxY = container.clientHeight - minVisible;
        const minX = -(gridWidth - minVisible);
        const minY = -(gridHeight - minVisible);
        
        const newX = Math.max(minX, Math.min(maxX, panStart.current.px + dx));
        const newY = Math.max(minY, Math.min(maxY, panStart.current.py + dy));
        
        setPan({ x: newX, y: newY });
      }
    };
    
    const handleMouseUp = () => {
      const wasDragging = panStart.current.moved;
      setIsPanning(false);
      setIsDragging(false);
      
      // Only trigger canvas click if didn't drag
      if (!wasDragging) {
        p.onCanvasClick();
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, pan.x, pan.y, p]);
  
  // Clear hover when unlocking (true → false transition)
  const prevLockedRef = useRef(locked);
  useEffect(() => {
    if (prevLockedRef.current && !locked) {
      p.onHover(null);
    }
    prevLockedRef.current = locked;
  }, [locked, p]);

  const visibleLinks = useMemo(
    () => data.links.filter(([a, b]) => view.visible.has(a) && view.visible.has(b) && idx.byId.has(a) && idx.byId.has(b)),
    [data.links, view.visible, idx.byId],
  );

  const recalc = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const out: Geo[] = [];
    for (const l of visibleLinks) {
      const [a, b] = l;
      const ea = nodeEls.current.get(a), eb = nodeEls.current.get(b);
      if (!ea || !eb) continue;
      const ra = offsetIn(ea, inner), rb = offsetIn(eb, inner);
      const x1 = ra.x + ra.w + 3, y1 = ra.y + ra.h / 2;
      const x2 = rb.x - 3, y2 = rb.y + rb.h / 2;
      const dx = Math.max(24, (x2 - x1) * 0.55);
      const d = `M${x1.toFixed(1)},${y1.toFixed(1)} C${(x1 + dx).toFixed(1)},${y1.toFixed(1)} ${(x2 - dx).toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
      out.push({ key: linkKey(l), a, b, d, x1, y1, x2, y2, ca: layerOf(idx.byId.get(a)!.layer).color, cb: layerOf(idx.byId.get(b)!.layer).color });
    }
    setGeo({ w: inner.scrollWidth, h: inner.scrollHeight, links: out });
  }, [visibleLinks, idx.byId]);

  useLayoutEffect(() => { recalc(); }, [recalc]);

  useEffect(() => {
    let raf = 0;
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(recalc); };
    const ro = new ResizeObserver(redraw);
    if (gridRef.current) ro.observe(gridRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener('resize', redraw);
    document.fonts?.ready.then(redraw).catch(() => undefined);
    return () => { ro.disconnect(); window.removeEventListener('resize', redraw); cancelAnimationFrame(raf); };
  }, [recalc]);

  // 侧栏点击：滚动并闪烁该列
  const colRefs = useRef(new Map<Layer, HTMLElement>());
  useEffect(() => {
    if (!p.flashLayer) return;
    const col = colRefs.current.get(p.flashLayer.k);
    if (!col) return;
    col.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    col.classList.remove('flash');
    void col.offsetWidth;
    col.classList.add('flash');
  }, [p.flashLayer]);

  // 提交后滚动到第一个新场景
  useEffect(() => {
    if (!p.scrollTarget) return;
    const h = window.setTimeout(() => nodeEls.current.get(p.scrollTarget!.id)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), 80);
    return () => window.clearTimeout(h);
  }, [p.scrollTarget]);

  // 选中后滚动到节点
  useEffect(() => {
    if (!selected) return;
    const el = nodeEls.current.get(selected);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [selected]);

  const meta = (n: GNode) => {
    const sup = view.support.get(n.id) ?? new Set<string>();
    const all = view.supportAll.get(n.id)?.size ?? 0;
    const origins = breakdown(sup, idx, 'origin');
    const pick = p.originFilter.length ? origins.find(([o]) => p.originFilter.includes(o)) ?? origins[0] : origins[0];
    return { n: sup.size, all, origins, pick };
  };

  const nodeBody = (n: GNode) => {
    const code = codeOf(n, data.nodes);
    const m = meta(n);
    const badge = fresh.has(n.id) ? <span className="nb">NEW</span> : n.user ? <span className="nb u">USER</span> : null;
    if (n.layer === 'area') {
      return (
        <>
          <div className="id"><span>{code}</span><span>ROOT</span></div>
          <div className="t">{n.title}</div>
          <div className="m"><span>{(idx.downs.get(n.id) ?? []).filter((x) => view.visible.has(x)).length} 个场景</span><span>{m.n}人</span></div>
        </>
      );
    }
    if (n.layer === 'scene') {
      const c = n.contributionId ? idx.contrib.get(n.contributionId) : undefined;
      const o = c?.identity.origin ?? '';
      return (
        <>
          <div className="id">
            <span>{code} · #{n.tag || '未分类'}</span>
            {c && (
              <span className="who" title={`${c.identity.origin} · ${c.identity.profession} · ${c.identity.city || ''} ${c.identity.region} · ${c.identity.age}`}>
                <span className="og" style={{ ['--oc' as string]: ORIGIN_COLORS[o] ?? '#00f0ff' }}>{o}</span>
                {c.identity.profession}·{c.identity.age}
              </span>
            )}
            {badge}
          </div>
          <div className="t clamp2">{n.title}</div>
        </>
      );
    }
    const votes = data.votes[n.id] ?? 0;
    return (
      <>
        <div className="id"><span>{code}</span>{badge}</div>
        <div className="t">{n.title}</div>
        <div className="m">
          <span className="sup">
            {m.n}人{m.pick ? <> · {originLabel(m.pick[0])} {m.pick[1]}</> : null}
            {p.filterOn && m.all !== m.n ? <i> /共{m.all}</i> : null}
          </span>
          {n.layer === 'principle' ? <span className={`vt${data.myVotes.includes(n.id) ? ' on' : ''}`}>▲有用 {votes}</span> : <span>{m.origins.length}种出身</span>}
        </div>
        {n.layer === 'principle' && m.n > 0 && (
          <div className="obar" title={m.origins.map(([o, k]) => `${o} ${k}`).join(' / ')}>
            {m.origins.map(([o, k]) => <i key={o} style={{ flex: k, background: ORIGIN_COLORS[o] ?? '#00f0ff' }} />)}
          </div>
        )}
      </>
    );
  };

  const focusOn = !!focusSet;
  return (
    <div className="scroll" onMouseDown={handleMouseDown}>
      <div className="zoom-controls">
        <button onClick={handleZoomIn} title="放大 (Ctrl/Cmd + Wheel)">+</button>
        <button onClick={handleZoomOut} title="缩小">−</button>
        <button onClick={handleZoomReset} title="重置">1:1</button>
        <button onClick={handleZoomFit} title="适应屏幕">⊡</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
      </div>
      <div 
        className={`inner${focusOn ? ' focus' : ''}${isDragging ? ' panning' : ''}`} 
        ref={innerRef}
        style={{ 
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        <svg className="links" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w || 1} ${geo.h || 1}`} data-testid="links">
          <defs>
            <filter id="lblur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.6" /></filter>
            {geo.links.map((g, i) => (
              <linearGradient key={g.key} id={`lg${i}`} gradientUnits="userSpaceOnUse" x1={g.x1} y1="0" x2={g.x2} y2="0">
                <stop offset="0" stopColor={g.ca} /><stop offset="1" stopColor={g.cb} />
              </linearGradient>
            ))}
          </defs>
          {geo.links.map((g, i) => {
            const on = focusSet ? focusSet.has(g.a) && focusSet.has(g.b) : false;
            const isNew = fresh.has(g.key);
            return (
              <g key={g.key} className={`lk${on ? ' on' : ''}${isNew ? ' new' : ''}`} data-a={g.a} data-b={g.b}>
                <path className="glow" d={g.d} stroke={`url(#lg${i})`} pathLength={isNew ? 1 : undefined} />
                <path className="core" d={g.d} stroke={`url(#lg${i})`} pathLength={isNew ? 1 : undefined} />
                <path className="flow" d={g.d} stroke="#ffffff" style={{ animationDelay: `${-(i % 7) * 0.15}s` }} />
                <circle className="dot" cx={g.x1} cy={g.y1} r="2.2" fill={g.ca} />
                <circle className="dot" cx={g.x2} cy={g.y2} r="2.6" fill={g.cb} />
              </g>
            );
          })}
        </svg>
        <div className="grid" ref={gridRef}>
          {LAYERS.map((L) => {
            const list = order[L.key].filter((n) => view.visible.has(n.id));
            return (
              <section
                key={L.key}
                className="col"
                data-col={L.key}
                ref={(el) => { if (el) colRefs.current.set(L.key, el); }}
                style={{ color: L.color, ['--c' as string]: L.color }}
              >
                <div className="col-h"><span>{L.en}</span><b>{L.name}</b><span className="n">×{list.length}</span></div>
                <div className="col-b">
                  {list.length === 0 && <div className="empty">— 当前筛选下暂无 —</div>}
                  {list.map((n) => {
                    const on = focusSet?.has(n.id);
                    const cls = ['node', on ? 'on' : '', selected === n.id ? 'sel' : '', fresh.has(n.id) ? 'new' : '', fresh.has('merged:' + n.id) ? 'merged' : ''].filter(Boolean).join(' ');
                    return (
                      <div
                        key={n.id}
                        className={cls}
                        data-id={n.id}
                        data-layer={n.layer}
                        ref={(el) => { if (el) nodeEls.current.set(n.id, el); else nodeEls.current.delete(n.id); }}
                        onMouseEnter={() => !locked && p.onHover(n.id)}
                        onMouseLeave={() => !locked && p.onHover(null)}
                        onClick={(e) => { e.stopPropagation(); p.onSelect(n.id); }}
                      >
                        {nodeBody(n)}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
