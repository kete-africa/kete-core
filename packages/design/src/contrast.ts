/** WCAG 2.2 relative luminance of a `#RRGGBB` color. */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) throw new Error(`A color is written #RRGGBB: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two colors, from 1 to 21 (WCAG 2.2). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export interface ContrastFailure {
  fg: string;
  bg: string;
  mode?: string;
  ratio: number;
  min: number;
}

/** Which pairs miss their minimum; ratios rounded to two decimals, never rounded up to pass. */
export function checkContrasts(
  colors: Record<string, string>,
  pairs: { fg: string; bg: string; min: number }[],
): ContrastFailure[] {
  return pairs.flatMap(({ fg, bg, min }) => {
    const fgColor = colors[fg];
    const bgColor = colors[bg];
    if (!fgColor || !bgColor) throw new Error(`No color for ${fg} or ${bg}.`);
    const ratio = contrastRatio(fgColor, bgColor);
    return ratio >= min ? [] : [{ fg, bg, ratio: Math.floor(ratio * 100) / 100, min }];
  });
}
