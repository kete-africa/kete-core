-- Offers with limits, a trial that ends, and reading after the end (spec 092). Additive: the
-- tables keep their RLS policies (offers read-only for the application role, subscriptions per
-- organization); the catalog is still written only through owner functions.
ALTER TABLE offers
  ADD COLUMN limits jsonb NOT NULL DEFAULT '{}'
    CHECK (jsonb_typeof(limits) = 'object'),
  -- Days during which what was done stays readable once the use (grace included) has ended.
  ADD COLUMN read_days integer NOT NULL DEFAULT 90 CHECK (read_days BETWEEN 0 AND 3650),
  -- A trial: free, once per organization and app, never sold.
  ADD COLUMN trial boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE subscriptions
  ADD COLUMN trial boolean NOT NULL DEFAULT false;--> statement-breakpoint
-- The names and amounts of limits an offer may set; anything else is refused.
CREATE FUNCTION offer_limits_valid(limits jsonb) RETURNS boolean
  LANGUAGE sql IMMUTABLE
  AS $$
  SELECT jsonb_typeof(limits) = 'object' AND NOT EXISTS (
    SELECT 1 FROM jsonb_each(limits) AS l(name, amount)
     WHERE l.name NOT IN ('people', 'ai_tokens_month', 'storage_mb', 'connected_apps', 'agents')
        OR jsonb_typeof(l.amount) <> 'number'
        OR (l.amount)::text !~ '^[0-9]{1,12}$') $$;--> statement-breakpoint
-- The terms of an offer already in the catalog: its limits and how long it stays readable.
CREATE FUNCTION admin_set_offer_terms(
  offer_provider text, offer_product_id text, offer_limits jsonb, offer_read_days integer
) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
  AS $$
DECLARE changed integer;
BEGIN
  IF NOT offer_limits_valid(offer_limits) THEN RAISE EXCEPTION 'invalid limits'; END IF;
  IF offer_read_days NOT BETWEEN 0 AND 3650 THEN RAISE EXCEPTION 'read days out of range'; END IF;
  UPDATE offers SET limits = offer_limits, read_days = offer_read_days, updated_at = now()
   WHERE provider = offer_provider AND provider_product_id = offer_product_id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END $$;--> statement-breakpoint
-- A trial offer of an app: free, for a number of days, with its limits. One per app.
CREATE FUNCTION admin_set_trial(
  offer_id text, offer_app text, offer_name text, offer_days integer, offer_limits jsonb,
  offer_read_days integer
) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
  AS $$
DECLARE saved text;
BEGIN
  IF offer_app NOT IN ('firmo', 'nettio', 'nyatefe', 'cockpit') THEN
    RAISE EXCEPTION 'unknown app %', offer_app;
  END IF;
  IF offer_days NOT BETWEEN 1 AND 90 THEN RAISE EXCEPTION 'trial days out of range'; END IF;
  IF NOT offer_limits_valid(offer_limits) THEN RAISE EXCEPTION 'invalid limits'; END IF;
  IF offer_read_days NOT BETWEEN 0 AND 3650 THEN RAISE EXCEPTION 'read days out of range'; END IF;
  INSERT INTO offers (id, app, name, period_days, grace_days, provider, provider_product_id,
                      price_value, price_currency, active, limits, read_days, trial, updated_at)
  VALUES (offer_id, offer_app, offer_name, offer_days, 0, 'kete', 'trial:' || offer_app, 0, 'XOF',
          true, offer_limits, offer_read_days, true, now())
  ON CONFLICT (provider, provider_product_id) DO UPDATE
    SET name = excluded.name, period_days = excluded.period_days, limits = excluded.limits,
        read_days = excluded.read_days, active = true, updated_at = now()
  RETURNING id INTO saved;
  RETURN saved;
END $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION admin_set_offer_terms(text, text, jsonb, integer) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION admin_set_trial(text, text, text, integer, jsonb, integer) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_set_offer_terms(text, text, jsonb, integer) TO account_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_set_trial(text, text, text, integer, jsonb, integer) TO account_app;
