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

type DisplayItem = DoubanItem & { isGroup?: boolean; groupItems?: DoubanItem[] };

const getUniqueKey = (item: any) => {
  return item.id ? item.id : `${(item.title || item.name || '').trim()}_${item.year || '0'}`;
};

const getGroupKey = (item: any) => {
  return (item.title || item.name || '').toLowerCase().replace(/[\(\（].*?[\)\）]|[\d\s\-\:]/g, '').trim();
};

function DoubanPageClient() {
  const searchParams = useSearchParams();
  const [doubanData, setDoubanData] = useState<DisplayItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DisplayItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectorsReady, setSelectorsReady] = useState(false);
  
  const type = searchParams.get('type') || 'movie';
  const tag = searchParams.get('tag') || '';
  const custom = searchParams.get('custom') === 'true';
  const name = searchParams.get('name') || '';

  const [primarySelection, setPrimarySelection] = useState<string>(() => type === 'movie' ? '热门' : '');
  const [secondarySelection, setSecondarySelection] = useState<string>('全部');

  // 获取数据
  const fetchData = useCallback(async (pageStart: number, isMore: boolean) => {
    try {
      setLoading(!isMore);
      let rawList: DoubanItem[] = [];

      if (secondarySelection === 'tv_Thailand') {
        const keywords = ['泰剧', '泰国', 'Thai','禁忌女孩','黑帮少爷爱上我'];
        const pg = Math.floor(pageStart / 25) + 1;
        const results = await Promise.all(keywords.map(kw => fetch(`/api/search?q=${encodeURIComponent(kw)}&pg=${pg}`).then(r => r.json())));
        rawList = results.flatMap(r => r.results || r.list || []);
      } else if (custom) {
        const data = await getDoubanList({ tag, type, pageLimit: 25, pageStart });
        rawList = data.code === 200 ? data.list : [];
      } else {
        const data = await getDoubanCategories({ 
            kind: (type === 'tv' || type === 'show') ? 'tv' : 'movie', 
            category: type === 'movie' ? 'movie' : (type === 'tv' || type === 'show' ? type : primarySelection), 
            type: secondarySelection, 
            pageLimit: 25, 
            pageStart 
        });
        rawList = data.code === 200 ? data.list : [];
      }

      // 强力过滤名单
      const blacklist = ['AFC', '锦标赛', '足球', '比赛', '亚足联', '预选赛', '世界杯', 'Logo', '积分榜', '女足', 'NBA', '亚洲杯', '泰国性痴迷', '亚运会', '男足', '回放', '世预赛', '世预亚','狂野泰国','冲游泰国','到了30岁还是处男','男足', '亚残运会', '泰国大象医院', '冲遊泰国', '野性泰国','T台新面孔', '泰国72小时粤语', '觉醒眼神后', '幸存者', '空中看泰国', '南洋大宝荐', '短剧', '爽文', '微剧','LoveLive', 'Sunshine', '宝石宠物', '二次元', '动漫', '动画', '剧场版','REBD', '写真', 'JAV', 'AV', '无码', '有码', 'Adult', 'Yuria', 'Yui3', 'Towa'];
      
      const filteredList = rawList.filter(item => !blacklist.some(kw => (item.title || '').includes(kw)));

      // 分组逻辑
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
    } finally {
      setLoading(false);
    }
  }, [type, secondarySelection, tag, custom, primarySelection]);

  useEffect(() => {
    setSelectorsReady(true);
    fetchData(0, false);
  }, [type, tag, custom, primarySelection, secondarySelection, fetchData]);

  return (
    <PageLayout activePath={`/douban?type=${type}&tag=${tag}`}>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
          {doubanData.map((item, i) => (
            <div key={`${item.id}-${i}`} className="relative cursor-pointer transition-transform hover:scale-105" 
                onClick={(e) => {
                    if (item.isGroup) {
                        e.preventDefault(); // 阻止原本的链接跳转
                        e.stopPropagation(); // 阻止事件冒泡到 VideoCard 内部
                        setSelectedGroup(item);
                    }
                }}>
               
               <VideoCard from='douban' title={item.title} poster={item.poster} douban_id={item.id} rate={item.rate} year={item.year} type={type === 'movie' ? 'movie' : ''} />
               
               {item.isGroup && (
                 <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-md pointer-events-none">
                   {item.groupItems?.length} 版本
                 </div>
               )}
            </div>
          ))}
        </div>

        {/* 弹窗部分 */}
        {selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedGroup(null)}>
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
