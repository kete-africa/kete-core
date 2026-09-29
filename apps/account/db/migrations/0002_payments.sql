CREATE TABLE "checkouts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_sale_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expected_value" numeric(14, 2) NOT NULL,
	"expected_currency" text NOT NULL,
	"checkout_url" text,
	"period_end" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "checkouts_provider_sale_id_unique" UNIQUE("provider_sale_id")
);
--> statement-breakpoint
ALTER TABLE "checkouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"app" text NOT NULL,
	"name" text NOT NULL,
	"period_days" integer NOT NULL,
	"grace_days" integer DEFAULT 3 NOT NULL,
	"provider" text NOT NULL,
	"provider_product_id" text NOT NULL,
	"price_value" numeric(14, 2) NOT NULL,
	"price_currency" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_provider_product_key" UNIQUE("provider","provider_product_id")
);
--> statement-breakpoint
ALTER TABLE "offers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_notifications" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event" text NOT NULL,
	"sale_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"app" text NOT NULL,
	"offer_id" text NOT NULL,
	"paid_until" timestamp with time zone NOT NULL,
	"grace_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_organization_app_key" UNIQUE("organization_id","app")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "checkouts_isolation" ON "checkouts" AS PERMISSIVE FOR ALL TO "account_app" USING (organization_id = current_setting('kete.organization_id', true)) WITH CHECK (organization_id = current_setting('kete.organization_id', true));--> statement-breakpoint
CREATE POLICY "offers_read" ON "offers" AS PERMISSIVE FOR SELECT TO "account_app" USING (true);--> statement-breakpoint
CREATE POLICY "subscriptions_isolation" ON "subscriptions" AS PERMISSIVE FOR ALL TO "account_app" USING (organization_id = current_setting('kete.organization_id', true)) WITH CHECK (organization_id = current_setting('kete.organization_id', true));--> statement-breakpoint
-- A provider notification carries a sale id and no trusted organization. This function, owned by
-- the owner role, finds the organization of the checkout that started the sale, and nothing else;
-- the service then works inside that organization, under RLS.
CREATE FUNCTION payments_checkout_organization(sale_id text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT organization_id FROM checkouts WHERE provider_sale_id = sale_id $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION payments_checkout_organization(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION payments_checkout_organization(text) TO account_app;
