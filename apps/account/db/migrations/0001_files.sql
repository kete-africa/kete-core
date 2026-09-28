CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"upload_key" text,
	"content_key" text,
	"content_type" text,
	"size_bytes" integer,
	"sha256" text,
	"width" integer,
	"height" integer,
	"rejection_reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "files_organization_id_id_key" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "logo_file_id" text;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_organization_idx" ON "files" USING btree ("organization_id","purpose","status");--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_logo_file_fk" FOREIGN KEY ("organization_id","logo_file_id") REFERENCES "public"."files"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "files_isolation" ON "files" AS PERMISSIVE FOR ALL TO "account_app" USING (organization_id = current_setting('kete.organization_id', true)) WITH CHECK (organization_id = current_setting('kete.organization_id', true));