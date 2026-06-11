import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { DoubanItem, DoubanResult } from '@/lib/types';

interface DoubanApiResponse {
  subjects: Array<{
    id: string;
    title: string;
    cover: string;
    rate: string;
  }>;
}

async function fetchDoubanData(url: string): Promise<DoubanApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const fetchOptions = {
    signal: controller.signal,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Referer: 'https://movie.douban.com/',
      Accept: 'application/json, text/plain, */*',
    },
  };

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get('type');
  const tag = searchParams.get('tag');
  const pageSize = parseInt(searchParams.get('pageSize') || '16');
  const pageStart = parseInt(searchParams.get('pageStart') || '0');

  if (!type || !tag) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  if (tag === 'top250') {
    return handleTop250(pageStart);
  }

  // --- 核心修改：标签翻译逻辑 ---
  let finalTag = tag;
  if (type === 'tv' && tag === '泰国') {
    finalTag = '泰剧';
  } else if (type === 'tv' && tag === '美国') {
    finalTag = '美剧';
  } else if (type === 'tv' && tag === '日本') {
    finalTag = '日剧';
  }
  // --------------------------

  const target = `https://movie.douban.com/j/search_subjects?type=${type}&tag=${encodeURIComponent(finalTag)}&sort=recommend&page_limit=${pageSize}&page_start=${pageStart}`;

  try {
    const doubanData = await fetchDoubanData(target);

    const list: DoubanItem[] = doubanData.subjects.map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.cover,
      rate: item.rate,
      year: '',
    }));

    const response: DoubanResult = {
      code: 200,
      message: '获取成功',
      list: list,
    };

    const cacheTime = await getCacheTime();
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取豆瓣数据失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function handleTop250(pageStart: number) {
  const target = `https://movie.douban.com/top250?start=${pageStart}&filter=`;
  // ... (handleTop250 其余代码保持不变)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  return fetch(target, { signal: controller.signal })
    .then(async (res) => {
      clearTimeout(timeoutId);
      const html = await res.text();
      const moviePattern = /<div class="item">[\s\S]*?<a[^>]+href="https?:\/\/movie\.douban\.com\/subject\/(\d+)\/"[\s\S]*?<img[^>]+alt="([^"]+)"[^>]*src="([^"]+)"[\s\S]*?<span class="rating_num"[^>]*>([^<]*)<\/span>[\s\S]*?<\/div>/g;
      const movies: DoubanItem[] = [];
      let match;
      while ((match = moviePattern.exec(html)) !== null) {
        movies.push({ id: match[1], title: match[2], poster: match[3].replace(/^http:/, 'https:'), rate: match[4], year: '' });
      }
      return NextResponse.json({ code: 200, message: '获取成功', list: movies });
    })
    .catch(() => NextResponse.json({ error: 'Failed' }, { status: 500 }));
}
