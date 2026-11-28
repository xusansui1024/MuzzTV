'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 电视端「退出应用」确认框
 * 在主页按返回键不再逐级回退历史，而是直接问一句"退出还是取消"。
 * 打开时整个覆盖层带 .tv-overlay，遥控焦点会被限制在弹窗内部。
 */
export default function TvExitDialog() {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  // 记住弹出前的焦点，取消后原路还回去，避免焦点掉到 body、遥控器像失灵
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onRequest = () => {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    const onClose = () => setOpen(false);
    window.addEventListener('tv-exit-request', onRequest);
    window.addEventListener('tv-exit-close', onClose);
    return () => {
      window.removeEventListener('tv-exit-request', onRequest);
      window.removeEventListener('tv-exit-close', onClose);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    // 打开后焦点默认停在「取消」，避免遥控器再按一下就误退出
    const t = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('tv-focus-first', { detail: '.tv-exit-dialog' })
      );
      cancelRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [open]);

  // 不做"挂载时读一次"的 TV 模式判断：TvNavigation 会在自己的 effect 里才给
  // <html> 加 tv-mode，早于它的组件读到的永远是 false，弹窗就再也不会出现。
  // 这里改成弹窗真正打开时再判定，保证遥控器一按返回就能看到退出框。
  const inTvMode = () => {
    if (typeof document === 'undefined') return false;
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

  if (!open || !inTvMode()) return null;

  const close = () => {
    setOpen(false);
    // 关闭后把焦点还给刚才的位置：优先原来那个元素，其次退回上一个电视焦点，
    // 最后才找第一个可聚焦元素。分两次尝试，兼容 React 卸载慢一拍的情况。
    const restore = () => {
      const prev = prevFocusRef.current;
      if (prev && document.body.contains(prev)) {
        prev.focus();
        return true;
      }
      window.dispatchEvent(
        new CustomEvent('tv-focus-first', { detail: '[data-tv-focusable]' })
      );
      return false;
    };
    window.setTimeout(() => {
      if (restore()) return;
      window.setTimeout(restore, 250);
    }, 60);
  };

  const exitApp = () => {
    // 电视浏览器 / TWA 里 window.close() 常被忽略，兜底换成一个空白页，
    // 至少不会把用户停在一个半死的旧界面上
    try {
      window.close();
    } catch {
      // 某些电视浏览器会直接抛错，忽略即可
    }
    window.setTimeout(() => {
      if (!window.closed) window.location.replace('about:blank');
    }, 300);
  };

  return (
    <div
      className='tv-exit-dialog'
      role='dialog'
      aria-modal='true'
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: '82vw',
          borderRadius: 20,
          padding: '36px 40px 30px',
          background: 'rgba(24,24,27,0.96)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 600, marginBottom: 8 }}>
          要退出吗？
        </div>
        <div
          style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 28,
          }}
        >
          选择「取消」继续浏览
        </div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          <button
            ref={cancelRef}
            type='button'
            data-tv-control='1'
            data-tv-autofocus='1'
            onClick={close}
            style={{
              minWidth: 160,
              height: 56,
              borderRadius: 12,
              fontSize: 18,
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            取消
          </button>
          <button
            type='button'
            data-tv-control='1'
            onClick={exitApp}
            style={{
              minWidth: 160,
              height: 56,
              borderRadius: 12,
              fontSize: 18,
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(239,68,68,0.85)',
              border: '1px solid rgba(239,68,68,0.9)',
            }}
          >
            退出
          </button>
        </div>
      </div>
    </div>
  );
}
