import { canvasIconShapes } from './canvas-icons.gen.js';

// The canvas's icons (spec 108): the validated mockup's own set, drawn as it draws them — 1.6 px
// strokes, round caps, the color of the text. The shapes are this package's constants.

export type CanvasIconName = keyof typeof canvasIconShapes;

/** Whether a name read from data (an app's manifest) is one of the canvas's icons. */
export function isCanvasIconName(name: string): name is CanvasIconName {
  return Object.hasOwn(canvasIconShapes, name);
}

export function CanvasIcon({ name, size = 18 }: { name: CanvasIconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      // Constant shapes of this package, never data.
      dangerouslySetInnerHTML={{ __html: canvasIconShapes[name] }}
    />
  );
}
