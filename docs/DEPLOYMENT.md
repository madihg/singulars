# Singulars deployment

How singulars is built, hosted and reached. Accurate as of September 2026.

## Topology

Singulars is its own repo and its own Vercel project. It is served to the
public under a path on the portfolio site, through a proxy rewrite.

```
visitor
  -> https://www.halimmadi.com/singulars/...        (halim-madi Vercel project)
       vercel.json rewrite
  -> https://singulars.oulipo.xyz/singulars/...     (singulars Vercel project)
       next.config.mjs basePath "/singulars"
  -> the app
```

| Item             | Value                                          |
| ---------------- | ---------------------------------------------- |
| Git repo         | https://github.com/madihg/singulars (public)   |
| Production branch| `main`                                         |
| Vercel project   | singulars (`prj_wAF6Dx0ddTLn2WhNlIMAWapI0cp3`) |
| Vercel team      | halims-projects (`team_9h3UVrcMfPTPWYdvGpnKezrd`) |
| Root directory   | repo root                                      |
| Framework        | Next.js 14 App Router, `next build`            |
| Node             | 24.x (Vercel project setting)                  |
| basePath         | `/singulars` (next.config.mjs)                 |
| Public URL       | https://www.halimmadi.com/singulars            |
| Origin domain    | https://singulars.oulipo.xyz                   |

Pushing to `main` deploys to production automatically through Vercel's Git
integration. There is no GitHub Action and no monorepo root directory; both
were part of the older oulipo-monorepo setup and are gone.

## Why the old host is still alive

`singulars.oulipo.xyz` stays reachable on purpose. Two rules in `vercel.json`
make that safe:

- `rewrites`: `/api/:path*` -> `/singulars/api/:path*`. The OpenAI and Together
  fine-tune webhooks were registered against
  `https://singulars.oulipo.xyz/api/admin/fine-tunes/webhooks/...`, which has no
  `/singulars` prefix. The rewrite keeps those URLs working after the basePath
  move. The same rewrite is what makes the app's server-side self-fetches to
  `/api/admin/...` (eval start, eval rerun, fine-tune retry) resolve. **Do not
  remove it** without re-registering the webhooks first.
- `redirects`: every non-`/api`, non-`/singulars` path on the
  `singulars.oulipo.xyz` host 301s to `https://www.halimmadi.com/singulars/:path`.

## basePath rules for contributors

Next strips the basePath before your code sees a path. That splits URLs into
two kinds:

- **Framework-relative** - `next/link` `href`, `router.push`, `middleware.ts`
  matcher and `req.nextUrl.pathname`. Write these WITHOUT `/singulars`; Next
  adds it. `<Link href="/singulars">` renders `/singulars/singulars` and 404s.
- **Real browser URLs** - `fetch()` strings, `window.location.href`, plain
  `<a href>`. These keep the `/singulars` prefix, because they are not passed
  through Next's basePath handling.

`npm run verify` prints both lists on every run - literal `/singulars` hrefs in
JSX, and plain `<a>` hrefs that are root-relative but missing the basePath - so
the two kinds do not drift.

## Cron

One entry in `vercel.json`:

| Path                                       | Schedule    | What it does |
| ------------------------------------------ | ----------- | ------------ |
| `/singulars/api/admin/cron/check-trained`  | `0 3 * * *` | Emails a nudge when a performance is `trained` but has no completed eval run in the last 24h. |

The cron path in `vercel.json` DOES carry the `/singulars` prefix, because
Vercel calls the deployment origin directly rather than going through Next.

`check-trained` is a no-op today: it needs `ADMIN_NIGHTLY_EMAIL` and
`RESEND_API_KEY`, neither of which is set.

`/api/admin/cron/poll-finetunes` has no cron entry (every-10-minute crons need
the Pro plan). Trigger it by hand when a webhook is missed:

```bash
curl -H "x-vercel-cron: 1" \
  https://singulars.oulipo.xyz/api/admin/cron/poll-finetunes
```

