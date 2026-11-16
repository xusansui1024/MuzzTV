import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('u') || '';
  if (!target) {
    return new NextResponse('missing u', { status: 400 });
  }

  // 只允许 http(s) 链接，避免被拿去做奇怪的事
  let text = target;
  if (!/^https?:\/\//i.test(text)) {
    text = `${request.nextUrl.origin}${
      text.startsWith('/') ? text : '/' + text
    }`;
  }

  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      width: 200,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#ffffff' },
    });

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('qr failed', { status: 500 });
  }
}
