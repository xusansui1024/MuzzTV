'use client';

import { Download, Monitor, Smartphone, Tv, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { DOWNLOAD_PAGE_PATH, DOWNLOADS } from '@/lib/downloads';

interface DownloadEntryProps {
  /** desktop=右上角文字按钮（悬停弹出卡片），floating=移动端左下角悬浮按钮 */
  variant?: 'desktop' | 'floating';
}

const PlatformIcon = ({ icon }: { icon: string }) => {
  if (icon === 'windows') return <Monitor className='w-4 h-4' />;
  if (icon === 'tv') return <Tv className='w-4 h-4' />;
  return <Smartphone className='w-4 h-4' />;
};

const DownloadEntry = ({ variant = 'desktop' }: DownloadEntryProps) => {
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState('');
  const [inWechat, setInWechat] = useState(false);

  useEffect(() => {
    setInWechat(/MicroMessenger/i.test(navigator.userAgent));
  }, []);

  // 二维码指向下载落地页，域名取当前访问的 origin
  useEffect(() => {
    if ((!hovered && !open) || qrSrc) return;
    const base = window.location.origin;
    setQrSrc(
      `${base}/api/qr?u=${encodeURIComponent(base + DOWNLOAD_PAGE_PATH)}`
    );
  }, [hovered, open, qrSrc]);

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

  if (variant === 'desktop') {
    return (
      <div
        className='relative'
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

        {hovered && (
          <div className='absolute right-0 top-full z-40 pt-2'>
            <div className='relative'>
              {/* 指向按钮的小三角 */}
              <div className='absolute -top-[5px] right-[46px] w-2.5 h-2.5 rotate-45 bg-white/70 dark:bg-gray-900/80 backdrop-blur-2xl border-l border-t border-white/60 dark:border-white/10' />

              <div className='w-[300px] rounded-2xl p-4 border border-white/60 dark:border-white/10 bg-white/70 dark:bg-gray-900/75 backdrop-blur-2xl shadow-[0_16px_48px_-16px_rgba(0,0,0,0.3)]'>
                <div className='flex items-center gap-2.5'>
                  <div className='shrink-0 w-9 h-9 rounded-lg bg-green-600 text-white flex items-center justify-center'>
                    <Tv className='w-5 h-5' />
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

                <div className='mt-3 pt-3 border-t border-gray-900/5 dark:border-white/10 flex items-center gap-2.5'>
                  {qrSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrSrc}
                      alt='扫码下载'
                      className='shrink-0 w-14 h-14 rounded bg-white p-0.5 border border-gray-100 dark:border-gray-700'
                    />
                  ) : (
                    <div className='shrink-0 w-14 h-14 rounded bg-gray-100 dark:bg-gray-800' />
                  )}
                  <span className='text-[11px] leading-relaxed text-gray-500 dark:text-gray-400'>
                    手机扫码打开下载页
                    <br />
                    自动按设备推荐版本
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className='flex items-center justify-center w-11 h-11 rounded-full bg-green-600 text-white shadow-lg shadow-green-600/25 transition-transform active:scale-95'
        title='下载客户端'
        aria-label='下载客户端'
      >
        <Download className='w-5 h-5' />
      </button>

      {open && (
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
        </div>
      )}
    </>
  );
};

export default DownloadEntry;
