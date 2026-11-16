/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import Hls from 'hls.js';

/**
 * 获取图片代理 URL 设置 - 绝对优先版
 */
export function getImageProxyUrl(): string {
  const envProxy = process.env.NEXT_PUBLIC_IMAGE_PROXY;
  if (envProxy && envProxy.trim().startsWith('http')) {
    return envProxy.trim();
  }

  if (typeof window !== 'undefined') {
    const enableImageProxy = localStorage.getItem('enableImageProxy');
    if (enableImageProxy !== null && !JSON.parse(enableImageProxy)) {
      return '';
    }

    const localImageProxy = localStorage.getItem('imageProxyUrl');
    if (localImageProxy && localImageProxy.trim().startsWith('http')) {
      return localImageProxy.trim();
    }
  }

  // 无任何代理配置时直接请求原始图（wsrv.nl 已取不到豆瓣图片，不再作为默认代理）
  return '';
}

/**
 * 处理图片 URL
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;
  const proxyUrl = getImageProxyUrl();
  if (!proxyUrl) return originalUrl;
  return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
}

/**
 * 获取豆瓣代理 URL 设置
 */
export function getDoubanProxyUrl(): string | null {
  const envDoubanProxy = process.env.NEXT_PUBLIC_DOUBAN_PROXY;
  if (envDoubanProxy && envDoubanProxy.trim().startsWith('http')) {
    return envDoubanProxy.trim();
  }

  if (typeof window !== 'undefined') {
    const enableDoubanProxy = localStorage.getItem('enableDoubanProxy');
    if (enableDoubanProxy !== null && !JSON.parse(enableDoubanProxy)) {
      return null;
    }
    const localDoubanProxy = localStorage.getItem('doubanProxyUrl');
    if (localDoubanProxy && localDoubanProxy.trim().startsWith('http')) {
      return localDoubanProxy.trim();
    }
  }
  return null;
}

/**
 * 处理豆瓣 URL
 */
export function processDoubanUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;
  const proxyUrl = getDoubanProxyUrl();
  if (!proxyUrl) return originalUrl;
  return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
}

export function cleanHtmlTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^\n+|\n+$/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * 从播放列表文本推断画质（仅当 hls 解不出尺寸时兜底）
 * 采集站的 RESOLUTION 字段普遍乱写，改用 BANDWIDTH 与子列表路径命名判断
 */
function inferQualityFromText(text: string, m3u8Url: string): string {
  let bw = 0;
  const re = /BANDWIDTH=(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const v = Number(m[1]);
    if (v > 100000 && v > bw) bw = v;
  }
  // 子列表路径常常直接标了档位，例如 2000k_1080 / 1000k_720
  const sub =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#')) || '';
  const hint = `${sub} ${m3u8Url}`.toLowerCase();

  if (/_2160|2160p|_4k|uhd/.test(hint)) return '4K';
  if (/_1440|1440p|_2k/.test(hint)) return '2K';

  if (bw >= 2500000) return '2K';
  if (bw >= 1400000) return '1080p';
  if (bw >= 700000) return '720p';
  if (bw >= 350000) return '480p';
  if (bw >= 100000) return 'SD';

  // BANDWIDTH 明显是占位值（如 128）时，只看路径命名
  if (/_1080|1080p|3000k|2500k|2000k|4000k/.test(hint)) return '1080p';
  if (/_720|720p|1500k|1200k|1000k|800k/.test(hint)) return '720p';
  if (/_480|480p|500k/.test(hint)) return '480p';
  return '未知';
}

/**
 * 按解码尺寸换算画质：取长边判断，兼容竖屏片源（如 720x1280）
 */
function qualityFromSize(width: number, height: number): string {
  const big = Math.max(width, height);
  if (big >= 3840) return '4K';
  if (big >= 2560) return '2K';
  if (big >= 1920) return '1080p';
  if (big >= 1280) return '720p';
  if (big >= 854) return '480p';
  return 'SD';
}

