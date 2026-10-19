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

export interface ScreenRect { left: number; top: number; right: number; bottom: number }

function overlap(card: ScreenRect, view: ScreenRect): { ox: number; oy: number; w: number; h: number } {
  const ox = Math.max(0, Math.min(view.right, card.right) - Math.max(view.left, card.left));
  const oy = Math.max(0, Math.min(view.bottom, card.bottom) - Math.max(view.top, card.top));
  return { ox, oy, w: card.right - card.left, h: card.bottom - card.top };
}

function needX(cardW: number, view: ScreenRect): number {
  return Math.min(40, Math.max(8, cardW), view.right - view.left);
}

function needY(cardH: number, view: ScreenRect): number {
  return Math.min(Math.max(cardH, 1), view.bottom - view.top);
}

/** True when a full card-height (and a usable width) sits in the viewport. */
export function cardHasFullHeightInView(card: ScreenRect, view: ScreenRect): boolean {
  const { ox, oy, w, h } = overlap(card, view);
  return ox >= needX(w, view) - 0.5 && oy >= needY(h, view) - 0.5;
}

export function cardOverlapsView(card: ScreenRect, view: ScreenRect, min = 24): boolean {
  const { ox, oy } = overlap(card, view);
  return ox >= min && oy >= min;
}

/** Screen-space nudge so at least one full card height remains visible. */
export function nudgePanForCards(
  pan: { x: number; y: number },
  view: ScreenRect,
  cards: ScreenRect[],
): { x: number; y: number } {
  if (!cards.length || cards.some((c) => cardHasFullHeightInView(c, view))) return pan;
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
  const w = best.right - best.left;
  const h = best.bottom - best.top;
  const nx = needX(w, view);
  const ny = needY(h, view);
  let dx = 0;
  let dy = 0;
  if (best.right < view.left + nx) dx = view.left + nx - best.right;
  else if (best.left > view.right - nx) dx = view.right - nx - best.left;
  if (best.bottom < view.top + ny) dy = view.top + ny - best.bottom;
  else if (best.top > view.bottom - ny) dy = view.bottom - ny - best.top;
  return { x: pan.x + dx, y: pan.y + dy };
}
