import type { IdentityDim } from '../types';

export interface DimDef {
  key: IdentityDim;
  name: string;
  en: string;
  options: string[];
  /** 是否允许投稿时自定义 */
  custom?: boolean;
}

export const DIMS: DimDef[] = [
  { key: 'origin', name: '出身', en: 'ORIGIN', options: ['农村', '大山', '县城', '三线城市', '二线城市', '一线城市'] },
  {
    key: 'profession',
    name: '职业',
    en: 'JOB',
    options: ['程序员', '教师', '护士', '医生', '创业者', '外卖骑手', '学生', '工厂工人', '销售'],
    custom: true,
  },
  { key: 'region', name: '地区', en: 'REGION', options: ['华北', '华东', '华南', '华中', '西南', '西北', '东北'] },
  { key: 'age', name: '年龄段', en: 'AGE', options: ['00后', '95后', '90后', '85后', '80后', '70后'] },
];

/** 出身配色（用于身份分布条） */
export const ORIGIN_COLORS: Record<string, string> = {
  农村: '#39ff9c',
  大山: '#00c2a8',
  县城: '#fcee0a',
  三线城市: '#ff9f1c',
  二线城市: '#ff2bd6',
  一线城市: '#b98cff',
};

export const originLabel = (o: string) => `${o}出身`;
