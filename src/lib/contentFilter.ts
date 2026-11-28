/**
 * 简易成人内容标题过滤
 *
 * 影视聚合站的内容全部来自上游第三方资源站，站方没法逐条人工审核，
 * 所以这里对「搜索结果 / 详情接口」做一层标题关键词兜底：
 * 命中就直接不展示，避免有人搜着搜着搜到色情条目。
 *
 * 只匹配明确指向成人内容的中英文词，不碰"色""情""欲"这类单字，
 * 免得把《色，戒》《情书》这种正常电影误杀。
 */
const BLOCKED_KEYWORDS = [
  // 中文
  '色情',
  '情色片',
  '成人影片',
  '成人视频',
  '成人电影',
  '三级片',
  '无码',
  '有码',
  '无修正',
  'av女优',
  '女优',
  '裸体',
  '全裸',
  '性爱',
  '做爱',
  '性交',
  '口交',
  '乱伦',
  '自慰',
  '淫乱',
  '淫妻',
  '约炮',
  '换妻',
  '18禁',
  '十八禁',
  // 英文 / 拼音
  'porn',
  'hentai',
  'jav',
  'avhd',
  'xxx',
  'nsfw',
  'onlyfans',
  'uncensored',
];

/** 标题里明显属于成人内容的判断（大小写、空格、标点都不影响） */
export function isBlockedContent(...texts: Array<string | undefined | null>) {
  const blob = texts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[\s._\-·:：!！?？,，、|/\\()（）[\]【】'"“”]/g, '');
  if (!blob) return false;
  return BLOCKED_KEYWORDS.some((kw) => {
    const key = kw.toLowerCase().replace(/[\s._\-·:：]/g, '');
    // 英文短词必须整词命中，避免 "jav" 命中 "java"、"xxx" 命中正常编号
    if (/^[a-z]+$/.test(key) && key.length <= 4) {
      return new RegExp(`(^|[^a-z])${key}([^a-z]|$)`).test(
        texts.filter(Boolean).join(' ').toLowerCase()
      );
    }
    return blob.includes(key);
  });
}
