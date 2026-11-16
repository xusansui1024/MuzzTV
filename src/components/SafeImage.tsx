/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';

import { getImageProxyUrl } from '@/lib/utils';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, ...props }) => {
  // 降级等级：0 = 自定义/主力代理, 1 = 豆瓣原图直连
  const [retryLevel, setRetryLevel] = useState<number>(0);

  if (!src) return <img alt={alt || ''} {...props} />;

  // 根据当前重试等级计算实际请求的 URL
  let currentSrc = src;

  if (retryLevel === 0) {
    const customProxy = getImageProxyUrl();
    currentSrc = customProxy ? `${customProxy}${encodeURIComponent(src)}` : src;
  }

  // 核心容灾逻辑：图片加载报错时，自动提升重试等级
  const handleError = () => {
    if (retryLevel < 1) {
      setRetryLevel((prev) => prev + 1);
    }
  };

  return (
    <img src={currentSrc} alt={alt || ''} onError={handleError} {...props} />
  );
};
