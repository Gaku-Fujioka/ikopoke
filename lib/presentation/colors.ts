export const GROUP_COLORS = {
  apricot: { label: "あんず", fill: "#ffe7c5", mark: "#b97825" },
  lemon: { label: "レモン", fill: "#fff1b8", mark: "#9c8116" },
  mint: { label: "ミント", fill: "#dff0df", mark: "#5e916a" },
  sky: { label: "空色", fill: "#dfeeff", mark: "#668fbc" },
  aqua: { label: "ソーダ", fill: "#d9f1ee", mark: "#408f88" },
  rose: { label: "さくら", fill: "#fce3e6", mark: "#bb7383" },
  lilac: { label: "ライラック", fill: "#eee5fa", mark: "#9776b3" },
  sand: { label: "サンド", fill: "#ece9e2", mark: "#8b8271" },
} as const;
export type GroupColor = keyof typeof GROUP_COLORS;
export function isGroupColor(value: unknown): value is GroupColor {
  return typeof value === "string" && Object.hasOwn(GROUP_COLORS, value);
}
export function groupColorStyle(color?: string | null) {
  const selected = GROUP_COLORS[isGroupColor(color) ? color : "sky"];
  return { "--kk-group-fill": selected.fill, "--kk-group-mark": selected.mark };
}
export function isProfilePath(value: unknown): value is string {
  return typeof value === "string" && /^profile-(avatar|cover)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(value);
}
