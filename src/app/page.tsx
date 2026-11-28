/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */
'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import Announcement from '@/components/Announcement';
import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

function HomeClient() {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);
  const { announcement } = useSite();

  // 获取首页热门数据
  useEffect(() => {
    const fetchDoubanData = async () => {
      try {
        setLoading(true);
        const [moviesData, tvShowsData, varietyShowsData] = await Promise.all([
          getDoubanCategories({
            kind: 'movie',
            category: '热门',
            type: '全部',
          }),
          getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
          getDoubanCategories({ kind: 'tv', category: 'show', type: 'show' }),
        ]);
        if (moviesData.code === 200) setHotMovies(moviesData.list);
        if (tvShowsData.code === 200) setHotTvShows(tvShowsData.list);
        if (tvShowsData.code === 200) setHotVarietyShows(varietyShowsData.list);
      } catch (error) {
        console.error('获取豆瓣数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoubanData();
  }, []);

  // 收藏相关逻辑
  const updateFavoriteItems = async (allFavorites: Record<string, any>) => {
    const allPlayRecords = await getAllPlayRecords();
    const sorted = Object.entries(allFavorites)
      .sort(([, a]: any, [, b]: any) => b.save_time - a.save_time)
      .map(([key, fav]: any) => {
        const plusIndex = key.indexOf('+');
        return {
          id: key.slice(plusIndex + 1),
          source: key.slice(0, plusIndex),
          title: fav.title,
          poster: fav.cover,
          episodes: fav.total_episodes,
          source_name: fav.source_name,
          currentEpisode: allPlayRecords[key]?.index,
          search_title: fav?.search_title,
        };
      });
    setFavoriteItems(sorted);
  };

  useEffect(() => {
    if (activeTab !== 'favorites') return;
    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };
    loadFavorites();
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      updateFavoriteItems
    );
    return unsubscribe;
  }, [activeTab]);

  return (
    <PageLayout>
      {/* 只有这一行是必须的，它会自动判断是否显示 */}
      <Announcement announcement={announcement} />

      <div className='px-2 sm:px-10 py-4 sm:py-8 overflow-visible'>
        <div className='mb-8 flex justify-center' data-tv-hide='1'>
          <CapsuleSwitch
            options={[
              { label: '首页', value: 'home' },
              { label: '收藏夹', value: 'favorites' },
            ]}
            active={activeTab}
            onChange={(value) => setActiveTab(value as 'home' | 'favorites')}
          />
        </div>

        <div className='max-w-[95%] mx-auto'>
          {activeTab === 'favorites' ? (
            <section className='mb-8'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                  我的收藏
                </h2>
                {favoriteItems.length > 0 && (
                  <button
                    className='text-sm text-gray-500 hover:text-gray-700'
                    onClick={async () => {
                      await clearAllFavorites();
                      setFavoriteItems([]);
                    }}
                  >
                    清空
                  </button>
                )}
              </div>
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'>
                {favoriteItems.map((item) => (
                  <div key={item.id + item.source} className='w-full'>
                    <VideoCard
                      query={item.search_title}
                      {...item}
                      from='favorite'
                      type={item.episodes > 1 ? 'tv' : ''}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <>
              <ContinueWatching />
              {/* 这里恢复了原本的首页电影渲染 */}
              {[
                { title: '热门电影', data: hotMovies, type: 'movie' },
                { title: '热门剧集', data: hotTvShows, type: 'tv' },
                { title: '热门综艺', data: hotVarietyShows, type: 'show' },
              ].map((section, idx) => (
                <section key={idx} className='mb-8'>
                  <div className='mb-4 flex items-center justify-between'>
                    <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                      {section.title}
                    </h2>
                    <Link
                      href={`/douban?type=${section.type}`}
                      className='flex items-center text-sm text-gray-500 hover:text-gray-700'
                    >
                      查看更多 <ChevronRight className='w-4 h-4 ml-1' />
                    </Link>
                  </div>
                  <ScrollableRow>
                    {loading
                      ? Array.from({ length: 8 }).map((_, i) => (
                          <div
                            key={i}
                            className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44 h-60 bg-gray-200 rounded-lg animate-pulse'
                          ></div>
                        ))
                      : section.data.map((item, i) => (
                          <div
                            key={i}
                            className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                          >
                            <VideoCard
                              from='douban'
                              title={item.title}
                              poster={item.poster}
                              douban_id={item.id}
                              rate={item.rate}
                              year={item.year}
                              type={section.type}
                            />
                          </div>
                        ))}
                  </ScrollableRow>
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
