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

  // 中文优先，表里查不到时用接口返回的原始英文名
  const country = info.countryCn || info.country || '';
  const province = info.provinceCn || '';
  const city = info.cityCn || info.city || '';

  const placeParts: string[] = [];
  if (country) placeParts.push(country);
  if (province && province !== country && province !== city)
    placeParts.push(province);
  if (city && city !== country && city !== province) placeParts.push(city);
  const place = placeParts.join(' ');

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
