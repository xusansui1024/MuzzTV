import { Download, Monitor, Smartphone } from 'lucide-react';
import type { Metadata } from 'next';

import { DOWNLOADS } from '@/lib/downloads';

export const metadata: Metadata = {
  title: '下载客户端',
  description: '手机、平板、电视盒子与 Windows 客户端安装包',
};

const PlatformIcon = ({ icon }: { icon: string }) => {
  if (icon === 'windows') return <Monitor className='w-5 h-5' />;
  return <Smartphone className='w-5 h-5' />;
};

export default function DownloadPage() {
  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100'>
      <main className='max-w-2xl mx-auto px-5 py-10'>
        <h1 className='text-2xl font-bold tracking-tight'>下载客户端</h1>
        <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
          Android 安装包同时支持手机、平板和电视盒子；Windows 提供安装版。
        </p>

        <div className='mt-6 space-y-3'>
          {DOWNLOADS.map((item) => (
            <div
              key={item.id}
              className='rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4'
            >
              <div className='flex items-start gap-3'>
                <div className='shrink-0 w-11 h-11 rounded-lg bg-green-50 dark:bg-green-900/25 text-green-600 dark:text-green-400 flex items-center justify-center'>
                  <PlatformIcon icon={item.icon} />
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-1.5 flex-wrap'>
                    <span className='font-medium'>{item.title}</span>
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
                className='mt-3 flex items-center justify-center gap-1.5 h-10 rounded-lg bg-green-600 text-white text-sm font-medium transition-colors hover:bg-green-700 active:bg-green-800'
              >
                <Download className='w-4 h-4' />
                下载 {item.platform}
              </a>
            </div>
          ))}
        </div>

        <div className='mt-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
          <p className='font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
            安装提示
          </p>
          <p>· 安卓安装时如提示「未知来源」，在系统设置里允许安装即可。</p>
          <p>· 电视盒子建议用 U 盘拷贝 APK 安装，或用当贝市场等工具推送。</p>
          <p>· Windows 版如被 SmartScreen 拦下，点「更多信息 → 仍要运行」。</p>
        </div>
      </main>
    </div>
  );
}
