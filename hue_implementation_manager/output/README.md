# 39N Health -- Client Implementation Portal

A dashboard for managing employer health plan onboarding/implementation: deliverables and
timelines, employer/broker questionnaires, contacts (39N staff, employer, broker, and external
partners), plan documents, and a "What to Expect" reference library. Implementation managers use
it to run onboarding; clients log in to the same portal, scoped to their own data, to track
status and come back to reference material later in the plan year.

## Stack

- **Frontend:** React 18 + Vite (`src/`)
- **Backend:** Express (`server.js`, `auth.js`)
- **Database:** Postgres (developed against Neon)
- Session-based auth (`express-session` + `connect-pg-simple`, bcrypt password hashing), not
  token-based -- the session cookie is what every API call authenticates with.

## Architecture notes

- **Roles:** every login is either `manager` (39N staff -- full read/write, sees every client) or
  `client` (a specific employer contact -- read-only apart from checking off deliverables and
  reviewing "What to Expect" items, scoped to their own `client_id`). Enforced server-side in
  `auth.js`'s `requireAuth` / `requireManager` / `canAccessClient` -- never trust the frontend for
  this.
- **Templates copy on create, not by reference:** `template_deliverables` and
  `template_expectations` are the single global templates a manager edits from the admin portal.
  When a new client is created, its `client_deliverables` / `client_expectations` rows are copied
  from the templates at that moment. Editing a template afterward never retroactively changes any
  existing client -- only new clients get the update.
- **Shared/reusable entities:** `contacts` and `brokers` are pools, not per-client copies. A
  contact or broker can be attached to more than one client (`client_contacts` is the join table);
  editing one's own fields (name, firm, etc.) updates it everywhere it's attached, which is
  intended, not a bug.
- **Individual logins per contact:** a client-role login (`users.contact_id`) is tied to one
  specific contact record, not shared per client. Multiple people at one employer, or one broker
  working across several clients, each get their own separate login. Passwords are set by a
  manager from the admin portal -- there is no self-service signup or password reset flow.
- **Documents** currently live on local disk (`uploads/`, via multer) with just a filename stored
  in `client_documents.storage_path`. **This does not survive a deploy to a platform with an
  ephemeral filesystem** (most PaaS targets wipe local disk on redeploy) -- confirm the deploy
  target has a persistent volume, or swap this for object storage (S3-compatible), before
  uploading real client documents.

## Prerequisites

- Node.js 18+
- A Postgres database (e.g. a free [Neon](https://neon.tech) project)

## Setup

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and SESSION_SECRET at minimum
npm run migrate         # creates every table via db/migrations/*.sql
```

`npm run migrate` is idempotent and tracks what's already applied in a `schema_migrations` table,
so it's safe to run again after pulling a new migration file -- it only applies what's new.

### Seeding fictional demo data (optional, useful for local development)

```bash
node db/seed-users.cjs   # two test logins: a manager and a client contact (see its output for credentials)
node db/seed.cjs         # one fictional client ("Acme Manufacturing Co.") plus the deliverables/expectations templates
```

Both scripts are safe to re-run -- they replace their own previously-seeded rows rather than
duplicating them. **Do not point this database at real client data until real manager/client
accounts exist beyond the two seeded test ones and the deployment's session/CORS config has been
reviewed** (see Deployment below).

## Running locally

Two servers run side by side in development:

```bash
npm run server   # Express API on http://localhost:3000
npm run dev      # Vite dev server on http://localhost:5173 (proxies API calls to :3000)
```

Open http://localhost:5173 and log in with a seeded account.

## Building for production

```bash
npm run build     # outputs dist/
```

`server.js` also serves `dist/` as static files and falls back to `dist/index.html` for any
non-`/api/` route, so a single Express process can serve both the API and the compiled app -- no
separate static host is required (though you can still put one in front if you prefer).

## Environment variables

See `.env.example` for the full list with descriptions. In short:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `SESSION_SECRET` | yes | Long random string signing session cookies |
| `CORS_ORIGIN` | no | Comma-separated allowed frontend origin(s); defaults to the local Vite dev server |
| `NODE_ENV` | in production | Set to `production` so the session cookie is marked `secure` (HTTPS-only) |
| `PORT` | no | Defaults to `3000` |

## Deployment checklist

Before pointing this at real client data or a real domain:

1. Set `CORS_ORIGIN` to the real frontend domain(s) (e.g. `https://39n.co,https://www.39n.co`).
2. Set `NODE_ENV=production` so session cookies are sent `secure`.
3. Confirm the deploy target's filesystem is persistent, or migrate document storage to something
   that is (see the Documents note above) -- otherwise uploaded files will disappear on redeploy.
4. Create real manager/client accounts (there's no self-service signup; a manager creates each
   login from the admin portal or `db/seed-users.cjs`-style script) and retire the two fictional
   test accounts.
5. Run `npm run migrate` against the production database before first deploy.

## Project structure

```
server.js, auth.js       Express API + session auth
db/
  migrations/*.sql       Schema, applied in order by migrate.cjs
  migrate.cjs            Migration runner (npm run migrate)
  seed*.cjs              Optional fictional demo data for local development
src/
  App.jsx                Central state/handlers for the whole client-facing + admin UI
  pages/                 One file per screen (Overview, Questionnaires, Contacts, Deliverables,
                          What to Expect, Documents, and their admin-portal template counterparts)
  components/            Shared UI pieces (cards, fields, error boundary)
  api.js                 Thin fetch wrapper for every backend endpoint
  mapClientResponse.js   Maps raw API/DB rows into the shapes the page components expect
```
