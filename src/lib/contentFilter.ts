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
  // 中文：只保留高精度、基本只会出现在成人资源上的词
  '成人影片',
  '成人视频',
  '成人电影',
  '三级片',
  '无码',
  '有码',
  '无修正',
  'av女优',
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

/**
 * 需要区分上下文的词：
 * 「色情 / 情色」本身要拦，但《白色情人节》《血色情欲》《桃色情人》这类
 * 正常片名里也带这两个字，所以只在前一个字不是颜色/氛围字时才拦。
 */
const CONTEXT_PATTERNS = [
  /(?:^|[^白黑蓝血桃粉紫绿黄红灰金银])色情/,
  /(?:^|[^白黑蓝血桃粉紫绿黄红灰])情色/,
];

/** 标题里明显属于成人内容的判断（大小写、空格、标点都不影响） */
export function isBlockedContent(...texts: Array<string | undefined | null>) {
  const blob = texts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[\s._\-·:：!！?？,，、|/\\()（）[\]【】'"“”]/g, '');
  if (!blob) return false;
  if (CONTEXT_PATTERNS.some((re) => re.test(blob))) return true;
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

/**
 * 简介过滤：有些条目标题起得很"干净"，但简介里全是偷拍、洗澡、公寓这类场景词。
 * 单个词很容易误伤正常剧情片（悬疑片也可能写"公寓""浴室"），
 * 所以规则是：命中明确成人词 → 直接拦；命中 2 个以上"可疑场景词" → 也拦。
 */
const SUSPICIOUS_WORDS = [
  '偷拍',
  '偷窥',
  '裙底',
  '更衣室',
  '洗澡',
  '沐浴',
  '公寓',
  '厕所',
  '床上',
  '呻吟',
  '内衣',
  '私密',
  '偷情',
  '开房',
  '一夜情',
  '艳照',
  '桃色',
  '陪睡',
  '潜规则',
  '按摩',
  '裸',
];

// 只放在简介里判断的词：标题里出现这些很可能是正常片名（如《白色情人节》里
// 就含「色情」两个字），但一部正常片的简介不会主动写"色情/情色"，
// 所以放在简介一侧拦，既挡住成人条目又不误杀情人节系列
const DESC_ONLY_WORDS = [
  '色情',
  '情色',
  '艳情',
  'A片',
  '成人片',
  '成人影片',
  '成人内容',
];

export function isBlockedDescription(
  ...texts: Array<string | undefined | null>
) {
  const joined = texts.filter(Boolean).join(' ');
  if (!joined) return false;
  // 明确成人词：简介里出现一个就够
  if (isBlockedContent(joined)) return true;
  if (DESC_ONLY_WORDS.some((w) => joined.includes(w))) return true;
  // 场景词需要同时命中两个，降低对正常剧情简介的误杀
  const hits = SUSPICIOUS_WORDS.filter((w) => joined.includes(w)).length;
  return hits >= 2;
}
