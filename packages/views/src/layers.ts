import type { View } from '@kete/sdk';
import { validateView } from '@kete/sdk';

// Where a view's configuration comes from (spec 145; ADR 0016; D-060's order of layers): the app's
// default for a place, the organization's, a position's, the person's own version. The most precise
// wins, whole — a configuration is never merged field by field, so what a person sees is one
// version someone made, which can be named, compared and undone.

export type ViewLevel = 'app' | 'organization' | 'position' | 'person';
const ORDER: readonly ViewLevel[] = ['person', 'position', 'organization', 'app'];

export interface ViewLayer {
  level: ViewLevel;
  view: View;
  /** Its version at that level: each change keeps the one before (R16). */
  version: number;
}

/** The view a place shows her: the most precise layer that holds one, and which it is. */
export function resolveView(layers: readonly ViewLayer[]): ViewLayer | null {
  for (const level of ORDER) {
    const found = layers.find((layer) => layer.level === level);
    if (found) return found;
  }
  return null;
}

/** A configuration that breaks view.v1 is refused where it is written, never where it is drawn. */
export function checkView(
  view: unknown,
): { ok: true; view: View } | { ok: false; errors: string[] } {
  const checked = validateView(view);
  return checked.ok ? { ok: true, view: view as View } : { ok: false, errors: checked.errors };
}

/** The axes a place binds, as a figure's filter: this object's, this unit, me. */
export function boundFilter(
  view: Pick<View, 'context'>,
  place: {
    project_id?: string;
    party_id?: string;
    unit_id?: string;
    person_id?: string;
    object_id?: string;
  },
): Record<string, string> {
  const context = new Set(view.context ?? []);
  const filter: Record<string, string> = {};
  if (context.has('project') && place.project_id) filter['project_id'] = place.project_id;
  if (context.has('party') && place.party_id) filter['party_id'] = place.party_id;
  if (context.has('unit') && place.unit_id) filter['unit_id'] = place.unit_id;
  if (context.has('me') && place.person_id) filter['person_id'] = place.person_id;
  if (context.has('object') && place.object_id) filter['object_id'] = place.object_id;
  return filter;
}
