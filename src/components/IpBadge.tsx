/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';

interface IpInfo {
  ip: string;
  country: string;
  city: string;
  region: string;
  edge: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  TW: '台湾',
  CN: '中国大陆',
  HK: '香港',
  MO: '澳门',
  JP: '日本',
  KR: '韩国',
  SG: '新加坡',
  MY: '马来西亚',
  TH: '泰国',
  VN: '越南',
  PH: '菲律宾',
  ID: '印尼',
  IN: '印度',
  AU: '澳大利亚',
  NZ: '新西兰',
  US: '美国',
  CA: '加拿大',
  MX: '墨西哥',
  BR: '巴西',
  GB: '英国',
  DE: '德国',
  FR: '法国',
  NL: '荷兰',
  ES: '西班牙',
  IT: '意大利',
  CH: '瑞士',
  SE: '瑞典',
  RU: '俄罗斯',
  AE: '阿联酋',
  TR: '土耳其',
};

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

  const countryName =
    (info.country && COUNTRY_NAMES[info.country.toUpperCase()]) || info.country;
  const place = [countryName, info.city].filter(Boolean).join(' ');

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
