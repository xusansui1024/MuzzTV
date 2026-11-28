'use client';

import { Download, Monitor, Smartphone, Tv, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { DOWNLOAD_PAGE_PATH, DOWNLOADS } from '@/lib/downloads';

interface DownloadEntryProps {
  /**
   * desktop=右上角文字按钮（悬停弹出卡片），
   * floating=移动端顶栏图标按钮，
   * sidebar=桌面侧边栏底部（综艺下方）入口，点击弹出下载面板
   */
  variant?: 'desktop' | 'floating' | 'sidebar';
  /** 侧边栏折叠时只显示图标 */
  compact?: boolean;
}

const PlatformIcon = ({ icon }: { icon: string }) => {
  if (icon === 'windows') return <Monitor className='w-4 h-4' />;
  if (icon === 'tv') return <Tv className='w-4 h-4' />;
  return <Smartphone className='w-4 h-4' />;
};

const DownloadEntry = ({
  variant = 'desktop',
  compact = false,
}: DownloadEntryProps) => {
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const [inWechat, setInWechat] = useState(false);
  // 移动端按钮现在位于带 backdrop-blur 的顶栏内，backdrop-filter 会成为 fixed 元素的 containing block，
  // 导致底部抽屉被裁成顶栏高度。用 Portal 把抽屉挂到 body 上，脱离该影响。
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setInWechat(/MicroMessenger/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  /** 悬停卡片内容（桌面右上角与侧边栏底部共用） */
  const hoverCard = (
    <div className='w-[300px] rounded-2xl p-4 border border-white/60 dark:border-white/10 bg-white/70 dark:bg-gray-900/75 backdrop-blur-2xl shadow-[0_16px_48px_-16px_rgba(0,0,0,0.3)]'>
      <div className='flex items-center gap-2.5'>
        <div className='shrink-0 w-9 h-9 rounded-lg overflow-hidden ring-1 ring-black/5 dark:ring-white/10'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src='/logo.png'
            alt='客户端图标'
            className='w-full h-full object-cover'
          />
        </div>
        <div className='min-w-0'>
          <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
            慕朝朝TV 客户端
          </div>
          <div className='text-[11px] text-gray-400'>
            手机 · 平板 · 电视 · Windows
          </div>
        </div>
      </div>

      <div className='mt-3 space-y-0.5'>
        {DOWNLOADS.map((item) => (
          <a
            key={item.id}
            href={item.file}
            download
            className='flex items-center gap-2.5 -mx-2 px-2 py-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5'
          >
            <span className='shrink-0 w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center'>
              <PlatformIcon icon={item.icon} />
            </span>
            <span className='min-w-0 flex-1'>
              <span className='block text-xs font-medium text-gray-900 dark:text-gray-100'>
                {item.platform} 客户端
              </span>
              <span className='block text-[10px] text-gray-400'>
                v{item.version} · {item.size}
              </span>
            </span>
            <Download className='w-4 h-4 shrink-0 text-green-600 dark:text-green-400' />
          </a>
        ))}
      </div>
    </div>
  );

  if (variant === 'desktop') {
    return (
      <div
        className='relative'
        data-tv-hide='1'
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Link
          href={DOWNLOAD_PAGE_PATH}
          className='flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 transition-colors hover:text-green-600 hover:border-green-300 dark:border-gray-700 dark:text-gray-300 dark:hover:text-green-400 dark:hover:border-green-700/60'
          title='下载客户端'
        >
          <Download className='w-4 h-4' />
          <span>下载客户端</span>
        </Link>

        <div
          className={`absolute right-0 top-full z-40 pt-2 transition-all duration-200 ease-out ${
            hovered
              ? 'opacity-100 translate-y-0'
              : 'pointer-events-none opacity-0 -translate-y-1'
          }`}
        >
          <div className='relative'>
            {/* 指向按钮的小三角 */}
            <div className='absolute -top-[5px] right-[46px] w-2.5 h-2.5 rotate-45 bg-white/70 dark:bg-gray-900/80 backdrop-blur-2xl border-l border-t border-white/60 dark:border-white/10' />
            {hoverCard}
          </div>
        </div>
      </div>
    );
  }

  // 下载面板（floating / sidebar 共用）：挂到 body，避免顶栏 backdrop-blur 裁切
  const sheet =
    mounted &&
    open &&
    createPortal(
      <div className='fixed inset-0 z-[60] flex items-end justify-center md:items-center'>
        {/* 遮罩 */}
        <div
          className='absolute inset-0 bg-black/50'
          onClick={() => setOpen(false)}
        />

        {/* 面板：移动端底部抽屉 */}
        <div className='relative w-full md:w-[620px] max-h-[88vh] overflow-y-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-t-2xl md:rounded-2xl shadow-2xl border border-white/50 dark:border-white/10 animate-[slideUp_180ms_ease-out]'>
          {/* 头部 */}
          <div className='flex items-start justify-between px-5 pt-5 pb-3'>
            <div>
              <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                下载客户端
              </h2>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                装到设备上直接看，比浏览器更顺
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className='p-1.5 -mt-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300'
              aria-label='关闭'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          {/* 微信内提示 */}
          {inWechat && (
            <div className='mx-5 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400'>
              微信内无法直接安装，请点右上角「⋯」选择「在浏览器打开」
            </div>
          )}

          {/* 下载卡片 */}
          <div className='px-5 pb-3 grid gap-3 md:grid-cols-2'>
            {DOWNLOADS.map((item) => (
              <div
                key={item.id}
                className='rounded-xl border border-gray-200 dark:border-gray-700/70 p-4 flex flex-col'
              >
                <div className='flex items-start gap-3'>
                  <div className='shrink-0 w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/25 text-green-600 dark:text-green-400 flex items-center justify-center'>
                    <PlatformIcon icon={item.icon} />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-1.5 flex-wrap'>
                      <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                        {item.title}
                      </span>
                      {item.recommend && (
                        <span className='text-[10px] leading-none px-1.5 py-0.5 rounded bg-green-600 text-white'>
                          推荐
                        </span>
                      )}
                    </div>
                    <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                      v{item.version} · {item.size}
                    </div>
                    <div className='text-[11px] text-gray-400 dark:text-gray-500 mt-0.5'>
                      {item.note}
                    </div>
                  </div>
                </div>

                <a
                  href={item.file}
                  download
                  className='mt-3 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-green-600 text-white text-sm font-medium transition-colors hover:bg-green-700 active:bg-green-800'
                >
                  <Download className='w-4 h-4' />
                  立即下载
                </a>
              </div>
            ))}
          </div>

          <div className='px-5 pb-5 text-[11px] text-gray-400 dark:text-gray-500'>
            安卓包同时支持手机、平板与电视盒子；电视端用 U 盘安装更方便。
          </div>
        </div>
      </div>,
      document.body
    );

  if (variant === 'sidebar') {
    return (
      <div
        className='relative'
        data-tv-hide='1'
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 悬停卡片：出现在按钮正上方，淡入 + 轻微上移，鼠标移开淡出 */}
        <div
          className={`absolute bottom-full left-0 z-40 mb-2 origin-bottom-left transition-all duration-200 ease-out ${
            hovered
              ? 'opacity-100 translate-y-0 scale-100'
              : 'pointer-events-none opacity-0 translate-y-2 scale-[0.98]'
          } ${compact ? 'left-1' : ''}`}
        >
          {hoverCard}
        </div>

        <button
          onClick={() => setOpen(true)}
          title='下载客户端'
          aria-label='下载客户端'
          className={`group inline-flex items-center justify-center gap-2 rounded-lg border border-green-500/70 bg-green-50/40 px-4 py-2 text-sm text-green-600 transition-colors duration-200 min-h-[40px] hover:border-green-600 hover:bg-green-500/10 hover:text-green-700 dark:border-green-400/50 dark:bg-green-400/10 dark:text-green-400 dark:hover:border-green-400 dark:hover:bg-green-400/15 dark:hover:text-green-300 ${
            compact ? 'w-full px-2' : ''
          }`}
        >
          <div className='w-4 h-4 flex items-center justify-center'>
            <Download className='h-4 w-4 text-green-600 group-hover:text-green-700 dark:text-green-400 dark:group-hover:text-green-300' />
          </div>
          {!compact && <span className='whitespace-nowrap'>下载客户端</span>}
        </button>
        {sheet}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
        title='下载客户端'
        aria-label='下载客户端'
      >
        <Download className='w-full h-full' />
      </button>

      {sheet}
    </>
  );
};

export default DownloadEntry;
