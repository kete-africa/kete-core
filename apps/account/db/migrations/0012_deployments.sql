-- Where an organization's Kete runs (spec 123; phase 11, step B3): its mode, region and apps, its
-- address once ready. One per organization and product, isolated per organization.
CREATE TABLE "deployments" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "product" text NOT NULL CHECK ("product" ~ '^prd_[a-z0-9_]{2,40}$'),
  "mode" text NOT NULL CHECK ("mode" IN ('shared', 'dedicated', 'on_premises', 'autonomous')),
  "region" text NOT NULL CHECK ("region" ~ '^[a-z][a-z0-9-]{1,40}$'),
  "apps" text[] DEFAULT '{}' NOT NULL,
  "status" text DEFAULT 'requested' NOT NULL CHECK ("status" IN ('requested', 'ready')),
  "url" text,
  "requested_mode" text CHECK ("requested_mode" IN ('shared', 'dedicated', 'on_premises', 'autonomous')),
  "requested_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "deployments_one_per_product" UNIQUE ("organization_id", "product"),
  CHECK (("status" = 'ready') = ("url" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "deployments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deployments_isolation" ON "deployments" AS PERMISSIVE FOR ALL TO "account_app" USING (organization_id = current_setting('kete.organization_id', true)) WITH CHECK (organization_id = current_setting('kete.organization_id', true));
