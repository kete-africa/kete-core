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
  /** The payment provider (Chariow first): API key and the signing secret of its notifications. */
  get payments() {
    return {
      apiKey: required('PAYMENTS_CHARIOW_API_KEY'),
      pulseSecret: required('PAYMENTS_CHARIOW_PULSE_SECRET'),
    };
  },
  /** Object storage of the same Neon branch as the database (decision 0002). */
  get storage() {
    return {
      endpoint: required('ACCOUNT_STORAGE_ENDPOINT'),
      region: required('ACCOUNT_STORAGE_REGION'),
      bucket: required('ACCOUNT_STORAGE_BUCKET'),
      accessKeyId: required('ACCOUNT_STORAGE_ACCESS_KEY_ID'),
      secretAccessKey: required('ACCOUNT_STORAGE_SECRET_ACCESS_KEY'),
    };
  },
};
