export default async function handler(req, res) {
  // 1. 設定跨域請求頭 (CORS)，確保 Moon TV 前端能正常調用
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. 獲取傳入的 url 參數
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('缺少 url 參數');
  }

  try {
    // 3. 請求目標圖片，並清空 Referer 以繞過防盜鏈（如豆瓣圖片）
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://www.douban.com', // 偽裝成豆瓣官網來源
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('無法獲取目標圖片');
    }

    // 4. 將圖片轉為 Buffer (二進位數據)
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. 設定響應標頭
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    
    // 設定瀏覽器與 Vercel 邊緣節點緩存 1 天，省流量且第二次載入圖片會一秒秒開！
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=600');

    // 6. 傳回圖片
    res.send(buffer);
  } catch (error) {
    console.error('圖片代理出錯:', error);
    res.status(500).send('圖片代理內部錯誤');
  }
}
