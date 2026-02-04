export function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  const int = parseInt(h, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255, 255];
}

export function rgbaToHex([r, g, b]: number[]) {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
    .join('')}`;
}
