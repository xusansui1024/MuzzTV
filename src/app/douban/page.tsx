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

// 标题标准化：统一转小写，去除非核心词，用作去重指纹
const getUniqueKey = (item: any) => {
  const title = (item.title || item.name || '').toLowerCase().replace(/[\(\（].*?[\)\）]|[\d\s\-\:]/g, '');
  const year = item.year || '0';
  return `${title}_${year}`; // 用 标题+年份 作为唯一指纹，极其精准
};

function DoubanPageClient() {
  const searchParams = useSearchParams();
  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
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
  const [secondarySelection, setSecondarySelection] = useState<string>(() => {
    if (type === 'movie') return '全部';
    if (type === 'tv') return 'tv';
    if (type === 'show') return 'show';
    return '全部';
  });

  useEffect(() => {
    setSelectorsReady(false);
    setLoading(true);

    if (type === 'movie') {
      setPrimarySelection('热门');
      setSecondarySelection('全部');
    } else if (type === 'tv') {
      setPrimarySelection('');
      setSecondarySelection('tv');
    } else if (type === 'show') {
      setPrimarySelection('');
      setSecondarySelection('show');
    } else {
      setPrimarySelection('');
      setSecondarySelection('全部');
    }

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

      let list: DoubanItem[] = [];

      if (secondarySelection === 'tv_Thailand') {
        // 核心：移除硬编码关键词，只保留大范围搜索，避免搜索结果重叠
        const keywords = ['泰剧', '泰国', 'Thai', '泰国剧'];
        const pg = Math.floor(pageStart / 25) + 1;
        
        const results = await Promise.all(
            keywords.map(kw => fetch(`/api/search?q=${encodeURIComponent(kw)}&pg=${pg}`).then(r => r.json()))
        );
        
        const allResults = results.flatMap(r => r.results || r.list || []);
        
        const blacklist = ['AFC', '锦标赛', '足球', '比赛', '亚足联', '预选赛', '世界杯', 'Logo', '积分榜', '女足', 'NBA', '亚洲杯', '泰国性痴迷', '亚运会', '男足', '回放', '世预赛', '世预亚','狂野泰国','冲游泰国','到了30岁还是处男','男足', '亚残运会', '泰国大象医院', '冲遊泰国', '野性泰国','T台新面孔', '泰国72小时粤语', '觉醒眼神后', '幸存者', '空中看泰国', '南洋大宝荐'];
        
        const uniqueMap = new Map<string, DoubanItem>();
        
        allResults.forEach((item: any) => {
            const rawTitle = item.title || item.name || '';
            const uniqueKey = getUniqueKey(item); // 使用计算出的指纹去重
            const isNoise = blacklist.some(kw => rawTitle.includes(kw));
            
            if (!isNoise && rawTitle.length > 0) {
                if (!uniqueMap.has(uniqueKey)) {
                    uniqueMap.set(uniqueKey, {
                        id: item.id || '',
                        title: rawTitle,
                        poster: item.poster || item.cover || item.pic || '',
                        rate: item.rate || '0.0',
                        year: item.year || '0'
                    });
                }
            }
        });
        
        list = Array.from(uniqueMap.values());
        list.sort((a, b) => parseInt(b.year || '0') - parseInt(a.year || '0'));
        setHasMore(list.length > 0);
      } 
      else if (custom) {
        const data = await getDoubanList({ tag, type, pageLimit: 25, pageStart });
        if (data.code === 200) list = data.list;
        setHasMore(list.length > 0);
      } else {
        const data = await getDoubanCategories(getRequestParams(pageStart));
        if (data.code === 200) list = data.list;
        setHasMore(list.length > 0);
      }

      setDoubanData(prev => {
          const combined = isMore ? [...prev, ...list] : list;
          // 全局双重校验
          const finalMap = new Map();
          combined.forEach(item => finalMap.set(getUniqueKey(item), item));
          return Array.from(finalMap.values()).sort((a, b) => parseInt(b.year || '0') - parseInt(a.year || '0'));
      });
      
    } catch (err) {
      console.error("加载数据出错:", err);
      setHasMore(false);
    } finally {
      if (isMore) setIsLoadingMore(false);
      else setLoading(false);
    }
  }, [type, tag, custom, secondarySelection, getRequestParams]);

  useEffect(() => {
    if (!selectorsReady && !custom) return;
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      setCurrentPage(0);
      fetchData(0, false);
    }, 100);
    return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
  }, [selectorsReady, type, tag, custom, primarySelection, secondarySelection, fetchData]);

  useEffect(() => {
    if (currentPage > 0) fetchData(currentPage * 25, true);
  }, [currentPage]);

  useEffect(() => {
    if (!hasMore || isLoadingMore || loading || !loadingRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setCurrentPage(p => p + 1);
    }, { threshold: 0.1 });
    observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loading]);

  return (
    <PageLayout activePath={`/douban?type=${type}&tag=${tag}`}>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='mb-6 sm:mb-8 space-y-4'>
          <h1 className='text-2xl sm:text-3xl font-bold'>{name || (custom ? tag : (type === 'movie' ? '电影' : type === 'tv' ? '电视剧' : '综艺'))}</h1>
          {!custom && (
            <div className='bg-white/60 rounded-2xl p-4 border border-gray-200/30 backdrop-blur-sm'>
              <DoubanSelector
                type={type as 'movie' | 'tv' | 'show'}
                primarySelection={primarySelection}
                secondarySelection={secondarySelection}
                onPrimaryChange={(v) => { if(v !== primarySelection) setPrimarySelection(v); }}
                onSecondaryChange={(v) => { if(v !== secondarySelection) setSecondarySelection(v); }}
              />
            </div>
          )}
        </div>
        
        <div className='grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
          {(loading) ? Array.from({ length: 10 }, (_, i) => <DoubanCardSkeleton key={i} />)
            : doubanData.map((item, i) => (
                <VideoCard key={`${item.id}-${i}`} from='douban' title={item.title} poster={item.poster} douban_id={item.id} rate={item.rate} year={item.year} type={type === 'movie' ? 'movie' : ''} />
              ))
          }
        </div>

        {hasMore && !loading && <div ref={loadingRef} className='h-20' />}
        {!loading && doubanData.length === 0 && <div className='text-center py-20'>暂无相关内容</div>}
      </div>
    </PageLayout>
  );
}

export default function DoubanPage() { return <Suspense><DoubanPageClient /></Suspense>; }
