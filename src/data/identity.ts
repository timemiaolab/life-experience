import type { Filter, IdentityDim } from '../types';

export interface DimDef {
  key: IdentityDim;
  name: string;
  en: string;
  options: string[];
  /** 是否允许投稿时自定义 */
  custom?: boolean;
}

/** 来源未写明该维度时使用；筛选行里排在最后。 */
export const UNSTATED = '未注明';

export const DIMS: DimDef[] = [
  { key: 'origin', name: '出身', en: 'ORIGIN', options: ['农村', '大山', '县城', '三线城市', '二线城市', '一线城市', UNSTATED] },
  {
    key: 'profession',
    name: '职业',
    en: 'JOB',
    options: ['程序员', '教师', '护士', '医生', '创业者', '外卖骑手', '学生', '工厂工人', '销售', UNSTATED],
    custom: true,
  },
  { key: 'region', name: '地区', en: 'REGION', options: ['华北', '华东', '华南', '华中', '西南', '西北', '东北', UNSTATED] },
  { key: 'age', name: '年龄段', en: 'AGE', options: ['00后', '95后', '90后', '85后', '80后', '70后', UNSTATED] },
];

/** 出身配色（用于身份分布条） */
export const ORIGIN_COLORS: Record<string, string> = {
  农村: '#39ff9c',
  大山: '#00c2a8',
  县城: '#fcee0a',
  三线城市: '#ff9f1c',
  二线城市: '#ff2bd6',
  一线城市: '#b98cff',
  [UNSTATED]: '#8a93a6',
};

/** 身份行展示用：未注明写成「出身未注明」等；筛选项仍用 UNSTATED。 */
export const UNSTATED_LABEL: Record<IdentityDim, string> = {
  origin: '出身未注明',
  profession: '职业未注明',
  region: '地区未注明',
  age: '年龄未注明',
};

export function displayIdentityValue(dim: IdentityDim, value: string): string {
  return value === UNSTATED ? UNSTATED_LABEL[dim] : value;
}

export const originLabel = (o: string) => (o === UNSTATED ? UNSTATED_LABEL.origin : `${o}出身`);

/** UI 默认展示的维度行数；超出的用「更多筛选」展开。改 DIMS 即可加维度。 */
export const FILTER_VISIBLE_ROWS = 4;

export function emptyFilter(): Filter {
  return Object.fromEntries(DIMS.map((d) => [d.key, [] as string[]])) as Filter;
}
