export default async function handler(req, res) {
  // 1. 设置跨域响应头 (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. 健壮地获取目标 URL (防止 URL 中的参数导致截断)
  // 使用 split 确保获取到 ?url= 之后的所有内容，再进行解码
  const urlParam = req.url.split('?url=')[1];
  if (!urlParam) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  const targetUrl = decodeURIComponent(urlParam);

  try {
    const urlObj = new URL(targetUrl);

    // 3. 构造请求头，仅透传必要的 Header，并注入伪装信息
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // 4. 针对豆瓣的特殊防盗链处理
    if (urlObj.hostname.includes('douban')) {
      headers['Referer'] = 'https://www.douban.com/';
      headers['Origin'] = 'https://www.douban.com/';
    }

    // 5. 执行代理请求
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(`Target returned ${response.status}`);
    }

    // 6. 传递响应头
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    // 强制缓存：1周 (节省流量)
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800');

    // 7. 处理响应体 (图片用 Buffer，其他用 Text)
    if (contentType.includes('json') || contentType.includes('text')) {
      const text = await response.text();
      return res.status(200).send(text);
    } else {
      const arrayBuffer = await response.arrayBuffer();
      return res.status(200).send(Buffer.from(arrayBuffer));
    }

  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({
      error: 'Proxy failed',
      message: error.message
    });
  }
}
