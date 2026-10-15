import type { PlaceExtra } from '@kete/design';
import type { Manifest } from '@kete/sdk';

// An app's places come from its manifest (contract manifest.v1, spec 099): the shell builds the
// sidebar, Ctrl K and the phone's tabs from them, in the person's language, keeping only the
// places her permissions open.

export type Lang = 'fr' | 'en';

/** A place as the manifest declares it. */
export type ManifestPlace = NonNullable<Manifest['places']>[number];

/** A place as the shell shows it: in her language, at its full address. */
export interface Place {
  id: string;
  label: string;
  href: string;
  icon?: string;
  /** A project's square in the places, in its color (`true`: the muted one). */
  dot?: string | true;
  /** What it says beside its name: a count, an agent at work, « 1 conflit ». */
  extra?: PlaceExtra;
}

/** Places under one heading, in the manifest's order; the first ones may have none. */
export interface PlaceSection {
  label?: string;
  places: Place[];
}

function join(base: string | undefined, path: string): string {
  if (!base) return path;
  return base.replace(/\/+$/, '') + path;
}

/**
 * The places she may open, grouped by their headings in the manifest's order. A place with a
 * permission shows only when `can` says she holds it; without `can`, such places stay hidden.
 */
export function placesFor(
  places: readonly ManifestPlace[] | undefined,
  options: { lang: Lang; can?: (permission: string) => boolean; base?: string },
): PlaceSection[] {
  const sections: PlaceSection[] = [];
  for (const place of places ?? []) {
    if (place.permission && !(options.can?.(place.permission) ?? false)) continue;
    const heading = place.section?.[options.lang];
    let last = sections.at(-1);
    if (!last || last.label !== heading) {
      last = heading === undefined ? { places: [] } : { label: heading, places: [] };
      sections.push(last);
    }
    last.places.push({
      id: place.id,
      label: place.label[options.lang],
      href: join(options.base, place.path),
      ...(place.icon ? { icon: place.icon } : {}),
    });
  }
  return sections;
}

/** Every place, in order, without its heading: for Ctrl K and the phone's tabs. */
export function allPlaces(sections: readonly PlaceSection[]): Place[] {
  return sections.flatMap((section) => section.places);
}
