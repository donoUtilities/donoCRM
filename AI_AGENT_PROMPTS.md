# AI Agent Prompts — DonoUtilities

Two ready-to-paste prompts based on a deep read of the actual codebase. Each one names the exact files, functions, and lines the agent should look at first so it doesn't waste turns rediscovering the project.

Stack reference (paste this into either prompt if your agent needs it):
- Next.js 16.1.1 (Turbopack dev), React 19.2.3, next-auth ^5.0.0-beta.31
- MongoDB driver 7.2.0
- Auth: Google OAuth with Docs + Drive scopes, JWT sessions
- Invoice PDF pipeline: Google Doc template → batchUpdate fills → export PDF → upload to Drive

---

## Prompt 1 — Fix the infinite reload loop on `/dtap-invoices`

```
You are debugging an infinite request loop on the Next.js 16 page `/dtap-invoices`
in the `web/` workspace. The dev server terminal shows this pattern repeating
forever, with no user interaction:

  GET /dtap-invoices 200 in 20ms
  GET /api/auth/session 200 in 23ms
  GET /dtap-invoices 200 in 32ms
  GET /api/auth/session 200 in 21ms
  ... (repeats indefinitely)

The same dev session also surfaces a Turbopack panic:
  "FATAL: An unexpected Turbopack error occurred"
  Failed to write app endpoint /dtap-invoices/page

## What has already been ruled out (do NOT re-investigate these)

1. `web/hooks/use-url-filters.ts` — already patched. It uses a `hasMountedRef`
   to skip the first effect, stores `searchParams` in a ref so `updateUrl` only
   depends on `pathname`, and only calls `router.replace` after a real filter
   change. Removing this hook entirely did not stop the loop. The loop is NOT
   in this hook.
2. `web/public/sw.js` — a no-op service worker, not intercepting anything.
3. All `router.push` / `router.replace` calls in the app are inside user
   click handlers (verified via grep across `app/`, `components/`, `hooks/`).
   Nothing in user code is calling `router.refresh()` or auto-navigating.

## Where to look (in this order)

1. `web/components/providers/auth-provider.tsx`
   - `AuthGuard` returns `null` while `useSession()` status is `"loading"` or
     `"unauthenticated"`, then returns `<>{children}</>` once authenticated.
   - `SessionProvider` is used with all defaults — meaning
     `refetchOnWindowFocus: true` is on. Investigate whether the session
     status is flipping `authenticated → loading → authenticated` on every
     refetch, which would unmount/remount the entire app subtree on every
     focus/visibility event and re-trigger Next's RSC fetch for the route.
   - Try setting explicit SessionProvider props:
       <SessionProvider
         refetchInterval={0}
         refetchOnWindowFocus={false}
         refetchWhenOffline={false}
       >
     and verify whether the loop stops. If it does, the fix is to keep these
     props AND change `AuthGuard` so it does not unmount children during a
     transient `loading` state — keep the last-known children mounted and
     overlay a spinner instead. The current pattern (`if (status === "loading")
     return null`) is what causes Next 16 to re-fetch the page tree.

2. `web/auth.ts` — the NextAuth v5 `jwt` callback
   - On every JWT call it checks `token.expiresAt` and, if expired, does a
     synchronous `fetch("https://oauth2.googleapis.com/token", ...)` to refresh
     the Google access token. If `expiresAt` is wrong (e.g. stored in ms vs s,
     or never refreshed in the returned token), every session check triggers a
     refresh, which writes a new session cookie, which makes the client see a
     "changed" session, which triggers another render cycle.
   - Verify that after a successful refresh, `token.expiresAt` is being set to
     `Math.floor(Date.now()/1000) + data.expires_in` (it is in the current
     code) AND that `data.expires_in` is actually present in the response
     (log it). If the refresh silently fails, `expiresAt` stays in the past
     and you refresh on every single session check.
   - Also check: the `jwt` callback re-reads MongoDB whenever `!token.designation`.
     If `designation` is `""` for a user, `!""` is true, so it hits the DB on
     every JWT call. Change the guard to `token.designation === undefined`.

3. `web/app/dtap-invoices/page.tsx`
   - The page wraps `<DtapInvoicesContent />` in `<Suspense>` with NO `fallback`.
     In Next 16 + React 19, a Suspense boundary that suspends without a
     fallback can trigger weird RSC streaming behavior. Add an explicit
     fallback (`<Suspense fallback={null}>`) and re-test.

4. The Turbopack panic itself
   - `Failed to write app endpoint /dtap-invoices/page` on Next 16.1.1 is a
     known class of bug. After ruling out the React-level causes above, try:
       a) Stop the dev server, delete `web/.next`, restart.
       b) Run `next dev` WITHOUT `--turbopack` (the package.json script forces
          turbopack — temporarily remove `--turbopack` to compare).
       c) If the loop disappears under webpack, the root cause is Turbopack
          and the fix is to either pin Next to a stable 16.x patch that
          fixes it, or stay on webpack for dev.

## Deliverable

Edit the minimum number of files to stop the loop. The expected change set is:
- `web/components/providers/auth-provider.tsx` — add SessionProvider props,
  rework AuthGuard so it doesn't unmount children during transient loading.
- Possibly `web/auth.ts` — tighten the `!token.designation` guard.
- Possibly `web/app/dtap-invoices/page.tsx` — add Suspense fallback.

After your edits, run `pnpm dev`, open `/dtap-invoices`, and confirm the
terminal shows ONE `GET /dtap-invoices` and ONE `GET /api/auth/session`
(plus the `GET /api/dtap-invoices` data fetch), then silence. Do not declare
the bug fixed until you have observed that quiet state for 30+ seconds.
```

