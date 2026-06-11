/* eslint-disable no-console,react-hooks/exhaustive-deps */
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { getDoubanCategories, getDoubanList } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import DoubanSelector from '@/components/DoubanSelector';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

// 扩展 Item 类型以支持分组功能
type DisplayItem = DoubanItem & { isGroup?: boolean; groupItems?: DoubanItem[] };

// 用于去重
const getUniqueKey = (item: any) => {
  return item.id ? item.id : `${(item.title || item.name || '').trim()}_${item.year || '0'}`;
};

// 用于分组 (仅比对标题)
const getGroupKey = (item: any) => {
  return (item.title || item.name || '').toLowerCase().trim();
};

function DoubanPageClient() {
  const searchParams = useSearchParams();
  const [doubanData, setDoubanData] = useState<DisplayItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DisplayItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectorsReady, setSelectorsReady] = useState(false);
  
  const loadingRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const type = searchParams.get('type') || 'movie';
  const tag = searchParams.get('tag') || '';
  const custom = searchParams.get('custom') === 'true';
  const name = searchParams.get('name') || '';

  const [primarySelection, setPrimarySelection] = useState<string>(() => type === 'movie' ? '热门' : '');
  const [secondarySelection, setSecondarySelection] = useState<string>('全部');

  useEffect(() => {
    setSelectorsReady(false);
    setLoading(true);
    const timer = setTimeout(() => setSelectorsReady(true), 50);
    return () => clearTimeout(timer);
  }, [type, tag, custom]);

  const getRequestParams = useCallback((pageStart: number) => ({
    kind: (type === 'tv' || type === 'show') ? ('tv' as const) : (type as 'tv' | 'movie'),
    category: (type === 'tv' || type === 'show') ? type : primarySelection,
    type: secondarySelection,
    pageLimit: 25,
    pageStart,
  }), [type, primarySelection, secondarySelection]);

  const fetchData = useCallback(async (pageStart: number, isMore: boolean) => {
    try {
      if (isMore) setIsLoadingMore(true);
      else setLoading(true);

      let rawList: DoubanItem[] = [];

      if (secondarySelection === 'tv_Thailand') {
        const keywords = [
            '泰剧', '泰国', 'Thai', 
            '禁忌女孩', '天生一对', 
            '以你的心诠释我的爱', '特长生', 
            '黑帮少爷爱上我', '学姐可以当老师', 
            '只是朋友', '只因我们天生一对', 
            '绝庙骗局', 'Shine', 'Mad Unicorn'
        ];
        const pg = Math.floor(pageStart / 25) + 1;
        const results = await Promise.all(keywords.map(kw => fetch(`/api/search?q=${encodeURIComponent(kw)}&pg=${pg}`).then(r => r.json())));
        rawList = results.flatMap(r => r.results || r.list || []);
      } else if (custom) {
        const data = await getDoubanList({ tag, type, pageLimit: 25, pageStart });
        rawList = data.code === 200 ? data.list : [];
      } else {
        const data = await getDoubanCategories({ kind: (type === 'tv' || type === 'show') ? 'tv' : 'movie', category: type, type: secondarySelection, pageLimit: 25, pageStart });
        rawList = data.code === 200 ? data.list : [];
      }

      const blacklist = ['AFC', '锦标赛', '足球', '比赛', '亚足联', '预选赛', '世界杯', 'Logo', '积分榜', '女足', 'NBA', '亚洲杯', '泰国性痴迷', '亚运会', '男足', '回放', '世预赛', '世预亚','狂野泰国','冲游泰国','到了30岁还是处男','男足', '亚残运会', '泰国大象医院', '冲遊泰国', '野性泰国','T台新面孔', '泰国72小时粤语', '觉醒眼神后', '幸存者', '空中看泰国', '南洋大宝荐', '短剧', '爽文', '微剧'];
      const filteredList = rawList.filter(item => !blacklist.some(kw => (item.title || '').includes(kw)));

      // 分组逻辑：按标题分组
      const groupMap = new Map<string, DoubanItem[]>();
      filteredList.forEach(item => {
        const key = getGroupKey(item);
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(item);
      });

      const processedList: DisplayItem[] = Array.from(groupMap.values()).map(items => {
        if (items.length > 1) return { ...items[0], isGroup: true, groupItems: items };
        return items[0];
      });

      setDoubanData(prev => isMore ? [...prev, ...processedList] : processedList);
      setHasMore(rawList.length > 0);
    } catch (err) {
      console.error(err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
      setLoading(false);
    }
  }, [type, secondarySelection, tag, custom, getRequestParams]);

  useEffect(() => {
    if (!selectorsReady && !custom) return;
    fetchData(0, false);
  }, [selectorsReady, type, tag, custom, primarySelection, secondarySelection, fetchData]);

  return (
    <PageLayout activePath={`/douban?type=${type}&tag=${tag}`}>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='grid grid-cols-3 gap-x-4 gap-y-12 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]'>
          {doubanData.map((item, i) => (
            <div key={`${item.id}-${i}`} onClick={() => item.isGroup && setSelectedGroup(item)} className="cursor-pointer relative">
               <VideoCard from='douban' title={item.title} poster={item.poster} douban_id={item.id} rate={item.rate} year={item.year} type={type === 'movie' ? 'movie' : ''} />
               {item.isGroup && (
                 <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">
                   {item.groupItems?.length}版本
                 </div>
               )}
            </div>
          ))}
        </div>

        {selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedGroup(null)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4">{selectedGroup.title} 的所有版本</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {selectedGroup.groupItems?.map((child, idx) => (
                  <VideoCard key={idx} from='douban' title={child.title} poster={child.poster} douban_id={child.id} rate={child.rate} year={child.year} type={type === 'movie' ? 'movie' : ''} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function DoubanPage() { return <Suspense><DoubanPageClient /></Suspense>; }
