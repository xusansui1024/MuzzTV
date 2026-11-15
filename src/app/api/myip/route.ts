import { NextRequest, NextResponse } from 'next/server';

import geoZh from '@/lib/geo-zh.json';

export const dynamic = 'force-dynamic';

interface GeoRecord {
  n: string; // 中文地名
  p: string; // 所属省级
  c: string; // 所属地级
  lv: number; // 1=省 2=市 3=区县/乡镇
}

const GEO = geoZh as unknown as Record<string, GeoRecord>;

// 国家代码 -> 中文
const COUNTRY_CN: Record<string, string> = {
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

// 安全解码（Vercel 的城市/地区头是 URL 编码，损坏时不能抛错）
function safeDecode(value: string | null): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// 把英文/拼音地名归一化：去空格、撇号、连字符，转小写
function normalize(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z]/g, '');
}

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip =
    forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || '';

  const country = safeDecode(request.headers.get('x-vercel-ip-country'));
  const city = safeDecode(request.headers.get('x-vercel-ip-city'));
  const region = safeDecode(request.headers.get('x-vercel-ip-country-region'));
  // x-vercel-id 形如 hkg1::sin1::xxxx，第一段是边缘机房
  const edge = (request.headers.get('x-vercel-id') || '').split('::')[0] || '';

  const record = city ? GEO[normalize(city)] : undefined;
  const countryCn = COUNTRY_CN[country.toUpperCase()] || country;
  // 表里查不到就退回原始英文名，不编造
  const cityCn = record?.n || city;
  const provinceCn = record?.p || '';

  return NextResponse.json(
    { ip, country, city, region, edge, countryCn, provinceCn, cityCn },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