---

## Prompt 2 — Batch invoice generation (faster, multi-select)

```
You are speeding up invoice PDF generation in the Next.js app under `web/`.

## Current behavior (what to read first)

Server: `web/app/api/dtap-invoices/generate/route.ts`
  - Accepts a single `invoiceId` per request.
  - Loads invoice + dtap + team + wireCenter + records + ALL DtapPrices from
    Mongo for every request (yes, every request re-fetches DtapPrices from
    scratch even though it's the same global table).
  - Calls `generateInvoicePdf` SEQUENTIALLY for the admin PDF, then the team
    PDF (lines 314-331). These two PDFs are independent Google Docs — they
    only need to be sequential because of the rate limiter, not because of
    any data dependency.

Pipeline: `web/lib/google.ts` → `generateInvoicePdf`
  - Per PDF: copy template → for each table do
    (read doc → batchUpdate delete+insertTable → read doc → batchUpdate fill →
    read doc → batchUpdate style) → insert picture grids → fill placeholders →
    export PDF bytes → upload to Drive → delete temp doc.
  - There is a GLOBAL serial `writeQueue` (line 56) plus a sliding-window
    rate limiter targeting 50 writes/min. Even if two requests arrive at
    once, every Docs batchUpdate is forced through one global queue.

Client: `web/app/dtap-invoices/dtap-invoices-content.tsx`
  - Has a client-side queue (`pendingQueue` + `generatingId` state, lines
    75-119) that processes ONE invoice at a time. The "queue" UX is real
    but it only fires `fetch("/api/dtap-invoices/generate")` for the next
    invoice after the previous response returns. There is no multi-select
    UI — invoices are added to the queue one button-click at a time.

## What "fast batch generation" needs to look like

The user wants to: select N invoices, click one button, get all N invoices
generated in a fraction of the time it currently takes to do them one by one.

### Required changes

1. NEW endpoint `web/app/api/dtap-invoices/generate-batch/route.ts`
   - POST body: `{ invoiceIds: string[] }`.
   - Use Server-Sent Events (or a streaming `ReadableStream` JSON-lines
     response) so the client gets per-invoice progress as each one finishes,
     instead of waiting for the whole batch.
   - Do ONE Mongo round trip up-front:
       * `DtapInvoices.find({ _id: { $in: invoiceIds } })`
       * Then collect all needed `dtapId`s, `teamId`s, `wireCenterId`s, and
         all `dtapItemsIds` across the whole batch, and `$in`-query each
         collection ONCE. Build lookup Maps keyed by `_id.toString()`.
       * Fetch `DtapPrices` exactly ONCE for the whole batch (it is the same
         global table for every invoice — currently re-fetched per invoice).
   - For each invoice, hand a pre-resolved bundle (invoice, dtap, team,
     wireCenter, records, pricesEntries) to a refactored
     `buildInvoicePayload(bundle, 'admin'|'team')` so no per-invoice DB I/O
     happens inside the loop.

2. Parallelize the Google Docs pipeline
   - In `web/lib/google.ts`, REMOVE the global `writeQueue` (the
     `let writeQueue: Promise<void> = Promise.resolve()` pattern). It
     serializes every write across the whole process, which is the single
     biggest reason batches are slow. The Google Docs API limit is per-USER,
     not per-process, and `batchUpdate` on DIFFERENT `docId`s does not
     conflict with itself.
   - Keep `waitForQuota()` (the sliding-window 50-writes/60s limiter) — that
     is the real safety net. It already throttles correctly across parallel
     callers because `writeTimestamps` is shared.
   - Inside `generateInvoicePdf`, run admin and team table inserts that target
     DIFFERENT docs in parallel with `Promise.all`. The reason the current
     route's admin and team calls are sequential is the same `writeQueue`
     bottleneck — once that's gone, the route can do:
        const [adminUrl, teamUrl] = await Promise.all([
          generateInvoicePdf(... admin args ...),
          generateInvoicePdf(... team args ...),
        ]);

3. Concurrency control for the batch
   - Add a small concurrency limiter (don't pull in `p-limit`, write a 30-line
     helper inside `lib/concurrency.ts`). Default concurrency = 4 invoices
     at a time = 8 PDFs in flight. Tune this against the 50 writes/min budget:
     a single invoice currently fires ~10-15 batchUpdate writes, so 4
     invoices ≈ 40-60 writes in a 60s window, right at the budget. Make the
     concurrency configurable via env var `INVOICE_BATCH_CONCURRENCY`.

4. Skip redundant Doc reads
   - `insertRecordsTable` in `lib/google.ts` reads the doc THREE times
     (lines 169, 212, 316) — once to find the marker, once to find the
     newly-inserted table, once again to apply center-alignment styling.
     The third read is unnecessary: the cell indices needed for alignment
     are already known from the second read. Cache `tableData` from step 2
     and reuse it in step 6 (the style pass) instead of calling
     `readDocument` again.

5. Multi-select UI in `web/app/dtap-invoices/dtap-invoices-content.tsx`
   - Add a checkbox column to the `DataTable` for each row.
   - Replace the per-row `handleGenerate` + `pendingQueue` design with:
       * A `selectedIds: Set<string>` state.
       * A "Generate Selected (N)" button in the PageHeader actions.
       * On click: POST `/api/dtap-invoices/generate-batch` with the array,
         then consume the streamed response and call `updateRecord` per
         invoice as each result arrives.
   - Keep the existing single-row Regenerate button for the common case of
     fixing one invoice, but route it through the same batch endpoint with
     `invoiceIds: [oneId]` so there's only one code path to maintain.
   - Show a top-bar progress strip: `Generated 3/12...` with the option to
     cancel (AbortController on the fetch).

6. Type safety + error handling
   - Strip the `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
     lines in `lib/google.ts` and `app/api/dtap-invoices/generate/route.ts`
     by introducing real types for the Docs API response shapes you actually
     use (Document, Body, ParagraphElement, Table). The current `any` jungle
     hides bugs that will bite hard once requests run in parallel.
   - In the batch endpoint, isolate failures: one failing invoice must NOT
     abort the rest. Stream `{ invoiceId, status: 'error', error: string }`
     for failures, `{ invoiceId, status: 'ok', adminInvoice, teamInvoice }`
     for successes.

