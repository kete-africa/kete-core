function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see apps/account/.env.example).`);
  return value;
}

/** Read lazily so importing a module never fails at build time. */
export const env = {
  /** Application role, without BYPASSRLS. */
  get databaseUrl() {
    return required('ACCOUNT_DATABASE_URL');
  },
  get authSecret() {
    return required('BETTER_AUTH_SECRET');
  },
  /** The public origin of the Compte Kete, e.g. https://compte.kete.africa */
  get publicUrl() {
    return required('BETTER_AUTH_URL');
  },
};
