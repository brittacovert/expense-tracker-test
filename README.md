# BOW — Privacy-Safe Multi-User Tester Edition

This edition is designed for inviting testers without including or exposing the
store's real financial information.

## Privacy model

- The repository contains fictional demo records only.
- Every tester is identified by a verified server-side login.
- Each tester's planner is stored under a separate database key.
- The browser cannot select or submit a user ID.
- A tester can reset only their own workspace.
- The original shared `app_state` record is never queried by this edition.

Do not make the Worker publicly reachable without an authentication layer.

## Deploying with Cloudflare Access

1. Create a GitHub repository and upload this folder.
2. Create a Cloudflare Worker deployment with a D1 database binding named `DB`.
3. Apply both SQL migrations in `drizzle/` in filename order.
4. Put the Worker behind a Cloudflare Access self-hosted application.
5. Add an Allow policy for the email addresses that may test the app.
6. Set these Worker environment variables:

   - `ACCESS_TEAM_DOMAIN`: your full team URL, such as
     `https://your-team.cloudflareaccess.com`
   - `ACCESS_AUD`: the Application Audience tag shown by Cloudflare Access

7. Disable or protect any alternate `workers.dev` route so Access cannot be
   bypassed.

The API validates Cloudflare's signed JWT, expiration time, issuer, and
application audience before reading or writing a planner.

## Adding testers

Add or remove testers through the Cloudflare Access Allow policy. A tester can
use a one-time email PIN or another identity provider configured in Cloudflare.
Their first visit receives fictional demo data. Changes are saved only to their
own D1 row.

## Local development

Install Node.js 22+, Git, and pnpm. Then run:

```powershell
pnpm install
pnpm dev
```

The Cloudflare local runtime requires a currently supported operating system.
On Windows 10, use WSL2 with a current Ubuntu distribution, or deploy the
repository and test the hosted version in Edge, Chrome, or Firefox.

## Database

Tester data is stored in:

```sql
CREATE TABLE planner_state (
  user_id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

The migration intentionally leaves the old `app_state` table untouched so an
existing private planner is not deleted accidentally.

## Before a wider launch

- Add a privacy policy and deletion/export controls.
- Decide whether account administrators may view user records.
- Add retention and backup rules.
- Test account removal and access revocation.
- Keep real production and tester databases completely separate.
