import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

  return NextResponse.json(
    { ip, country, city, region, edge },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