## Constraints / things NOT to break

- The Google Doc TEMPLATES (placeholders, table markers like {{recordsTable}},
  {{adminPriceTable}}, {{teamPriceTable}}, {{dtapRecordPictures}}) are
  authored by the user — do not change placeholder names.
- The per-invoice Mongo write at the end (storing `adminInvoice`, `teamInvoice`,
  `invoiceGeneratedAt`, `invoiceGeneratedBy`) must still happen for every
  invoice in the batch.
- Old PDFs in Drive must still be best-effort deleted when regenerating
  (the current code uses `Promise.allSettled` with `extractDriveFileId` /
  `deleteDoc` — keep this behavior in the batch path).
- The 60 writes/min Google Docs quota is a HARD limit. Do not raise the
  `QUOTA_LIMIT` from 50 without telling the user — the buffer is there
  because the quota is per-user across the entire app, not per-route.

## How to know you're done

Bench before and after with a batch of 5 invoices, each with ~10 records and
~5 pictures. Target: ≥3× wall-clock speedup vs the current one-at-a-time
loop. Verify the same PDFs are produced (compare page counts, file sizes,
and a visual spot-check of one admin + one team PDF). Verify the Mongo
`adminInvoice` / `teamInvoice` fields are updated for every invoice in the
batch. Verify a single forced failure (e.g. invalid invoiceId in the array)
does not block the others.
```

---

## Prompt 3 — Hardening pass (security, perf, footguns)

```
You are doing a focused hardening pass on the Next.js app under `web/`.
This is a freelance project: keep the changes surgical, do not rewrite
working code, and do not introduce new dependencies unless explicitly
called for below. Work through the items in order — they are ranked by
real-world impact.

