'use client';

import { useEffect, useState } from 'react';

/**
 * 电视端播放页底部遥控条（精简版）。
 * - 只保留必要按钮：播放/暂停、合集、返回。
 * - 音量交给电视遥控器本身，不再占按钮。
 * - 快退/快进改由方向键左/右直接触发（±15 秒），不再占按钮。
 * - 按钮都是原生 button，遥控器 OK 触发 React onClick，比 ArtPlayer 自带控制条可靠。
 * - 只在 tv-mode（TvNavigation 打上的 body class）下渲染。
 */

interface Props {
  panelOpen: boolean;
  onTogglePanel: () => void;
  onBack: () => void;
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const fmt = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export default function TvPlayerBar({
  panelOpen,
  onTogglePanel,
  onBack,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const getVideo = () =>
    document.querySelector<HTMLVideoElement>('.art-video-player video');

  useEffect(() => {
    const timer = window.setInterval(() => {
      const v = getVideo();
      if (!v) return;
      setPlaying(!v.paused);
      setCurrent(v.currentTime || 0);
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const toggle = () => {
    const v = getVideo();
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };

  const percent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const iconCls = 'w-6 h-6';

  return (
    <div className='tv-overlay tv-player-bar'>
      {/* 进度条（纯展示，不抢焦点） */}
      <div className='tv-progress'>
        <div className='tv-progress-fill' style={{ width: `${percent}%` }} />
      </div>

      <button
        type='button'
        data-tv-control
        data-tv-autofocus
        className='tv-bar-btn'
        onClick={toggle}
        title={playing ? '暂停' : '播放'}
      >
        {playing ? (
          <svg className={iconCls} viewBox='0 0 24 24' fill='currentColor'>
            <path d='M6 5h4v14H6zM14 5h4v14h-4z' />
          </svg>
        ) : (
          <svg className={iconCls} viewBox='0 0 24 24' fill='currentColor'>
            <path d='M8 5l12 7-12 7z' />
          </svg>
        )}
        <span>{playing ? '暂停' : '播放'}</span>
      </button>

      <span className='tv-bar-time'>
        {fmt(current)} / {fmt(duration)}
      </span>

      <span className='tv-bar-hint'>左右键 快退 / 快进 15 秒</span>

      <div className='flex-1' />

      <button
        type='button'
        data-tv-control
        className='tv-bar-btn'
        onClick={onTogglePanel}
        title='选集与换源'
      >
        <svg className={iconCls} viewBox='0 0 24 24' fill='currentColor'>
          <path d='M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z' />
        </svg>
        <span>{panelOpen ? '收起列表' : '选集/换源'}</span>
      </button>

      <button
        type='button'
        data-tv-control
        className='tv-bar-btn'
        onClick={onBack}
        title='返回'
      >
        <svg className={iconCls} viewBox='0 0 24 24' fill='currentColor'>
          <path d='M10 5L4 12l6 7v-4h10V9H10z' />
        </svg>
        <span>返回</span>
      </button>
    </div>
  );
}
