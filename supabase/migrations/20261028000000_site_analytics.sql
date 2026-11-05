-- ============================================================
-- Analytics: link each site to its Vercel project
-- ------------------------------------------------------------
-- The portal's api/analytics function reads this column *as the
-- signed-in user*, so the existing row-level security decides who
-- may see a site's analytics: members of that site and admins.
-- The browser never chooses a project id; it only names a site.
--
-- No new grants or policies: `authenticated` already holds
-- table-level select/update on public.sites, and only admins pass
-- the update policy. The id itself is not a secret (it is useless
-- without the Vercel token, which lives only in the function).
-- ============================================================

alter table public.sites
  add column vercel_project_id text
  check (vercel_project_id ~ '^prj_[A-Za-z0-9]+$');

comment on column public.sites.vercel_project_id is
  'Vercel project whose Web Analytics this site''s members see. Null hides the Analytics tab.';
