# Soedirman Baik

Mobile-responsive P3MD good-act feed. Students submit anonymously; an admin reviews every post. Photos (up to four), videos, articles, and community contribution links.

## Run locally

Node.js 22.13+ is required (SQLite support). Install dependencies and initialize local secrets:

```sh
npm install
npm run setup:local
npm run dev
```

Open http://localhost:3000. Admin: http://localhost:3000/admin. The generated admin password is in `.env.local`. Keep this file private. Optional preview content: `npm run setup:local -- --demo`; these posts are visibly marked **Contoh** and remain local.

Local submissions, media, moderation history, reports, and appreciation counts persist in `.data/` across restarts. Back up that directory and `.env.local` together. Guest ownership is a signed, HttpOnly cookie valid for 30 days. Clearing cookies, changing devices, or cookie expiry loses submission access. Poster names are never requested or exposed. An optional subject names the person being appreciated; it does not identify the poster.

Anyone with the link can read approved posts and submit; P3MD membership is not verified. Admin authentication, approval checks, revision checks, request origin validation, and rate limits are enforced by the server. Pending media is visible only to its guest owner and admin. Photos are re-encoded to WebP, removing EXIF metadata. Content itself can reveal identities; anonymity is not a guarantee against recognition.

## Production: Supabase + Mux + Vercel

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor. It creates server-only tables, transaction functions, and a **private** `post-media` bucket. Do not add public SELECT policies.
2. Set `DATA_BACKEND=supabase`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment. No service key is exposed as `NEXT_PUBLIC_*`.
3. Set a unique `SESSION_SECRET` (at least 32 random characters), `ADMIN_PASSWORD` (at least 12 characters), and the exact HTTPS `APP_URL`.
4. Create Mux API credentials and a signing key. Set `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, and the base64-encoded key in `MUX_SIGNING_PRIVATE_KEY`.
5. Configure a Mux webhook pointing to `${APP_URL}/api/webhooks/mux` and set `MUX_WEBHOOK_SECRET`. Subscribe to `video.upload.asset_created`, `video.asset.ready`, and `video.asset.errored`.
6. Deploy the Next.js project to Vercel after setting these variables. Local disk persistence is explicitly refused on Vercel. Cloud video uploads go directly to Mux and use signed playback; videos over 120 seconds are not publishable.

Production adapters and SQL are provided; a live cloud integration requires provider credentials and must be verified against the provisioned services. Local execution uses SQLite and local video playback, not Mux emulation. The browser compresses photos before sending them to avoid oversized serverless requests.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

The browser tests use a separate temporary database and test-only secrets. They cover all post types, ownership, pending media, moderation, editing, reporting, reactions, keyboard interaction, and mobile layouts.

## Design

The feed uses 4:5 photo, video, article, and website previews. **Jelajahi** displays approved posts in a searchable three-column gallery; select a tile to see the full post. Submit using **Kirim** in the bottom navigation (mobile) or bottom of the sidebar (desktop). Articles open at `/articles?id=<post-id>` and support Markdown headings, emphasis, lists, quotes, code, links, images, and GFM tables. Raw HTML is ignored; Markdown images load lazily without a referrer. Pending articles retain the API’s existing owner/admin access checks.

Tokens: `design-system/MASTER.md` and `src/app/globals.css`. TypeUI fundamentals are installed project-locally under `.agents/skills/typeui-fundamentals`. The Superdesign brief is in `design-system/superdesign-brief.md`. All UI copy is Indonesian. Dialogs trap focus and respect reduced motion; tap targets are 48px.

Crest: user-supplied P3MD image. Example volunteer photo: [Unsplash image source](https://images.unsplash.com/photo-1559027615-cd4628902d4a). Example posts are fictional demonstrations, not evidence of P3MD student activity.

## Frontend design preview

Run `npm run build:preview` to export the same UI with browser-only example data into `.ui-preview/out`. The export includes no API routes, backend modules, local database, or environment files. Filter, search, compose, upload previews, reactions, and moderation are interactive; changes reset on page reload. All content is marked as an example. Use **Coba admin** on `/admin` to view the demo review queue; it is not production authentication.

Vercel settings for this preview: Framework **Other**, build command `npm run build:preview`, output directory `.ui-preview/out`, install command `npm ci`. Do not add backend credentials to the design preview project.

## GitHub Actions and Vercel deployment

`.github/workflows/ci-deploy.yml` runs lint, type checking, unit tests, the full Next.js build, and desktop/mobile browser tests on pull requests and pushes to `main`. GitHub Actions supplies checks; Vercel's native GitHub integration builds and deploys the connected repository. No Vercel token is needed in GitHub Actions.

The target is the existing **soedirman-baik-ui** project at https://soedirman-baik-ui.vercel.app. This is the browser-only demo; data resets on reload. It is separate from the Supabase/Mux production backend described above. `vercel.json` preserves the demo build settings and enables native Git deployments. Pushes to the Vercel production branch (`main`) deploy to production; other branches and pull requests receive Vercel preview deployments when configured in the project.

If automatic builds stop, check **Vercel → soedirman-baik-ui → Settings → Git** and confirm the connected repository is `ZidanHadipratama/soedirmanBaik` and the production branch is `main`. Check workflow results on the [Actions page](https://github.com/ZidanHadipratama/soedirmanBaik/actions).

## Polling demo

Polling is available in the browser-only preview: **Kirim → Polling**. Enter a question and 2–12 unique answers; optionally enable **Izinkan beberapa jawaban**. The submission appears in **Kiriman saya** and becomes votable after approval through **Coba admin**. Find approved polls in Beranda or through the Polling filter in Jelajahi.

Tap an answer to vote, replace your single answer, or toggle multiple answers. Results are visible immediately. Percentages use participants as the denominator, so multiple-answer results may total more than 100%. Creators can use **Tutup polling** in Kiriman saya; closing preserves results and prevents further changes. Polls with votes, closed polls, and pending submissions cannot be edited.

Run `npm run build:preview` followed by `npm run start:preview`, then open http://localhost:3138. Run `npm run test:preview` for the desktop/mobile preview checks.

Polls, votes, and example counts are demo data: changes reset on page reload and are not shared between visitors. Production mode retains its existing four post formats; persistent shared voting is a future backend feature.
