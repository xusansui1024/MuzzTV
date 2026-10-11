import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { SearchResult } from '@/lib/types';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

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

  // 手动收集各源结果：单源失败不影响整体；12 秒后返回已收集结果，
  // 避免个别慢源把整个 edge 函数拖到超时（冷缓存搜索会因此整体失败）
  const results: SearchResult[][] = [];
  let timeoutReached = false;
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      timeoutReached = true;
      resolve();
    }, 12000);
  });

  await Promise.all([
    ...apiSites.map((site, i) =>
      searchFromApi(site, query)
        .then((r) => {
          results[i] = r;
        })
        .catch(() => {
          results[i] = [];
        })
    ),
    timeoutPromise,
  ]);

  const flattenedResults = results.flat();
  const cacheTime = await getCacheTime();
  // 空结果只短缓存（1 分钟）：源接口偶发集体超时会返回空结果，
  // 若按正常时长缓存会使用户数小时内反复搜到空结果
  const effectiveCache =
    flattenedResults.length === 0 || timeoutReached ? 60 : cacheTime;

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
}
