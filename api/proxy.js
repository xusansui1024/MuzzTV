export default async function handler(req, res) {
  // 1. 设置跨域响应头 (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. 健壮地获取目标 URL (通过 URL API 解析，彻底解决参数截断问题)
  const baseUrl = `http://${req.headers.host}`;
  const fullUrl = new URL(req.url, baseUrl);
  const targetUrl = fullUrl.searchParams.get('url');

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // 3. 构造请求头，注入伪装信息
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  try {
    const urlObj = new URL(targetUrl);

    // 针对豆瓣的特殊防盗链处理
    if (urlObj.hostname.includes('douban')) {
      headers['Referer'] = 'https://www.douban.com/';
      headers['Origin'] = 'https://www.douban.com/';
    }

    // 4. 设置请求超时控制器 (8秒超时)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // 5. 执行代理请求
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: headers,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Target returned ${response.status}`);
    }

    // 6. 传递响应头
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800');

    // 7. 处理响应体
    if (contentType.includes('json') || contentType.includes('text')) {
      const text = await response.text();
      return res.status(200).send(text);
    } else {
      const arrayBuffer = await response.arrayBuffer();
      return res.status(200).send(Buffer.from(arrayBuffer));
    }

  } catch (error) {
    console.error('Proxy Error for:', targetUrl, error);
    return res.status(500).json({
      error: 'Proxy failed',
      message: error.name === 'AbortError' ? 'Request timed out' : error.message
    });
  }
}