## 1. STOP leaking the Google access token to the browser (CRITICAL)

File: `web/auth.ts`, session callback (~line 100-107).

The current code does `session.accessToken = token.accessToken`. NextAuth
sends the session object to the client browser as JSON via
`/api/auth/session`. That means the Google OAuth access token — which has
full `documents` + `drive` scope — is readable by anyone who opens devtools
on the live app. Anyone who exfiltrates it can read/delete files in the
shared Drive folder until the token expires.

Fix:
  - REMOVE the line `session.accessToken = token.accessToken as string;`
    from the `session` callback. Keep `name` and `designation`.
  - The token already lives on the JWT, and server-side code in
    `app/api/dtap-invoices/generate/route.ts` already reads it via
    `const session = await auth()` on the server. Verify that path still
    works by checking that `auth()` invoked server-side still returns the
    accessToken from the JWT (it should — server-side `auth()` reads the
    raw JWT, not the client-facing session). If your TypeScript declares
    `session.accessToken`, also remove it from `web/types/next-auth.d.ts`
    so client code can't accidentally rely on it.

## 2. Add auth checks to every list/data API route (CRITICAL)

Files to check (grep `export async function (GET|POST|PUT|PATCH|DELETE)` in
`web/app/api/**/route.ts`). At minimum these are unprotected:
  - `app/api/dtap-invoices/route.ts`        (only `generate/route.ts` checks auth)
  - `app/api/dtap/route.ts`
  - `app/api/dtap-records/route.ts`
  - `app/api/dtap-prices/route.ts`
  - `app/api/bspd*/route.ts`
  - `app/api/teams/route.ts`
  - `app/api/users/route.ts`
  - `app/api/wire-centers/route.ts`

Today anyone who knows a URL can paginate through every invoice, team, and
user record in the database.

