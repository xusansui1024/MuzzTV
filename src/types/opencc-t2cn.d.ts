// opencc-js 的 types 指向 .d.mts，本项目 tsconfig 是 Node16 + CommonJS，
// 直接 import 会报 TS1479（ESM 不能被 require）。这里做本地声明绕过去，
// 打包器（Next/webpack）仍按 ESM 正常加载。
declare module 'opencc-js/t2cn' {
  export function Converter(options?: {
    from?: string;
    to?: string;
  }): (text: string) => string;
}
