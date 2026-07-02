/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import Hls from 'hls.js';

/**
 * 获取图片代理 URL 设置 - 彻底重构版
 */
export function getImageProxyUrl(): string {
  // 1. 强制优先读取 Vercel 构建时的环境变量 (最稳定)
  const envProxy = process.env.NEXT_PUBLIC_IMAGE_PROXY;
  if (envProxy && envProxy.trim().startsWith('http')) {
    return envProxy.trim();
  }

  // 2. 如果环境变量没有，才去读 localStorage (允许用户在设置页覆盖)
  if (typeof window !== 'undefined') {
    const enableImageProxy = localStorage.getItem('enableImageProxy');
    if (enableImageProxy !== null && !JSON.parse(enableImageProxy)) {
      return ''; // 如果用户关闭了代理，返回空字符串
    }

    const localImageProxy = localStorage.getItem('imageProxyUrl');
    if (localImageProxy && localImageProxy.trim().startsWith('http')) {
      return localImageProxy.trim();
    }
  }

  // 3. 终极兜底：如果不幸以上都失败，强制返回 wsrv.nl
  return 'https://wsrv.nl/?url=';
}

/**
 * 处理图片 URL
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  const proxyUrl = getImageProxyUrl();
  
  // 如果没有代理，直接返回原始地址
  if (!proxyUrl) return originalUrl;

  // 这里的关键：确保 proxyUrl 后面连接正确
  return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
}

/**
 * 获取豆瓣代理 URL 设置
 */
export function getDoubanProxyUrl(): string | null {
  // 1. 优先读取 Vercel 环境配置
  const envDoubanProxy = process.env.NEXT_PUBLIC_DOUBAN_PROXY;
  if (envDoubanProxy && envDoubanProxy.trim().startsWith('http')) {
    return envDoubanProxy.trim();
  }

  // 2. 本地设置
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

// ... (cleanHtmlTags 和 getVideoResolutionFromM3u8 代码保持不变，不需要动)