Fix: create `web/lib/with-auth.ts`:

  import { auth } from "@/auth";
  import { NextRequest, NextResponse } from "next/server";

  type Handler = (req: NextRequest, ctx: { session: NonNullable<Awaited<ReturnType<typeof auth>>> }) => Promise<Response>;

  export function withAuth(handler: Handler) {
    return async (req: NextRequest) => {
      const session = await auth();
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return handler(req, { session });
    };
  }

Then wrap every list/mutation handler:
  export const GET = withAuth(async (req, { session }) => { ... existing body ... });

Do this for every route file enumerated above. Do not change the body of the
handlers — only the function signature.

## 3. Debounce search input (perf, easy win)

File: `web/app/dtap-invoices/dtap-invoices-content.tsx`, the `<Input>` at
line 132-140 that calls `setSearchQuery(e.target.value)` on every keystroke.

Today, typing "invoice 123" fires ~11 Mongo aggregations because
`searchQuery` flows directly into `serverFilters` → `useInfiniteData` →
fetch on every change.

Fix: add `web/hooks/use-debounced-value.ts`:

  import * as React from "react";
  export function useDebouncedValue<T>(value: T, delay = 250): T {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
      const id = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
  }

In `dtap-invoices-content.tsx`:
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const serverFilters = React.useMemo(() => ({
    ...filters,
    q: debouncedSearch,     // use debounced value here
  }), [filters, debouncedSearch]);

Apply the same fix to the other content files that have a search box:
`app/dtap-records/...`, `app/dtap/...`, `app/bspd*/...`, `app/users/...`,
`app/teams/...`, `app/wire-centers/...`. Only debounce `searchQuery` — do
NOT debounce filter-select changes (those should feel instant).

## 4. Replace `<a href>` with `<Link>` in the sidebar (perf/UX)

Files:
  - `web/components/app-sidebar.tsx` (logo link + login link + profile menu)
  - `web/components/nav-main.tsx`     (every nav item)

Every sidebar click today does a full browser navigation: full reload, auth
re-init from scratch, sidebar re-render. Replacing with `next/link` enables
prefetching and client-side routing.

Fix:
  - `import Link from "next/link"` at the top of both files.
  - Replace `<a href="/dashboard">...</a>` with `<Link href="/dashboard" prefetch>...</Link>`.
  - Keep the same children (icons + spans).
  - For dropdown menu items that use `asChild` with `<a>`, switch them to
    `<Link>`.

Do NOT replace `<a href={row.adminInvoice} target="_blank">` PDF links —
those are external Drive URLs and should stay as plain anchors.

## 5. Stop forcing Google consent on every login

File: `web/auth.ts`, the Google provider config (~line 9-18).

