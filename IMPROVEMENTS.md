# Bloom — Mid-Level Readiness Backlog

A prioritized list of improvements to bring Bloom up to a consistent mid-level
engineering standard. The app is already past junior level (layered architecture,
tests, CI, structured logging, centralized error handling, input validation,
internal-secret auth, Decimal money columns, Docker, rate limiting). The items
below are mostly **consistency** and **production-hardening** gaps, not missing
features.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Tier 1 — Highest signal, low effort (intended-but-incomplete work)

### [x] 1. Use the Prisma singleton everywhere
**Problem:** `backend/src/lib/prisma.ts` exports a singleton (added in commit
`e178a93`), but only `app.ts` imports it. All 8 services still call
`new PrismaClient()`, creating 8 separate connection pools that will exhaust
Postgres connections under load / in serverless.

**Files using their own client:**
- `backend/src/services/accountService.ts:6`
- `backend/src/services/budgetService.ts:6`
- `backend/src/services/plaidService.ts:11`
- `backend/src/services/profileService.ts:4`
- `backend/src/services/recurringTransactionService.ts:6`
- `backend/src/services/savingsGoalService.ts:5`
- `backend/src/services/transactionSearchService.ts:3`

**Fix:** replace each `const prisma = new PrismaClient()` with
`import prisma from "../lib/prisma"`. Verify tests still pass (test-setup may
need to reference the singleton for cleanup).

---

### [x] 2. Finish the Decimal money migration (remove `::float8` read casts)
**Problem:** Commit `2fb5024` moved money from `FLOAT → DECIMAL` "to avoid
computation errors," but the read path has ~30 `::float8` casts
(e.g. `"balance"::float8 AS "balance"`). Money is converted back to JS floats
on every read, reintroducing the precision loss the migration was meant to fix.
Storage is safe; the application layer is not.

**Fix:** read Decimal as string (or use Prisma's Decimal type / a Decimal
library like `decimal.js`) and keep money values precise through computation and
display. Update the `balance: number` / `amount: number` types in service
records accordingly. Audit all arithmetic on money values.

**Search:** `grep -rn "::float8" backend/src`

---

### [x] 3. Add ESLint + Prettier and enforce in CI
**Problem:** No ESLint or Prettier config in either package. Project style rules
in `CLAUDE.md` (no abbreviations, JSDoc on every function) are not
machine-enforced — e.g. `accounts.ts` has `uid`/`pid` helpers that violate the
naming rule.

**Fix:**
- Add ESLint (typescript-eslint) + Prettier to `frontend` and `backend`.
- Add `lint` and `format:check` npm scripts.
- Add a `lint` step to `.github/workflows/ci.yml` for both jobs.
- Fix existing violations (rename `uid`/`pid`, etc.).

---

## Tier 2 — Production hardening

### [ ] 4. Encrypt Plaid access tokens at rest
**Problem:** `schema.prisma` says `// NOTE: accessToken is stored in plain text
— encrypt before production.` (model `PlaidItem`). Tokens grant access to users'
real bank data.

**Fix:** encrypt `accessToken` with AES-256-GCM using a key from env (or a KMS),
encrypt on write in `plaidService.ts`, decrypt on read. Never log the token.

---

### [ ] 5. Validate environment variables at startup
**Problem:** Env vars are read ad-hoc (`process.env.X ?? ""`). The Next.js proxy
sends `X-Internal-Secret: process.env.INTERNAL_API_SECRET ?? ""` — an empty
string silently if misconfigured, producing confusing 401s instead of a loud
failure.

**Fix:** add a Zod (or hand-rolled) env schema validated once at boot in both
`backend` and `frontend`; crash with a clear message if anything required is
missing. Required keys today: `DATABASE_URL`, `INTERNAL_API_SECRET`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_URL`. Optional:
`ANTHROPIC_API_KEY`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`.

---

### [ ] 6. Fix / verify CI database setup
**Problem:** The backend CI job sets `DATABASE_URL=...localhost:5432...` but the
workflow never starts a Postgres service container. Either backend tests don't
actually hit the DB (thinner coverage than it appears) or the job is misleading.

**Fix:**
- Add a `services: postgres` container to the backend job (with health check).
- Run `prisma migrate deploy` before tests.
- Trigger CI on `pull_request` as well as `push`.
- Add a `build` step (`tsc` / `next build`) so broken builds are caught.

---

### [ ] 7. Move rate limiting to a shared store
**Problem:** The AI-chat rate limiter (`frontend/src/app/api/learn/chat/route.ts`)
is an in-memory `Map`. It resets on restart and doesn't work across multiple
instances — incompatible with the prod Docker / multi-instance setup.

**Fix:** back the limiter with Redis (e.g. Upstash) or another shared store.
Consider applying rate limiting to the main backend API too, not just AI chat.

---

## Tier 3 — Nice to have / polish

- [ ] **Replace hand-rolled validation with Zod** — `backend/src/lib/validation.ts`
  works but Zod gives schema validation + inferred types in one place and removes
  repetitive manual checks in routes (see `accounts.ts` import handler).
- [ ] **API versioning** — namespace routes under `/api/v1` to allow breaking
  changes later.
- [ ] **OpenAPI / Swagger docs** — generate API docs from route/schema definitions.
- [ ] **E2E tests** — add Playwright for critical user flows (login → create
  account → add transaction → view dashboard). Unit + component coverage is
  already solid.
- [ ] **Error monitoring** — wire Sentry (or similar) so unhandled errors in prod
  are captured beyond stdout logs.
- [ ] **Replace `console.*` with the logger** — ~5 `console.*` calls remain in
  backend src (e.g. `middleware/internalAuth.ts`) instead of the pino `logger`.
- [ ] **Health check depth** — `/health` probes the DB; consider also reporting
  build/version and dependency (Plaid/Anthropic) reachability for readiness.

---

## Notes
- Tier 1 items (1–3) are the best first pass: cheap, high-signal, and mostly
  finishing work that's already half-done in the repo.
- None of these require new product features — they make the existing system
  consistent and production-ready.
