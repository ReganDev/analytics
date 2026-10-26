# Client Portal

Where clients write and publish their website blogs. One portal and one
Supabase project serve every client site; row-level security keeps each
client inside their own site.

```
Portal (this app) ── Supabase Auth + Postgres (RLS) ── publish_post() ──▶ site's Vercel deploy hook
Client site build ── POST /rest/v1/rpc/published_posts {site_slug} ──▶ prerendered /blog pages
```

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the project URL and anon key
npm run dev
```

Database schema, policies and functions: `supabase/migrations/`. Apply with
`npx supabase link --project-ref <ref>` then `npx supabase db push`.

### Supabase dashboard settings (once)

- **Authentication → URL configuration:** Site URL = the portal's address;
  add `<portal>/set-password` to Redirect URLs.
- **Authentication → Emails → SMTP:** use Resend (or another SMTP). Supabase's
  built-in sender only delivers to your own team's addresses, so client invites
  and password resets need custom SMTP.
- **Authentication → Sign in providers → Email:** leave "Allow new users to sign
  up" **on** — the Admin invite uses it to create the client's account. It is
  safe: the portal has no sign-up page, and an account that isn't a member of a
  site can't read or change anything.
- **Make yourself an admin** (SQL editor), after signing up once:
  `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';`

### GitHub secrets (keep-alive job)

`SUPABASE_URL` and `SUPABASE_ANON_KEY` — used by `.github/workflows/keep-alive.yml`
to stop the free project pausing after 7 quiet days.

## Adding a client site

1. Admin → **Create site** (the build key is what the site's build script asks for).
2. In Vercel, create a deploy hook for the site's branch and paste it into the site's card.
3. **Invite** the client by email. They get a link, set a password, and can start writing.
4. In the client site's repo, point `scripts/fetch-posts.mjs` at the portal's
   `published_posts` function with that build key.

## How publishing works

Every edit autosaves to the draft columns of `posts`. Publishing copies the
draft into the `published` snapshot (after checking required fields); a trigger
then calls the site's deploy hook through `pg_net`. Unpublishing clears the
snapshot; deleting a published post also triggers a rebuild. Client sites only
ever read snapshots, so drafts never leak.
