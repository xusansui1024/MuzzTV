/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import Hls from 'hls.js';

/**
 * 获取图片代理 URL 设置
 */
export function getImageProxyUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. 本地设置优先级最高 (如果用户手动关闭，则禁用)
  const enableImageProxy = localStorage.getItem('enableImageProxy');
  if (enableImageProxy !== null && !JSON.parse(enableImageProxy)) {
    return null;
  }

  const localImageProxy = localStorage.getItem('imageProxyUrl');
  if (localImageProxy && localImageProxy.trim()) {
    return localImageProxy.trim();
  }

  // 2. 增加：优先读取 Vercel 构建时的环境配置 (关键修改)
  const envProxy = process.env.NEXT_PUBLIC_IMAGE_PROXY;
  if (envProxy && envProxy.trim()) return envProxy.trim();

  // 3. 最后：读取运行时配置 (兼容你原有的架构)
  const serverImageProxy = (window as any).RUNTIME_CONFIG?.IMAGE_PROXY;
  
  // 增加默认值：如果以上都没设置，默认使用 wsrv.nl，防止空白
  return serverImageProxy && serverImageProxy.trim()
    ? serverImageProxy.trim()
    : 'https://wsrv.nl/?url=';
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
  if (typeof window === 'undefined') return null;

  const enableDoubanProxy = localStorage.getItem('enableDoubanProxy');
  if (enableDoubanProxy !== null && !JSON.parse(enableDoubanProxy)) {
    return null;
  }

  const localDoubanProxy = localStorage.getItem('doubanProxyUrl');
  if (localDoubanProxy && localDoubanProxy.trim()) {
    return localDoubanProxy.trim();
  }

  // 增加：优先读取 Vercel 环境配置
  const envDoubanProxy = process.env.NEXT_PUBLIC_DOUBAN_PROXY;
  if (envDoubanProxy && envDoubanProxy.trim()) return envDoubanProxy.trim();

  const serverDoubanProxy = (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY;
  return serverDoubanProxy && serverDoubanProxy.trim()
    ? serverDoubanProxy.trim()
    : null;
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
 * 从m3u8地址获取视频质量等级和网络信息
 */
export async function getVideoResolutionFromM3u8(m3u8Url: string): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
}> {
  try {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';

      const pingStart = performance.now();
      let pingTime = 0;

      fetch(m3u8Url, { method: 'HEAD', mode: 'no-cors' })
        .then(() => { pingTime = performance.now() - pingStart; })
        .catch(() => { pingTime = performance.now() - pingStart; });

      const hls = new Hls();
      const timeout = setTimeout(() => {
        hls.destroy(); video.remove();
        reject(new Error('Timeout loading video metadata'));
      }, 4000);

      video.onerror = () => {
        clearTimeout(timeout);
        hls.destroy(); video.remove();
        reject(new Error('Failed to load video metadata'));
      };

      let actualLoadSpeed = '未知';
      let hasSpeedCalculated = false;
      let hasMetadataLoaded = false;
      let fragmentStartTime = 0;

      const checkAndResolve = () => {
        if (hasMetadataLoaded && (hasSpeedCalculated || actualLoadSpeed !== '未知')) {
          clearTimeout(timeout);
          const width = video.videoWidth;
          if (width && width > 0) {
            hls.destroy(); video.remove();
            const quality = width >= 3840 ? '4K' : width >= 2560 ? '2K' : width >= 1920 ? '1080p' : width >= 1280 ? '720p' : width >= 854 ? '480p' : 'SD';
            resolve({ quality, loadSpeed: actualLoadSpeed, pingTime: Math.round(pingTime) });
          } else {
            resolve({ quality: '未知', loadSpeed: actualLoadSpeed, pingTime: Math.round(pingTime) });
          }
        }
      };

      hls.on(Hls.Events.FRAG_LOADING, () => { fragmentStartTime = performance.now(); });
      hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
        if (fragmentStartTime > 0 && data?.payload && !hasSpeedCalculated) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;
          if (loadTime > 0 && size > 0) {
            const speedKBps = size / 1024 / (loadTime / 1000);
            actualLoadSpeed = speedKBps >= 1024 ? `${(speedKBps / 1024).toFixed(1)} MB/s` : `${speedKBps.toFixed(1)} KB/s`;
            hasSpeedCalculated = true;
            checkAndResolve();
          }
        }
      });

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        if (data.fatal) {
          clearTimeout(timeout); hls.destroy(); video.remove();
          reject(new Error(`HLS播放失败: ${data.type}`));
        }
      });
      video.onloadedmetadata = () => { hasMetadataLoaded = true; checkAndResolve(); };
    });
  } catch (error) {
    throw new Error(`Error getting video resolution: ${error instanceof Error ? error.message : String(error)}`);
  }
}
