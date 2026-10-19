#!/usr/bin/env npx tsx
/**
 * Ingest one or more experience Markdown files into data/graph.json.
 * Story text is treated as data only; only schema-valid model JSON is applied.
 *
 *   npx tsx scripts/ingest.ts --dry-run --mock-response mock.json experiences/foo.md
 *   npx tsx scripts/ingest.ts experiences/foo.md
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  EMBEDDINGS_PATH, GRAPH_PATH, ROOT, loadEmbeddings, loadGraph, saveEmbeddings, saveGraph, prettyGraph,
  type EmbeddingsFile,
} from './lib/graph-io.ts';
import { applyExtraction, formatNote, nearest, textForEmbed } from './lib/apply-ingest.ts';
import { chatModel, embedDim, embedModel, extractWithLlm, geminiEmbed, cosine } from './lib/llm.ts';
import { readExperience, type ExperienceDoc } from './lib/parse-experience.ts';
import type { GNode } from '../src/types.ts';

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

const EMBED_LAYERS = new Set<GNode['layer']>(['principle', 'idea', 'meaning', 'scene']);

async function embedMissing(
  graphNodes: GNode[],
  embeddings: EmbeddingsFile,
  key: string,
): Promise<void> {
  const missing = graphNodes.filter((n) => EMBED_LAYERS.has(n.layer) && !embeddings.vectors[n.id]);
  if (!missing.length) return;
  console.log(`补齐 ${missing.length} 个已有节点的 embedding（${embedModel()} dim=${embedDim()}）`);
  const vecs = await geminiEmbed(missing.map(textForEmbed), key);
  missing.forEach((n, i) => { embeddings.vectors[n.id] = vecs[i]; });
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
  if (!mockPath && !geminiKey) {
    console.error('缺少 GEMINI_API_KEY：嵌入模型无法调用，拒绝静默跳过近重判断。请配置 Secrets / 环境变量后再运行。');
    process.exit(1);
  }

  console.log(`对话模型默认 ${chatModel()}；嵌入模型 ${embedModel()}（outputDimensionality=${embedDim()}）`);

  let graph = loadGraph();
  let embeddings = loadEmbeddings();
  embeddings.model = embedModel();
  embeddings.dim = embedDim();
  const summaries: string[] = [];
  const MERGE_SIM = 0.82;

  for (const file of files) {
    const parsed = readExperience(file);
    if (!parsed.ok) {
      console.error(`${basename(file)} 校验失败：\n- ${parsed.errors.join('\n- ')}`);
      process.exit(1);
    }
    const doc: ExperienceDoc = parsed.doc;
    const mockJson = mockPath ? JSON.parse(readFileSync(mockPath, 'utf8')) : undefined;
    const llm = await extractWithLlm(doc.story, graph, { mockJson, geminiKey, siliconKey });

    const sceneVecs: (number[] | undefined)[] = [];
    if (mockPath) {
      console.log('mock 模式：跳过 embedding / 近重判断（不调用模型）。');
    } else {
      try {
        await embedMissing(graph.nodes, embeddings, geminiKey!);
        const sceneTexts = llm.extraction.scenes.map((s) => `${s.title} ${s.desc}`);
        const newSceneVecs = await geminiEmbed(sceneTexts, geminiKey!);
        sceneVecs.push(...newSceneVecs);
        for (const p of llm.extraction.principles) {
          const [vec] = await geminiEmbed([`${p.title} ${p.desc}`], geminiKey!);
          if (p.action === 'merge' && p.existingId) {
            const ev = embeddings.vectors[p.existingId];
            if (ev) p.similarity = cosine(vec, ev);
            continue;
          }
          const near = nearest(vec, 'principle', graph, embeddings);
          if (!near) continue;
          p.similarity = near.similarity;
          p.nearestId = near.id;
          p.nearestTitle = near.title;
          if (near.similarity >= MERGE_SIM) {
            p.action = 'merge';
            p.existingId = near.id;
            console.log(`近重合并原则 → ${near.id}「${near.title}」相似度 ${(near.similarity * 100).toFixed(0)}%`);
          }
        }
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        console.error(`FALLBACK 嵌入失败：模型 ${embedModel()} dim=${embedDim()}。原因：${why}`);
        console.error('拒绝静默跳过近重判断；本轮整理中止。');
        process.exit(1);
      }
    }

    const applied = applyExtraction(graph, doc, llm.extraction, embeddings, sceneVecs);
    graph = applied.graph;

    if (!mockPath && applied.newNodeIds.length) {
      try {
        const created = applied.newNodeIds
          .map((id) => graph.nodes.find((n) => n.id === id))
          .filter((n): n is GNode => !!n);
        if (created.length) {
          console.log(`为本轮新建的 ${created.length} 个节点写入 embedding`);
          const vecs = await geminiEmbed(created.map(textForEmbed), geminiKey!);
          created.forEach((n, i) => { embeddings.vectors[n.id] = vecs[i]; });
        }
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        console.error(`新建节点 embedding 失败（${embedModel()}）：${why}`);
        console.error('拒绝在没有向量的情况下写入图谱。');
        process.exit(1);
      }
    }

    const fallbackLines = llm.fallbacks.length
      ? llm.fallbacks.map((f) => `回退：${f}`)
      : [];
    summaries.push([
      `文件：${doc.file}`,
      `贡献者：${doc.origin} · ${doc.profession} · ${doc.region} · ${doc.age}${doc.city ? ` · ${doc.city}` : ''}（${applied.contributionId}）`,
      `模型：${llm.provider} / ${llm.chatModel}`,
      ...fallbackLines,
      `场景：${llm.extraction.scenes.map((s) => s.title).join('；')}`,
      ...applied.notes.map(formatNote),
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
