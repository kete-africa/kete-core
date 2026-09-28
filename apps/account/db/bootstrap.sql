-- Run once per Neon branch, as the owner role, before the first migration.
-- The application role gets data access to every table the owner creates; RLS policies decide
-- which rows it sees.
alter default privileges for role account_owner in schema public
  grant select, insert, update, delete on tables to account_app;
alter default privileges for role account_owner in schema public
  grant usage, select on sequences to account_app;
