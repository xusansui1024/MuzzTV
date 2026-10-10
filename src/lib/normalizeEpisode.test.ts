import {
  normalizeEpisodeUrl,
  parseAndNormalizePlayUrls,
} from './normalizeEpisode';

describe('normalizeEpisodeUrl', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('保留已是 .m3u8 结尾的直链', async () => {
    const url = 'https://cdn.example.com/20250101/123_abc/index.m3u8';
    expect(await normalizeEpisodeUrl(url)).toBe(url);
  });

  it('保留 .mp4 直链', async () => {
    const url = 'https://cdn.example.com/movie.mp4';
    expect(await normalizeEpisodeUrl(url)).toBe(url);
  });

  it('播放器壳页地址补全为 /index.m3u8', async () => {
    const pageUrl = 'https://hd.kuktxu.com/play/PdyYo8Wd';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/vnd.apple.mpegurl' },
    }) as unknown as typeof fetch;
    expect(await normalizeEpisodeUrl(pageUrl)).toBe(
      'https://hd.kuktxu.com/play/PdyYo8Wd/index.m3u8'
    );
  });

  it('壳页地址补全失败时保留原地址', async () => {
    const pageUrl = 'https://hd.kuktxu.com/play/abc';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      headers: { get: () => 'text/html' },
    }) as unknown as typeof fetch;
    expect(await normalizeEpisodeUrl(pageUrl)).toBe(pageUrl);
  });

  it('网络异常时保留原地址', async () => {
    const pageUrl = 'https://hd.kuktxu.com/play/abc';
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('timeout')) as unknown as typeof fetch;
    expect(await normalizeEpisodeUrl(pageUrl)).toBe(pageUrl);
  });

  it('非 http 地址原样返回', async () => {
    const url = 'rtmp://cdn.example.com/live';
    expect(await normalizeEpisodeUrl(url)).toBe(url);
  });
});

describe('parseAndNormalizePlayUrls', () => {
  it('max 模式：解析多播放源并取集数最多的一组，去重', async () => {
    const vodPlayUrl =
      '第01集$https://cdn.example.com/1/index.m3u8#第02集$https://cdn.example.com/2/index.m3u8$$$源2$https://cdn.example.com/1/index.m3u8';
    const urls = await parseAndNormalizePlayUrls(vodPlayUrl, 'max');
    expect(urls).toEqual([
      'https://cdn.example.com/1/index.m3u8',
      'https://cdn.example.com/2/index.m3u8',
    ]);
  });

  it('first 模式：只返回第一个播放源', async () => {
    const vodPlayUrl =
      '第01集$https://cdn.example.com/a/index.m3u8$$$源2$https://cdn.example.com/1/index.m3u8#第02集$https://cdn.example.com/2/index.m3u8';
    const urls = await parseAndNormalizePlayUrls(vodPlayUrl, 'first');
    expect(urls).toEqual(['https://cdn.example.com/a/index.m3u8']);
  });

  it('播放器壳页地址被归一化', async () => {
    const vodPlayUrl =
      '正片$https://hd.kuktxu.com/play/PdyYo8Wd$$$备用$https://hd.kuktxu.com/play/PdyYo8Wd/index.m3u8';
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/vnd.apple.mpegurl' },
    }) as unknown as typeof fetch;
    const urls = await parseAndNormalizePlayUrls(vodPlayUrl, 'max');
    global.fetch = originalFetch;
    expect(urls).toEqual(['https://hd.kuktxu.com/play/PdyYo8Wd/index.m3u8']);
  });
});
