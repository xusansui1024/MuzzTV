/**
 * 播放地址归一化：
 * 部分苹果CMS 源的 vod_play_url 给出的是"播放器壳页"地址（如 hd.kuktxu.com/play/xxx），
 * 真实 HLS 流地址是壳页路径 + "/index.m3u8"。此处对非 .m3u8/.mp4 结尾的地址
 * 尝试补全 index.m3u8 并验证响应，成功则返回流地址，失败则保留原地址。
 */

const DIRECT_VIDEO_RE = /\.(m3u8|mp4)(\?|#|$)/i;

export async function normalizeEpisodeUrl(url: string): Promise<string> {
  if (!url || !url.startsWith('http')) return url;
  // 已是直链媒体地址，直接返回
  if (DIRECT_VIDEO_RE.test(url)) return url;

  // 尝试壳页地址 + /index.m3u8
  const candidate = url.replace(/\/+$/, '') + '/index.m3u8';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(candidate, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('mpegurl')) {
      return candidate;
    }
  } catch {
    // 网络异常等一律保留原地址
  }
  return url;
}

/**
 * 从苹果CMS 的 vod_play_url 解析播放地址列表，并对非直链地址做归一化。
 * vod_play_url 格式：第01集$url1#第02集$url2$$$播放源2$url3...
 * mode:
 *  - 'max'  ：返回集数最多的播放源（搜索场景，与原逻辑一致）
 *  - 'first'：返回第一个播放源（详情场景，与原逻辑一致）
 */
export async function parseAndNormalizePlayUrls(
  vodPlayUrl: string,
  mode: 'max' | 'first' = 'max'
): Promise<string[]> {
  const sources = (vodPlayUrl || '').split('$$$');
  const normalizedBySource: string[][] = [];

  for (const source of sources) {
    const urls: string[] = [];
    const episodes = source.split('#');
    for (const ep of episodes) {
      const parts = ep.split('$');
      const url = parts.length > 1 ? parts[1] : '';
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        urls.push(url);
      }
    }
    if (urls.length > 0) {
      // 性能优化：同一播放源的多集地址通常在同一 CDN/壳页，
      // 只对第一个非直链地址做网络验证，其余按相同规则补全，避免几百个串行验证拖垮搜索
      const firstCandidate = urls.find((u) => !DIRECT_VIDEO_RE.test(u));
      let verified = '';
      if (firstCandidate) {
        verified = await normalizeEpisodeUrl(firstCandidate);
      }
      const normalized = urls.map((u) => {
        if (DIRECT_VIDEO_RE.test(u)) return u;
        // 壳页地址：验证成功 → 补全 index.m3u8；失败 → 保留原地址
        if (verified && verified !== firstCandidate) {
          return u.replace(/\/+$/, '') + '/index.m3u8';
        }
        return u;
      });
      normalizedBySource.push(Array.from(new Set(normalized)));
    }
  }

  if (normalizedBySource.length === 0) return [];
  if (mode === 'first') return normalizedBySource[0];
  // max：取集数最多的一组
  return normalizedBySource.reduce((a, b) => (b.length > a.length ? b : a));
}
