import type { Metric, MetricReading } from '@kete/sdk';

// A figure's trend (spec 103): where it went since the period before, toned by whether that is good
// news for this figure — its `better` decides, never the arrow.

/** Where a figure went since the period before, and whether that is good news. */
export interface Trend {
  direction: 'up' | 'down' | 'flat';
  tone: 'good' | 'bad' | 'neutral';
  /** The change as a ratio of the previous value (0.12 for +12 %); null from zero. */
  change: number | null;
}

/** The trend of a reading compared with the period before; null without both values. */
export function trend(reading: MetricReading, better: Metric['better']): Trend | null {
  if (reading.value === null || reading.previous === null || reading.previous === undefined) {
    return null;
  }
  const delta = reading.value - reading.previous;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const tone =
    direction === 'flat' || better === 'none' ? 'neutral' : direction === better ? 'good' : 'bad';
  return {
    direction,
    tone,
    change: reading.previous === 0 ? null : delta / Math.abs(reading.previous),
  };
}
