-- Kete's fleet reads every organization's deployment requests (spec 125; phase 11, step B2), from
-- Kete Cockpit through the Compte Kete's admin API, after checking the operator. These two
-- functions, owned by the owner role, are the only way across organizations; writing a deployment
-- stays in its own organization.
CREATE FUNCTION admin_deployments() RETURNS TABLE (
  id text, organization_id text, organization_name text, product text, mode text, region text,
  apps text[], status text, url text, requested_mode text, created_at timestamptz,
  updated_at timestamptz
)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
  SELECT d.id, d.organization_id, o.name, d.product, d.mode, d.region, d.apps, d.status, d.url,
         d.requested_mode, d.created_at, d.updated_at
    FROM deployments d JOIN organization o ON o.id = d.organization_id
   ORDER BY (d.status = 'requested' OR d.requested_mode IS NOT NULL) DESC, d.updated_at DESC
   LIMIT 500 $$;--> statement-breakpoint
CREATE FUNCTION admin_deployment_organization(deployment_id text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT organization_id FROM deployments WHERE id = deployment_id $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION admin_deployments() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION admin_deployment_organization(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_deployments() TO account_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_deployment_organization(text) TO account_app;
