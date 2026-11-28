'use client';

import { useEffect, useState } from 'react';

/**
 * 电视端播放页底部遥控条。
 * - 不依赖 ArtPlayer 自带控制条（那条在电视上只能鼠标用），全部改用原生按钮，
 *   遥控器方向键直接选，OK 键触发 React onClick，天然可靠。
 * - 只在 tv-mode（TvNavigation 打上的 body class）下渲染。
 */

interface Props {
  panelOpen: boolean;
  onTogglePanel: () => void;
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const fmt = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export default function TvPlayerBar({ panelOpen, onTogglePanel }: Props) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const getVideo = () =>
    document.querySelector<HTMLVideoElement>('.art-video-player video');

  useEffect(() => {
    const timer = window.setInterval(() => {
      const v = getVideo();
      if (!v) return;
      setPlaying(!v.paused);
      setCurrent(v.currentTime || 0);
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
      setVolume(v.muted ? 0 : v.volume);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const toggle = () => {
    const v = getVideo();
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };

  const seek = (delta: number) => {
    const v = getVideo();
    if (!v) return;
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    const next = v.currentTime + delta;
    v.currentTime = Math.max(0, dur > 0 ? Math.min(dur - 1, next) : next);
  };

  const changeVolume = (delta: number) => {
    const v = getVideo();
    if (!v) return;
    v.muted = false;
    v.volume = Math.max(0, Math.min(1, v.volume + delta));
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

      <button
        type='button'
        data-tv-control
        className='tv-bar-btn'
        onClick={() => seek(-10)}
        title='快退 10 秒'
      >
        <svg className={iconCls} viewBox='0 0 24 24' fill='currentColor'>
          <path d='M11 6v12L2 12z' />
          <path d='M16 6h2v12h-2z' />
        </svg>
        <span>-10 秒</span>
      </button>

      <button
        type='button'
        data-tv-control
        className='tv-bar-btn'
        onClick={() => seek(10)}
        title='快进 10 秒'
      >
        <svg className={iconCls} viewBox='0 0 24 24' fill='currentColor'>
          <path d='M13 6v12l9-6z' />
          <path d='M6 6h2v12H6z' />
        </svg>
        <span>+10 秒</span>
      </button>

      <button
        type='button'
        data-tv-control
        className='tv-bar-btn'
        onClick={() => changeVolume(-0.1)}
        title='音量减'
      >
        <svg className={iconCls} viewBox='0 0 24 24' fill='currentColor'>
          <path d='M4 9h4l4-4v14l-4-4H4z' />
          <path d='M16 11h6v2h-6z' />
        </svg>
        <span>音量 -</span>
      </button>

      <button
        type='button'
        data-tv-control
        className='tv-bar-btn'
        onClick={() => changeVolume(0.1)}
        title='音量加'
      >
        <svg className={iconCls} viewBox='0 0 24 24' fill='currentColor'>
          <path d='M4 9h4l4-4v14l-4-4H4z' />
          <path d='M14 11h2v-2h2v2h2v2h-2v2h-2v-2h-2z' />
        </svg>
        <span>{`音量 ${Math.round(volume * 100)}`}</span>
      </button>

      <span className='tv-bar-time'>
        {fmt(current)} / {fmt(duration)}
      </span>

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
        onClick={() => {
          if (window.history.length > 1) window.history.back();
          else window.location.href = '/';
        }}
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
