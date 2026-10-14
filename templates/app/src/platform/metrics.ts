import { defineMetrics } from '@kete/metrics/server';
import { taskMetrics } from '@/features/tasks/metrics';

/**
 * Every figure the app declares in kete.json (kete-core spec 103), computed by its features: the
 * center's boards, the app's home and the summaries read them at /api/metrics, under the reader's
 * rights.
 */
export const metrics = defineMetrics([...taskMetrics]);