export async function getVideoResolutionFromM3u8(m3u8Url: string): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
}> {
  const pingStart = performance.now();
  let pingTime = 0;

  // ① 先取播放列表文本，既算 ping 也用于画质兜底（hls 常常解不出 width）
  let playlistQuality = '未知';
  // 取播放列表必须带硬超时：无超时的 fetch 会永久挂起，把整个优选流程卡死
  const playlistAbort = new AbortController();
  const playlistTimer = setTimeout(() => playlistAbort.abort(), 3000);
  try {
    const res = await fetch(m3u8Url, {
      cache: 'no-store',
      signal: playlistAbort.signal,
    });
    pingTime = Math.round(performance.now() - pingStart);
    if (res.ok) {
      const text = await res.text();
      playlistQuality = inferQualityFromText(text, m3u8Url);
    }
  } catch {
    pingTime = Math.round(performance.now() - pingStart);
  } finally {
    clearTimeout(playlistTimer);
  }

  // ② hls.js 实测速度与真实解码尺寸
  const inner = new Promise<{
    quality: string;
    loadSpeed: string;
    pingTime: number;
  }>((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.playsInline = true;
    video.style.cssText =
      'position:fixed;left:-10px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(video);

    const hls = new Hls();
    let done = false;
    const cleanup = () => {
      try {
        hls.destroy();
      } catch {
        /* ignore */
      }
      video.remove();
    };
    const finish = (quality: string, speed: string) => {
      if (done) return;
      done = true;
      cleanup();
      resolve({ quality, loadSpeed: speed, pingTime });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      // 超时了但播放列表给过画质，仍然返回，避免列表出现大片空白
      if (playlistQuality !== '未知') {
        finish(playlistQuality, '未知');
      } else {
        done = true;
        cleanup();
        reject(new Error('Timeout loading video metadata'));
      }
    }, 5000);

    let actualLoadSpeed = '未知';
    let hasSpeed = false;
    let hasMeta = false;
    let fragmentStartTime = 0;

    const tryFinish = () => {
      if (!hasMeta) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      const bySize = w > 0 ? qualityFromSize(w, h) : '未知';
      // 尺寸实测优先；解不出来时用播放列表命名兜底
      const quality = bySize !== '未知' ? bySize : playlistQuality;
      if (quality !== '未知') {
        clearTimeout(timeout);
        finish(quality, actualLoadSpeed);
      } else if (hasSpeed && actualLoadSpeed !== '未知') {
        clearTimeout(timeout);
        finish('未知', actualLoadSpeed);
      }
    };

    video.onerror = () => {
      if (done) return;
      clearTimeout(timeout);
      if (playlistQuality !== '未知') {
        finish(playlistQuality, actualLoadSpeed);
      } else {
        done = true;
        cleanup();
        reject(new Error('Failed to load video metadata'));
      }
    };

    hls.on(Hls.Events.FRAG_LOADING, () => {
      fragmentStartTime = performance.now();
    });
    hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
      if (done || fragmentStartTime <= 0 || !data?.payload || hasSpeed) return;
      const loadTime = performance.now() - fragmentStartTime;
      const size = data.payload.byteLength || 0;
      if (loadTime > 0 && size > 0) {
        const speedKBps = size / 1024 / (loadTime / 1000);
        actualLoadSpeed =
          speedKBps >= 1024
            ? `${(speedKBps / 1024).toFixed(1)} MB/s`
            : `${speedKBps.toFixed(1)} KB/s`;
        hasSpeed = true;
        tryFinish();
      }
    });
    hls.on(Hls.Events.ERROR, (event: any, data: any) => {
      if (!data?.fatal || done) return;
      clearTimeout(timeout);
      if (playlistQuality !== '未知') {
        finish(playlistQuality, actualLoadSpeed);
      } else {
        done = true;
        cleanup();
        reject(new Error(`HLS播放失败: ${data.type}`));
      }
    });

    video.onloadedmetadata = () => {
      hasMeta = true;
      tryFinish();
      // 只拿到尺寸没拿到速度时，给速度测量留一点时间
      setTimeout(() => {
        if (!done) tryFinish();
      }, 1500);
    };

    hls.loadSource(m3u8Url);
    hls.attachMedia(video);
  });

  // 硬兜底：内部任何环节挂起，都必须在 8 秒内给前端一个结果，
  // 避免‘正在优选最佳播放源’永久转圈
  let guardTimer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<{
    quality: string;
    loadSpeed: string;
    pingTime: number;
  }>((resolve) => {
    guardTimer = setTimeout(
      () => resolve({ quality: playlistQuality, loadSpeed: '未知', pingTime }),
      8000
    );
  });

  return Promise.race([inner, guard]).finally(() => {
    if (guardTimer) clearTimeout(guardTimer);
  });
}
