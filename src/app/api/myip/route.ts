import { NextRequest, NextResponse } from 'next/server';

import { buildPlace, COUNTRY_CN, normalizeCity } from '@/lib/geo-cn';
import geoZh from '@/lib/geo-zh.json';

export const dynamic = 'force-dynamic';

interface GeoRecord {
  n: string; // 中文地名
  p: string; // 所属省级
  c: string; // 所属地级
  lv: number; // 1=省 2=市 3=区县/乡镇
}

const GEO = geoZh as unknown as Record<string, GeoRecord>;

// 安全解码（Vercel 的城市/地区头是 URL 编码，损坏时不能抛错）
function safeDecode(value: string | null): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

  const record = city ? GEO[normalizeCity(city)] : undefined;
  const countryCn = COUNTRY_CN[country.toUpperCase()] || country;
  // 表里查不到就退回原始英文名，不编造
  const cityCn = record?.n || city;
  const provinceCn = record?.p || '';
  const place = buildPlace(countryCn, provinceCn, cityCn);

  return NextResponse.json(
    { ip, country, city, region, edge, countryCn, provinceCn, cityCn, place },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
