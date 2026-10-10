import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
  }

  const apiSites = await getAvailableApiSites();
  const searchPromises = apiSites.map((site) => searchFromApi(site, query));

  try {
    const results = await Promise.all(searchPromises);
    const flattenedResults = results.flat();
    const cacheTime = await getCacheTime();
    // 空结果只短缓存（1 分钟）：源接口偶发集体超时会返回空结果，
    // 若按正常时长缓存会使用户数小时内反复搜到空结果
    const effectiveCache = flattenedResults.length === 0 ? 60 : cacheTime;

    return NextResponse.json(
      { results: flattenedResults },
      {
        headers: {
          'Cache-Control': `public, max-age=${effectiveCache}, s-maxage=${effectiveCache}`,
          'CDN-Cache-Control': `public, s-maxage=${effectiveCache}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${effectiveCache}`,
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
