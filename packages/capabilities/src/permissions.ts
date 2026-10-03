// Permissions (kete-core spec 049): what an app checks, declared once with its words for people and
// the Compte Kete roles that hold it by default. The manifest describes them; a center (Kete
// Enterprise) lets an administrator grant them to roles and positions, and the app reads the
// person's grants from it. Without a center, or until it manages the app, the defaults apply.

export type Role = 'owner' | 'admin' | 'member';

/** Words in each language of Kete: French and English. */
export interface Words {
  fr: string;
  en: string;
}

export interface PermissionDefinition {
  /** `feature:verb`: `tickets:manage`. */
  name: string;
  /** What it allows, for an administrator ticking it. */
  label: Words;
  description?: Words;
  /** The Compte Kete roles that hold it when no center manages the app's rights. */
  roles: Role[];
}

/** What a center answers about a person, for one app. */
export interface Grants {
  /**
   * Whether the organization manages this app's rights at the center: once a role there carries
   * one of its permissions. Until then, the app keeps its defaults.
   */
  managed: boolean;
  /** What she holds for the app, and where (a unit and its subtree, or everywhere). */
  permissions: { permission: string; everywhere: boolean; units: string[] }[];
}

const pattern = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;

/** Declares an app's permissions; checked once, at start-up. */
export function definePermissions(
  list: readonly PermissionDefinition[],
): readonly PermissionDefinition[] {
  const seen = new Set<string>();
  for (const permission of list) {
    if (!pattern.test(permission.name)) {
      throw new Error(`A permission reads « feature:verb »: ${permission.name}`);
    }
    if (seen.has(permission.name)) throw new Error(`Declared twice: ${permission.name}`);
    seen.add(permission.name);
    if (!permission.label.fr.trim() || !permission.label.en.trim()) {
      throw new Error(`${permission.name} needs its label in French and in English.`);
    }
  }
  return list;
}

/** The permissions as the manifest describes them (`manifest.v1`, `permissions`). */
export function describePermissions(list: readonly PermissionDefinition[]) {
  return list.map((p) => ({
    name: p.name,
    label: p.label,
    ...(p.description ? { description: p.description } : {}),
    roles: p.roles,
  }));
}

export interface RightsOptions {
  permissions: readonly PermissionDefinition[];
  /**
   * The person's grants at the center, read with her token; null when there is no center, it does
   * not answer, or refuses the token. Caching is the caller's (see `@kete/center`).
   */
  grants?: (token: string) => Promise<Grants | null>;
  /** How long the last grants known for a person stand in when the center is silent (24 h). */
  lastKnownSeconds?: number;
  now?: () => number;
}

/** A person, as the rights need her: who she is, and her Compte Kete role. */
export interface RightsPerson {
  userId: string;
  role: Role | null;
}

export interface Rights {
  /**
   * What the person holds in this app: the center's grants once it manages them; when it is
   * silent, the last grants known for her; otherwise the defaults of her role.
   */
  permissionsOf(person: RightsPerson | null, token?: string | null): Promise<Set<string>>;
  /** The defaults of a Compte Kete role. */
  defaultsOf(role: Role | null): Set<string>;
}

export function createRights(options: RightsOptions): Rights {
  const declared = new Set(options.permissions.map((p) => p.name));
  const byRole = new Map<Role, Set<string>>(
    (['owner', 'admin', 'member'] as const).map((role) => [
      role,
      new Set(options.permissions.filter((p) => p.roles.includes(role)).map((p) => p.name)),
    ]),
  );
  const now = options.now ?? Date.now;
  const lastKnownFor = (options.lastKnownSeconds ?? 86_400) * 1000;
  // A token another app or a copilot holds may be one the center refuses: the person's last
  // grants stand in, so that a right withdrawn at the center stays withdrawn everywhere.
  const lastKnown = new Map<string, { at: number; grants: Grants }>();
  const defaultsOf = (role: Role | null) => new Set(role ? byRole.get(role) : []);

  function held(grants: Grants): Set<string> {
    // Only what the app declares: a center never adds a permission the app does not know.
    return new Set(
      grants.permissions
        .filter((g) => g.everywhere || g.units.length > 0)
        .map((g) => g.permission)
        .filter((p) => declared.has(p)),
    );
  }

  return {
    defaultsOf,
    async permissionsOf(person, token) {
      if (!person) return new Set();
      const fresh = options.grants && token ? await options.grants(token).catch(() => null) : null;
      if (fresh) {
        if (lastKnown.size >= 5000) lastKnown.delete(lastKnown.keys().next().value as string);
        lastKnown.set(person.userId, { at: now(), grants: fresh });
      }
      const known = lastKnown.get(person.userId);
      const grants = fresh ?? (known && now() - known.at < lastKnownFor ? known.grants : null);
      return grants?.managed ? held(grants) : defaultsOf(person.role);
    },
  };
}
