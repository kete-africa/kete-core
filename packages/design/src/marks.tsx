// The marks of the `kete` design: brand elements, drawn in Kete's own palette whatever the design.

/** The K whose leg becomes a root. Decorative: pair it with the word "kete" or an accessible name. */
export function KeteMark({ size = 32, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false">
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <path d="M42 12 L42 64" strokeWidth={14} />
        <path d="M42 58 L90 14" strokeWidth={14} />
        <path d="M42 62 C62 66 82 82 94 108" strokeWidth={12} />
        <path d="M42 64 C42 84 30 94 16 108" strokeWidth={10} />
        <path d="M42 66 C44 86 52 96 54 110" strokeWidth={9} />
      </g>
    </svg>
  );
}

/** The kete band: a strip of rectangular blocks. Never behind text. */
export function KeteBand({ height = 8 }: { height?: number }) {
  const blocks: [string, number][] = [
    ['bg-primary', 8],
    ['bg-ochre', 2],
    ['bg-ink', 5],
    ['bg-root', 3],
    ['bg-primary', 6],
    ['bg-ember', 2],
    ['bg-primary', 9],
  ];
  return (
    <div className="flex" style={{ height }} aria-hidden="true">
      {blocks.map(([color, grow], i) => (
        <div key={i} className={color} style={{ flexGrow: grow }} />
      ))}
    </div>
  );
}
