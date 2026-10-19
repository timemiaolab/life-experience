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
  const x = clampAxis(pan.x, scaledW, offX, box.cw, minVisible);
  const y = clampAxis(pan.y, scaledH, offY, box.ch, minVisible);
  return { x, y };
}

export function cardOverlapsView(
  card: { left: number; top: number; right: number; bottom: number },
  view: { left: number; top: number; right: number; bottom: number },
  min = 8,
): boolean {
  const ox = Math.max(0, Math.min(view.right, card.right) - Math.max(view.left, card.left));
  const oy = Math.max(0, Math.min(view.bottom, card.bottom) - Math.max(view.top, card.top));
  return ox > min && oy > min;
}

/** Screen-space nudge so at least one card overlaps the viewport. pan deltas = pixel deltas. */
export function nudgePanForCards(
  pan: { x: number; y: number },
  view: { left: number; top: number; right: number; bottom: number },
  cards: { left: number; top: number; right: number; bottom: number }[],
): { x: number; y: number } {
  if (!cards.length || cards.some((c) => cardOverlapsView(c, view))) return pan;
  const cx = (view.left + view.right) / 2;
  const cy = (view.top + view.bottom) / 2;
  let best = cards[0];
  let bestD = Infinity;
  for (const c of cards) {
    const dx = (c.left + c.right) / 2 - cx;
    const dy = (c.top + c.bottom) / 2 - cy;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  let dx = 0;
  let dy = 0;
  if (best.right < view.left + 8) dx = view.left + 8 - best.right;
  else if (best.left > view.right - 8) dx = view.right - 8 - best.left;
  if (best.bottom < view.top + 8) dy = view.top + 8 - best.bottom;
  else if (best.top > view.bottom - 8) dy = view.bottom - 8 - best.top;
  return { x: pan.x + dx, y: pan.y + dy };
}
