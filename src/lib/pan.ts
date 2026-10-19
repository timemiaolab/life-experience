export interface PanCard { x: number; y: number; w: number; h: number }

export interface PanBox {
  cw: number;
  ch: number;
  gridW: number;
  gridH: number;
  gridLeft: number;
  gridTop: number;
  zoom: number;
  scrollLeft?: number;
  scrollTop?: number;
  cards?: PanCard[];
}

function clampAxis(pan: number, size: number, start: number, view: number, vis: number) {
  const visPx = Math.min(vis, Math.max(1, size));
  const max = view - visPx - start;
  const min = visPx - start - size;
  return Math.max(min, Math.min(max, pan));
}

/** Clamp drag-pan so a slice of the unscaled grid (× zoom) stays in view. */
export function clampPan(pan: { x: number; y: number }, box: PanBox): { x: number; y: number } {
  const minVisible = Math.min(200, box.cw * 0.25, box.ch * 0.25);
  const scaledW = box.gridW * box.zoom;
  const scaledH = box.gridH * box.zoom;
  const offX = box.gridLeft * box.zoom - (box.scrollLeft ?? 0);
  const offY = box.gridTop * box.zoom - (box.scrollTop ?? 0);
  let x = clampAxis(pan.x, scaledW, offX, box.cw, minVisible);
  let y = clampAxis(pan.y, scaledH, offY, box.ch, minVisible);
  return ensureCardInView({ x, y }, box);
}

/** If the clamped slice is an empty corner of the grid, nudge to the nearest card. */
export function ensureCardInView(pan: { x: number; y: number }, box: PanBox): { x: number; y: number } {
  const cards = box.cards;
  if (!cards?.length) return pan;
  const z = box.zoom;
  const sl = box.scrollLeft ?? 0;
  const st = box.scrollTop ?? 0;
  const shown = (c: PanCard, p: { x: number; y: number }) => {
    const l = c.x * z + p.x - sl;
    const t = c.y * z + p.y - st;
    const ox = Math.max(0, Math.min(box.cw, l + c.w * z) - Math.max(0, l));
    const oy = Math.max(0, Math.min(box.ch, t + c.h * z) - Math.max(0, t));
    return ox > 8 && oy > 8;
  };
  if (cards.some((c) => shown(c, pan))) return pan;
  let best = pan;
  let bestD = Infinity;
  for (const c of cards) {
    const l0 = c.x * z - sl;
    const t0 = c.y * z - st;
    const w = Math.max(1, c.w * z);
    const h = Math.max(1, c.h * z);
    let x = pan.x;
    let y = pan.y;
    if (l0 + x + w < 8) x = 8 - l0 - w;
    if (l0 + x > box.cw - 8) x = box.cw - 8 - l0;
    if (t0 + y + h < 8) y = 8 - t0 - h;
    if (t0 + y > box.ch - 8) y = box.ch - 8 - t0;
    const d = (x - pan.x) ** 2 + (y - pan.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  return best;
}
