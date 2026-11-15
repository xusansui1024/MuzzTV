/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 💡 打印访客真实 IP + 归属地 + 处理的机房
  // x-forwarded-for 第一段是真实客户端 IP；x-vercel-ip-* 是 Vercel 解析出的归属地
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0].trim() || request.ip || '未知 IP';

  // Vercel 自动注入的国家代码（CN=中国大陆, TW=台湾, HK=香港, US=美国...）
  const country = request.headers.get('x-vercel-ip-country') || '';
  const city = safeDecode(request.headers.get('x-vercel-ip-city'));
  // x-vercel-id 形如 hkg1::sin1::xxxx，第一段是边缘机房（hkg1=香港）
  const edge = (request.headers.get('x-vercel-id') || '').split('::')[0] || '-';

  console.log(
    `[实时监控] ${pathname} | 访客 ${ip} | ${country || '??'}${
      city ? ' ' + city : ''
    } | 机房 ${edge}`
  );

  // 给 next() 响应附加国家 cookie（供前端判断是否大陆用户，如换源优先级）
  const withCountryCookie = (response: NextResponse): NextResponse => {
    if (country) {
      response.cookies.set('x-country', country, {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  };

  // 💡 新增/修改：把 proxy / douban / search 相关的接口全部加入白名单
  // search 为公开聚合搜索（多源站聚合结果，无用户私有数据），无需登录即可搜索
  if (
    pathname.startsWith('/api/proxy') ||
    pathname.startsWith('/api/douban') ||
    pathname.startsWith('/api/search') ||
    pathname.startsWith('/api/myip')
  ) {
    return withCountryCookie(NextResponse.next());
  }

  // 跳过不需要认证的路径
  if (shouldSkipAuth(pathname)) {
    return withCountryCookie(NextResponse.next());
  }

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  if (!process.env.PASSWORD) {
    // 如果没有设置密码，重定向到警告页面
    const warningUrl = new URL('/warning', request.url);
    return NextResponse.redirect(warningUrl);
  }

  // 从cookie获取认证信息
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo) {
    return handleAuthFailure(request, pathname);
  }

  // localstorage模式：在middleware中完成验证
  if (storageType === 'localstorage') {
    if (!authInfo.password || authInfo.password !== process.env.PASSWORD) {
      return handleAuthFailure(request, pathname);
    }
    return withCountryCookie(NextResponse.next());
  }

  // 其他模式：只验证签名
  // 检查是否有用户名（非localStorage模式下密码不存储在cookie中）
  if (!authInfo.username || !authInfo.signature) {
    return handleAuthFailure(request, pathname);
  }

  // 验证签名（如果存在）
  if (authInfo.signature) {
    const isValidSignature = await verifySignature(
      authInfo.username,
      authInfo.signature,
      process.env.PASSWORD || ''
    );

    // 签名验证通过即可
    if (isValidSignature) {
      return withCountryCookie(NextResponse.next());
    }
  }

  // 签名验证失败或不存在签名
  return handleAuthFailure(request, pathname);
}

// 安全解码（Vercel 的归属地头是 URL 编码，损坏时不能抛错）
function safeDecode(value: string | null): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// 验证签名
async function verifySignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  try {
    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // 将十六进制字符串转换为Uint8Array
    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    // 验证签名
    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      messageData
    );
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
}

// 处理认证失败的情况
function handleAuthFailure(
  request: NextRequest,
  pathname: string
): NextResponse {
  // 如果是 API 路由，返回 401 状态码
  if (pathname.startsWith('/api')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 否则重定向到登录页面
  const loginUrl = new URL('/login', request.url);
  // 保留完整的URL，包括查询参数
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', fullUrl);
  return NextResponse.redirect(loginUrl);
}

// 判断是否需要跳过认证的路径
function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/favicon-v2.ico',
    '/apple-touch-icon',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/logo.png',
    '/screenshot.png',
    '/.well-known/',
  ];

  return skipPaths.some((path) => pathname.startsWith(path));
}

// 配置middleware匹配规则
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon-v2.ico|apple-touch-icon|login|warning|api/login|api/register|api/logout|api/cron|api/server-config).*)',
  ],
};
