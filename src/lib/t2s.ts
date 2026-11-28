import { Converter } from 'opencc-js/t2cn';

// 繁体（台湾用词）→ 简体（大陆用词），例如 網路→网络、軟體→软件
const convert = Converter({ from: 'twp', to: 'cn' });

/** 把搜索框里的繁体字自动转成简体，非汉字原样保留 */
export function toSimplified(text: string) {
  if (!text) return text;
  try {
    return convert(text);
  } catch {
    return text;
  }
}
