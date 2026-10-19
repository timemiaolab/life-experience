import { useEffect, useState } from 'react';
import type { AppData, Identity, IdentityDim } from '../types';
import { DIMS, ORIGIN_COLORS } from '../data/identity';
import { SAMPLE_STORY } from '../data/seed';
import { engineLabel, organize, type OrganizeResult, type PrincipleDraft } from '../ai/organizer';
import { layerOf } from '../lib/graph';
import type { CommitPayload } from '../store/store';

interface Props {
  open: boolean;
  data: AppData;
  onClose: () => void;
  onConfirm: (p: CommitPayload) => Promise<void>;
}

type Step = 'write' | 'organizing' | 'preview';
const EMPTY_ID: Identity = { origin: '', profession: '', region: '', age: '', city: '' };
const MIN_LEN = 30;

/** 「讲一件事」：选身份 → 写故事 → AI 整理 → 预览确认 */
export function SubmitStory({ open, data, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<Step>('write');
  const [identity, setIdentity] = useState<Identity>(EMPTY_ID);
  const [customJob, setCustomJob] = useState('');
  const [story, setStory] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<OrganizeResult | null>(null);

  useEffect(() => {
    if (open) { setStep('write'); setErr(''); setDraft(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && step !== 'organizing') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, step, onClose]);

  if (!open) return null;

  const areas = data.nodes.filter((n) => n.layer === 'area');
  const principles = data.nodes.filter((n) => n.layer === 'principle');
  const ideas = data.nodes.filter((n) => n.layer === 'idea');
  const title = (id?: string) => data.nodes.find((n) => n.id === id)?.title ?? '';
  const finalIdentity = (): Identity => ({ ...identity, profession: identity.profession === '__custom' ? customJob.trim() : identity.profession, city: identity.city?.trim() || undefined });

  const setDim = (k: IdentityDim, v: string) => setIdentity((s) => ({ ...s, [k]: s[k] === v ? '' : v }));

  const runOrganize = async () => {
    const idt = finalIdentity();
    const miss = DIMS.filter((d) => !idt[d.key]).map((d) => d.name);
    if (miss.length) return setErr(`› 请选择身份：${miss.join(' / ')}`);
    if (story.trim().length < MIN_LEN) return setErr(`› 故事至少 ${MIN_LEN} 字：发生了什么？后来怎么做的？学到了什么？`);
    if (!agree) return setErr('› 请确认这是你自己的真实经历，且不包含他人隐私');
    setErr(''); setStep('organizing');
    try {
      const r = await organize(story, idt, data);
      setDraft(r); setStep('preview');
    } catch (e) {
      setErr(`› 整理失败：${e instanceof Error ? e.message : String(e)}`); setStep('write');
    }
  };

  const patchScene = (i: number, patch: Partial<OrganizeResult['scenes'][number]>) =>
    setDraft((d) => d && { ...d, scenes: d.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const patchP = (i: number, patch: Partial<PrincipleDraft>) =>
    setDraft((d) => d && { ...d, principles: d.principles.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const removeP = (i: number) => setDraft((d) => d && { ...d, principles: d.principles.filter((_, j) => j !== i) });

  const confirm = async () => {
    if (!draft) return;
    if (draft.scenes.some((s) => !s.title.trim())) return setErr('› 场景标题不能为空');
    if (draft.principles.some((p) => p.action === 'new' && !p.title.trim())) return setErr('› 新原则标题不能为空');
    if (draft.principles.some((p) => !p.sceneIndexes.length)) return setErr('› 每条原则至少关联一个场景');
    await onConfirm({ identity: finalIdentity(), story: draft.anonymizedStory.trim(), engine: draft.engine, scenes: draft.scenes, principles: draft.principles });
  };

  const mergedN = draft?.principles.filter((p) => p.action === 'merge').length ?? 0;
  const newN = (draft?.principles.length ?? 0) - mergedN;

  return (
    <div className="modal open" onMouseDown={(e) => { if (e.target === e.currentTarget && step !== 'organizing') onClose(); }}>
      <div className={`form${step === 'preview' ? ' wide' : ''}`} data-testid="submit-modal">
        {step !== 'preview' && (
          <>
            <h3>＋ 讲一件事 · SHARE_A_STORY</h3>
            <div className="desc">选几个身份标签，用大白话讲一件你真实经历过的事。AI 会帮你整理成「场景 → 原则」，并合并到社区已有的经验里。</div>
            {DIMS.map((d) => (
              <div key={d.key}>
                <label>{d.name} {d.en} *</label>
                <div className="seg">
                  {d.options.map((v) => (
                    <button key={v} type="button" data-dim={d.key} data-val={v} className={identity[d.key] === v ? 'on' : ''}
                      style={{ ['--pc' as string]: d.key === 'origin' ? ORIGIN_COLORS[v] : '#00f0ff' }} onClick={() => setDim(d.key, v)}>{v}</button>
                  ))}
                  {d.custom && (
                    <button type="button" className={identity[d.key] === '__custom' ? 'on' : ''} style={{ ['--pc' as string]: '#00f0ff' }} onClick={() => setDim(d.key, '__custom')}>其他…</button>
                  )}
                </div>
                {d.custom && identity.profession === '__custom' && (
                  <input className="mt6" maxLength={8} placeholder="你的职业，例如：快递员 / 设计师" value={customJob} onChange={(e) => setCustomJob(e.target.value)} />
                )}
              </div>
            ))}
            <label>城市 / 省份（可选，只展示到城市）</label>
            <input maxLength={10} placeholder="例如：成都 / 河南" value={identity.city ?? ''} onChange={(e) => setIdentity({ ...identity, city: e.target.value })} />
            <label>你的故事 STORY *<span className="cnt">{story.trim().length} 字</span></label>
            <textarea data-testid="story" rows={7} maxLength={1500} value={story} onChange={(e) => setStory(e.target.value)}
              placeholder={'发生了什么？当时怎么想的？后来怎么做的？你学到了什么？\n多件事可以用“还有一次 / 另外”分开。请不要写真实姓名、电话、单位全称。'} />
            <label className="agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />这是我自己的真实经历；我已去掉他人可识别的信息，同意匿名公开。</label>
            <div className="err">{err}</div>
            <div className="acts">
              <span className="engine">AI 引擎：{engineLabel()}</span>
              <button type="button" className="btn ghost" data-testid="fill-sample"
                onClick={() => { setIdentity({ ...SAMPLE_STORY.identity }); setStory(SAMPLE_STORY.story); setAgree(true); setErr(''); }}>填入示例</button>
              <button type="button" className="btn ghost" onClick={onClose} disabled={step === 'organizing'}>取消</button>
              <button type="button" className="btn mag" data-testid="organize" onClick={runOrganize} disabled={step === 'organizing'}>
                {step === 'organizing' ? 'AI 整理中…' : 'AI 整理 ›'}
              </button>
            </div>
            {step === 'organizing' && <div className="thinking"><i /><span>正在拆分场景 · 提炼原则 · 比对 {principles.length} 条已有原则…</span></div>}
          </>
        )}

        {step === 'preview' && draft && (
          <div data-testid="preview">
            <h3>◆ AI 整理结果 · PREVIEW</h3>
            <div className="desc">
              引擎 <b className="eng">{draft.engine === 'llm' ? 'LLM' : 'MOCK'}</b> · 拆出 {draft.scenes.length} 个场景 · 合并到已有原则 {mergedN} 条 · 新原则 {newN} 条。
              一切都可以修改，确认后才会加入人生树。
            </div>
            {draft.warnings.length > 0 && (
              <div className="warns">{draft.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>
            )}
            <div className="pv">
              <div className="pv-col">
                <div className="pv-h" style={{ color: layerOf('scene').color }}>L1 // 场景 SCENES</div>
                {draft.scenes.map((s, i) => (
                  <div className="card" key={i} style={{ ['--c' as string]: layerOf('scene').color }}>
                    <div className="card-h"><span>场景 #{i + 1}</span>
                      <select value={s.areaId} onChange={(e) => patchScene(i, { areaId: e.target.value })}>{areas.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
                      <input className="tagin" value={s.tag} maxLength={6} onChange={(e) => patchScene(i, { tag: e.target.value })} />
                    </div>
                    <input value={s.title} maxLength={30} onChange={(e) => patchScene(i, { title: e.target.value })} data-testid={`scene-title-${i}`} />
                    <textarea rows={3} value={s.desc} maxLength={200} onChange={(e) => patchScene(i, { desc: e.target.value })} />
                  </div>
                ))}
                <div className="pv-h dim">脱敏后的原文（将匿名公开）</div>
                <textarea className="orig" rows={6} value={draft.anonymizedStory} onChange={(e) => setDraft({ ...draft, anonymizedStory: e.target.value })} />
              </div>
              <div className="pv-col">
                <div className="pv-h" style={{ color: layerOf('principle').color }}>L2 // 原则 PRINCIPLES</div>
                {draft.principles.map((p, i) => (
                  <div className={`card ${p.action}`} key={i} style={{ ['--c' as string]: layerOf('principle').color }} data-testid={`principle-${i}`}>
                    <div className="card-h">
                      {p.action === 'merge'
                        ? <span className="badge merge">⇢ 合并到已有：{title(p.existingId)}</span>
                        : <span className="badge new">✦ 新原则</span>}
                      <span className="sim">相似度 {p.similarity.toFixed(2)}</span>
                      <button type="button" className="x" title="删除这条" onClick={() => removeP(i)}>✕</button>
                    </div>
                    <div className="from">AI 从故事中提炼：“{p.title}”</div>
                    <select value={p.action === 'merge' ? p.existingId : '__new'} data-testid={`principle-target-${i}`}
                      onChange={(e) => e.target.value === '__new' ? patchP(i, { action: 'new', existingId: undefined }) : patchP(i, { action: 'merge', existingId: e.target.value })}>
                      <option value="__new">✦ 作为新原则</option>
                      {principles.map((x) => <option key={x.id} value={x.id}>⇢ 合并到：{x.title}{x.id === p.nearestId ? '（最相近）' : ''}</option>)}
                    </select>
                    {p.action === 'new' && (
                      <>
                        <input value={p.title} maxLength={30} onChange={(e) => patchP(i, { title: e.target.value })} placeholder="原则标题" />
                        <textarea rows={2} value={p.desc} maxLength={160} onChange={(e) => patchP(i, { desc: e.target.value })} placeholder="补充说明" />
                        <div className="row-l">挂到理念
                          <select value={p.ideaId} onChange={(e) => patchP(i, { ideaId: e.target.value })}>{ideas.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
                        </div>
                      </>
                    )}
                    {p.action === 'merge' && <div className="row-l dim">→ 理念：{data.links.filter(([a]) => a === p.existingId).map(([, b]) => title(b)).join(' / ')}</div>}
                    <div className="row-l">来自场景
                      {draft.scenes.map((_, si) => (
                        <label key={si} className="ck"><input type="checkbox" checked={p.sceneIndexes.includes(si)}
                          onChange={(e) => patchP(i, { sceneIndexes: e.target.checked ? [...p.sceneIndexes, si].sort() : p.sceneIndexes.filter((x) => x !== si) })} />#{si + 1}</label>
                      ))}
                    </div>
                  </div>
                ))}
                {draft.principles.length === 0 && <div className="none">— 没有原则：场景将只挂在领域下 —</div>}
              </div>
            </div>
            <div className="err">{err}</div>
            <div className="acts">
              <button type="button" className="btn ghost" onClick={() => setStep('write')}>‹ 返回修改</button>
              <button type="button" className="btn mag" data-testid="confirm" onClick={confirm}>确认加入人生树 ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