Currently `prompt: "consent"` is hard-coded. This is correct on FIRST login
(it's how you get a `refresh_token`), but it forces every user to see the
permissions screen every time they log in.

Fix: change `prompt: "consent"` → `prompt: "select_account"`. The refresh
token is already stored in the JWT on the first login (your `jwt` callback
captures `account.refresh_token`), and `select_account` still lets users
swap Google accounts without re-granting permissions every time. If you're
worried about losing refresh tokens for brand-new users, run a one-time
manual sign-out + sign-in for yourself after the change to verify the
refresh flow still works.

## 6. Validate required env vars at startup

File: NEW `web/lib/env.ts`.

Today `process.env.GOOGLE_DOC_TEMPLATE_ADMIN!` (and similar `!` non-null
assertions) silently passes `undefined` into the Google APIs when the env
var is missing, producing confusing 400s mid-pipeline like "Failed to copy
template: 404 File not found:".

Fix:

  function required(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
  }

  export const env = {
    GOOGLE_DOC_TEMPLATE_ADMIN: required("GOOGLE_DOC_TEMPLATE_ADMIN"),
    GOOGLE_DOC_TEMPLATE_TEAM:  required("GOOGLE_DOC_TEMPLATE_TEAM"),
    GOOGLE_DRIVE_FOLDER_ID:    required("GOOGLE_DRIVE_FOLDER_ID"),
    AUTH_GOOGLE_ID:            required("AUTH_GOOGLE_ID"),
    AUTH_GOOGLE_SECRET:        required("AUTH_GOOGLE_SECRET"),
    MONGODB_URI:               required("MONGODB_URI"),
  };

Replace every `process.env.XXX!` in `app/api/**/route.ts`, `lib/google.ts`,
`auth.ts`, and `lib/mongodb.ts` with `env.XXX`. The `required()` call
throws at import time, so a misconfigured deploy fails immediately with a
clear message instead of failing mysteriously inside an API call.

## 7. Stable sort for `pricesEntries`

File: `web/app/api/dtap-invoices/generate/route.ts`, line ~186.

Today: `const pricesEntries = await db.collection("DonoUtilities_DtapPrices").find({}).toArray();`

There is no `.sort()`. Mongo's natural order is NOT stable — if the
collection ever gets compacted, gets a deleted+re-inserted document, or
moves chunks in a sharded setup, the line-item order in your generated
invoices will change.

Fix: identify the intended ordering field (likely `order`, `sortOrder`, or
`createdAt`) by inspecting one document with
`db.DonoUtilities_DtapPrices.findOne()`, then add `.sort({ <field>: 1 })`
to the query. Apply the same review to `bspd-invoices/generate` if it
exists — same pattern, same bug.

## 8. Work around the Turbopack panic for dev

File: `web/package.json`, the `dev` script.

The dev server is panicking with "Failed to write app endpoint" on Next
16.1.1 + Turbopack. This is upstream — not your code.

Fix (temporary): remove `--turbopack` from the dev script:
  "dev": "PORT=$(node -e \"...\") next dev"

Webpack dev is slower to start (~3-5s vs ~1s) but does not panic, and the
build output is identical. Re-enable Turbopack on the next Next.js patch
release (track https://github.com/vercel/next.js/issues for "Failed to
write app endpoint").

## Deliverable

A single PR or commit that completes items 1–8 in order. After each item,
sanity-check:
  - Item 1: `curl http://localhost:PORT/api/auth/session` while logged in
    should NOT include `accessToken` in the JSON.
  - Item 2: `curl http://localhost:PORT/api/dtap-invoices` while logged out
    should return 401.
  - Item 3: type fast in the search box, watch the dev-server terminal —
    one request after you stop typing, not one per keystroke.
  - Item 4: click a sidebar item, confirm no full-page flash (the sidebar
    stays mounted).
  - Item 5: log out, log back in — Google should show the account picker
    only, not the permissions screen.
  - Item 6: temporarily rename `GOOGLE_DOC_TEMPLATE_ADMIN` in `.env.local`,
    restart dev — the server should fail to boot with a clear error.
  - Item 7: regenerate the same invoice twice — line items in the PDF
    should be in the exact same order both times.
  - Item 8: dev server starts and stays up without "Turbopack panic" lines.
```

---

## Prompt 4 — Make batch generation feel fast AND show real progress

```
Context: Prompts 1 and 2 are shipped. `web/app/api/dtap-invoices/generate-batch/route.ts`
exists, uses SSE, batches Mongo lookups, uses a `createLimiter()` (default
concurrency 4), and admin+team PDFs go in parallel via `Promise.all`. The
global `writeQueue` was removed from `web/lib/google.ts`. The client in
`web/app/dtap-invoices/dtap-invoices-content.tsx` consumes the SSE stream
with a `ReadableStreamDefaultReader` + `TextDecoder` loop.

Despite all that, the user reports: kicking off 9 invoices shows
"Generated 0/9..." and that counter sits at 0 for a long time before
anything changes. They are not sure anything is happening at all.

There are TWO separate problems here. Fix both.

## Problem A: progress isn't streaming to the browser ("0/9..." stuck)

Root cause is almost certainly SSE response buffering. By default a Next.js
route handler runs on the Node runtime, which may buffer the response
through `compression` middleware, through dev-server proxies, and through
the Fetch streaming implementation. The SSE bytes are produced inside
`controller.enqueue(...)` but they don't reach the browser reader until
the buffer flushes — which can be at the end of the whole batch.

Fix in `web/app/api/dtap-invoices/generate-batch/route.ts`:

1. At the top of the file, force the Node runtime AND extend the timeout:

     export const runtime = "nodejs";
     export const dynamic = "force-dynamic";
     export const maxDuration = 300;   // 5 min — match your hosting limit

2. Add the anti-buffering headers to the Response:

     return new Response(stream, {
       headers: {
         "Content-Type": "text/event-stream",
         "Cache-Control": "no-cache, no-transform",
         "Connection": "keep-alive",
         "X-Accel-Buffering": "no",      // nginx / Vercel hint
       },
     });

3. Emit a `started` event when each invoice's task ACTUALLY begins (inside
   the limiter callback, before the long-running Google calls). Right now
   the only per-invoice event is the final `{ status: "ok" }` after both
   PDFs are done. That means the browser sees absolutely nothing for the
   first ~30-60 seconds. Add:

     controller.enqueue(encoder.encode(sseEvent({
       invoiceId,
       status: "started",
     })));

   ...as the first line inside the `limit(async () => { try { ... } })`
   block. Then on the client, when a `started` event arrives, set that
   invoice's row spinner immediately. That alone makes the UI go from
   "nothing is happening" to "I can see 4 spinners working" within 1s of
   pressing the button.

4. Send a heartbeat every 5 seconds so any intermediate proxy keeps the
   connection alive AND the client knows the server is still working:

     const heartbeat = setInterval(() => {
       try { controller.enqueue(encoder.encode(`: ping\n\n`)); }
       catch { clearInterval(heartbeat); }
     }, 5000);

     // ...inside finally:
     clearInterval(heartbeat);

5. Client side, in `web/app/dtap-invoices/dtap-invoices-content.tsx`, handle
   the new `status: "started"` event by adding `invoiceId` to
   `batchGeneratingIds` (it is currently populated up-front for ALL ids,
   which is misleading — change it to only add IDs as their `started`
   event arrives, so the user sees the limiter concurrency reflected in
   real time).

Verify the fix: open devtools → Network → click the `generate-batch`
request → confirm the response shows `event-stream` and that events
appear in the response body LIVE as each invoice completes, not all at
the end.

## Problem B: the batch genuinely takes minutes — find the real ceiling

The Google Docs writes/minute quota is the binding constraint. Count it:

  Per PDF (read `lib/google.ts` carefully, grep `batchUpdateDoc`):
    - copyTemplate         → 0 Docs writes (Drive call)
    - insertRecordsTable   → 2 Docs writes  × 2 tables = 4
    - insertPicturesGrid   → 4 Docs writes (title, table, images, borders)
    - fillPlaceholders     → 1 Docs write
    - exportAsPdf          → 0 Docs writes (Drive read)
    - uploadPdfToDrive     → 0 Docs writes (Drive write)
    - deleteDoc            → 0 Docs writes (Drive delete)
    TOTAL                  ≈ 9 Docs batchUpdate writes per PDF

  Per invoice = 2 PDFs = ~18 writes.
  9 invoices = ~162 writes.

  With QUOTA_LIMIT = 50/min in `lib/google.ts`, the FLOOR is ~3.2 minutes
  for 9 invoices NO MATTER how much you parallelize. Network latency on
  each batchUpdate (~400-800ms) adds another minute or two. Total ≈ 4-6 min.

That is the actual wall. To go faster you must either reduce writes per
PDF or raise the quota. In priority order:

1. Collapse the picture grid into fewer writes (`insertPicturesGrid` in
   `lib/google.ts`, line 482-625):
     - Today it does 4 separate batchUpdates: title insertion + style,
       insertTable, image insertion, borderless styling.
     - Steps 2 and 4 can be merged into the same batchUpdate as the title
       step IF you compute the eventual `tableStartLocation` index from
       the title length up-front (you already know `titleText.length`).
     - The post-insertion `readDocument` to find cell positions can be
       eliminated by using the deterministic index math: after
       `insertTable` at index N, the first cell content starts at known
       offsets relative to N (one per row × column, with fixed-size
       intermediate tokens).
     - Realistic target: 4 writes → 2 writes per picture grid.

2. Skip the picture grid entirely when an invoice has zero pictures
   (`pictureUrls.length === 0`). The current code calls
   `insertPicturesGrid`, which immediately returns inside if there are no
   valid URLs — but it still costs the upstream `readDocument` and a
   wasted code path. Guard at the caller in
   `app/api/dtap-invoices/generate/route.ts` and the new batch route:
       if (pictureUrls.length === 0) { /* skip picturesGrid block entirely */ }

3. Skip the prices table when it has zero rows (some invoices have admin
   prices but empty team prices, or vice versa). `generateInvoicePdf`
   already does `if (t.records.length > 0)` per table — verify the
   batch route is passing empty arrays correctly and they're not falling
   through to wasted reads.

4. Raise concurrency carefully. Today `INVOICE_BATCH_CONCURRENCY` defaults
   to 4 (= 8 PDFs in flight = ~72 writes/min attempted). With QUOTA_LIMIT
   at 50/min, you're already throttled. Either:
     a) Drop concurrency to 3 — the limiter kicks in less, so each PDF
        finishes more linearly and the user sees consistent progress
        instead of a 60s pause every minute when `waitForQuota` blocks.
     b) OR raise QUOTA_LIMIT to 58 (still under 60) AND keep concurrency
        at 4. You'll occasionally tip into 429s, but `batchUpdateDoc`
        already retries with 15s/30s/60s backoff.

