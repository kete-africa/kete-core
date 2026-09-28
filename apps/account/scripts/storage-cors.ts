/**
 * Lets browsers send files straight to this branch's bucket from the Compte Kete's origins, and
 * nowhere else. Idempotent. ACCOUNT_STORAGE_CORS_ORIGINS: comma-separated origins.
 */
import { PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

const origins = required('ACCOUNT_STORAGE_CORS_ORIGINS')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
for (const origin of origins) {
  if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error(`Not an origin: ${origin}`);
}

const client = new S3Client({
  endpoint: required('ACCOUNT_STORAGE_ENDPOINT'),
  region: required('ACCOUNT_STORAGE_REGION'),
  forcePathStyle: true,
  credentials: {
    accessKeyId: required('ACCOUNT_STORAGE_ACCESS_KEY_ID'),
    secretAccessKey: required('ACCOUNT_STORAGE_SECRET_ACCESS_KEY'),
  },
});

await client.send(
  new PutBucketCorsCommand({
    Bucket: required('ACCOUNT_STORAGE_BUCKET'),
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: origins,
          AllowedMethods: ['PUT', 'GET'],
          AllowedHeaders: ['content-type'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
console.log(`Storage CORS set for ${origins.join(', ')}.`);
