// The icons the canvas v6.2 added (spec 140; doctrine D-061), drawn as the v3.1 set: the inner
// shapes of a 24 × 24 view, 1.6 px strokes, round caps. Constants of this package, never data.

export const canvasIconShapesV6 = {
  hash: '<path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"/>',
  smile:
    '<circle cx="12" cy="12" r="8"/><path d="M9 14c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5M9.5 10h.01M14.5 10h.01"/>',
  image:
    '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m5 18 5-5 3 3 2-2 4 4"/>',
  reply: '<path d="M10 7 5 12l5 5"/><path d="M5 12h9a5 5 0 0 1 5 5v1"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  whatsapp: '<path d="M5 19l1.3-3.6A7 7 0 1 1 9 18.5z"/>',
  merge: '<path d="M6 4v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v4"/><path d="M18 4v4a4 4 0 0 1-4 4"/>',
  import: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 14v6h14v-6"/>',
  route:
    '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-7 7 6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
} as const;
