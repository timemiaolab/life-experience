#!/usr/bin/env npx tsx
/**
 * Ingest one or more experience Markdown files into data/graph.json.
 * Story text is treated as data only; only schema-valid model JSON is applied.
 *
 *   npx tsx scripts/ingest.ts --dry-run --mock-response mock.json experiences/foo.md
 *   npx tsx scripts/ingest.ts experiences/foo.md
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  EMBEDDINGS_PATH, GRAPH_PATH, ROOT, loadEmbeddings, loadGraph, saveEmbeddings, saveGraph, prettyGraph,
} from './lib/graph-io.ts';
import { applyExtraction, textForEmbed } from './lib/apply-ingest.ts';
import { extractWithLlm, geminiEmbed, cosine } from './lib/llm.ts';
import { readExperience, type ExperienceDoc } from './lib/parse-experience.ts';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function collectFiles(): string[] {
  const out: string[] = [];
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--')) continue;
    const prev = process.argv[process.argv.indexOf(a) - 1];
    if (prev === '--mock-response' || prev === '--out') continue;
    out.push(a);
  }
  if (out.length) return out.map((p) => resolve(p));
  const dir = resolve(ROOT, 'experiences');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'TEMPLATE.md')
    .map((f) => join(dir, f));
}

async function main() {
  const dry = has('--dry-run');
  const mockPath = arg('--mock-response');
  const files = collectFiles();
  if (!files.length) {
    console.error('没有可处理的 experiences/*.md（已跳过 TEMPLATE.md）');
    process.exit(1);
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const siliconKey = process.env.SILICONFLOW_API_KEY;
  if (!mockPath && !geminiKey && !siliconKey) {
    console.error('缺少环境变量 GEMINI_API_KEY 与 SILICONFLOW_API_KEY。请仓库管理员在 GitHub Secrets 中配置后再运行。');
    process.exit(1);
  }

  let graph = loadGraph();
  let embeddings = loadEmbeddings();
  const summaries: string[] = [];

  for (const file of files) {
    const parsed = readExperience(file);
    if (!parsed.ok) {
      console.error(`${basename(file)} 校验失败：\n- ${parsed.errors.join('\n- ')}`);
      process.exit(1);
    }
    const doc: ExperienceDoc = parsed.doc;
    const mockJson = mockPath ? JSON.parse(readFileSync(mockPath, 'utf8')) : undefined;
    const llm = await extractWithLlm(doc.story, graph, { mockJson, geminiKey, siliconKey });

    const MERGE_SIM = 0.82;
    if (geminiKey && !mockPath) {
      try {
        const missing = graph.nodes.filter((n) => n.layer === 'principle' || n.layer === 'idea' || n.layer === 'meaning' || n.layer === 'scene')
          .filter((n) => !embeddings.vectors[n.id]);
        if (missing.length) {
          const vecs = await geminiEmbed(missing.map(textForEmbed), geminiKey);
          missing.forEach((n, i) => { embeddings.vectors[n.id] = vecs[i]; });
        }
        for (const p of llm.extraction.principles) {
          if (p.action !== 'new') continue;
          const [vec] = await geminiEmbed([`${p.title} ${p.desc}`], geminiKey);
          let best = { id: '', s: 0 };
          for (const n of graph.nodes.filter((x) => x.layer === 'principle')) {
            const ev = embeddings.vectors[n.id];
            if (!ev) continue;
            const s = cosine(vec, ev);
            if (s > best.s) best = { id: n.id, s };
          }
          if (best.id && best.s >= MERGE_SIM) {
            p.action = 'merge';
            p.existingId = best.id;
          }
        }
      } catch (e) {
        console.warn('embedding / 近重判断跳过：', e instanceof Error ? e.message : e);
      }
    }

    const applied = applyExtraction(graph, doc, llm.extraction, embeddings, []);
    graph = applied.graph;
    summaries.push([
      `文件：${doc.file}`,
      `贡献者：${doc.origin} · ${doc.profession} · ${doc.region} · ${doc.age}${doc.city ? ` · ${doc.city}` : ''}（${applied.contributionId}）`,
      `模型：${llm.provider}`,
      `场景：${llm.extraction.scenes.map((s) => s.title).join('；')}`,
      ...applied.notes.map((n) => {
        const sim = n.similarity != null ? `，相似度 ${(n.similarity * 100).toFixed(0)}%` : '';
        const near = n.nearestId ? ` ← ${n.nearestId}` : '';
        return n.action === 'merge' ? `合并${n.kind} ${n.id}「${n.title}」${near}${sim}` : `新建${n.kind} ${n.id}「${n.title}」${near}${sim}`;
      }),
    ].join('\n'));
  }

  const report = summaries.join('\n\n');
  if (dry) {
    console.log('--- DRY RUN：不会写入仓库 ---\n');
    console.log(report);
    console.log('\n--- graph.json 预览（前 2KB）---');
    const pretty = prettyGraph(graph);
    console.log(pretty.slice(0, 2000));
    const out = arg('--out');
    if (out) writeFileSync(out, pretty);
    process.exit(0);
  }

  saveGraph(graph);
  saveEmbeddings(embeddings);
  console.log(report);
  console.log(`\n已写入 ${GRAPH_PATH} 与 ${EMBEDDINGS_PATH}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
