'use client';

import { useEffect } from 'react';

/**
 * 电视端「返回键」统一入口。
 *
 * 独立于焦点系统的遥控器返回处理：
 * - 监听 window 捕获阶段（先于任何组件），keydown + keyup 双保险；
 * - 不论焦点停在侧边栏、封面卡片、筛选按钮还是播放器上，都先走这里；
 * - 首层页面（主页 / 电影 / 剧集 / 综艺 / 搜索）一律弹「要退出吗」；
 * - 次层页面（详情 / 播放）保持原有行为：先收抽屉，再回退。 */
export default function TvBackGuard() {
  useEffect(() => {
    let lastAt = 0;

    // 浏览类页面（首页、电影、剧集、综艺、搜索、收藏夹…）按返回键都直接弹退出确认，
    // 不再"先退回首页、再按一次才弹"，用户在哪个分区浏览都能一步退出；
    // 只有详情/播放这类真正需要退回上一层的页面才走 history.back()
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

    const handleBack = () => {
      const now = Date.now();
      if (now - lastAt < 400) return;
      lastAt = now;

      // 弹窗开着：返回 = 取消
      if (document.querySelector('.tv-exit-dialog')) {
        window.dispatchEvent(new CustomEvent('tv-exit-close'));
        return;
      }
      // 选集/换源抽屉开着：先收抽屉
      if (document.querySelector('.tv-panel.tv-open')) {
        window.dispatchEvent(new CustomEvent('tv-close-panel'));
        return;
      }
      if (!isDetailPage()) {
        window.dispatchEvent(new CustomEvent('tv-exit-request'));
        return;
      }
      if (window.history.length > 1) window.history.back();
      else window.location.href = '/';
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

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
    };
  }, []);

  return null;
}
