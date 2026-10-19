#!/usr/bin/env npx tsx
/**
 * Apply hand-extracted graph updates for curated public stories.
 * Does not call Gemini / SiliconFlow. Uses the same applyExtraction + schema
 * as scripts/ingest.ts. New nodes are left without embeddings; ingest.ts
 * embedMissing() backfills them on the next real ingest run.
 */
import { basename, join, resolve } from 'node:path';
import { applyExtraction, formatNote } from './lib/apply-ingest.ts';
import { loadEmbeddings, loadGraph, ROOT, saveGraph } from './lib/graph-io.ts';
import { readExperience } from './lib/parse-experience.ts';
import { validateExtraction, type IngestExtraction } from './lib/schema.ts';

const DIR = resolve(ROOT, 'experiences');

const JOBS: { file: string; extraction: IngestExtraction }[] = [
  {
    file: '2025-07-19-zhang-sai-gongchang.md',
    extraction: {
      scenes: [
        {
          title: '16岁进晋江卫生巾厂，手受伤仍留下',
          desc: '树脂厂太危险改去楼上卫生巾厂，记不住三种胶被骂，手指卡过机器，下了夜班走五公里借书。',
          areaId: 'a1',
          tag: '打工',
        },
        {
          title: '武汉送外卖摔伤后又回工厂再跑单',
          desc: '快递老板卷走工资后改送外卖，腿摔坏回泉州工厂三年，再回武汉跑外卖。',
          areaId: 'a1',
          tag: '职场',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p6', title: '把手上的小事做到靠谱，机会会找上门', desc: '挨打后才看清自己干活糊弄、不了解工友。', sceneIndexes: [0], ideaId: 'i4' },
        { action: 'merge', existingId: 'p11', title: '敢于走出熟悉的圈子去看看', desc: '晋江工厂、武汉饺子馆、快递外卖来回换，反复横跳也是活法。', sceneIndexes: [0, 1], ideaId: 'i1' },
        { action: 'merge', existingId: 'p7', title: '身体发出信号时，立刻停下来', desc: '送外卖把腿摔坏，才不得不停下来换工作。', sceneIndexes: [1], ideaId: 'i5' },
      ],
      ideas: [
        { action: 'merge', existingId: 'i4', title: '长期主义：小事做久就是壁垒', desc: '打工二十二年仍在写身边的人。', meaningId: 'm2' },
        { action: 'merge', existingId: 'i5', title: '身体和情绪是一切的地基', desc: '腿伤迫使停轮。', meaningId: 'm2' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm2', title: '成为一个可靠而温暖的人', desc: '眼里有了周围的人，才值得去写。', },
      ],
    },
  },
  {
    file: '2024-03-16-xie-ailei-zuotijia.md',
    extraction: {
      scenes: [
        {
          title: '误打误撞报了华东师范大学英语专业',
          desc: '安徽农村走出来，高考文科第一，误打误撞进了离原来生活很远的英语专业。',
          areaId: 'a3',
          tag: '求学',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p1', title: '大事先问过来人，别只靠自己摸索', desc: '误打误撞报了英语专业，大学万圣节派对不到一半就离开。', sceneIndexes: [0], ideaId: 'i1' },
        { action: 'merge', existingId: 'p11', title: '敢于走出熟悉的圈子去看看', desc: '精英大学里要推开门进去看看，不能只做题。', sceneIndexes: [0], ideaId: 'i1' },
      ],
      ideas: [
        { action: 'merge', existingId: 'i1', title: '信息差就是机会差', desc: '不熟悉的味道会直接拒绝，信息差会变成机会差。', meaningId: 'm1' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm1', title: '不被出身定义，把选择权握在自己手里', desc: '小镇做题家的下一程不该只剩应试。', },
      ],
    },
  },
  {
    file: '2021-03-20-cheng-meng-dushu.md',
    extraction: {
      scenes: [
        {
          title: '沿田埂上村小，熄灯后借灯光写作业',
          desc: '村里说是读书的料，大考每次卡线，最后考上北京的大学。',
          areaId: 'a3',
          tag: '求学',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p5', title: '每天固定学一点，比偶尔拼命有用', desc: '熄灯后仍去水房借光写作业，靠的是每天一点点。', sceneIndexes: [0], ideaId: 'i4' },
        { action: 'merge', existingId: 'p11', title: '敢于走出熟悉的圈子去看看', desc: '从村小到大城市大学，像风筝一次次离开家乡。', sceneIndexes: [0], ideaId: 'i1' },
      ],
      ideas: [
        { action: 'merge', existingId: 'i4', title: '长期主义：小事做久就是壁垒', desc: '苦读背后是很少被看见的内心世界。', meaningId: 'm1' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm1', title: '不被出身定义，把选择权握在自己手里', desc: '走出农村改变的和改变不了的，都要被看见。', },
      ],
    },
  },
  {
    file: '2021-07-18-weizhou-shiye.md',
    extraction: {
      scenes: [
        {
          title: '广告公司谈结构调整，人到中年去领失业金',
          desc: '这家公司待了五年多，入行二十年，N+2 离开，社区窗口领每月约两千的失业金。',
          areaId: 'a1',
          tag: '职场',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p8', title: '情绪上头时，先别做决定', desc: '走出大楼先接受离开，而不是硬留在清单阴影里。', sceneIndexes: [0], ideaId: 'i2' },
        { action: 'merge', existingId: 'p2', title: '先存够 3–6 个月的应急钱', desc: '中年失业后收入骤停，写作还谈不上稳定收入。', sceneIndexes: [0], ideaId: 'i2' },
      ],
      ideas: [
        { action: 'merge', existingId: 'i2', title: '给自己留余地，才有底气', desc: '安全不是抱紧浮木，而是愿不愿意调适。', meaningId: 'm1' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm1', title: '不被出身定义，把选择权握在自己手里', desc: '把写作当成正业，重新开始。', },
      ],
    },
  },
  {
    file: '2012-02-21-qiao-congcong.md',
    extraction: {
      scenes: [
        {
          title: '珠海流水线做到没希望，辞职回老家待业',
          desc: '一周六天还加班，觉得只能当一辈子操作工，决定离开。',
          areaId: 'a1',
          tag: '职场',
        },
        {
          title: '吴江报名组长培训，转到人事并读函授',
          desc: '满三个月参加内部招聘，再读南大商务管理函授，厂里报销一半。',
          areaId: 'a3',
          tag: '学习',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p11', title: '敢于走出熟悉的圈子去看看', desc: '没希望的流水线再待下去，路只会更窄。', sceneIndexes: [0], ideaId: 'i1' },
        { action: 'merge', existingId: 'p5', title: '每天固定学一点，比偶尔拼命有用', desc: '周末函授三年，拿到文凭才有下一格晋升。', sceneIndexes: [1], ideaId: 'i4' },
        { action: 'merge', existingId: 'p6', title: '把手上的小事做到靠谱，机会会找上门', desc: '培训表现被看见，才被推荐去做新员工辅导员。', sceneIndexes: [1], ideaId: 'i4' },
      ],
      ideas: [
        { action: 'merge', existingId: 'i4', title: '长期主义：小事做久就是壁垒', desc: '看得见的晋升机制，靠持续学习往上走。', meaningId: 'm1' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm1', title: '不被出身定义，把选择权握在自己手里', desc: '从农村进城，不一定只能停在流水线上。', },
      ],
    },
  },
  {
    file: '2017-10-17-li-jia-yangmu.md',
    extraction: {
      scenes: [
        {
          title: '工厂辞职八年，每天喊养母记住自己',
          desc: '养母失智后没有送养老院，辞职住到身边穿衣喂饭、下楼散步。',
          areaId: 'a2',
          tag: '家庭',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p10', title: '和家人好好说话，比多给钱更重要', desc: '人在比钱在更要紧，陪失智的母亲把名字一次次叫回来。', sceneIndexes: [0], ideaId: 'i3' },
      ],
      ideas: [
        { action: 'merge', existingId: 'i3', title: '关系靠真诚与边界维系', desc: '小时候她把我抱回家，现在我陪她变老。', meaningId: 'm2' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm2', title: '成为一个可靠而温暖的人', desc: '对事靠谱，对人温暖。', },
      ],
    },
  },
  {
    file: '2015-07-06-yuanshan-jiuyuan.md',
    extraction: {
      scenes: [
        {
          title: '汶川废墟上只有铁锹，回来把队伍建成综合救援',
          desc: '面对几十吨楼板束手无策，回来坚持每周专业培训。尼泊尔自费一人一两万，菲律宾是代表国家派出。',
          areaId: 'a1',
          tag: '创业',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p5', title: '每天固定学一点，比偶尔拼命有用', desc: '队员白天上班，每周两三次培训，技能不练就等于把命交给现场。', sceneIndexes: [0], ideaId: 'i4' },
        { action: 'merge', existingId: 'p6', title: '把手上的小事做到靠谱，机会会找上门', desc: '跨省搜救十二天没找到目标，却在后山救下坠崖的人。', sceneIndexes: [0], ideaId: 'i4' },
        { action: 'merge', existingId: 'p11', title: '敢于走出熟悉的圈子去看看', desc: '从太行山的户外领队，走到全国和跨境救援。', sceneIndexes: [0], ideaId: 'i1' },
      ],
      ideas: [
        { action: 'merge', existingId: 'i4', title: '长期主义：小事做久就是壁垒', desc: '专业是救人的前提，也是少出事故的前提。', meaningId: 'm2' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm2', title: '成为一个可靠而温暖的人', desc: '帮忙时要感恩，不要摆救世主姿态。', },
        { action: 'merge', existingId: 'm3', title: '让后来的人少走一点弯路', desc: '把防溺水讲进学校，后来的孩子少走险途。', },
      ],
    },
  },
  {
    file: '2024-06-12-tianhuo-fuzhai.md',
    extraction: {
      scenes: [
        {
          title: '阳了逾期两天，催收电话打到家里和合伙人',
          desc: '高烧七天没看手机，催收报出地址；花钱买的协商方法在论坛上本来就有。仍在还款。',
          areaId: 'a2',
          tag: '理财',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p2', title: '先存够 3–6 个月的应急钱', desc: '房贷加网贷上百万，逾期几天就要四处凑五万，手里没有能撑过账单的余钱。', sceneIndexes: [0], ideaId: 'i2' },
      ],
      ideas: [
        { action: 'merge', existingId: 'i2', title: '给自己留余地，才有底气', desc: '周转断裂时，余地比面子更重要。', meaningId: 'm1' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm1', title: '不被出身定义，把选择权握在自己手里', desc: '正在还钱的人像想主动治疗的病人，别把选择权交给灰产。', },
      ],
    },
  },
  {
    file: '2016-11-27-hu-weiwei-mobai.md',
    extraction: {
      scenes: [
        {
          title: '公共自行车办不了卡，决定做能扫码骑走的车',
          desc: '杭州和哥德堡傍晚看见路边的车却租不成，设计师退出后只剩自己把项目做下来。',
          areaId: 'a1',
          tag: '创业',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p11', title: '敢于走出熟悉的圈子去看看', desc: '记者做了十年汽车，还是出来自己做极客汽车和共享单车。', sceneIndexes: [0], ideaId: 'i1' },
        {
          action: 'new',
          title: '身边都说不靠谱，也不轻易丢掉判断',
          desc: '重大决定有时凭直觉。别人论证会被偷、没人用，仍把能骑走的车放到路上。',
          sceneIndexes: [0],
          ideaId: 'i4',
        },
      ],
      ideas: [
        { action: 'merge', existingId: 'i4', title: '长期主义：小事做久就是壁垒', desc: '从栏目没获批，到一个人做媒体，再到把车放到城市里。', meaningId: 'm1' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm1', title: '不被出身定义，把选择权握在自己手里', desc: '与其坐等城市适合骑行，不如先把车放出去。', },
      ],
    },
  },
  {
    file: '2024-09-06-ahao-caiyuan.md',
    extraction: {
      scenes: [
        {
          title: '转岗后天天十点后下班，妻子那次怀孕胎停了',
          desc: '2020年内部转岗后每天十点后下班。妻子当时那次怀孕后来胎停，他后悔没多留一点时间。',
          areaId: 'a2',
          tag: '健康',
        },
        {
          title: '大厂十年被裁，开车离开北京去长沙当老师',
          desc: '无固定期限合同只拿到 N+1，试用期工资约从前的十分之一。',
          areaId: 'a1',
          tag: '职场',
        },
      ],
      principles: [
        { action: 'merge', existingId: 'p7', title: '身体发出信号时，立刻停下来', desc: '转岗后的加班和那次胎停，让他看清工作不是全部。', sceneIndexes: [0], ideaId: 'i5' },
        { action: 'merge', existingId: 'p11', title: '敢于走出熟悉的圈子去看看', desc: '离开待了十年的北京，改去长沙当高职老师。', sceneIndexes: [1], ideaId: 'i1' },
      ],
      ideas: [
        { action: 'merge', existingId: 'i5', title: '身体和情绪是一切的地基', desc: '先把人从通宵加班里拉开。', meaningId: 'm2' },
      ],
      meanings: [
        { action: 'merge', existingId: 'm2', title: '成为一个可靠而温暖的人', desc: '收入少了，仍要在家庭和课堂上靠谱。', },
      ],
    },
  },
];

function alreadyApplied(graph: ReturnType<typeof loadGraph>, doc: { sourceUrl?: string; name?: string; file: string }): boolean {
  return graph.contributions.some((c) => {
    if (doc.sourceUrl && c.source?.url === doc.sourceUrl) return true;
    if (doc.name && c.name === doc.name && c.engine === 'curated') return true;
    return false;
  });
}

function main() {
  let graph = loadGraph();
  const embeddings = loadEmbeddings();
  const beforeNodes = graph.nodes.length;
  const beforeContrib = graph.contributions.length;
  const reports: string[] = [];
  let changed = false;

  for (const job of JOBS) {
    const path = join(DIR, job.file);
    const parsed = readExperience(path);
    if (!parsed.ok) {
      console.error(`${job.file} 校验失败：\n- ${parsed.errors.join('\n- ')}`);
      process.exit(1);
    }
    if (alreadyApplied(graph, parsed.doc)) {
      reports.push(`跳过 ${basename(job.file)}：来源已在图谱中`);
      continue;
    }
    const v = validateExtraction(job.extraction, graph);
    if (!v.ok) {
      console.error(`${job.file} 抽取不合法：${v.error}`);
      process.exit(1);
    }
    const applied = applyExtraction(graph, parsed.doc, v.value, embeddings, []);
    graph = applied.graph;
    changed = true;
    reports.push(
      [
        `文件：${basename(job.file)}`,
        `贡献者：${parsed.doc.name ?? ''} · ${parsed.doc.origin} · ${parsed.doc.profession} · ${parsed.doc.region} · ${parsed.doc.age}（${applied.contributionId}）`,
        `场景：${v.value.scenes.map((s) => s.title).join('；')}`,
        ...applied.notes.map(formatNote),
      ].join('\n'),
    );
  }

  if (changed) saveGraph(graph);
  console.log(reports.join('\n\n'));
  console.log(`\n节点 ${beforeNodes} → ${graph.nodes.length}，贡献 ${beforeContrib} → ${graph.contributions.length}${changed ? '' : '（无写入）'}`);
}

main();
