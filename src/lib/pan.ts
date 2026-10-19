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
}

/** Clamp drag-pan so a slice of the unscaled grid (× zoom) stays in view. */
export function clampPan(pan: { x: number; y: number }, box: PanBox): { x: number; y: number } {
  const minVisible = Math.min(200, box.cw * 0.25, box.ch * 0.25);
  const scaledW = box.gridW * box.zoom;
  const scaledH = box.gridH * box.zoom;
  const offX = box.gridLeft * box.zoom - (box.scrollLeft ?? 0);
  const offY = box.gridTop * box.zoom - (box.scrollTop ?? 0);
  const visX = Math.min(minVisible, Math.max(1, scaledW));
  const visY = Math.min(minVisible, Math.max(1, scaledH));
  const maxX = box.cw - visX - offX;
  const minX = visX - offX - scaledW;
  const maxY = box.ch - visY - offY;
  const minY = visY - offY - scaledH;
  return {
    x: Math.max(minX, Math.min(maxX, pan.x)),
    y: Math.max(minY, Math.min(maxY, pan.y)),
  };
}
