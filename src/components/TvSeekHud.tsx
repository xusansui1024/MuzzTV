'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 电视端快进/快退提示（模仿芒果 TV / 腾讯视频）。
 * 按一下遥控器左/右，荧幕中间弹出「◀◀ 15 秒」+ 当前时间；
 * 连续按（长按遥控器）会累加成 30/45/60 秒，并在松手 1 秒后淡出。
 */

interface HudState {
  direction: 'back' | 'forward';
  seconds: number;
  time: number;
  duration: number;
  key: number;
}

export default function TvSeekHud() {
  const [hud, setHud] = useState<HudState | null>(null);
  const hideTimer = useRef<number | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onSeek = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as
        | { direction?: 'back' | 'forward'; seconds?: number }
        | undefined;
      if (!detail) return;
      const video = document.querySelector<HTMLVideoElement>(
        '.art-video-player video'
      );
      seq.current += 1;
      setHud({
        direction: detail.direction === 'back' ? 'back' : 'forward',
        seconds: Math.max(1, Math.abs(detail.seconds || 15)),
        time: video?.currentTime || 0,
        duration: video
          ? Number.isFinite(video.duration)
            ? video.duration
            : 0
          : 0,
        key: seq.current,
      });
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setHud(null), 1200);
    };
    window.addEventListener('tv-seek', onSeek);
    return () => {
      window.removeEventListener('tv-seek', onSeek);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (!hud) return null;

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const fmt = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  return (
    <div className='tv-overlay tv-seek-hud' key={hud.key}>
      <div className={`tv-seek-arrows ${hud.direction}`}>
        <span>‹</span>
        <span>‹</span>
        <span>‹</span>
      </div>
      <div className='tv-seek-text'>
        {hud.direction === 'back' ? '快退' : '快进'} {hud.seconds} 秒
      </div>
      <div className='tv-seek-time'>
        {fmt(hud.time)} / {fmt(hud.duration)}
      </div>
    </div>
  );
}
