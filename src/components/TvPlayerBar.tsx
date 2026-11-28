'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 电视端播放页底部信息条（极简版）。
 * - 只留一个「选集/换源」按钮；播放/暂停交给遥控器 OK 键（见 TvNavigation）。
 * - 音量交给电视遥控器本身。
 * - 快退/快进由方向键左/右触发（±15 秒），屏幕中央会出现提示（TvSeekHud）。
 * - 播放中 3 秒无操作自动淡出，让画面完整全屏；任意按键/暂停/选集抽屉打开时重新出现。
 */

interface Props {
  panelOpen: boolean;
  onTogglePanel: () => void;
}

const IDLE_MS = 3000;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const fmt = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const videoOf = () =>
  document.querySelector<HTMLVideoElement>('.art-video-player video');

export default function TvPlayerBar({ panelOpen, onTogglePanel }: Props) {
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<number | null>(null);

  // 重新显示底栏，并在"正在播放"时 3 秒后自动隐藏
  const wake = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      const v = videoOf();
      if (!v || v.paused) return;
      const focused = document.activeElement as HTMLElement | null;
      // 抽屉开着或焦点正停在底栏按钮上时，不要藏起来
      if (document.querySelector('.tv-panel.tv-open')) return;
      if (focused?.closest('.tv-player-bar')) return;
      setIdle(true);
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const v = videoOf();
      if (!v) return;
      setCurrent(v.currentTime || 0);
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
      // 暂停时底栏常显，方便直接看到进度和选集入口
      if (v.paused) setIdle(false);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 左右键只是快进/快退（中央提示），不用把底栏叫出来
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
      wake();
    };
    const onFocus = (e: FocusEvent) => {
      // 焦点挪到底栏按钮上才需要露出来；回到舞台就继续藏
      const t = e.target as HTMLElement | null;
      if (t?.closest('.tv-player-bar')) wake();
    };
    const onTouch = () => wake();
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus, true);
    window.addEventListener('pointerdown', onTouch, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus, true);
      window.removeEventListener('pointerdown', onTouch, true);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [wake]);

  useEffect(() => {
    if (panelOpen) wake();
  }, [panelOpen, wake]);

  useEffect(() => {
    wake();
  }, [wake]);

  const percent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div
      className={`tv-overlay tv-player-bar${
        idle && !panelOpen ? ' tv-bar-idle' : ''
      }`}
    >
      <div className='tv-progress'>
        <div className='tv-progress-fill' style={{ width: `${percent}%` }} />
      </div>

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
        <svg className='w-6 h-6' viewBox='0 0 24 24' fill='currentColor'>
          <path d='M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z' />
        </svg>
        <span>{panelOpen ? '收起列表' : '选集/换源'}</span>
      </button>
    </div>
  );
}
