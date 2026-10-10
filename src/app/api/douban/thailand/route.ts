import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { normalizeTitle } from '@/lib/normalizeTitle';
import { DoubanItem, DoubanResult } from '@/lib/types';

export const runtime = 'edge';

// 泰剧关键词：覆盖中文/英文常见搜索词，后端聚合一次返回
const THAI_KEYWORDS = [
  '泰剧',
  '泰国',
  'Thai',
  '禁忌女孩',
  '天生一对',
  '以你的心诠释我的爱',
  '黑帮少爷爱上我',
  '绝庙骗局',
  '泰版',
  'sotus',
  'kinnporsche',
  '我的会长男友',
];

const SEARCH_TIMEOUT_MS = 6000;

interface ApiSiteItem {
  key: string;
  api: string;
  name: string;
  detail?: string;
}

// 轻量搜索：直接请求单个源接口，只取标题/封面/年份（不做播放地址归一化，保证聚合速度）
async function lightSearch(
  site: ApiSiteItem,
  kw: string
): Promise<DoubanItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const base = site.api.replace(/\/$/, '');
    const url = `${base}?ac=videolist&wd=${encodeURIComponent(kw)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      list?: Array<Record<string, unknown>>;
    };
    const list = data.list || [];
    // 标题必须包含搜索词，剔除源接口返回的无关结果
    const nq = normalizeTitle(kw);
    return list
      .filter((v) => {
        const t = String(v.vod_name || '').trim();
        return nq && normalizeTitle(t).includes(nq);
      })
      .map((v) => ({
        id: String(v.vod_id ?? ''),
        title: String(v.vod_name || '').trim(),
        poster: String(v.vod_pic || ''),
        rate: '',
        year: String(v.vod_year || ''),
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(): Promise<NextResponse> {
  const sites = await getAvailableApiSites();

  // 12 个关键词并行，每个关键词内部并行打全部源；单个失败只跳过该词/该源
  const keywordResults = await Promise.all(
    THAI_KEYWORDS.map(async (kw) => {
      const perSite = sites.map((site) => lightSearch(site, kw));
      const settled = await Promise.allSettled(perSite);
      return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    })
  );

  // 合并 + 去重：剥"泰剧"等后缀后按归一化标题去重（同名不同源只保留一个）
  const seen = new Map<string, DoubanItem>();
  keywordResults.flat().forEach((item) => {
    const key = normalizeTitle(
      item.title
        .replace(/泰剧$/, '')
        .replace(/[（【[(][^）】)\]]*[）】)\]]/g, '')
    );
    if (key && !seen.has(key)) seen.set(key, item);
  });

  const list = Array.from(seen.values());
  const cacheTime = await getCacheTime();
  // 空结果只短缓存，避免源接口偶发故障导致长时间空列表
  const effectiveCache = list.length === 0 ? 60 : cacheTime;

  const response: DoubanResult = {
    code: 200,
    message: '获取成功',
    list,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, max-age=${effectiveCache}, s-maxage=${effectiveCache}`,
      'CDN-Cache-Control': `public, s-maxage=${effectiveCache}`,
      'Vercel-CDN-Cache-Control': `public, s-maxage=${effectiveCache}`,
    },
  });
}