Cron routes authenticate on the `x-vercel-cron` header, not the admin cookie,
so the admin middleware lets them through by name.

## Environment variables

Set in the Vercel project, by name. Values live in Vercel and `.env.local`;
never in the repo.

**Production**

| Name | Used for |
| ---- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase client, and the HMAC key for the admin cookie |
| `ADMIN_PASSWORD` | Admin login. **Required** - with it unset the admin surface fails closed |
| `OPENAI_API_KEY` | Chat on fine-tuned models, fine-tune jobs |
| `ANTHROPIC_API_KEY` | Eval judges, classifier extraction |
| `OPENROUTER_API_KEY` | `/api/chat-edge` (Claude Opus for reverse, frontiere, recover) |
| `TOGETHER_API_KEY` | Together fine-tune jobs |

**Preview and Development** carry the same set except `OPENROUTER_API_KEY`,
which is Production-only. That is why `/chat` returns 503 on preview
deployments for the OpenRouter-backed models.

**Referenced in code but not set anywhere.** Each has a defined off state:

`OPENAI_WEBHOOK_SECRET`, `TOGETHER_WEBHOOK_SECRET` (see below),
`THEME_ADMIN_PASSWORD` (alternative to `ADMIN_PASSWORD`), `STAGE_CONTROL_KEY`
(falls back to the admin password), `RESEND_API_KEY`, `ADMIN_NIGHTLY_EMAIL`,
`ADMIN_NIGHTLY_FROM` (cron email, off), `FINETUNE_POLLING` (poll route, off),
`HUGGINGFACE_API_KEY`, `NEXT_PUBLIC_SHOW_EVOLUTION_ON_LANDING`,
`NEXT_PUBLIC_FINETUNE_COST_CAP_USD`, `NEXT_PUBLIC_TURN_URL`,
`NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL`,
`EVAL_COST_CAP_USD` (CLI scripts only).

## Two dashboard items only Halim can do

Neither can be done from this repo. Both are open.

1. **Set the webhook secrets.** `OPENAI_WEBHOOK_SECRET` and
   `TOGETHER_WEBHOOK_SECRET` are absent from the Vercel project. The webhook
   handlers skip signature verification when the secret is empty, so today
   anyone who knows the URL can POST a fake completion and rewrite
   `fine_tune_jobs.status` and `candidate_models.api_endpoint`. Copy each
   signing secret from the provider dashboard into Vercel (Production at
   minimum) and redeploy.
2. **Confirm the registered callback URLs.** The webhook URLs are registered in
   the OpenAI and Together dashboards, not in this repo, so nothing here
   records which URL is live. Confirm both point at
   `https://singulars.oulipo.xyz/api/admin/fine-tunes/webhooks/openai` and
   `.../together`. Those keep working because of the `/api` rewrite above. If
   you would rather move them to
   `https://www.halimmadi.com/singulars/api/admin/fine-tunes/webhooks/...`,
   re-register first, confirm a job completes, and only then consider dropping
   the rewrite (the server-side self-fetches still need it).

## Before you push

```bash
npm run verify
```

That runs `next build`, then `tsc --noEmit`, then `scripts/verify-copy.mjs`
(fails on an em dash outside the model prompts, and prints the basePath href
reports for review).

## Verification checklist after a deploy

- [ ] The Vercel deployment for `main` reaches READY
- [ ] https://www.halimmadi.com/singulars loads
- [ ] https://www.halimmadi.com/singulars/chat loads
- [ ] https://www.halimmadi.com/singulars/admin redirects to
      `/singulars/admin/login?from=%2Fadmin`
- [ ] https://singulars.oulipo.xyz/api/health returns 200
- [ ] Hard refresh (Cmd+Shift+R) if you still see old content

## Manual deploy (emergency)

```bash
vercel --prod
```

from the repo root, with the Vercel CLI linked to the `singulars` project.
