'use client';

import { useEffect } from 'react';

/**
 * 电视端「返回键」统一入口。
 *
 * 电视盒子 / WebView 的返回键有两种投递方式：
 * 1. 标准 keydown/keyup（Escape、keyCode 4/10009…）——直接拦；
 * 2. 系统级「后退」——不派发按键，直接把浏览器 history 退一格。
 *    这种最坑：会像普通网页一样一页页往回退，最后才停在首页。
 *
 * 为了让「一次返回就弹退出确认」对两种投递方式都成立：
 * - 拦截按键（keydown / keyup 双保险）；
 * - 在浏览页顶部常驻一条同址「哨兵」历史记录：系统后退只会吃掉这条同址记录，
 *   url 不变，popstate 一触发就补回哨兵并弹窗；
 * - 直接接管 history.pushState / replaceState：Next 每次路由跳转后立刻补哨兵，
 *   不再靠定时器，避免「跳转后 0.6 秒内按返回仍然退页」的窗口期。
 *
 * - 浏览页（首页 / 电影 / 剧集 / 综艺 / 搜索…）：一次返回 = 弹「要退出吗」；
 * - 详情 / 播放页：保持回退上一层（落回浏览页后恢复哨兵，下一次返回再弹窗）。
 */
const MARK = '__tvBackGuard';

export default function TvBackGuard() {
  useEffect(() => {
    let lastAt = 0;
    let lastPath = window.location.pathname + window.location.search;

    const isDetailPage = () => {
      const p = window.location.pathname;
      return (
        p.startsWith('/detail') ||
        p.startsWith('/play') ||
        p.startsWith('/admin')
      );
    };

    const inTvMode = () => {
      if (
        document.documentElement.classList.contains('tv-mode') ||
        document.body.classList.contains('tv-mode')
      ) {
        return true;
      }
      try {
        return new URLSearchParams(window.location.search).has('tv');
      } catch {
        return false;
      }
    };

    const isTyping = (target: HTMLElement | null) => {
      const tag = target?.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        !!target?.isContentEditable
      );
    };

    const isBackKey = (e: KeyboardEvent) => {
      const keys = ['Backspace', 'Escape', 'BrowserBack', 'GoBack', 'XF86Back'];
      return (
        keys.includes(e.key) ||
        e.keyCode === 4 ||
        e.keyCode === 8 ||
        e.keyCode === 27 ||
        e.keyCode === 166 ||
        e.keyCode === 461 ||
        e.keyCode === 10009
      );
    };

    const isBackspace = (e: KeyboardEvent) =>
      e.key === 'Backspace' || e.keyCode === 8;

    const rawPush = window.history.pushState.bind(window.history);
    const rawReplace = window.history.replaceState.bind(window.history);

    /** 在浏览页顶部压一条同址历史记录，用来接系统后退 */
    const arm = () => {
      if (!inTvMode() || isDetailPage()) return;
      const url = window.location.pathname + window.location.search;
      const st = window.history.state as Record<string, unknown> | null;
      if (st && st[MARK] === url) return;
      try {
        rawPush(
          { ...(st && typeof st === 'object' ? st : {}), [MARK]: url },
          document.title,
          window.location.href
        );
      } catch {
        // 某些环境限制 pushState，退化为纯按键拦截
      }
    };

    // 接管路由的 pushState / replaceState：Next 每次跳转后马上补哨兵
    type HistoryMethod = (
      data: unknown,
      unused: string,
      url?: string | URL | null
    ) => void;

    window.history.pushState = ((data, unused, url) => {
      rawPush(data, unused, url);
      lastPath = window.location.pathname + window.location.search;
      arm();
    }) as HistoryMethod;

    window.history.replaceState = ((data, unused, url) => {
      rawReplace(data, unused, url);
      lastPath = window.location.pathname + window.location.search;
      arm();
    }) as HistoryMethod;

    const requestExit = () => {
      window.dispatchEvent(new CustomEvent('tv-exit-request'));
    };

    const handleBack = () => {
      const now = Date.now();
      if (now - lastAt < 400) return;
      lastAt = now;

      if (document.querySelector('.tv-exit-dialog')) {
        window.dispatchEvent(new CustomEvent('tv-exit-close'));
        return;
      }
      if (document.querySelector('.tv-panel.tv-open')) {
        window.dispatchEvent(new CustomEvent('tv-close-panel'));
        return;
      }
      if (isDetailPage()) {
        if (window.history.length > 1) window.history.back();
        else window.location.href = '/';
        return;
      }
      requestExit();
      // 弹窗期间历史可能被系统改写，关掉后再补回哨兵
      window.setTimeout(arm, 300);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isBackKey(e) || !inTvMode()) return;
      // 搜索框里输入时，只有 Backspace 让给输入框删字；
      // 遥控器真正的返回键（Escape / keyCode 4 / 10009 等）照常弹退出确认
      if (isTyping(e.target as HTMLElement) && isBackspace(e)) return;
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      handleBack();
    };

    // 部分电视/WebView 只在 keyup 阶段派发返回键，这里做一次补捕
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isBackKey(e) || !inTvMode()) return;
      if (isTyping(e.target as HTMLElement) && isBackspace(e)) return;
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      handleBack();
    };

    /**
     * 系统后退（无按键事件）会吃掉浏览器顶部的一条历史记录：
     * 浏览器不会自动跳过我们的哨兵，所以 popstate 到达时 url 没变，
     * 说明刚才那一下就是用户按的返回键 —— 补回哨兵并弹窗。
     * 弹窗开着时再收到 popstate（部分设备按键和系统后退会同时到达），
     * 只把哨兵补回去，不关弹窗，避免一次返回把弹窗「闪一下就关掉」。
     */
    const onPopState = () => {
      const prevPath = lastPath;
      lastPath = window.location.pathname + window.location.search;
      if (!inTvMode()) return;
      arm();
      // 从详情/播放页退回浏览页：这是一次正常的"返回上一层"，不弹窗
      const wasDetail =
        prevPath.startsWith('/detail') ||
        prevPath.startsWith('/play') ||
        prevPath.startsWith('/admin');
      if (wasDetail) return;
      const now = Date.now();
      if (now - lastAt < 400) return;
      lastAt = now;
      if (document.querySelector('.tv-exit-dialog')) return;
      requestExit();
    };

    arm();
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('popstate', onPopState);

    // 兜底：极端情况下 state 被外部改写（例如第三方脚本），定期补一句
    const armTimer = window.setInterval(arm, 1200);

    return () => {
      window.clearInterval(armTimer);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('popstate', onPopState);
      window.history.pushState = rawPush;
      window.history.replaceState = rawReplace;
    };
  }, []);

  return null;
}
