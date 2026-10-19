/**
 * 基础脱敏（在 mock 与 LLM 两条路径上都会先在本地执行，保证敏感信息不出浏览器）。
 * 仅为启发式规则，不能替代人工与后端审核。
 */
export interface AnonymizeResult {
  text: string;
  warnings: string[];
  replaced: { kind: string; count: number }[];
}

const RULES: { kind: string; re: RegExp; mask: string }[] = [
  { kind: '邮箱', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, mask: '[邮箱已隐藏]' },
  // 身份证号：18 位（末位可为 X）或 15 位
  { kind: '身份证号', re: /(?<!\d)(\d{17}[\dXx]|\d{15})(?!\d)/g, mask: '[证件号已隐藏]' },
  // 银行卡等 16–19 位长数字
  { kind: '银行卡号', re: /(?<!\d)\d{16,19}(?!\d)/g, mask: '[卡号已隐藏]' },
  // 手机号（可带 +86 / 空格 / 短横线）
  { kind: '手机号', re: /(?:\+?86[-\s]?)?(?<!\d)1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)/g, mask: '[手机号已隐藏]' },
  // 座机
  { kind: '座机号', re: /(?<!\d)0\d{2,3}-\d{7,8}(?!\d)/g, mask: '[电话已隐藏]' },
  // 微信号 / QQ
  { kind: '微信/QQ', re: /(微信号?|vx|VX|wx|QQ|qq)[:：\s]*[A-Za-z0-9_-]{5,20}/g, mask: '$1[已隐藏]' },
];

const SURNAMES =
  '王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤';
const TITLES = '老师|经理|总|医生|主任|校长|同学|师傅|阿姨|叔叔|哥|姐|老板|护士长|站长|组长';
const NAME_RES: RegExp[] = [
  /(?:我叫|名叫|叫做|我的名字是)([\u4e00-\u9fa5]{2,3})/g,
  new RegExp(`([${SURNAMES}][\\u4e00-\\u9fa5]{1,2})(?=(?:${TITLES}))`, 'g'),
  new RegExp(`(?:同事|朋友|室友|老乡|领导|表哥|表姐)([${SURNAMES}][\\u4e00-\\u9fa5]{1,2})(?=[说告诉问让把和跟])`, 'g'),
];

/** 常见词误报白名单 */
const NAME_WHITELIST = new Set(['高老师', '王总', '李总', '张总']);

export function anonymize(input: string): AnonymizeResult {
  let text = input;
  const replaced: { kind: string; count: number }[] = [];
  for (const r of RULES) {
    let count = 0;
    text = text.replace(r.re, (...m) => {
      count++;
      return r.mask.replace('$1', String(m[1] ?? ''));
    });
    if (count) replaced.push({ kind: r.kind, count });
  }
  const warnings: string[] = [];
  if (replaced.length) warnings.push(`已自动隐藏：${replaced.map((r) => `${r.kind} ×${r.count}`).join('、')}`);
  const names = new Set<string>();
  for (const re of NAME_RES) for (const m of text.matchAll(re)) if (!NAME_WHITELIST.has(m[1])) names.add(m[1]);
  if (names.size) warnings.push(`可能包含真实姓名：${[...names].join('、')}——建议改成“某同事 / 一位老师”等称呼`);
  if (/(小区|街道|路\d+号|号楼|单元\d+)/.test(text)) warnings.push('可能包含具体住址，建议只保留到城市');
  if (/(公司|医院|学校)名?叫/.test(text)) warnings.push('可能包含具体机构名称，建议模糊处理');
  return { text, warnings, replaced };
}
