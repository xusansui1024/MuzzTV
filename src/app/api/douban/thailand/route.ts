import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { isBlockedContent } from '@/lib/contentFilter';
import { normalizeTitle } from '@/lib/normalizeTitle';
import { DoubanItem, DoubanResult } from '@/lib/types';

import thaiRates from '@/data/thai-rates.json';

export const runtime = 'edge';

interface ApiSiteItem {
  key: string;
  api: string;
  name: string;
}

interface ResourceItem {
  title: string;
  poster: string;
  year: string;
}

interface RateSnapshot {
  items: Array<{ title: string; rate: string }>;
}

// 豆瓣评分快照：豆瓣只对国内 IP 开放，Vercel 边缘节点直连会被挡，
// 所以评分由脚本在本地跑好后写进 src/data/thai-rates.json，随代码一起部署
const RATE_MAP = new Map(
  ((thaiRates as RateSnapshot).items || []).map((v) => [v.title, v.rate])
);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const LIST_TIMEOUT_MS = 8000;
const PAGE_TIMEOUT_MS = 10000;
// 分类树半年都不会变，内存里存 6 小时够用，省掉每次请求的 ac=list
const CLASS_TTL_MS = 6 * 60 * 60 * 1000;
// 多个源每源取两页，合并后大约 130–200 部，足够铺满首屏
const PAGES_PER_SITE = 2;

// 体育赛事、旅游节目常带"泰国"字样，分类列表里一般不会出现，
// 这里仍留一层兜底，防止个别源把直播间塞进剧集分类
const NOISE_PATTERN =
  /VS|vs|足球|篮球|比赛|锦标赛|亚洲杯|亚冠|AFC|NBA|预选赛|世界杯|女足|男足|亚运会|邀请赛|积分榜|直播|回放|录像/;

const classCache = new Map<string, { ids: number[]; at: number }>();

async function fetchJson(url: string, ms: number) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      class?: Array<{ type_id?: number; type_name?: string }>;
      list?: Array<Record<string, unknown>>;
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 找到该源分类树里的泰剧分类 id（泰国剧 / 泰剧 / 马泰剧…） */
async function getThaiTypeIds(site: ApiSiteItem): Promise<number[]> {
  const cached = classCache.get(site.api);
  if (cached && Date.now() - cached.at < CLASS_TTL_MS) return cached.ids;

  const data = await fetchJson(
    `${site.api.replace(/\/$/, '')}?ac=list`,
    LIST_TIMEOUT_MS
  );
  const classes = data?.class || [];
  const thaiClasses = classes.filter((c) =>
    /泰/.test(String(c.type_name || ''))
  );
  // 优先"泰国剧/泰剧"，"马泰剧"这种混合分类放最后
  const ordered = thaiClasses.sort((a, b) => {
    const score = (n: string) => (/泰国剧|泰剧/.test(n) ? 0 : 1);
    return score(String(a.type_name || '')) - score(String(b.type_name || ''));
  });
  const ids = ordered
    .map((c) => Number(c.type_id))
    .filter((id) => Number.isFinite(id));
  classCache.set(site.api, { ids, at: Date.now() });
  return ids;
}

/** 拉取某个泰剧分类的一页，只取标题/封面/年份 */
async function fetchThaiPage(
  site: ApiSiteItem,
  typeId: number,
  page: number
): Promise<ResourceItem[]> {
  const data = await fetchJson(
    `${site.api.replace(/\/$/, '')}?ac=detail&t=${typeId}&pg=${page}`,
    PAGE_TIMEOUT_MS
  );
  const list = data?.list || [];
  return list
    .map((v) => ({
      title: String(v.vod_name || '').trim(),
      poster: String(v.vod_pic || '').trim(),
      year: String(v.vod_year || '').trim(),
    }))
    .filter((v) => v.title);
}

export async function GET(): Promise<NextResponse> {
  const sites = await getAvailableApiSites();

  // 每个源：先查分类树拿泰剧 id，再并行拉前两页。
  // 分类树查不到的源直接跳过（个别源不开放 ac=list）。
  const perSite = await Promise.allSettled(
    sites.map(async (site) => {
      const ids = await getThaiTypeIds(site);
      if (!ids.length) return [] as ResourceItem[];
      const pages = await Promise.all(
        Array.from({ length: PAGES_PER_SITE }, (_, i) =>
          fetchThaiPage(site, ids[0], i + 1)
        )
      );
      return pages.flat();
    })
  );

  const merged = new Map<string, ResourceItem>();
  perSite.forEach((r) => {
    if (r.status !== 'fulfilled') return;
    r.value.forEach((item) => {
      if (isBlockedContent(item.title)) return;
      if (NOISE_PATTERN.test(item.title)) return;
      const key = normalizeTitle(
        item.title
          .replace(/泰剧|泰国剧|泰版|泰国版/g, '')
          .replace(/[（【[(][^）】)\]]*[）】)\]]/g, '')
      );
      if (!key) return;
      const prev = merged.get(key);
      if (!prev) merged.set(key, item);
      // 有的源没写年份，用别家同名的补上
      else if (!prev.year && item.year) prev.year = item.year;
      // 封面缺失时也用别家的补
      else if (!prev.poster && item.poster) prev.poster = item.poster;
    });
  });

  const list: DoubanItem[] = Array.from(merged.values())
    .sort((a, b) => {
      const ya = Number(String(a.year).slice(0, 4)) || 0;
      const yb = Number(String(b.year).slice(0, 4)) || 0;
      return yb - ya;
    })
    .slice(0, 240)
    .map((item) => ({
      id: normalizeTitle(item.title),
      title: item.title,
      poster: item.poster,
      year: item.year,
      rate: RATE_MAP.get(item.title) || '',
    }));

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
      // 浏览器端不缓存（只做 0 秒直用+回源校验），避免用户长期看到旧列表；
      // CDN 端仍按站点配置缓存，保证冷启动不会被反复打爆
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control': `public, s-maxage=${effectiveCache}`,
      'Vercel-CDN-Cache-Control': `public, s-maxage=${effectiveCache}`,
    },
  });
}
