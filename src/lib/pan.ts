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

/** True when a card is fully inside the view (or covers it if the card is larger). */
export function cardFullyInView(card: ScreenRect, view: ScreenRect): boolean {
  const { ox, oy, w, h } = overlap(card, view);
  const nx = Math.min(Math.max(w, 1), view.right - view.left);
  const ny = Math.min(Math.max(h, 1), view.bottom - view.top);
  return ox >= nx - 0.5 && oy >= ny - 0.5;
}

/** @deprecated use cardFullyInView */
export function cardHasFullHeightInView(card: ScreenRect, view: ScreenRect): boolean {
  return cardFullyInView(card, view);
}

export function cardOverlapsView(card: ScreenRect, view: ScreenRect, min = 24): boolean {
  const { ox, oy } = overlap(card, view);
  return ox >= min && oy >= min;
}

function nudgeForCard(
  pan: { x: number; y: number },
  view: ScreenRect,
  card: ScreenRect,
): { x: number; y: number } {
  const viewW = view.right - view.left;
  const viewH = view.bottom - view.top;
  const w = card.right - card.left;
  const h = card.bottom - card.top;
  let dx = 0;
  let dy = 0;
  if (w <= viewW + 0.5) {
    if (card.left < view.left - 0.5) dx = view.left - card.left;
    else if (card.right > view.right + 0.5) dx = view.right - card.right;
  } else if (card.left > view.left + 0.5) dx = view.left - card.left;
  else if (card.right < view.right - 0.5) dx = view.right - card.right;
  if (h <= viewH + 0.5) {
    if (card.top < view.top - 0.5) dy = view.top - card.top;
    else if (card.bottom > view.bottom + 0.5) dy = view.bottom - card.bottom;
  } else if (card.top > view.top + 0.5) dy = view.top - card.top;
  else if (card.bottom < view.bottom - 0.5) dy = view.bottom - card.bottom;
  return { x: pan.x + dx, y: pan.y + dy };
}

/** Screen-space nudge so at least one card is fully visible in the viewport. */
export function nudgePanForCards(
  pan: { x: number; y: number },
  view: ScreenRect,
  cards: ScreenRect[],
): { x: number; y: number } {
  if (!cards.length || cards.some((c) => cardFullyInView(c, view))) return pan;
  const cx = (view.left + view.right) / 2;
  const cy = (view.top + view.bottom) / 2;
  const ranked = cards.map((c) => {
    const { ox, oy } = overlap(c, view);
    const dx = (c.left + c.right) / 2 - cx;
    const dy = (c.top + c.bottom) / 2 - cy;
    return { c, area: ox * oy, d: dx * dx + dy * dy };
  });
  ranked.sort((a, b) => b.area - a.area || a.d - b.d);
  return nudgeForCard(pan, view, ranked[0].c);
}
