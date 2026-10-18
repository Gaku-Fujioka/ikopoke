export const GROUP_COLORS = {
  // Persisted keys remain compatible; the old apricot slot is now berry, not orange.
  apricot: { label: "ベリー", fill: "#fce0e4", mark: "#b72f42" },
  lemon: { label: "レモン", fill: "#fff2aa", mark: "#927500" },
  mint: { label: "ミント", fill: "#dcefdc", mark: "#2d8050" },
  sky: { label: "空色", fill: "#dfebff", mark: "#3569b5" },
  aqua: { label: "ソーダ", fill: "#d5f2f4", mark: "#007d8f" },
  rose: { label: "さくら", fill: "#f8ddf1", mark: "#ac478e" },
  lilac: { label: "ライラック", fill: "#eae1fb", mark: "#7957ad" },
  sand: { label: "スレート", fill: "#e4e8ee", mark: "#5b6572" },
} as const;
export type GroupColor = keyof typeof GROUP_COLORS;
export function isGroupColor(value: unknown): value is GroupColor {
  return typeof value === "string" && Object.hasOwn(GROUP_COLORS, value);
}
export function groupColorStyle(color?: string | null) {
  const selected = GROUP_COLORS[isGroupColor(color) ? color : "sky"];
  return { "--kk-group-fill": selected.fill, "--kk-group-mark": selected.mark, "--kk-tone":selected.mark, "--kk-tint":selected.fill };
}
export function isProfilePath(value: unknown): value is string {
  return typeof value === "string" && /^profile-(avatar|cover)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(value);
}
