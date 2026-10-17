-- A person's preferences (spec 115; decision 0013): her layer of Kete's settings, the same in every
-- Kete app. Identity data, global like the other identity tables (decision 0003).
CREATE TABLE "user_preferences" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "values" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
