-- ============================================================
-- Regan Dev client portal — initial schema
-- ------------------------------------------------------------
-- One Supabase project serves every client site. Row-level
-- security keeps each client inside their own site:
--   * agency admins (public.admins) can do everything;
--   * a site member can read and edit that site's posts only.
--
-- Posts work like Sanity documents: the row holds the working
-- draft, and `published` holds a frozen snapshot of the last
-- published version. Client sites only ever read snapshots, via
-- public.published_posts(). Publishing, unpublishing and deleting
-- a published post call that site's Vercel deploy hook through
-- pg_net, so the site rebuilds with no server of our own.
--
-- Grants are explicit throughout: Supabase no longer exposes new
-- tables to the Data API by default.
-- ============================================================

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- tables ----------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  -- Identifies the site to its own build script: published_posts('<slug>').
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  site_url text,
  created_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.site_members (
  site_id uuid not null references public.sites (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);

-- Secret: anyone holding a deploy hook URL can trigger builds. Lives in a
-- schema the Data API cannot see; only the functions below read it.
create table private.site_hooks (
  site_id uuid primary key references public.sites (id) on delete cascade,
  deploy_hook_url text not null check (deploy_hook_url ~ '^https://')
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  -- Working draft
  title text not null default '',
  slug text not null default '',
  excerpt text not null default '',
  published_on date not null default current_date,
  body jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}',
  -- Last published version: {slug,title,excerpt,published_on,body}, or null
  published jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

create index posts_site_id_idx on public.posts (site_id);
-- Two posts on one site may not share a web address. Empty slugs are drafts
-- nobody has named yet.
create unique index posts_site_slug_key on public.posts (site_id, slug) where slug <> '';

-- ---------- helpers ----------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

create or replace function public.is_site_member(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.site_members
    where site_id = target and user_id = (select auth.uid())
  )
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger posts_touch_updated_at
  before update of title, slug, excerpt, published_on, body on public.posts
  for each row execute function private.touch_updated_at();

-- Fire the site's deploy hook whenever what is live changes: a snapshot is
-- created, replaced or cleared, or a published post is deleted.
create or replace function private.notify_site()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  target uuid := coalesce(new.site_id, old.site_id);
  hook text;
begin
  if tg_op = 'DELETE' and old.published is null then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.published is not distinct from old.published then
    return new;
  end if;

  select deploy_hook_url into hook from private.site_hooks where site_id = target;
  if hook is not null then
    perform net.http_post(url := hook, body := '{}'::jsonb);
  end if;
  return coalesce(new, old);
end
$$;

create trigger posts_notify_site
  after update of published or delete on public.posts
  for each row execute function private.notify_site();

-- ---------- row-level security ----------

alter table public.sites enable row level security;
alter table public.admins enable row level security;
alter table public.site_members enable row level security;
alter table public.posts enable row level security;

create policy "members and admins read sites" on public.sites
  for select to authenticated
  using (public.is_admin() or public.is_site_member(id));
create policy "admins manage sites" on public.sites
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "users see their own admin row" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "members see their memberships, admins see all" on public.site_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "admins manage memberships" on public.site_members
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "members and admins read posts" on public.posts
  for select to authenticated
  using (public.is_admin() or public.is_site_member(site_id));
create policy "members and admins create posts" on public.posts
  for insert to authenticated
  with check (public.is_admin() or public.is_site_member(site_id));
create policy "members and admins edit posts" on public.posts
  for update to authenticated
  using (public.is_admin() or public.is_site_member(site_id))
  with check (public.is_admin() or public.is_site_member(site_id));
create policy "members and admins delete posts" on public.posts
  for delete to authenticated
  using (public.is_admin() or public.is_site_member(site_id));

-- ---------- grants ----------

revoke all on public.sites, public.admins, public.site_members, public.posts from anon, authenticated;

grant select, insert, update, delete on public.sites to authenticated;
grant select on public.admins to authenticated;
grant select, insert, delete on public.site_members to authenticated;
grant select, delete on public.posts to authenticated;
grant insert (site_id, title, slug, excerpt, published_on, body) on public.posts to authenticated;
-- No update on `published`/`published_at`: going live only happens through
-- publish_post(), which validates the draft first.
grant update (title, slug, excerpt, published_on, body) on public.posts to authenticated;

-- ---------- functions the portal calls ----------

create or replace function public.publish_post(post_id uuid)
returns public.posts
language plpgsql security definer set search_path = ''
as $$
declare
  p public.posts;
begin
  select * into p from public.posts where id = post_id;
  if p.id is null or not (public.is_admin() or public.is_site_member(p.site_id)) then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if btrim(p.title) = '' then raise exception 'Add a title before publishing.'; end if;
  if p.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Add a web address before publishing.'; end if;
  if btrim(p.excerpt) = '' then raise exception 'Add a summary before publishing.'; end if;
  if coalesce(jsonb_array_length(p.body -> 'content'), 0) = 0 then
    raise exception 'Write the article before publishing.';
  end if;

  update public.posts
  set published = jsonb_build_object(
        'slug', p.slug, 'title', p.title, 'excerpt', p.excerpt,
        'publishedAt', p.published_on, 'body', p.body),
      published_at = now()
  where id = post_id
  returning * into p;
  return p;
end
$$;

create or replace function public.unpublish_post(post_id uuid)
returns public.posts
language plpgsql security definer set search_path = ''
as $$
declare
  p public.posts;
begin
  select * into p from public.posts where id = post_id;
  if p.id is null or not (public.is_admin() or public.is_site_member(p.site_id)) then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  update public.posts set published = null, published_at = null
  where id = post_id
  returning * into p;
  return p;
end
$$;

-- Admin: add an existing portal user to a site by email.
create or replace function public.admin_add_member(target_site uuid, member_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select id into uid from auth.users where lower(email) = lower(btrim(member_email));
  if uid is null then
    raise exception 'No portal user with that email yet. Invite them first, then add them.';
  end if;
  insert into public.site_members (site_id, user_id) values (target_site, uid)
  on conflict do nothing;
end
$$;

-- Admin: list a site's members with their emails (auth.users is not exposed).
create or replace function public.admin_site_members(target_site uuid)
returns table (user_id uuid, email text, added_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select m.user_id, u.email::text, m.created_at
    from public.site_members m join auth.users u on u.id = m.user_id
    where m.site_id = target_site
    order by m.created_at;
end
$$;

-- Admin: set or clear a site's deploy hook. Never readable back in full.
create or replace function public.admin_set_deploy_hook(target_site uuid, hook_url text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if hook_url is null or btrim(hook_url) = '' then
    delete from private.site_hooks where site_id = target_site;
  else
    insert into private.site_hooks (site_id, deploy_hook_url) values (target_site, btrim(hook_url))
    on conflict (site_id) do update set deploy_hook_url = excluded.deploy_hook_url;
  end if;
end
$$;

create or replace function public.admin_has_deploy_hook(target_site uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return exists (select 1 from private.site_hooks where site_id = target_site);
end
$$;

-- ---------- public read API for client site builds ----------

-- Called by each client site's build with the public anon key:
--   POST /rest/v1/rpc/published_posts  {"site_slug": "orpington-osteopaths"}
-- Returns only published snapshots, newest first; never drafts.
create or replace function public.published_posts(site_slug text)
returns setof jsonb
language sql stable security definer set search_path = ''
as $$
  select p.published
  from public.posts p
  join public.sites s on s.id = p.site_id
  where s.slug = site_slug
    and p.published is not null
    and (p.published ->> 'publishedAt')::date <= current_date
  order by (p.published ->> 'publishedAt') desc, p.published_at desc
$$;

-- Daily keep-alive target, so the free project is never paused for inactivity.
create or replace function public.ping()
returns text
language sql stable set search_path = ''
as $$ select 'ok' $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.published_posts(text) to anon, authenticated;
grant execute on function public.ping() to anon, authenticated;
grant execute on function
  public.is_admin(), public.is_site_member(uuid),
  public.publish_post(uuid), public.unpublish_post(uuid),
  public.admin_add_member(uuid, text), public.admin_site_members(uuid),
  public.admin_set_deploy_hook(uuid, text), public.admin_has_deploy_hook(uuid)
  to authenticated;
