/** Font-independent paths shared by the UI and generated launcher icons. */
export const pocketMark = {
  outline: "M108 150H404L387 333C383 369 327 400 256 424C185 400 129 369 125 333Z",
  seam: "M137 183H375M139 208L152 329C154 348 204 380 256 397C308 380 358 348 360 329L373 208",
  letter: "M207 227C198 260 197 300 210 316C216 323 227 313 237 297M294 231C311 247 321 271 322 293",
};
export function pocketIconSvg(){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>いこポケ</title><rect width="512" height="512" fill="#fff5e7"/><g stroke-linecap="round" stroke-linejoin="round"><path d="${pocketMark.outline}" fill="#ffae45" stroke="#202124" stroke-width="10"/><path d="${pocketMark.seam}" fill="none" stroke="#8b4b00" stroke-width="4" stroke-dasharray="5 10"/><path d="${pocketMark.letter}" fill="none" stroke="#202124" stroke-width="18"/></g></svg>`;
}
