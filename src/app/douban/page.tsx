/* eslint-disable no-console,react-hooks/exhaustive-deps */
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { getDoubanCategories, getDoubanList } from '@/lib/douban.client';
import { DoubanItem, DoubanResult } from '@/lib/types';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import DoubanSelector from '@/components/DoubanSelector';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

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

  // 智能数据获取函数（已修复分页加载逻辑，并保留去重与清洗）
  const fetchData = useCallback(async (pageStart: number, isMore: boolean) => {
    try {
      if (isMore) setIsLoadingMore(true);
      else setLoading(true);

      let list: DoubanItem[] = [];

      if (secondarySelection === 'tv_Thailand') {
        // 计算当前页码（每页 25 个）
        const page = Math.floor(pageStart / 25) + 1;
        const res = await fetch(`/api/search?q=${encodeURIComponent('泰剧')}&page=${page}`);
        const json = await res.json();
        
        // 关键词白名单
        const thaiKeywords = ['泰', '泰国', '泰剧', '泰版', '泰语', '泰国版'];
        const uniqueMap = new Map<string, DoubanItem>();
        
        (json.results || []).forEach((item: any) => {
            const title = item.title || item.name || '';
            const isThai = thaiKeywords.some(keyword => title.includes(keyword));
            
            if (isThai) {
                if (!uniqueMap.has(title)) {
                    uniqueMap.set(title, {
                        id: item.id || '',
                        title: title,
                        poster: item.poster || item.cover || item.pic || '',
                        rate: item.rate || '0.0',
                        year: item.year || ''
                    });
                }
            }
        });
        list = Array.from(uniqueMap.values());
      } 
      else if (custom) {
        const data = await getDoubanList({ tag, type, pageLimit: 25, pageStart });
        if (data.code === 200) list = data.list;
      } else {
        const data = await getDoubanCategories(getRequestParams(pageStart));
        if (data.code === 200) list = data.list;
      }

      setDoubanData(prev => isMore ? [...prev, ...list] : list);
      // 如果获取到了数据，说明可能还有更多，这里设为 true 以触发观察者
      setHasMore(list.length >= 10); 
    } catch (err) {
      console.error("加载数据出错:", err);
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
