# Bloom — Claude Instructions

Bloom is a beginner-focused Canadian personal finance app. Read this whole file before making changes. When a rule here conflicts with what you'd do by default, this file wins.

## Project Overview

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript. Styling is **inline `style={{}}` objects** plus Tailwind utility classes and a shared `globals.css`. shadcn/ui provides primitives.
- **Backend:** Express 5 + TypeScript. Data access is **Prisma with raw/hand-written SQL** (not the Prisma query builder for most reads). PostgreSQL.
- **Auth:** NextAuth v5, Google OAuth. Reads the `AUTH_`-prefixed env vars (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`). Middleware protects routes.
- **Deployment:** Render — separate frontend and backend services plus a managed Postgres.
- **Primary data path:** the CSV/bank **import** feature is the main way transactions enter Bloom; Plaid (sandbox) is secondary.

## Architecture (facts you can't infer from the file tree)

- **The browser never calls the backend directly.** The frontend calls its own `/api/*` routes, and `next.config.ts` rewrites `/api/*` to `${NEXT_PUBLIC_API_URL}/api/*` **server-side**. Consequence: there is **no CORS setup** and none is needed; the backend is only ever hit server-to-server.
- **`page.tsx` files are thin orchestration layers.** They own data-loading and top-level state, then pass data into feature components. Feature logic does **not** live in `page.tsx` (see Modularity).
- **`CollapsibleCard` (`src/components/collapsible-card.tsx`) is the shared dashboard-card primitive.** It exposes `eyebrow`, `title`, `description`, and `headerRight` slots and owns its own collapse animation. Prefer it over hand-rolling a card.
- **Backend route → service → SQL layering.** Routes validate/parse input and call services; services hold the logic and the SQL. Keep that separation.

## Modularity

Never add new feature logic directly to `page.tsx` or another existing file if it can live in its own module. When implementing a new feature or UI section:

- Create a dedicated file for it.
- Place it in a semantically named subfolder under `_components/`.
- Use underscore-prefixed folder names (e.g. `_import`, `_accountActions`, `_accountTransactions`) to mark them as private/non-route in Next.js.

**Example structure:**
```
app/account/[id]/
  page.tsx
  _components/
    _import/
      ImportTab.tsx
      import-csv.ts
    _accountActions/
      FreezeButton.tsx
      DeleteAccount.tsx
      NicknameEditor.tsx
    _accountTransactions/
      DeleteTransaction.tsx
```

A component or utility belongs in its own file when it has its own state, makes API calls, or contains more than trivial JSX.

**Co-location rule:** place a file in the most specific folder that covers all its consumers. If a component or utility is only ever used by files inside `_accountTransactions/`, it lives inside `_accountTransactions/` — not in a new sibling folder at the `_components/` level. Only promote to a higher folder (or `src/components/`) when a second, distinct feature needs to import it.

**Pure logic goes in its own `.ts` file, not inside a component.** Calculation/derivation helpers (e.g. `contribution-room.ts`, `insights.ts`) live separately from the React component that renders them, so they are unit-testable in isolation. This is a hard rule for anything with branching or edge cases.

## Naming

Use full, descriptive names for all identifiers — functions, constants, variables, and types. Abbreviations are unacceptable unless universally understood domain terms (e.g. `id`, `url`).

- **Functions** — name for what they do: `formatCurrency`, not `fmt`; `handleSubmit`, not `onSub`.
- **Constants** — name for what they represent: `inputStyle`, not `s`; `ACCOUNT_TYPE_META`, not `META`.
- **Variables** — spell out intent: `isSubmitting`, not `loading2`; `selectedAccountId`, not `selId`.
- **Booleans** — prefix with `is` / `has` / `should`: `isSubmitting`, `hasCreatedFirstAccount`, `shouldWarn`.

If a name needs a comment to explain what it refers to, the name is wrong — rename it instead.

## Comments

Add a JSDoc comment above every function — including handlers, helpers, and hooks. Explain the **why or what** in one line; do not restate the function name.

```ts
/** Saves the updated nickname via the API and notifies the parent with the updated account. */
async function handleSave() { ... }

/** Syncs the local input value when the nickname prop changes after a parent refresh. */
useEffect(() => { ... }, [nickname, editing]);
```

## State Ownership (Controlled Component Pattern)

When a child needs to change state that the parent also reads, the state belongs in the parent. Pass the value and a setter callback as props.

```tsx
// Parent owns the state
const [pendingId, setPendingId] = useState<string | null>(null);

// Child receives value + callback
<DeleteTransaction
  pendingTransactionId={pendingId}
  onPendingChange={setPendingId}
  ...
/>
```

Do not define state inside a child if a sibling or parent also needs to read or set it.

## UI — reach for existing components first

Before building a custom UI component, check whether shadcn/ui (`src/components/ui/`) or the shared component library already provides it. Check for an existing shadcn input/select/dialog before writing raw HTML with inline styles.

- **Dialogs / confirms** → use shadcn `AlertDialog` before writing a custom modal.
- **Shared, non-route components** (e.g. `BackToHome`) → live in `src/components/`, not inside a route's `_components/` folder.
- **Cards** → use the `CollapsibleCard` primitive rather than rebuilding a card shell.

## Interaction rules (non-negotiable)

- **Every create or delete must fire a toast.** Use `toast` from `sonner` — `toast.success(...)` on success, `toast.error(...)` on failure. Call it directly in the component that performs the action. Never use inline `opError` / `opSuccess` state for user feedback. A create or delete that lands silently is a bug.
- **Deletes are always two steps:** (1) a shadcn `AlertDialog` confirm with the item name in the description, then (2) `toast.success("X deleted")` after it completes. Never delete immediately on click.
- **Creates confirm on success:** `toast.success("X created")` immediately after a successful creation.

## Styling

- The app uses **inline `style={{}}` objects**. Inline styles **cannot** contain `:hover`, `:active`, media queries, or other pseudo/at-rules — this is a frequent source of bugs. When you need any of those, add or reuse a class in `globals.css`.
- **Buttons need a hover state.** Every interactive button needs a CSS `:hover` effect via a `globals.css` class (e.g. `.press`, `.budget-action-pill`, `.budget-delete-button`), paired with a matching `:active` response. Any transform must be guarded under `@media (prefers-reduced-motion: reduce)`.
- **Responsive/mobile:** because inline styles can't hold media queries, branch on the existing mobile hook (`use-mobile` / `useSidebar().isMobile`, breakpoint 768px) to compute layout values in JS, or use intrinsically-responsive grid values (`minmax(0, 1fr)`, `repeat(auto-fit, …)`). Reuse the existing hook and breakpoint — do not add a second viewport listener or a different breakpoint.
- Use CSS variables for theme colors (`var(--surface-1)`, `var(--border)`, `var(--text-secondary)`, etc.). The amber accent is `#f59e0b`. Match neighboring components rather than introducing new values.
- Keep desktop rendering identical when adding mobile branches — every responsive change should be gated on the breakpoint or be an intrinsically-responsive value.

## Testing conventions

The suite is **Vitest** on both frontend and backend. `npm test` runs once and exits — never pass Jest-only flags like `--watchAll`.

- **Location:** co-locate tests as `*.test.ts` / `*.test.tsx` next to the source.
- **Highest-value targets:** pure-logic helpers with branching (score/insight/derivation utilities) and untested backend **services** (route tests already mock the service layer, so the service logic itself needs direct coverage).
- **Frontend mocking:** mock `@/lib/api`, `next/navigation`, `sonner`, and chart libs (`recharts`); assert on user-visible text/roles, not class names or inline styles.
- **Backend mocking:** the house pattern is `vi.hoisted` for the service mock → `vi.mock(...)` → supertest against `app`, asserting status, that the service was called with the right args, and that validation rejects bad payloads before the service runs.
- Tests must verify real behavior, not restate the implementation. Cover happy path, each branch, and boundary values. Never leave failing or skipped tests.

## Gotchas (things that have bitten this project)

- **`NEXT_PUBLIC_*` is baked in at build time**, not read at runtime. If you change one (e.g. `NEXT_PUBLIC_API_URL`), the frontend must be **rebuilt**, not just restarted.
- **Production migrations use `prisma migrate deploy`, never `migrate dev`.** `migrate dev` tries to author new migrations and prompts interactively, which breaks in CI/deploy. Migration folders must be committed for `deploy` to have anything to apply.
- **Non-JSON API responses crash the parser.** A backend 502/404 returns HTML, and calling `res.json()` on it throws `JSON.parse: unexpected character…`. Check `res.ok` (and ideally content-type) before parsing, and surface a clean error.
- **Auth env var naming matters.** The bare `Google` provider in `auth.ts` relies on `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. The production Google OAuth client must whitelist the deployed callback URL, and `AUTH_URL` must match the real deployed origin exactly.
- **Free-tier backend cold-starts** (~1 min after 15 min idle) — the first request after idle may fail; this is infra, not app logic.

## Post-Implementation Checklist

After every implementation, run the full checklist and fix any failures before reporting the task complete. These mirror the GitHub CI jobs (`.github/workflows`) exactly — CI runs typecheck + lint + format:check + test for **both** packages.

```bash
# Frontend (mirrors the "Frontend (typecheck + test)" CI job)
cd frontend
npx tsc --noEmit
npm run lint
npm run format:check
npm test

# Backend (mirrors the "Backend (typecheck + test)" CI job)
cd backend
npx prisma generate
npx tsc --noEmit
npm run lint
npm run format:check
npm test
```

If `format:check` fails in either package, run `npx prettier --write src` from that package's directory to auto-fix, then re-verify.

## Implementation Summary

At the end of every feature implementation, provide a short summary in this format:

**Files touched:**
- `path/to/file.tsx` — what was added or removed

**Example:**
```
Files touched:
- frontend/src/app/account/[id]/_components/_accountTransactions/DeleteTransaction.tsx — created; AlertDialog + delete handler
- frontend/src/app/account/[id]/page.tsx — removed handleDeleteTransaction, AlertDialog import; wired <DeleteTransaction> props
```