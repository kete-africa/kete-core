-- Spec 013 — the Compte Kete by phone number. Identity tables are global (decision 0003).
ALTER TABLE "user" ADD COLUMN "phone_number" text;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_phone_number_unique" UNIQUE ("phone_number");
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_phone_number_e164"
  CHECK ("phone_number" IS NULL OR "phone_number" ~ '^\+[1-9][0-9]{7,14}$');
--> statement-breakpoint
CREATE TABLE "app_sign_in_links" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "return_to" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "app_sign_in_links_user_idx" ON "app_sign_in_links" ("user_id");
