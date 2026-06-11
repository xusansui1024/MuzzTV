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

// 扩展类型，支持分组显示
type DisplayItem = DoubanItem & { isGroup?: boolean; groupItems?: DoubanItem[] };

// 唯一指纹：用于最终列表的硬去重
const getUniqueKey = (item: any) => {
  return item.id ? item.id : `${(item.title || item.name || '').trim()}_${item.year || '0'}`;
};

// 分组聚合键：提取标题核心，将同名/不同版本的剧集聚类
const getGroupKey = (item: any) => {
  return (item.title || item.name || '').toLowerCase().replace(/[\(\（].*?[\)\）]|[\d\s\-\:]|hd|高清|未删减|泰版|粤语|日语|韩语|美剧/g, '').trim();
};

function DoubanPageClient() {
  const searchParams = useSearchParams();
  const [doubanData, setDoubanData] = useState<DisplayItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DisplayItem | null>(null); // 控制弹窗
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

      let rawList: DoubanItem[] = [];

      // 1. 获取基础数据
      if (secondarySelection === 'tv_Thailand') {
        const keywords = ['泰剧', '泰国', 'Thai', '禁忌女孩', '天生一对', '以你的心诠释我的爱', '黑帮少爷爱上我', '绝庙骗局'];
        const pg = Math.floor(pageStart / 25) + 1;
        const results = await Promise.all(keywords.map(kw => fetch(`/api/search?q=${encodeURIComponent(kw)}&pg=${pg}`).then(r => r.json())));
        rawList = results.flatMap(r => r.results || r.list || []);
      } else if (custom) {
        const data = await getDoubanList({ tag, type, pageLimit: 25, pageStart });
        if (data.code === 200) rawList = data.list;
      } else {
        const data = await getDoubanCategories(getRequestParams(pageStart));
        if (data.code === 200) rawList = data.list;
      }

      // 2. 全局清洗：强制对齐所有数据的封面字段，修复封面丢失问题
      rawList.forEach((item: any) => {
          item.poster = item.poster || item.cover || item.pic || item.thumbnail || '';
      });

      // 3. 全局黑名单过滤（应用到所有分类，而不仅仅是泰剧）
      const blacklist = ['AFC', '锦标赛', '足球', '比赛', '亚足联', '预选赛', '世界杯', 'Logo', '积分榜', '女足', 'NBA', '亚洲杯', '泰国性痴迷', '亚运会', '男足', '回放', '世预赛', '世预亚','狂野泰国','冲游泰国','到了30岁还是处男','男足', '亚残运会', '泰国大象医院', '冲遊泰国', '野性泰国','T台新面孔', '泰国72小时粤语', '觉醒眼神后', '幸存者', '空中看泰国', '南洋大宝荐', '短剧', '爽文', '微剧','LoveLive', 'Sunshine', '宝石宠物', '二次元', '动漫', '动画', '剧场版','REBD', '写真', 'JAV', 'AV', '无码', '有码', 'Adult', 'Yuria', 'Yui3', 'Towa'];
      const filteredList = rawList.filter(item => {
          const title = item.title || item.name || '';
          return !blacklist.some(kw => title.includes(kw));
      });

      // 4. 同名聚合分组逻辑
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

      // 5. 更新状态并处理分页
      setDoubanData(prev => {
          const combined = isMore ? [...prev, ...processedList] : processedList;
          // 最后通过 ID 进行一次硬去重，防止分页重叠
          const finalMap = new Map();
          combined.forEach(item => finalMap.set(getUniqueKey(item), item));
          return Array.from(finalMap.values()).sort((a, b) => parseInt(b.year || '0') - parseInt(a.year || '0'));
      });
      
      setHasMore(rawList.length > 0);
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
          {(loading && doubanData.length === 0) ? Array.from({ length: 10 }, (_, i) => <DoubanCardSkeleton key={i} />)
            : doubanData.map((item, i) => (
                <div key={`${item.id}-${i}`} className="relative group transition-transform hover:scale-105">
                   
                   {/* 遮罩拦截层：只要是分组节点，这层透明遮罩会吞掉一切点击事件，不让子元素跳转 */}
                   {item.isGroup && (
                     <div 
                       className="absolute inset-0 z-50 cursor-pointer" 
                       onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         setSelectedGroup(item);
                       }}
                     />
                   )}
                   
                   {/* 原生卡片渲染区 */}
                   <div className={item.isGroup ? "pointer-events-none" : ""}>
                     <VideoCard from='douban' title={item.title} poster={item.poster} douban_id={item.id} rate={item.rate} year={item.year} type={type === 'movie' ? 'movie' : ''} />
                   </div>
                   
                   {/* 分组标识角标 */}
                   {item.isGroup && (
                     <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-md z-10 pointer-events-none">
                       {item.groupItems?.length} 版本
                     </div>
                   )}
                </div>
              ))
          }
        </div>

        {/* 聚合弹窗层 */}
        {selectedGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedGroup(null)}>
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

        {hasMore && !loading && <div ref={loadingRef} className='h-20' />}
        {!loading && doubanData.length === 0 && <div className='text-center py-20'>暂无相关内容</div>}
      </div>
    </PageLayout>
  );
}

export default function DoubanPage() { return <Suspense><DoubanPageClient /></Suspense>; }
