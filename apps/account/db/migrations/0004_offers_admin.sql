-- The offers catalog stays read-only for the application role (0002). Kete operators change it
-- from Kete Cockpit through the Compte Kete's admin API; after checking the operator, the service
-- calls these two functions, owned by the owner role, and nothing else can write the catalog.
CREATE FUNCTION admin_set_offer(
  offer_id text, offer_app text, offer_name text, offer_period_days integer,
  offer_grace_days integer, offer_provider text, offer_product_id text,
  offer_price_value numeric, offer_price_currency text
) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
  AS $$
DECLARE saved text;
BEGIN
  IF offer_app NOT IN ('firmo', 'nettio', 'nyatefe', 'cockpit') THEN
    RAISE EXCEPTION 'unknown app %', offer_app;
  END IF;
  IF offer_period_days NOT BETWEEN 1 AND 366 OR offer_grace_days NOT BETWEEN 0 AND 30 THEN
    RAISE EXCEPTION 'period or grace out of range';
  END IF;
  IF offer_price_value <= 0 OR offer_price_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'invalid price';
  END IF;
  INSERT INTO offers (id, app, name, period_days, grace_days, provider, provider_product_id,
                      price_value, price_currency, active, updated_at)
  VALUES (offer_id, offer_app, offer_name, offer_period_days, offer_grace_days, offer_provider,
          offer_product_id, offer_price_value, offer_price_currency, true, now())
  ON CONFLICT (provider, provider_product_id) DO UPDATE
    SET app = excluded.app, name = excluded.name, period_days = excluded.period_days,
        grace_days = excluded.grace_days, price_value = excluded.price_value,
        price_currency = excluded.price_currency, active = true, updated_at = now()
  RETURNING id INTO saved;
  RETURN saved;
END $$;--> statement-breakpoint
CREATE FUNCTION admin_disable_offer(offer_provider text, offer_product_id text) RETURNS integer
  LANGUAGE sql SECURITY DEFINER SET search_path = public
  AS $$
  WITH changed AS (
    UPDATE offers SET active = false, updated_at = now()
     WHERE provider = offer_provider AND provider_product_id = offer_product_id
     RETURNING 1)
  SELECT count(*)::integer FROM changed $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION admin_set_offer(text, text, text, integer, integer, text, text, numeric, text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION admin_disable_offer(text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_set_offer(text, text, text, integer, integer, text, text, numeric, text) TO account_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_disable_offer(text, text) TO account_app;
