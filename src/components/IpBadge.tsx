/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';

interface IpInfo {
  ip: string;
  country: string;
  city: string;
  region: string;
  edge: string;
  countryCn?: string;
  provinceCn?: string;
  cityCn?: string;
  place?: string;
}

const IpBadge = () => {
  const [info, setInfo] = useState<IpInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/myip', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: IpInfo | null) => {
        if (alive && data) setInfo(data);
      })
      .catch(() => {
        /* 拿不到归属地就静默不显示 */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!info || !info.ip) return null;

  // 后端已经拼好中文归属地，直接用；拿不到时做一次本地兜底
  let place = info.place || '';
  if (!place) {
    const country = info.countryCn || info.country || '';
    const province = info.provinceCn || '';
    const city = info.cityCn || info.city || '';
    const parts: string[] = [];
    if (country) parts.push(country);
    if (province && city && province === city) {
      parts.push(province);
    } else {
      if (province && province !== country) parts.push(province);
      if (city && city !== country) parts.push(city);
    }
    place = parts.join(' ');
  }

  return (
    <div className='mt-8 mb-2 flex justify-center'>
      <span className='text-[11px] text-gray-400 dark:text-gray-500 select-all'>
        你的 IP：{info.ip}
        {place ? ` · ${place}` : ''}
      </span>
    </div>
  );
};

export default IpBadge;
