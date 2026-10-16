/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';

/**
 * 电视模式 + 遥控器导航
 * - 检测 Android TV / Google TV 设备（或 URL 加 ?tv=1 强制开启）
 * - 方向键移动焦点、OK/Enter 确认、返回键回退、播放键控制播放器
 * - 焦点自动高亮并滚动到可视区域
 * 对现有组件零侵入：自动收集页面上的 a / button / input 等可交互元素。
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [data-tv-focusable]';

function detectTV(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).has('tv')) return true;
    const ua = navigator.userAgent;
    return (
      /Android TV|AFTS|GoogleTV|SMART-TV|Tizen|Web0S|webOS/i.test(ua) ||
      /(^|; )TV;/i.test(ua) ||
      /Xbox|PLAYSTATION/i.test(ua)
    );
  } catch {
    return false;
  }
}

type Dir = 'left' | 'right' | 'up' | 'down';

export default function TvNavigation() {
  const currentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const isTV = detectTV();
    if (!isTV) return;
    document.documentElement.classList.add('tv-mode');
    document.body.classList.add('tv-mode');

    const collect = (): HTMLElement[] => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      return els.filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          rect.width > 2 &&
          rect.height > 2 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none'
        );
      });
    };

    const focusEl = (el: HTMLElement) => {
      if (currentRef.current && currentRef.current !== el) {
        currentRef.current.classList.remove('tv-focused');
      }
      currentRef.current = el;
      el.classList.add('tv-focused');
      try {
        el.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'smooth',
        });
      } catch {
        el.scrollIntoView();
      }
    };

    const focusFirst = () => {
      const els = collect();
      if (els.length) focusEl(els[0]);
    };

    const move = (dir: Dir) => {
      const current = currentRef.current;
      const els = collect();
      if (!els.length) return;
      if (!current || !document.body.contains(current)) {
        focusFirst();
        return;
      }
      const curRect = current.getBoundingClientRect();
      const curCX = curRect.left + curRect.width / 2;
      const curCY = curRect.top + curRect.height / 2;
      let best: HTMLElement | null = null;
      let bestScore = Infinity;

      for (const el of els) {
        if (el === current) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = cx - curCX;
        const dy = cy - curCY;

        // 方向约束：只考虑目标方向上的元素（±16px 阈值，容忍卡片行高微差，避免误判）
        if (dir === 'left' && dx > -16) continue;
        if (dir === 'right' && dx < 16) continue;
        if (dir === 'up' && dy > -16) continue;
        if (dir === 'down' && dy < 16) continue;

        // 水平移动：优先垂直中心接近（同行）；垂直移动：优先水平中心接近（同列）
        let score: number;
        if (dir === 'left' || dir === 'right') {
          const overlapY = Math.max(
            0,
            Math.min(curRect.bottom, r.bottom) - Math.max(curRect.top, r.top)
          );
          score = Math.abs(dy) - overlapY * 1.2 + Math.abs(dx) * 0.6;
        } else {
          const overlapX = Math.max(
            0,
            Math.min(curRect.right, r.right) - Math.max(curRect.left, r.left)
          );
          score = Math.abs(dx) - overlapX * 1.2 + Math.abs(dy) * 0.6;
        }
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      if (best) focusEl(best);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        !!target?.isContentEditable;

      switch (e.key) {
        case 'ArrowLeft':
          if (isTyping) return;
          e.preventDefault();
          move('left');
          break;
        case 'ArrowRight':
          if (isTyping) return;
          e.preventDefault();
          move('right');
          break;
        case 'ArrowUp':
          if (isTyping) return;
          e.preventDefault();
          move('up');
          break;
        case 'ArrowDown':
          if (isTyping) return;
          e.preventDefault();
          move('down');
          break;
        case 'Enter':
          if (isTyping) return;
          e.preventDefault();
          if (currentRef.current) currentRef.current.click();
          else focusFirst();
          break;
        case 'Backspace':
          // Android TV 遥控器的返回键
          if (isTyping || e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          if (window.history.length > 1) window.history.back();
          else window.location.href = '/';
          break;
        case 'MediaPlayPause':
        case ' ': {
          if (isTyping || (e.key === ' ' && e.target !== document.body)) return;
          e.preventDefault();
          const video = document.querySelector('video');
          if (video) {
            if (video.paused) void video.play().catch(() => undefined);
            else video.pause();
          } else if (e.key === ' ') {
            // 空格且无视频时，若焦点在按钮上则触发
            if (currentRef.current) currentRef.current.click();
          }
          break;
        }
      }
    };

    // 进入页面/路由变化后聚焦第一个元素
    const timer = window.setTimeout(focusFirst, 500);
    const onRouteChange = () => {
      const t = window.setTimeout(focusFirst, 300);
      window.addEventListener('keydown', onKeyDown, { once: true });
      window.clearTimeout(timer);
      window.setTimeout(() => window.clearTimeout(t), 0);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('popstate', onRouteChange);
    // Next.js App Router 下监听文档可见性变化重新聚焦（页面切换后 DOM 替换）
    const observer = new MutationObserver(() => {
      if (currentRef.current && !document.body.contains(currentRef.current)) {
        focusFirst();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onRouteChange);
      observer.disconnect();
      currentRef.current?.classList.remove('tv-focused');
    };
  }, []);

  return null;
}
