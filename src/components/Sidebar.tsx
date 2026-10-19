import type { AppData, Layer } from '../types';
import { LAYERS, layerOf } from '../lib/graph';

interface Props {
  counts: Record<Layer, number>;
  activeLayer: Layer | null;
  onJump: (k: Layer) => void;
  people: { matched: number; total: number };
  usingSupabase: boolean;
  data: AppData;
}

const CX = 140, W = 128, H = 42;
const CARDS: [Layer, number][] = [['scene', 170], ['principle', 288], ['idea', 406], ['meaning', 524]];
const FWD = ['总结', '提炼', '升华'];
const BACK = ['检查', '优化', '影响'];

/** 侧栏：纵向系统模型图（生活&工作 → 场景 → 原则 → 理念 → 人生意义） */
export function Sidebar({ counts, activeLayer, onJump, people, usingSupabase, data }: Props) {
  const ac = layerOf('area').color;
  const top = CARDS[0][1] - H / 2 - 12;
  const L = CX - W / 2, R = CX + W / 2 + 12, XL = 34, XR = 252;
  const lvl = (k: Layer) => `lvl${activeLayer === k ? ' active' : ''}`;
  return (
    <aside className="side">
      <div className="brand">
        <div className="logo">LIFE<b>//</b>EXP</div>
        <div className="sub">COMMUNITY WISDOM ENGINE · v0.1</div>
      </div>
      <div className="flow-wrap">
        <div className="sec-title"><span>// 经验模型</span><i>CLICK→JUMP</i></div>
        <svg className="flow" viewBox="0 0 280 600" preserveAspectRatio="xMidYMin meet" aria-label="人生经验模型图">
          <defs>
            <filter id="fglow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {([['mc', '#00f0ff'], ['mm', '#ff2bd6'], ['mg', '#39ff9c']] as const).map(([id, c]) => (
              <marker key={id} id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={c} />
              </marker>
            ))}
          </defs>
          <g className={lvl('area')} data-layer="area" onClick={() => onJump('area')}>
            <circle cx={CX} cy={62} r={46} fill="none" stroke={ac} strokeOpacity=".35" strokeDasharray="2 5" className="spin" />
            <circle className="face" cx={CX} cy={62} r={38} fill="rgba(57,255,156,.07)" stroke={ac} strokeWidth="1.4" filter="url(#fglow)" />
            <circle cx={CX} cy={62} r={33} fill="none" stroke={ac} strokeOpacity=".5" />
            <text className="lbl" x={CX} y={66} textAnchor="middle" fill="#eafff4" fontSize="14" fontWeight="700">生活&amp;工作</text>
            <text className="cnt" x={CX} y={82} textAnchor="middle">×{counts.area}</text>
          </g>
          <path className="ar" d={`M${CX - 18},108 L${CX - 18},${top - 4}`} stroke={ac} markerEnd="url(#mg)" />
          <path className="ar" d={`M${CX + 18},${top - 4} L${CX + 18},108`} stroke="#ff2bd6" markerEnd="url(#mm)" />
          <text className="tag" x={CX - 26} y={(108 + top) / 2 + 3} textAnchor="end" fill={ac}>IN 经历</text>
          <text className="tag" x={CX + 26} y={(108 + top) / 2 + 3} fill="#ff2bd6">借鉴 OUT</text>
          {CARDS.map(([k, y]) => {
            const c = layerOf(k).color, x = CX - W / 2, yy = y - H / 2;
            return (
              <g key={k} className={lvl(k)} data-layer={k} onClick={() => onJump(k)}>
                <rect x={x + 12} y={yy - 12} width={W} height={H} rx="3" fill="#070b14" stroke={c} strokeOpacity=".35" />
                <rect x={x + 6} y={yy - 6} width={W} height={H} rx="3" fill="#070b14" stroke={c} strokeOpacity=".6" />
                <rect className="face" x={x} y={yy} width={W} height={H} rx="3" fill="rgba(8,14,26,.96)" stroke={c} strokeWidth="1.4" filter="url(#fglow)" />
                <rect x={x} y={yy} width="3" height={H} fill={c} />
                <text className="lbl" x={CX} y={y + 5} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700" letterSpacing="2">{LAYERS.find((l) => l.key === k)!.name}</text>
                <text className="cnt" x={x + W - 6} y={yy + H - 5} textAnchor="end">×{counts[k]}</text>
              </g>
            );
          })}
          {[0, 1, 2].map((i) => {
            const y1 = CARDS[i][1], y2 = CARDS[i + 1][1], my = (y1 + y2) / 2;
            const pf = `M${L},${y1 + 8} L${XL},${y1 + 8} L${XL},${y2 + 8} L${L - 2},${y2 + 8}`;
            const pb = `M${R},${y2 - 14} L${XR},${y2 - 14} L${XR},${y1 - 14} L${R + 2},${y1 - 14}`;
            return (
              <g key={i}>
                <path className="ar" d={pf} stroke="#00f0ff" strokeOpacity=".55" markerEnd="url(#mc)" />
                <path className="ar-flow" d={pf} stroke="#bffcff" />
                <rect x={XL - 17} y={my - 10} width="34" height="20" fill="#05070e" stroke="#00f0ff" strokeOpacity=".6" />
                <text className="alabel" x={XL} y={my + 4} textAnchor="middle" fill="#00f0ff" filter="url(#fglow)">{FWD[i]}</text>
                <path className="ar" d={pb} stroke="#ff2bd6" strokeOpacity=".55" markerEnd="url(#mm)" />
                <path className="ar-flow" d={pb} stroke="#ffc4f3" />
                <rect x={XR - 17} y={my - 24} width="34" height="20" fill="#05070e" stroke="#ff2bd6" strokeOpacity=".6" />
                <text className="alabel" x={XR} y={my - 10} textAnchor="middle" fill="#ff2bd6" filter="url(#fglow)">{BACK[i]}</text>
              </g>
            );
          })}
          <text className="tag" x={XL} y={585} textAnchor="middle" fill="#00f0ff" opacity=".7">▼ FORWARD</text>
          <text className="tag" x={XR} y={585} textAnchor="middle" fill="#ff2bd6" opacity=".7">▲ FEEDBACK</text>
        </svg>
      </div>
      <div className="legend">
        <div className="row"><span className="sw" style={{ color: 'var(--cyan)' }} />左侧 · 正向：总结 / 提炼 / 升华</div>
        <div className="row"><span className="sw" style={{ color: 'var(--mag)' }} />右侧 · 反馈：检查 / 优化 / 影响</div>
        <div className="row people">
          贡献者 <b>{usingSupabase ? (data.nodes.filter(n => n.contributionId).length || people.total) : people.total}</b> 位
        </div>
        <div className="demo">⚠ DEMO DATA · 示例投稿均为虚构，仅供演示</div>
      </div>
    </aside>
  );
}
