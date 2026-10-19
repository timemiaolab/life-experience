import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, GNode, Layer } from '../types';
import { LAYERS, breakdown, codeOf, layerOf, linkKey, type Index, type View } from '../lib/graph';
import { ORIGIN_COLORS, originLabel } from '../data/identity';
import { clampPan, nudgePanForCards } from '../lib/pan';

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

function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0, y = 0;
  let e: HTMLElement | null = el;
  while (e && e !== root) {
    x += e.offsetLeft; y += e.offsetTop;
    e = e.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function geoUnchanged(prev: { w: number; h: number; links: Geo[] }, next: { w: number; h: number; links: Geo[] }) {
  if (prev.w !== next.w || prev.h !== next.h || prev.links.length !== next.links.length) return false;
  for (let i = 0; i < prev.links.length; i++) {
    const a = prev.links[i], b = next.links[i];
    if (a.key !== b.key || a.d !== b.d || a.a !== b.a || a.b !== b.b) return false;
  }
  return true;
}

const LinkItem = memo(function LinkItem({ g, i, on, isNew }: { g: Geo; i: number; on: boolean; isNew: boolean }) {
  return (
    <g className={`lk${on ? ' on' : ''}${isNew ? ' new' : ''}`} data-a={g.a} data-b={g.b}>
      <path className="glow" d={g.d} stroke={`url(#lg${i})`} pathLength={isNew ? 1 : undefined} />
      <path className="core" d={g.d} stroke={`url(#lg${i})`} pathLength={isNew ? 1 : undefined} />
      <path className="flow" d={g.d} stroke="#ffffff" />
      <circle className="dot" cx={g.x1} cy={g.y1} r="2.2" fill={g.ca} />
      <circle className="dot" cx={g.x2} cy={g.y2} r="2.6" fill={g.cb} />
    </g>
  );
});

const LinkLayer = memo(function LinkLayer({ geo, focusSet, fresh }: { geo: { w: number; h: number; links: Geo[] }; focusSet: Set<string> | null; fresh: Set<string> }) {
  return (
    <svg className="links" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w || 1} ${geo.h || 1}`} data-testid="links">
      <defs>
        <filter id="lblur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.6" /></filter>
        {geo.links.map((g, i) => (
          <linearGradient key={g.key} id={`lg${i}`} gradientUnits="userSpaceOnUse" x1={g.x1} y1="0" x2={g.x2} y2="0">
            <stop offset="0" stopColor={g.ca} /><stop offset="1" stopColor={g.cb} />
          </linearGradient>
        ))}
      </defs>
      {geo.links.map((g, i) => (
        <LinkItem key={g.key} g={g} i={i} on={!!(focusSet && focusSet.has(g.a) && focusSet.has(g.b))} isNew={fresh.has(g.key)} />
      ))}
    </svg>
  );
});

const NodeCard = memo(function NodeCard({
  n, on, selected, locked, onHover, onSelect, register,
  data, idx, view, originFilter, filterOn, fresh,
}: {
  n: GNode; on: boolean; selected: boolean; locked: boolean;
  onHover: (id: string | null) => void; onSelect: (id: string) => void;
  register: (id: string, el: HTMLDivElement | null) => void;
  data: AppData; idx: Index; view: View; originFilter: string[]; filterOn: boolean; fresh: Set<string>;
}) {
  const code = codeOf(n, data.nodes);
  const sup = view.support.get(n.id) ?? new Set<string>();
  const all = view.supportAll.get(n.id)?.size ?? 0;
  const origins = breakdown(sup, idx, 'origin');
  const pick = originFilter.length ? origins.find(([o]) => originFilter.includes(o)) ?? origins[0] : origins[0];
  const m = { n: sup.size, all, origins, pick };
  const badge = fresh.has(n.id) ? <span className="nb">NEW</span> : n.user ? <span className="nb u">USER</span> : null;
  const votes = data.votes[n.id] ?? 0;
  let body: ReactNode;
  if (n.layer === 'area') {
    body = (
      <>
        <div className="id"><span>{code}</span><span>ROOT</span></div>
        <div className="t">{n.title}</div>
        <div className="m"><span>{(idx.downs.get(n.id) ?? []).filter((x) => view.visible.has(x)).length} 个场景</span><span>{m.n}人</span></div>
      </>
    );
  } else if (n.layer === 'scene') {
    const c = n.contributionId ? idx.contrib.get(n.contributionId) : undefined;
    const o = c?.identity.origin ?? '';
    body = (
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
  } else {
    body = (
      <>
        <div className="id"><span>{code}</span>{badge}</div>
        <div className="t">{n.title}</div>
        <div className="m">
          <span className="sup">
            {m.n}人{m.pick ? <> · {originLabel(m.pick[0])} {m.pick[1]}</> : null}
            {filterOn && m.all !== m.n ? <i> /共{m.all}</i> : null}
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
  }
  return (
    <div
      className={['node', on ? 'on' : '', selected ? 'sel' : ''].filter(Boolean).join(' ')}
      data-id={n.id}
      data-layer={n.layer}
      ref={(el) => register(n.id, el)}
      onMouseEnter={() => { if (!locked) onHover(n.id); }}
      onMouseLeave={() => { if (!locked) onHover(null); }}
      onClick={(e) => { e.stopPropagation(); onSelect(n.id); }}
    >
      {body}
    </div>
  );
});

export function TreeView(p: Props) {
  const { data, idx, view, order, focusSet, selected, locked, fresh } = p;
  const innerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomLevelRef = useRef<HTMLSpanElement>(null);
  const nodeEls = useRef(new Map<string, HTMLDivElement>());
  const [geo, setGeo] = useState<{ w: number; h: number; links: Geo[] }>({ w: 0, h: 0, links: [] });

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const endTimer = useRef(0);
  const zoomingRef = useRef(false);
  const wheelAcc = useRef({ dy: 0, mx: 0, my: 0 });
  const originCache = useRef<{ left: number; top: number } | null>(null);
  const safariBase = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);
  const persistAtEnd = useRef(false);
  const clampAtEnd = useRef(true);
  const onCanvasClickRef = useRef(p.onCanvasClick);
  onCanvasClickRef.current = p.onCanvasClick;
  const geoRef = useRef(geo);
  geoRef.current = geo;

  const paint = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const { x, y } = panRef.current;
    const z = zoomRef.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
    if (zoomLevelRef.current) zoomLevelRef.current.textContent = `${Math.round(z * 100)}%`;
  }, []);

  const persistZoom = () => {
    try { localStorage.setItem('tree-zoom', String(zoomRef.current)); } catch { /* ignore */ }
  };

  const panBox = () => {
    const container = scrollRef.current;
    const grid = gridRef.current;
    if (!container || !grid) return null;
    return {
      cw: container.clientWidth,
      ch: container.clientHeight,
      gridW: grid.offsetWidth,
      gridH: grid.offsetHeight,
      gridLeft: grid.offsetLeft,
      gridTop: grid.offsetTop,
      zoom: zoomRef.current,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
  };

  const foldScrollIntoPan = () => {
    const container = scrollRef.current;
    if (!container) return;
    if (container.scrollLeft || container.scrollTop) {
      panRef.current = {
        x: panRef.current.x - container.scrollLeft,
        y: panRef.current.y - container.scrollTop,
      };
      container.scrollLeft = 0;
      container.scrollTop = 0;
    }
  };

  const setBusy = (on: boolean) => {
    const inner = innerRef.current;
    const tree = inner?.parentElement?.parentElement;
    const body = tree?.parentElement;
    if (on) {
      if (!zoomingRef.current) {
        zoomingRef.current = true;
        if (inner) inner.style.willChange = 'transform';
        tree?.classList.add('is-zooming');
        body?.classList.add('is-zooming');
      }
    } else if (zoomingRef.current) {
      zoomingRef.current = false;
      if (inner) inner.style.willChange = '';
      tree?.classList.remove('is-zooming');
      body?.classList.remove('is-zooming');
    }
  };

  const applyPanZoom = (next: { x: number; y: number }, zoom = zoomRef.current) => {
    zoomRef.current = zoom;
    foldScrollIntoPan();
    const box = panBox();
    panRef.current = box ? clampPan(next, { ...box, zoom }) : next;
    paint();
    const container = scrollRef.current;
    if (container && nodeEls.current.size) {
      const view = container.getBoundingClientRect();
      const cards = [...nodeEls.current.values()].map((el) => el.getBoundingClientRect());
      panRef.current = nudgePanForCards(panRef.current, view, cards);
      paint();
    }
  };

  const finishGesture = (persist: boolean, clampNow = false) => {
    persistAtEnd.current = persist;
    if (clampNow) {
      applyPanZoom(panRef.current, zoomRef.current);
      clampAtEnd.current = false;
    } else {
      clampAtEnd.current = true;
    }
    window.clearTimeout(endTimer.current);
    endTimer.current = window.setTimeout(() => {
      if (clampAtEnd.current) applyPanZoom(panRef.current, zoomRef.current);
      if (persistAtEnd.current) persistZoom();
      setBusy(false);
      originCache.current = null;
    }, 150);
  };

  const applyZoomAt = (newZoom: number, mouseX: number, mouseY: number) => {
    const oldZoom = zoomRef.current;
    const z = Math.max(0.3, Math.min(2.5, newZoom));
    if (z === oldZoom) return;
    const k = z / oldZoom;
    const p0 = panRef.current;
    zoomRef.current = z;
    panRef.current = { x: mouseX - (mouseX - p0.x) * k, y: mouseY - (mouseY - p0.y) * k };
  };

  const flushWheel = () => {
    rafRef.current = 0;
    const acc = wheelAcc.current;
    if (acc.dy) {
      const origin = originCache.current;
      const mouseX = origin ? acc.mx - origin.left : acc.mx;
      const mouseY = origin ? acc.my - origin.top : acc.my;
      applyZoomAt(zoomRef.current * Math.exp(-acc.dy * 0.002), mouseX, mouseY);
      acc.dy = 0;
    }
    paint();
  };

  const scheduleFlush = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(flushWheel);
  };

  const layoutBusy = () =>
    zoomingRef.current || document.querySelector('.app')?.classList.contains('is-sidebar-animating');

  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem('tree-zoom');
      if (saved) zoomRef.current = Math.max(0.3, Math.min(2.5, parseFloat(saved) || 1));
    } catch { /* ignore */ }
    paint();
  }, [paint]);

  const handleZoomIn = () => { applyPanZoom(panRef.current, Math.min(zoomRef.current * 1.2, 2.5)); persistZoom(); };
  const handleZoomOut = () => { applyPanZoom(panRef.current, Math.max(zoomRef.current / 1.2, 0.3)); persistZoom(); };
  const handleZoomReset = () => {
    const c = scrollRef.current;
    if (c) { c.scrollLeft = 0; c.scrollTop = 0; }
    applyPanZoom({ x: 0, y: 0 }, 1);
    persistZoom();
  };
  const handleZoomFit = () => {
    const container = scrollRef.current;
    const g = geoRef.current;
    if (!container || !g.w || !g.h) return;
    const scale = Math.min((container.clientWidth - 80) / g.w, (container.clientHeight - 80) / g.h, 1);
    applyPanZoom({ x: 0, y: 0 }, scale);
    persistZoom();
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (!originCache.current) {
        const r = el.getBoundingClientRect();
        originCache.current = { left: r.left, top: r.top };
      }
      setBusy(true);
      wheelAcc.current.dy += e.deltaY;
      wheelAcc.current.mx = e.clientX;
      wheelAcc.current.my = e.clientY;
      scheduleFlush();
      finishGesture(true);
    };
    type GEv = Event & { scale: number; clientX: number; clientY: number };
    const onGStart = (e: Event) => {
      e.preventDefault();
      const ge = e as GEv;
      safariBase.current = { zoom: zoomRef.current, pan: { ...panRef.current } };
      const r = el.getBoundingClientRect();
      originCache.current = { left: r.left, top: r.top };
      wheelAcc.current.mx = ge.clientX;
      wheelAcc.current.my = ge.clientY;
      setBusy(true);
    };
    const onGChange = (e: Event) => {
      e.preventDefault();
      const ge = e as GEv;
      const base = safariBase.current;
      if (!base) return;
      const origin = originCache.current;
      const mouseX = origin ? ge.clientX - origin.left : ge.clientX;
      const mouseY = origin ? ge.clientY - origin.top : ge.clientY;
      zoomRef.current = base.zoom;
      panRef.current = { ...base.pan };
      applyZoomAt(base.zoom * (ge.scale || 1), mouseX, mouseY);
      if (!rafRef.current) rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; paint(); });
      finishGesture(true);
    };
    const onGEnd = (e: Event) => { e.preventDefault(); safariBase.current = null; finishGesture(true, true); };
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('gesturestart', onGStart, { passive: false });
    el.addEventListener('gesturechange', onGChange, { passive: false });
    el.addEventListener('gestureend', onGEnd, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('gesturestart', onGStart);
      el.removeEventListener('gesturechange', onGChange);
      el.removeEventListener('gestureend', onGEnd);
    };
  }, []);

  const pinchState = useRef<{ dist: number; zoom: number; pan: { x: number; y: number } } | null>(null);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const pointers = new Map<number, PointerEvent>();
    const handlePointerDown = (e: PointerEvent) => { if (e.pointerType === 'touch') pointers.set(e.pointerId, e); };
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pointers.set(e.pointerId, e);
      if (pointers.size !== 2) return;
      const [p1, p2] = Array.from(pointers.values());
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      if (!pinchState.current) {
        pinchState.current = { dist, zoom: zoomRef.current, pan: { ...panRef.current } };
        originCache.current = (() => { const r = container.getBoundingClientRect(); return { left: r.left, top: r.top }; })();
        setBusy(true);
        return;
      }
      const newZoom = pinchState.current.zoom * (dist / pinchState.current.dist);
      const origin = originCache.current;
      const cx = origin ? (p1.clientX + p2.clientX) / 2 - origin.left : 0;
      const cy = origin ? (p1.clientY + p2.clientY) / 2 - origin.top : 0;
      zoomRef.current = pinchState.current.zoom;
      panRef.current = { ...pinchState.current.pan };
      applyZoomAt(newZoom, cx, cy);
      if (!rafRef.current) rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; paint(); });
    };
    const handlePointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) { pinchState.current = null; finishGesture(true, true); }
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
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.node, button, .zoom-controls')) return;
    foldScrollIntoPan();
    const start = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y, moved: false };
    e.preventDefault();
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!start.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        start.moved = true;
        innerRef.current?.classList.add('panning');
        setBusy(true);
      }
      if (!start.moved) return;
      panRef.current = { x: start.px + dx, y: start.py + dy };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          paint();
        });
      }
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      innerRef.current?.classList.remove('panning');
      if (!start.moved) onCanvasClickRef.current();
      else finishGesture(false, true);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const prevLockedRef = useRef(locked);
  useEffect(() => {
    if (prevLockedRef.current && !locked) p.onHover(null);
    prevLockedRef.current = locked;
  }, [locked, p.onHover]);

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
    const next = { w: inner.scrollWidth, h: inner.scrollHeight, links: out };
    setGeo((prev) => (geoUnchanged(prev, next) ? prev : next));
  }, [visibleLinks, idx.byId]);

  useLayoutEffect(() => { recalc(); }, [recalc]);

  useEffect(() => {
    let raf = 0;
    const redraw = () => {
      if (layoutBusy()) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recalc);
    };
    const ro = new ResizeObserver(redraw);
    if (gridRef.current) ro.observe(gridRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener('resize', redraw);
    window.addEventListener('layout-settled', redraw);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', redraw);
      window.removeEventListener('layout-settled', redraw);
      cancelAnimationFrame(raf);
    };
  }, [recalc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (layoutBusy()) return;
      applyPanZoom(panRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  useEffect(() => {
    if (!p.scrollTarget) return;
    const h = window.setTimeout(() => nodeEls.current.get(p.scrollTarget!.id)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), 80);
    return () => window.clearTimeout(h);
  }, [p.scrollTarget]);

  useEffect(() => {
    if (!selected) return;
    nodeEls.current.get(selected)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [selected]);

  const register = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodeEls.current.set(id, el); else nodeEls.current.delete(id);
  }, []);

  return (
    <div className="tree-area">
      <div className="scroll" ref={scrollRef} onMouseDown={handleMouseDown} data-testid="tree-scroll">
        <div className={`inner${focusSet ? ' focus' : ''}`} ref={innerRef}>
          <LinkLayer geo={geo} focusSet={focusSet} fresh={fresh} />
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
                    {list.map((n) => (
                      <NodeCard
                        key={n.id}
                        n={n}
                        on={!!focusSet?.has(n.id)}
                        selected={selected === n.id}
                        locked={locked}
                        onHover={p.onHover}
                        onSelect={p.onSelect}
                        register={register}
                        data={data}
                        idx={idx}
                        view={view}
                        originFilter={p.originFilter}
                        filterOn={p.filterOn}
                        fresh={fresh}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
      <div className="zoom-controls">
        <button type="button" data-testid="zoom-in" onClick={handleZoomIn} title="放大 (Ctrl/Cmd + Wheel)">+</button>
        <button type="button" data-testid="zoom-out" onClick={handleZoomOut} title="缩小">−</button>
        <button type="button" data-testid="zoom-reset" onClick={handleZoomReset} title="重置">1:1</button>
        <button type="button" data-testid="zoom-fit" onClick={handleZoomFit} title="适应屏幕">⊡</button>
        <span className="zoom-level" ref={zoomLevelRef}>100%</span>
      </div>
    </div>
  );
}
