# Implement Feature 4: TFSA / RRSP / FHSA Contribution Room Tracker

You are working in the **Bloom** codebase — a beginner-focused Canadian personal finance app (Next.js 15 / React 19 / TypeScript frontend, Express 5 / Prisma / PostgreSQL backend). Read `CLAUDE.md`, `README.md`, and the **Feature 4** section of `GOALS.md` before writing any code. Follow every convention in `CLAUDE.md` exactly.

## What to build

A **contribution room tracker** for Canada's three registered account types (TFSA, RRSP, FHSA). Bloom currently lets users open these account types but offers no help avoiding the single most expensive mistake users make in them: TFSA over-contribution (1%/month CRA penalty) and RRSP under-utilization. This feature closes that gap with per-account-type panels and a one-time profile setup.

### The three panels (rendered on the relevant account detail page)

1. **TFSA panel** — estimates lifetime room from the user's birth year, subtracts contributions made elsewhere (user-supplied), and subtracts net deposits to all of the user's TFSA accounts in Bloom.
   - "Estimated TFSA room remaining: $34,500"
   - Setup prompt when `tfsaBirthYear` is null: "Enter your birth year on your profile to estimate your TFSA room →"
   - Warning state when remaining ≤ 0: red banner, "You may be at or over your TFSA limit. CRA penalizes over-contributions at 1%/month."

2. **RRSP panel** — usage meter against the user's CRA deduction limit (user-supplied from their Notice of Assessment), minus net deposits to all of the user's RRSP accounts in Bloom.
   - "$8,400 of $14,000 deduction room used (60%)"
   - Setup prompt when `rrspContributionRoom` is null: "Enter your RRSP deduction limit from your CRA Notice of Assessment →"

3. **FHSA panel** — shows annual (max $8,000) and lifetime (max $40,000) limits versus current-year deposits and total deposits to all of the user's FHSA accounts in Bloom.
   - Two progress bars: "This year: $3,500 of $8,000" and "Lifetime: $12,500 of $40,000"
   - No profile fields required — FHSA limits are fixed by CRA.

### Important behavioral rules

- Every value displayed is an **estimate within Bloom**. The panels must say so clearly: "Based on deposits tracked in Bloom — does not include contributions made outside the app." This avoids giving users a false sense of precision.
- "Deposits in Bloom" means **net** of withdrawals (deposits minus withdrawals) on accounts of that type. Treat transfers between two accounts of the same registered type as zero net change.
- The setup prompts on TFSA/RRSP panels must link to `/profile`.
- Each panel must include a one-line "What is this?" link to the matching card on the Learn page (the existing `LearningCards.tsx` has TFSA, RRSP, and FHSA cards already).

## Data: schema changes

Extend the `Profile` model in `backend/prisma/schema.prisma` with three nullable fields:

```prisma
tfsaBirthYear           Int?    // year of birth (e.g. 1998); used to estimate TFSA lifetime room
tfsaRoomUsedElsewhere   Float?  // user-supplied dollar amount contributed to TFSAs outside Bloom
rrspContributionRoom    Float?  // CRA deduction limit from the user's Notice of Assessment
```

Generate a new Prisma migration with a descriptive name (e.g. `add_contribution_room_fields_to_profile`). All three fields must be **nullable** so existing users aren't broken. Run `prisma migrate dev` locally and `prisma generate`.

Update `backend/src/services/profileService.ts` to:
- Accept and persist the three new fields on `upsertProfile`.
- Return them on `getProfile`.
- Validate inputs server-side: `tfsaBirthYear` between 1900 and the current year, `tfsaRoomUsedElsewhere ≥ 0`, `rrspContributionRoom ≥ 0`. Follow the existing `AppError(400, "...")` validation pattern in this file.
- Update the route layer in `backend/src/routes/profile.ts` to accept these new fields in the PUT body, sanitizing/parsing them in the same style as the existing fields.

## Data: TFSA lifetime room table (frontend)

Create `frontend/src/lib/contribution-room.ts` with a hardcoded TFSA annual limits table sourced from the CRA. The cumulative-by-year-turning-18 calculation is well-known and stable; use this:

```
2009: $5,000   2010: $5,000   2011: $5,000   2012: $5,000   2013: $5,500
2014: $5,500   2015: $10,000  2016: $5,500   2017: $5,500   2018: $5,500
2019: $6,000   2020: $6,000   2021: $6,000   2022: $6,000   2023: $6,500
2024: $7,000   2025: $7,000   2026: $7,000
```

