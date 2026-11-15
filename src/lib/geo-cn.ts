// 归属地中文格式化（纯函数，Edge Runtime 与 Node Runtime 都可用）
import geoMin from '@/lib/geo-zh-min.json';

export interface CityRecord {
  n: string; // 中文地名
  p: string; // 所属省级
  c: string; // 所属地级
  lv: number;
}

const CITY_GEO = geoMin as unknown as Record<string, CityRecord>;

// 国家代码 -> 中文
export const COUNTRY_CN: Record<string, string> = {
  CN: '中国大陆',
  TW: '台湾',
  HK: '香港',
  MO: '澳门',
  JP: '日本',
  KR: '韩国',
  SG: '新加坡',
  MY: '马来西亚',
  TH: '泰国',
  VN: '越南',
  PH: '菲律宾',
  ID: '印尼',
  IN: '印度',
  AU: '澳大利亚',
  NZ: '新西兰',
  US: '美国',
  CA: '加拿大',
  MX: '墨西哥',
  BR: '巴西',
  GB: '英国',
  DE: '德国',
  FR: '法国',
  NL: '荷兰',
  ES: '西班牙',
  IT: '意大利',
  CH: '瑞士',
  SE: '瑞典',
  RU: '俄罗斯',
  AE: '阿联酋',
  TR: '土耳其',
};

// 英文/拼音地名归一化：去空格、撇号、连字符，转小写
export function normalizeCity(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * 拼中文归属地。规则：
 *   国家 省 市（省与市同名时只显示一次，例如直辖市）
 *   TW + Toufen   -> 台湾 苗栗縣 頭份市
 *   CN + Shanghai -> 中国大陆 上海市
 *   CN + Shucheng -> 中国大陆 安徽省 舒城县
 *   US + San Jose -> 美国 San Jose
 */
export function buildPlace(
  countryCn: string,
  province: string,
  cityName: string
): string {
  const parts: string[] = [];
  if (countryCn) parts.push(countryCn);

  const prov = province && province !== countryCn ? province : '';
  const city = cityName && cityName !== countryCn ? cityName : '';

  if (prov && city && prov === city) {
    // 省名与市名相同（直辖市、港澳等），只显示一次
    parts.push(prov);
  } else {
    if (prov) parts.push(prov);
    if (city) parts.push(city);
  }
  return parts.join(' ');
}

/** 直接从 Vercel 头里的国家/城市查表并拼中文 */
export function formatPlace(country: string, city: string): string {
  const countryCn = COUNTRY_CN[(country || '').toUpperCase()] || country || '';
  const record = city ? CITY_GEO[normalizeCity(city)] : undefined;
  return buildPlace(countryCn, record?.p || '', record?.n || city || '');
}
