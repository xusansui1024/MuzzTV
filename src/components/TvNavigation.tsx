/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';

/**
 * 电视模式 + 遥控器导航
 * - 检测 Android TV / Google TV 设备（或 URL 加 ?tv=1 强制开启）
 * - 方向键移动焦点、OK/Enter 确认、返回键回退、播放键控制播放器
 * - 焦点自动高亮并滚动到可视区域
 * 对现有组件零侵入：自动收集页面上的 a / button / input 等可交互元素，
 * 并把播放器（ArtPlayer）控制条纳入焦点链，方便遥控器操作全屏/设置等。
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [data-tv-focusable], [data-tv-control]';

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

const isCard = (el: HTMLElement) => el.hasAttribute('data-tv-focusable');

export default function TvNavigation() {
  const currentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const isTV = detectTV();
    if (!isTV) return;
    document.documentElement.classList.add('tv-mode');
    document.body.classList.add('tv-mode');

    // 元素是否真的可见：尺寸、是否脱离布局、祖先链路里的 opacity/visibility/display，
    // 以及"完全在视口外"的隐藏面板（例如移动端抽屉、侧边栏折叠按钮）。
    // 例外：横向滚动行里的封面卡片可能暂时在视口外，需要用 scrollIntoView 带进来，不能排除。
    const isVisible = (el: HTMLElement): boolean => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 2 || rect.height <= 2) return false;
      // position:fixed 的元素 offsetParent 恒为 null（播放舞台/抽屉就是固定定位），不能据此判隐藏
      const isFixed = getComputedStyle(el).position === 'fixed';
      if (el.offsetParent === null && !isFixed) return false;
      if (!isCard(el) && (rect.right <= 0 || rect.left >= window.innerWidth))
        return false;
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        const cs = getComputedStyle(node);
        if (
          cs.display === 'none' ||
          cs.visibility === 'hidden' ||
          cs.opacity === '0'
        )
          return false;
        node = node.parentElement;
      }
      return true;
    };

    // 电视端播放页有"全屏舞台 + 底部遥控条 + 选集抽屉"这层覆盖结构，
    // 页面底下的元素虽然还在 DOM 里（也在视口内），但被盖住了，不能再抢焦点。
    const overlayRoots = (): Element[] =>
      Array.from(document.querySelectorAll('.tv-overlay'));

    const collect = (): HTMLElement[] => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      // 装饰性 / 没有实际操作意义的文字（站名 logo、页内的纯说明标签）标了
      // data-tv-skip，遥控器直接跳过，不浪费一次按键
      const usable = els.filter((el) => !el.closest('[data-tv-skip]'));
      const roots = overlayRoots();
      const visible = usable.filter(isVisible);
      // 选集抽屉打开时，焦点只在抽屉（和底部遥控条）里走，
      // 否则满屏的播放舞台会把方向键"吸"过去
      const openPanel = document.querySelector('.tv-panel.tv-open');
      if (openPanel) {
        return visible.filter(
          (el) => openPanel.contains(el) || !!el.closest('.tv-player-bar')
        );
      }
      if (!roots.length) return visible;
      return visible.filter((el) =>
        roots.some((root) => root.contains(el) || root === el)
      );
    };

    // 侧边栏判定：只看真实的侧边栏容器（aside），不再用"靠左 22%"这种几何猜测，
    // 否则某些分辨率下最左边那张封面会被误判成菜单项。
    const isSidebarEl = (el: HTMLElement): boolean => {
      if (el.closest('[data-tv-sidebar], aside[data-sidebar]')) return true;
      return false;
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
      if (!els.length) return;
      const preferred = els.find((el) => el.hasAttribute('data-tv-autofocus'));
      if (preferred) {
        focusEl(preferred);
        return;
      }
      // 一般页面：优先落在侧边栏第一个菜单项（首页），不要让顶部的装饰按钮抢焦点
      const menuFirst = els.find((el) => isSidebarEl(el));
      focusEl(menuFirst || els[0]);
    };

    // 菜单项上按右键：跳到主内容区第一张封面卡片（优先卡片，不再落到顶部的切换按钮上）
    const jumpToMainContent = () => {
      const cur = currentRef.current;
      if (!cur) return false;
      const els = collect().filter((el) => el !== cur);
      const curRect = cur.getBoundingClientRect();
      const curCY = curRect.top + curRect.height / 2;
      const inMain = (el: HTMLElement) =>
        el.getBoundingClientRect().left >= window.innerWidth * 0.22;

      const pick = (list: HTMLElement[]) => {
        let best: HTMLElement | null = null;
        let bestScore = Infinity;
        for (const el of list) {
          const r = el.getBoundingClientRect();
          const score =
            Math.abs(r.top + r.height / 2 - curCY) * 2 + r.left * 0.2;
          if (score < bestScore) {
            bestScore = score;
            best = el;
          }
        }
        if (best) focusEl(best);
        return !!best;
      };

      const cards = els.filter((el) => isCard(el) && inMain(el));
      if (cards.length) {
        // 从菜单进入内容区，永远先落到"离菜单最近那一行里最靠左"的封面，
        // 也就是这一屏的第一个影片，不要因为纵向距离打分的细微差别跳到第二张
        const rows = cards.map((el) => {
          const r = el.getBoundingClientRect();
          return { el, top: r.top, left: r.left };
        });
        const minDy = Math.min(...rows.map((x) => Math.abs(x.top - curCY)));
        const nearRow = rows.filter(
          (x) => Math.abs(x.top - curCY) <= minDy + 40
        );
        nearRow.sort((a, b) => a.left - b.left);
        if (nearRow[0]) {
          focusEl(nearRow[0].el);
          return true;
        }
      }
      const others = els.filter(
        (el) => inMain(el) && el.getBoundingClientRect().width > 30
      );
      return pick(others);
    };

    // 播放器控制条：把 ArtPlayer 的控件标记为可聚焦，遥控器才能选到全屏/设置等
    const markPlayerControls = () => {
      document
        .querySelectorAll<HTMLElement>('.art-video-player .art-control')
        .forEach((el) => {
          if (el.classList.contains('art-control-time')) return;
          if (el.classList.contains('art-control-thumbnails')) return;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) return;
          if (!el.hasAttribute('data-tv-control')) {
            el.setAttribute('data-tv-control', '1');
          }
        });
    };

    const inPlayer = (el: HTMLElement | null) =>
      !!el?.closest('.art-video-player');

    const inPlayerBar = (el: HTMLElement | null) =>
      !!el?.closest('.tv-player-bar');

    // 播放页的"舞台"（全屏视频区域）本身也是焦点目标：焦点停在这里时
    // 左右=快退/快进，OK=播放/暂停，上下=跳到「选集/换源」按钮
    const inPlayStage = (el: HTMLElement | null) =>
      !!el?.closest('[data-tv-stage]');

    const seekBy = (delta: number) => {
      const video = document.querySelector<HTMLVideoElement>(
        '.art-video-player video'
      );
      if (!video) return;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const next = video.currentTime + delta;
      video.currentTime = Math.max(
        0,
        duration > 0 ? Math.min(duration - 1, next) : next
      );
    };

    // 连续按（遥控器长按）累加秒数，跟芒果/腾讯的快进提示一致
    let lastSeekAt = 0;
    let seekDirection: 'back' | 'forward' = 'forward';
    let seekTotal = 0;
    const seekWithHint = (delta: number) => {
      const now = Date.now();
      const dir = delta > 0 ? 'forward' : 'back';
      if (now - lastSeekAt < 1500 && seekDirection === dir) {
        seekTotal += Math.abs(delta);
      } else {
        seekDirection = dir;
        seekTotal = Math.abs(delta);
      }
      lastSeekAt = now;
      seekBy(delta);
      window.dispatchEvent(
        new CustomEvent('tv-seek', {
          detail: { direction: dir, seconds: seekTotal },
        })
      );
    };

    // 点一下 OK：播放/暂停
    const togglePlay = () => {
      const video = document.querySelector<HTMLVideoElement>(
        '.art-video-player video'
      );
      if (!video) return false;
      if (video.paused) void video.play().catch(() => undefined);
      else video.pause();
      return true;
    };

    // 上下键：舞台 <-> 遥控条按钮 之间来回
    const jumpStageOrBar = (dir: Dir): boolean => {
      const stage = document.querySelector<HTMLElement>('[data-tv-stage]');
      const barBtn = document.querySelector<HTMLElement>(
        '.tv-player-bar .tv-bar-btn'
      );
      if (!barBtn) return false;
      const cur = currentRef.current;
      if (cur && inPlayerBar(cur)) {
        if (stage) {
          focusEl(stage);
          return true;
        }
        return false;
      }
      if (dir === 'down') {
        focusEl(barBtn);
        return true;
      }
      return false;
    };

    const changeVolumeBy = (delta: number) => {
      const video = document.querySelector<HTMLVideoElement>(
        '.art-video-player video'
      );
      if (!video) return;
      video.volume = Math.max(0, Math.min(1, video.volume + delta));
    };

    // 浏览器只允许"由真实按键处理函数直接发起"的全屏请求，
    // 用 el.click() 触发播放器自己的全屏按钮会被拒绝（not granted），
    // 所以遥控器确认键落在全屏按钮上时，直接对播放器调用 requestFullscreen。
    const togglePlayerFullscreen = () => {
      if (document.fullscreenElement) {
        const p = document.exitFullscreen?.();
        if (p && typeof p.catch === 'function') p.catch(() => undefined);
        return true;
      }
      const player = document.querySelector<HTMLElement>('.art-video-player');
      if (!player) return false;
      const p = player.requestFullscreen?.();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
      return true;
    };

    const move = (dir: Dir) => {
      const current = currentRef.current;
      const els = collect();
      if (!els.length) return;
      if (!current || !document.body.contains(current)) {
        focusFirst();
        return;
      }
      // 侧边栏菜单项上：右键直接跳主内容区（封面），不做同行对齐判断
      if (dir === 'right' && isSidebarEl(current)) {
        jumpToMainContent();
        return;
      }

      // 播放页舞台：左右 = ±15 秒（带中央提示），上下 = 跳到「选集/换源」
      if (inPlayStage(current)) {
        if (dir === 'left') {
          seekWithHint(-15);
          return;
        }
        if (dir === 'right') {
          seekWithHint(15);
          return;
        }
        if (jumpStageOrBar(dir)) return;
        return;
      }

      // 遥控条：只有一个「选集/换源」按钮，左右仍然快退/快进，上下回舞台
      if (inPlayerBar(current)) {
        if (dir === 'left') {
          seekWithHint(-15);
          return;
        }
        if (dir === 'right') {
          seekWithHint(15);
          return;
        }
        jumpStageOrBar(dir);
        return;
      }

      // 极少数情况下焦点落在播放器自带控制条（旧逻辑保留，电视端已隐藏该条）
      if (inPlayer(current)) {
        if (current.classList.contains('art-control-progress')) {
          if (dir === 'left') {
            seekBy(-15);
            return;
          }
          if (dir === 'right') {
            seekBy(15);
            return;
          }
        }
        if (current.classList.contains('art-control-volume')) {
          if (dir === 'left') {
            changeVolumeBy(-0.1);
            return;
          }
          if (dir === 'right') {
            changeVolumeBy(0.1);
            return;
          }
        }
      }

      const curRect = current.getBoundingClientRect();
      const curCX = curRect.left + curRect.width / 2;
      const curCY = curRect.top + curRect.height / 2;
      const horizontal = dir === 'left' || dir === 'right';

      const cands: Array<{ el: HTMLElement; r: DOMRect }> = [];
      for (const el of els) {
        if (el === current) continue;
        const r = el.getBoundingClientRect();
        // 候选收集放宽 28px：同一行/列上的邻居可能因为缩放或边框略有错位，
        // 真正"是不是这个方向"由下面的严格判断决定
        if (horizontal) {
          const dcx = r.left + r.width / 2 - curCX;
          if (dir === 'right' ? dcx < -28 : dcx > 28) continue;
        } else {
          const dcy = r.top + r.height / 2 - curCY;
          if (dir === 'down' ? dcy < -28 : dcy > 28) continue;
        }
        cands.push({ el, r });
      }
      if (!cands.length) return;

      const overlap = (r: DOMRect) =>
        horizontal
          ? Math.max(
              0,
              Math.min(curRect.bottom, r.bottom) - Math.max(curRect.top, r.top)
            )
          : Math.max(
              0,
              Math.min(curRect.right, r.right) - Math.max(curRect.left, r.left)
            );

      // 第一优先：同一行 / 同一列有实体重叠的元素（最常见的正确落点）
      let best: HTMLElement | null = null;
      let bestScore = Infinity;
      for (const { el, r } of cands) {
        const ov = overlap(r);
        if (ov <= 0) continue;
        const dcx = r.left + r.width / 2 - curCX;
        const dcy = r.top + r.height / 2 - curCY;
        // 同行候选仍要求确实在前进方向上（±6px 容差）
        if (horizontal) {
          if (dir === 'right' ? dcx < 6 : dcx > -6) continue;
        } else {
          if (dir === 'down' ? dcy < 6 : dcy > -6) continue;
        }
        const score = horizontal
          ? Math.abs(dcy) - ov * 1.2 + Math.abs(dcx) * 0.6
          : Math.abs(dcx) - ov * 1.2 + Math.abs(dcy) * 0.6;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      if (best) {
        focusEl(best);
        return;
      }

      // 第二优先（没有同行元素）：横向移动时找相邻行里最靠左/右的封面卡片，
      // 避免"最左边按右"直接跳到顶部栏或整屏最右侧。
      if (horizontal) {
        const cards = cands.filter(({ el }) => isCard(el));
        if (cards.length) {
          let target: HTMLElement | null = null;
          let targetScore = Infinity;
          for (const { el, r } of cards) {
            const dcx = r.left + r.width / 2 - curCX;
            const dcy = r.top + r.height / 2 - curCY;
            // 右键优先下一行，左键优先上一行
            const rowPenalty = dir === 'right' ? dcy < 0 : dcy > 0;
            const score =
              Math.abs(dcx) * 0.6 +
              Math.abs(dcy) +
              (rowPenalty ? window.innerHeight : 0);
            if (score < targetScore) {
              targetScore = score;
              target = el;
            }
          }
          if (target) {
            focusEl(target);
            return;
          }
        }
      }

      // 第三优先：兜底取方向上距离最近的元素（取消小阈值限制），最远不超过半屏，
      // 且横向移动不再允许"往上跑"（否则封面区最左边按右键会跳到顶部切换按钮）。
      let fallback: HTMLElement | null = null;
      let fallbackScore = Infinity;
      for (const { el, r } of cands) {
        const dcx = r.left + r.width / 2 - curCX;
        const dcy = r.top + r.height / 2 - curCY;
        if (horizontal) {
          if (Math.abs(dcy) > window.innerHeight * 0.35) continue;
          if (dir === 'right' && r.top < curRect.top - 4) continue;
          if (dir === 'left' && r.bottom > curRect.bottom + 4) continue;
        } else if (Math.abs(dcx) > window.innerWidth * 0.5) {
          continue;
        }
        const score = horizontal
          ? Math.abs(dcy) * 1.2 + Math.abs(dcx) * 0.6
          : Math.abs(dcx) * 1.2 + Math.abs(dcy) * 0.6;
        if (score < fallbackScore) {
          fallbackScore = score;
          fallback = el;
        }
      }
      if (fallback) focusEl(fallback);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        !!target?.isContentEditable;

      // 遥控器「返回」键：Android TV keyCode 4 / webOS 461 / Tizen 10009，
      // 键名也可能是 Backspace、Escape、BrowserBack、GoBack 等
      const backKeys = [
        'Backspace',
        'Escape',
        'BrowserBack',
        'GoBack',
        'XF86Back',
      ];
      const isBackKey =
        backKeys.includes(e.key) ||
        e.keyCode === 4 ||
        e.keyCode === 461 ||
        e.keyCode === 10009;
      if (isBackKey && !isTyping && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        // 退出确认框开着时，返回键等于「取消」
        if (document.querySelector('.tv-exit-dialog')) {
          window.dispatchEvent(new CustomEvent('tv-exit-close'));
        } else if (document.querySelector('.tv-panel.tv-open')) {
          // 选集/换源抽屉开着时，返回键只收起抽屉，不能直接退出观影页
          window.dispatchEvent(new CustomEvent('tv-close-panel'));
        } else if (window.location.pathname === '/') {
          // 主页按返回 = 问一句"退出还是取消"，不再一级级回退历史
          window.dispatchEvent(new CustomEvent('tv-exit-request'));
        } else if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = '/';
        }
        return;
      }

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
          if (currentRef.current) {
            // 焦点在播放舞台：OK 就是播放/暂停
            if (inPlayStage(currentRef.current)) {
              togglePlay();
              return;
            }
            // 全屏按钮必须由按键处理函数直接发起，不能走 click
            if (
              currentRef.current.classList.contains('art-control-fullscreen')
            ) {
              togglePlayerFullscreen();
              return;
            }
            currentRef.current.click();
          } else {
            focusFirst();
          }
          break;
        case 'MediaPlayPause':
        case ' ': {
          if (isTyping) return;
          // 空格无视频时，若焦点在可点元素上则触发
          const video = document.querySelector<HTMLVideoElement>('video');
          if (
            video &&
            (e.key === 'MediaPlayPause' || e.target === document.body)
          ) {
            e.preventDefault();
            if (video.paused) void video.play().catch(() => undefined);
            else video.pause();
          } else if (e.key === ' ' && currentRef.current) {
            e.preventDefault();
            currentRef.current.click();
          }
          break;
        }
      }
    };

    // 进入页面/路由变化后聚焦第一个元素
    const timer = window.setTimeout(focusFirst, 500);
    const onRouteChange = () => {
      window.setTimeout(focusFirst, 300);
      window.clearTimeout(timer);
    };

    // React 重渲染会把 className 整个覆盖掉，我们加的 tv-focused 可能被抹掉。
    // 这里优先"补回同一个元素的焦点"，元素真被换掉时才重新挑一个。
    const keepFocusClass = (): boolean => {
      const cur = currentRef.current;
      if (!cur || !document.body.contains(cur)) return false;
      // 弹窗/抽屉打开后，被盖住的元素即使还在 DOM 里也不该继续高亮
      if (!collect().includes(cur)) return false;
      if (!cur.classList.contains('tv-focused'))
        cur.classList.add('tv-focused');
      return true;
    };

    const focusRecover = () => {
      const panel = document.querySelector('.tv-panel.tv-open');
      if (panel) {
        const inside = collect().filter((el) => panel.contains(el));
        if (inside.length) {
          focusEl(inside[0]);
          return;
        }
      }
      focusFirst();
    };

    // 播放器控制条会随播放器重建，需要持续补标记
    markPlayerControls();
    const markTimer = window.setInterval(markPlayerControls, 1200);

    // 兜底：React 重渲染可能把带 tv-focused 的节点整个换掉，
    // 焦点会"消失"，遥控器按了像没反应。这里定期检查，丢了就补回来。
    const focusGuardTimer = window.setInterval(() => {
      if (!keepFocusClass()) focusRecover();
    }, 700);

    // 播放页抽屉/遥控条切换时，由组件发起"把焦点送到某个区域"的请求
    const onFocusRequest = (ev: Event) => {
      const selector = (ev as CustomEvent).detail as string | undefined;
      if (!selector) return;
      try {
        const els = collect().filter((el) => el.closest(selector));
        if (els.length) focusEl(els[0]);
      } catch {
        // 选择器写错时忽略，不影响方向键主流程
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('tv-focus-first', onFocusRequest as EventListener);
    window.addEventListener('popstate', onRouteChange);
    // Next.js App Router 下监听文档可见性变化重新聚焦（页面切换后 DOM 替换）
    const observer = new MutationObserver(() => {
      markPlayerControls();
      keepFocusClass();
      const cur = currentRef.current;
      if (cur && !document.body.contains(cur)) {
        focusRecover();
        return;
      }
      // 播放页全屏舞台出现后，焦点若还停在被盖住的页面元素上，重新落到遥控条
      const roots = overlayRoots();
      if (
        cur &&
        roots.length &&
        !roots.some((root) => root.contains(cur) || root === cur)
      ) {
        focusRecover();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(markTimer);
      window.clearInterval(focusGuardTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(
        'tv-focus-first',
        onFocusRequest as EventListener
      );
      window.removeEventListener('popstate', onRouteChange);
      observer.disconnect();
      currentRef.current?.classList.remove('tv-focused');
    };
  }, []);

  return null;
}
