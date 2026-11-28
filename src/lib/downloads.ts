export interface DownloadItem {
  id: string;
  /** 平台分类标签 */
  platform: string;
  /** 卡片主标题 */
  title: string;
  version: string;
  size: string;
  /** public 下的下载地址 */
  file: string;
  /** 一行补充说明 */
  note: string;
  icon: 'android' | 'tv' | 'windows';
  /** 默认推荐，卡片上加「推荐」角标 */
  recommend?: boolean;
}

// 升级安装包时只改这里：换 file 名 + version + size
export const DOWNLOADS: DownloadItem[] = [
  {
    id: 'android',
    platform: 'Android',
    title: '手机 / 平板 / 电视',
    version: '1.1.0',
    size: '4.7 MB',
    file: '/downloads/muzhaotv-1.1.0.apk',
    note: '同一安装包，手机、平板、电视盒子通用',
    icon: 'android',
    recommend: true,
  },
  {
    id: 'windows',
    platform: 'Windows',
    title: 'Windows 安装版',
    version: '1.0.1',
    size: '78.3 MB',
    file: '/downloads/muzhaotv-setup-1.0.1.exe',
    note: '支持 Win 10 / 11 64 位',
    icon: 'windows',
  },
];

/** 二维码统一指向下载落地页，换版本不用换二维码 */
export const DOWNLOAD_PAGE_PATH = '/download';
