import { normalizeTitle } from './normalizeTitle';

describe('normalizeTitle', () => {
  it('去除括号后缀（中文/英文/方括号）', () => {
    expect(normalizeTitle('千与千寻[电影解说]')).toBe('千与千寻');
    expect(normalizeTitle('千与千寻[影视解说]')).toBe('千与千寻');
    expect(normalizeTitle('千与千寻(日语版)')).toBe('千与千寻');
    expect(normalizeTitle('千与千寻（高清修复）')).toBe('千与千寻');
  });

  it('去除版本/语言/清晰度后缀', () => {
    expect(normalizeTitle('千与千寻普通话版')).toBe('千与千寻');
    expect(normalizeTitle('千与千寻中文字幕')).toBe('千与千寻');
    expect(normalizeTitle('千与千寻完整版')).toBe('千与千寻');
    expect(normalizeTitle('千与千寻1080P')).toBe('千与千寻');
    expect(normalizeTitle('千与千寻电影解说')).toBe('千与千寻');
  });

  it('去除日文副标题', () => {
    expect(normalizeTitle('千与千寻 千と千尋の神隠し')).toBe('千与千寻');
    expect(normalizeTitle('千与千寻 千と千尋の神隠し 高清')).toBe('千与千寻');
  });

  it('去除空白（含全角空格）', () => {
    expect(normalizeTitle('千 与 千 寻')).toBe('千与千寻');
    expect(normalizeTitle('千与千寻　日语版')).toBe('千与千寻');
  });

  it('英文标题转小写去空格', () => {
    expect(normalizeTitle('Spirited Away')).toBe('spiritedaway');
  });

  it('去除标点（哈利·波特 与 哈利波特 归并）', () => {
    expect(normalizeTitle('哈利·波特')).toBe('哈利波特');
    expect(normalizeTitle('千与千寻：神隐少女')).toBe('千与千寻神隐少女');
  });

  it('空输入安全', () => {
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle('  ')).toBe('');
  });
});