Export pure functions with these signatures (these are the targets for unit tests — write them so they're trivially testable):

```ts
/** TFSA lifetime room a person has accumulated by the given year, given their birth year. */
export function calculateTfsaLifetimeRoom(birthYear: number, currentYear: number): number;

/** Net contributions to a list of accounts of a given type in Bloom: deposits minus withdrawals. */
export function calculateNetContributions(transactions: Transaction[], accountIds: string[]): number;

/** Same as above but restricted to a specific calendar year (for FHSA annual limit tracking). */
export function calculateNetContributionsForYear(transactions: Transaction[], accountIds: string[], year: number): number;

/** FHSA annual limit ($8,000) and lifetime limit ($40,000) — exported as constants. */
export const FHSA_ANNUAL_LIMIT = 8000;
export const FHSA_LIFETIME_LIMIT = 40000;
```

The calculation rule for `calculateTfsaLifetimeRoom`: a person accumulates room starting in the year they turn 18 (or 2009 if they turned 18 before then, since TFSAs were introduced in 2009). Return `0` if they haven't turned 18 yet.

## Frontend: components

Create three sibling panel components under `frontend/src/app/account/[id]/_components/_contributionRoom/`:

- `TfsaRoomPanel.tsx`
- `RrspRoomPanel.tsx`
- `FhsaRoomPanel.tsx`

Plus a thin dispatcher component in the same folder, `ContributionRoomPanel.tsx`, which picks the right panel based on `account.accountType` and renders nothing for non-registered types. The account detail page should import only this dispatcher.

Each panel should:
- Match the visual language of existing account-page panels (e.g. `NicknameEditor`, `_debtPayoff` if it exists) — `var(--surface-1)` background, `var(--border)` borders, `border-radius: 16px`, `padding: 24px`. Use the per-type accent color from `ACCOUNT_TYPE_META` in `frontend/src/lib/constants/account.ts`.
- Use the established 11px uppercase letter-spaced section header pattern ("Contribution Room").
- Render a progress bar for used vs. available room.
- Be **collapsible by default** using the existing `CollapsibleCard` primitive if it fits the visual style.

### Profile page additions

Extend `frontend/src/components/profile-form-panel.tsx` (or a new co-located sub-section if the form is getting long) with a new "Contribution Room" section containing three optional inputs:
- "Year of birth" — number input, hint: "Used to estimate your TFSA contribution room."
- "TFSA room used elsewhere" — currency input, hint: "Any contributions to TFSAs outside Bloom."
- "RRSP deduction limit (from your CRA Notice of Assessment)" — currency input, hint: "Find this on the CRA's My Account portal or your latest NOA."

All three are optional; saving with them blank persists `null`. Use the existing `inputStyle` helper.

## Architecture conventions (from `CLAUDE.md` — non-negotiable)

- **Modularity:** one component per file, underscore-prefixed folders for feature groups. The new contribution-room logic lives in its own folder.
- **Data flow:** the account detail page already loads the account, transactions, and likely the profile — pass the needed data into `ContributionRoomPanel` as props. Don't fetch from inside the panel. If the profile isn't already loaded on this page, add a single `api.getProfile()` call at the page level — not inside the panel.
- **API client extension:** add the new profile fields to the `Profile` type in `frontend/src/lib/api.ts` and to the `saveProfile` payload.
- **Naming:** full descriptive names (`calculateTfsaLifetimeRoom`, not `tfsaCalc`).
- **Comments:** one-line JSDoc above every function, handler, and hook explaining the why/what.
- **Tone:** factual and gentle. Never alarmist. Always include the "estimate within Bloom" caveat.

## Testing

Add Vitest tests following the existing house style:

**Frontend pure-logic tests** in `frontend/src/lib/contribution-room.test.ts`:
- `calculateTfsaLifetimeRoom`: birth year before 1991 (full table accumulated), birth year exactly when user turns 18 in the current year, birth year that makes user still under 18 (returns 0), boundary years (turning 18 in 2009 itself).
- `calculateNetContributions`: only counts transactions on the specified account IDs, sums DEPOSIT positively, sums WITHDRAWAL negatively, ignores TRANSFER_IN/TRANSFER_OUT between same-type accounts, returns 0 for empty input.
- `calculateNetContributionsForYear`: same as above but restricted to a year window.

**Backend service tests** in `backend/src/services/profileService.test.ts` (create if missing): validate the new fields' bounds and that nulls are accepted.

**Backend route tests**: extend `backend/src/routes/profile.test.ts` to assert the new fields round-trip and that invalid values (e.g. `tfsaBirthYear: 1700`, negative dollar amounts) are rejected with 400.

**Component tests** are nice-to-have but lower priority — focus on conditional rendering only: setup-prompt state when profile fields are null, normal display when set, warning state when room ≤ 0.

Mock `@/lib/api`, `next/navigation`, and `sonner` exactly as the existing frontend tests do. Run `npm test` in both packages and ensure everything passes — do not leave failing or skipped tests.

## Wiring

On the account detail page (`frontend/src/app/account/[id]/page.tsx` or equivalent), render `<ContributionRoomPanel>` near the top of the page (above the new transaction form and transaction history) when `account.accountType` is one of `TFSA | RRSP | FHSA`. Pass the account, the user's full transaction list for accounts of the matching type, and the profile.

## Out of scope (do not implement)

- Bloom-specific over-contribution tracking history. Just show the current estimate.
- Cross-year RRSP carry-forward math beyond what the user types in.
- Editing the CRA limits table from the UI. Keep them as a hardcoded constant for now.
- Any of GOALS.md Feature 15 (RRSP Tax Savings Estimator) — that's a separate feature even though it lives in a similar place.

## Deliverable

End with the `CLAUDE.md` Implementation Summary:

```
Files touched:
- path/to/file.ts — what was added or removed
```

Plus confirmation that `npm test` passes in both `backend/` and `frontend/`.
