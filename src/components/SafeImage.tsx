import React, { useState } from 'react';
import { getImageProxyUrl } from '@/lib/utils';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, ...props }) => {
  // 降级等级：0 = 自定义/主力代理, 1 = 备用公共CDN(wsrv.nl), 2 = 原始直连
  const [retryLevel, setRetryLevel] = useState<number>(0);

  if (!src) return <img alt={alt || ''} {...props} />;

  // 根据当前重试等级计算实际请求的 URL
  let currentSrc = src;
  const customProxy = getImageProxyUrl();

  if (retryLevel === 0) {
    // 级别 0：尝试你的主力代理
    currentSrc = customProxy ? `${customProxy}${encodeURIComponent(src)}` : src;
  } else if (retryLevel === 1) {
    // 级别 1：主力代理失效，自动降级切到公共 CDN 兜底
    currentSrc = `https://wsrv.nl/?url=${encodeURIComponent(src)}`;
  } else {
    // 级别 2：全部代理失效，尝试直接请求豆瓣原图
    currentSrc = src;
  }

  // 核心容灾逻辑：图片加载报错时，自动提升重试等级
  const handleError = () => {
    if (retryLevel < 2) {
      setRetryLevel(prev => prev + 1);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt || ''}
      onError={handleError}
      {...props}
    />
  );
};
