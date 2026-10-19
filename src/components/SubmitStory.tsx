import { useEffect } from 'react';

const CONTRIB_URL = 'https://github.com/timemiaolab/life-experience/blob/main/CONTRIBUTING.md#%E6%8A%95%E7%A8%BF%E4%B8%80%E7%AF%87%E7%BB%8F%E5%8E%86';
const TEMPLATE_URL = 'https://github.com/timemiaolab/life-experience/new/main/experiences?filename=YYYY-MM-DD-bian-ti.md';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 投稿入口：引导到 GitHub 网页新增 Markdown，不在浏览器里跑 AI / 后端。 */
export default function SubmitStory({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal open" onMouseDown={onClose}>
      <form className="form" onMouseDown={(e) => e.stopPropagation()} data-testid="submit-sheet" onSubmit={(e) => e.preventDefault()}>
        <h3>讲一件事</h3>
        <p className="desc">本站是<strong>纯静态</strong>知识图谱：经历以 Markdown 文本投稿，由仓库里的 AI 工作流整理进 JSON，站长审核合并后才会出现在树上。</p>
        <ol className="desc">
          <li>打开 GitHub 仓库的 <code>experiences/</code> 目录</li>
          <li>点 <b>Add file → Create new file</b>（网页会自动开 Pull Request）</li>
          <li>复制 <code>TEMPLATE.md</code> 的格式，填写出身 / 职业 / 地区 / 年龄段和正文（30–2000 字）</li>
          <li>提交后机器人会整理图谱；站长合并一次即可上线</li>
        </ol>
        <p className="desc">请只提交经历文本，不要提交代码。</p>
        <div className="acts">
          <a className="btn mag" href={TEMPLATE_URL} target="_blank" rel="noreferrer">在 GitHub 写一篇</a>
          <a className="btn ghost" href={CONTRIB_URL} target="_blank" rel="noreferrer">查看投稿说明</a>
          <button type="button" className="btn ghost" onClick={onClose}>关闭</button>
        </div>
      </form>
    </div>
  );
}