5. If even that is too slow for the user's workflow, the only remaining
   lever is a second Google service account / OAuth credential. The
   60/min quota is per-user, so two users = 120/min. Out of scope for
   this prompt — flag it to the user as a follow-up architectural decision.

## Diagnostic deliverable

Add a `console.time` / `console.timeEnd` pair around each invoice in the
batch route. Log per-invoice wall time AND a running write count. Then
run a 9-invoice batch and paste the server log. The user wants to
SEE the actual numbers, not just "it's slow":

  [batch] start (9 invoices, concurrency=4)
  [batch] inv 10572 started
  [batch] inv 10571 started
  [batch] inv 10570 started
  [batch] inv 10569 started
  [batch] inv 10572 done in 38.2s (18 writes)
  [batch] inv 10568 started
  ...

Once those logs exist, the user can tell the difference between "the
quota is the wall" and "something else is broken".

## Done definition

- Pressing "Generate Selected (9)" shows up to N spinners (N = concurrency)
  within 1 second.
- The "Generated X/9" counter advances visibly as each invoice finishes,
  not in one jump at the end.
- Server log shows per-invoice timings.
- A 9-invoice batch finishes in roughly (9 × 18 writes) / writes-per-min,
  i.e. ≤ 4 minutes once the write-count optimizations land. If wall time
  is significantly higher, something other than the quota is the bottleneck
  and you keep digging.
```

---

## Tips for using these prompts

Paste them one at a time, in order — fix the loop first, then ship the batch feature, then run the hardening pass. All three prompts assume the agent can `pnpm dev`, read files in `web/`, and edit them. If your agent has a built-in browser, ask it to verify the loop fix by watching the dev-server terminal for 30 seconds with `/dtap-invoices` open. For the batch prompt, ask it to add a small bench script in `web/scripts/bench-batch.ts` so you can keep measuring future regressions. The hardening pass is the kind of work that is easy to skip and expensive to skip — items 1 and 2 should ship before this app sees a real user.
