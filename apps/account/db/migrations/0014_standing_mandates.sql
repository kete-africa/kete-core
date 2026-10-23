-- A standing mandate (spec 150): a person lets one of the center's agents act for her while she is
-- away — one agent, one client, one organization. Withdrawn, nothing more is signed. Isolated per
-- organization.
CREATE TABLE "standing_mandates" (
  "id" text PRIMARY KEY NOT NULL CHECK ("id" ~ '^smd_'),
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "client_id" text NOT NULL,
  "agent_id" text NOT NULL CHECK ("agent_id" ~ '^agt_[\w-]{1,64}$'),
  "agent_name" text NOT NULL CHECK (length("agent_name") BETWEEN 1 AND 120),
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  CONSTRAINT "standing_mandates_one_per_agent" UNIQUE ("organization_id", "user_id", "client_id", "agent_id")
);
--> statement-breakpoint
ALTER TABLE "standing_mandates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "standing_mandates_isolation" ON "standing_mandates" AS PERMISSIVE FOR ALL TO "account_app" USING (organization_id = current_setting('kete.organization_id', true)) WITH CHECK (organization_id = current_setting('kete.organization_id', true));
