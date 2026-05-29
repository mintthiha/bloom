# Bloom

Bloom is a full-stack personal finance demo app built for Canadians learning to manage their money. It includes Google sign-in, profile onboarding, multi-account tracking, merchant-aware transactions, recurring transaction scheduling, an upcoming payment calendar, monthly budgeting, net worth tracking, savings goals, a 50/30/20 budget rule visualizer, actionable financial insights, savings rate tracking, TFSA/RRSP/FHSA contribution room tracking, proactive over-contribution warnings, and an AI-powered Canadian financial education assistant.

## Tech Stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Base UI (`@base-ui/react`)
- Recharts
- Sonner
- Lucide React
- NextAuth v5 beta
- Anthropic SDK (`@anthropic-ai/sdk`)
- Vitest
- Testing Library
- jsdom

### Backend

- Node.js
- Express 5
- TypeScript
- Prisma ORM
- PostgreSQL
- Vitest
- Supertest

### Authentication

- Google OAuth via NextAuth

## Project Structure

- `frontend/` — Next.js app, auth integration, dashboard UI, profile onboarding, and account pages
- `backend/` — Express API, Prisma schema, account/profile/budget/recurring services, and backend tests

## Core Features

### Authentication And Onboarding

- Google login integration
- Protected application routes via NextAuth
- First-time user onboarding flow
- Prisma-backed user profile
- Unique Bloom username validation

### Profile Management

- Separate first name, last name, username, and email
- Sidebar identity uses Bloom profile data
- Home page greeting uses the saved first name
- Profile page for updating user information

### Account Management

- Multiple account creation per user
- Supported account types:
  - Chequing
  - Savings
  - TFSA
  - RRSP
  - FHSA
  - Credit
- Optional account nicknames
- Freeze and unfreeze controls
- Account deletion
- Dashboard grouping by account type

### Transactions

- Deposits
- Withdrawals
- Transfers between accounts
- Transaction categories
- Optional merchant names on deposits, withdrawals, and recurring-generated entries
- Transaction history filtering by:
  - type
  - category (including an explicit "Uncategorized" option for transactions with no category)
  - description or merchant search
  - preset date range
  - custom date range
- Transaction editing
- Transaction deletion with confirmation dialog
- Linked transfer edit/delete support for newly created transfer pairs
- CSV import on any account:
  - Client-side parsing with row-level validation and preview table
  - Supports `deposit`, `withdrawal`, `credit`, and `debit` type values
  - Columns: `date`, `type`, `amount`, `description`, `merchant`, `category`
  - Downloadable template from the import tab
  - Automatically resets transaction history filter to all-time after import
  - Backfills net worth snapshots for each imported month using month-end balances

### Registered Account Contribution Room

Each TFSA, RRSP, and FHSA account detail page shows a contribution room panel below the account card:

- **TFSA panel** — estimates lifetime room from birth year (set on profile) using CRA annual limits from 2009 to present. Tracks net Bloom deposits and lets users record contributions made outside the app (`tfsaRoomUsedElsewhere`). Shows remaining room, a progress bar, and a breakdown of tracked vs external contributions.
- **RRSP panel** — reads the user's CRA deduction limit from their profile (`rrspContributionRoom`). Tracks net Bloom deposits and displays used vs available room as a percentage. Links to the profile to update the deduction limit.
- **FHSA panel** — tracks both the $8,000 annual limit and the $40,000 lifetime limit. Shows two labeled progress bars, one per limit, for the current calendar year and all time.
- All three panels link to the `/learn` page for background on what contribution room means.
- All calculation logic lives in `frontend/src/lib/contribution-room.ts` and is fully unit-tested.

### Over-Contribution Warnings

Proactive, non-blocking warnings that surface before and after a potentially problematic deposit on TFSA, RRSP, and FHSA accounts:

- **Inline warning under the deposit amount input** — updates live as the user types. Evaluates whether the typed amount would breach the account's estimated room:
  - Amber warning when less than 10% of total room would remain
  - Red warning when the deposit would exceed the estimated limit
  - FHSA checks both the $8,000 annual and $40,000 lifetime limits; the message names whichever would be breached first
  - RRSP warning only appears when the user has set their deduction limit on the profile; TFSA warning only appears when birth year is set
  - Copy uses "may" and "estimated" throughout — Bloom is an estimate, not a CRA-authoritative source
- **Post-submission persistent toast** — fires after a successful deposit if the new total puts the user at or over their estimated room. Uses a 10-second duration so it outlasts the success toast. Prompts the user to verify on the CRA's My Account portal.
- **Panel over-contribution banners** — all three contribution room panels show a red banner when the current tracked total already exceeds the estimated limit. All banners use the same palette (`#ef4444` border, `#ef444408` background).
- Warning logic lives in `frontend/src/lib/over-contribution.ts` — pure functions with no side effects, fully unit-tested.

### Recurring Transactions

- Create named recurring deposit and withdrawal rules
- Supported schedules:
  - Weekly
  - Biweekly
  - Monthly
- Required rule names make edit and delete flows easier to understand
- Optional categories, merchants, and descriptions
- Optional end dates
- Pause and resume recurring rules
- Edit recurring rules without changing previously generated transactions
- Delete recurring rules with confirmation dialog and success toast
- Manual `Apply due` action creates due recurring entries as normal transactions
- Generated recurring transactions update balances, budgets, analytics, and transaction history

### Upcoming Payment Calendar

- Timeline view of upcoming recurring transaction occurrences for the next 90 days
- Occurrences generated from active recurring rules using each rule's next scheduled date
- Supports weekly, biweekly, and monthly frequencies
- Groups occurrences by calendar month
- Visually distinguishes three urgency states:
  - **Overdue** — past due, not yet applied (red)
  - **Due soon** — within 7 days (amber)
  - **Upcoming** — more than 7 days away (muted)
- Shows merchant or rule name, signed amount (deposits in green), relative date label ("Tomorrow", "In 3 days"), and frequency
- Overdue and due-soon entries show status badges
- Empty state when no active recurring rules exist
- Respects optional end dates on recurring rules

### Budgeting And Analytics

- Monthly category budgets
- Budget usage, remaining amount, and over-budget state
- Budget detail pages with:
  - daily spending chart
  - account totals
  - transaction activity
- Account analytics and balance history charts
- Monthly cash-flow summary (income, spending, net cash flow, top expense category)
- Savings rate tile — fourth stat in the monthly snapshot showing `net cash flow / income` as a percentage:
  - Green ≥ 20%, amber 10–19%, red < 10%, "N/A" when income is zero
- Snapshot/Trends toggle on the monthly summary card:
  - Snapshot view: income, spending, net cash flow, and savings rate for the selected period
  - Trends view: grouped bar chart showing income and spending over the last 6 months
- Spending forecast strip: projects end-of-month spending based on daily pace (shown for current month only)

### 50/30/20 Budget Rule Visualizer

- Maps actual spending to the 50/30/20 rule:
  - **Needs** — Groceries, Rent, Utilities, Transport, Healthcare
  - **Wants** — all other spending categories
  - **Savings** — net cash flow for the period
- Each bucket shows actual vs target percentage with a progress bar and a target marker
- Per-account category drilldown: expand any bucket to see spending broken down by category and account
- Drilldown capped at a max height with a fade-scrollbar (hides after 1 second of inactivity)
- Date range follows the dashboard's active range selector

### Financial Insights

- "Your Next Moves" card — rule-based engine that evaluates up to 7 rules in priority order and surfaces the top 2–3 actionable items:
  1. Over-budget categories — calls out the most overspent budget by dollar amount
  2. Overdue recurring transactions — flags rules with pending apply actions
  3. Emergency fund coverage — warns when chequing + savings covers fewer than 3 months of spending
  4. Idle chequing balance — suggests moving excess cash to a TFSA when balance is high relative to spending
  5. Low savings rate — flags when the savings rate falls below 10%
  6. No budgets set — prompts first-time budget creation
  7. Strong savings rate — positive reinforcement when savings rate exceeds 20%
- Each insight has a severity (warning / info / success), a one-line message, and a supporting detail
- Warning count badge in the card header
- Empty state when no action items exist

### Net Worth Tracking

- Monthly net worth snapshots recorded automatically on each dashboard load
- Tracks total assets (non-credit accounts), total debt (credit accounts), and net worth
- Net worth history line chart with Assets, Debt, and Net Worth lines
- Month-over-month delta badge showing net worth change from the prior month
- Zero reference line for at-a-glance breakeven visibility

### Savings Goals

- Create savings goals linked to any non-credit account
- Track progress as a live percentage of account balance vs target
- Progress bar with completion colour (amber in progress, green when complete)
- Compact GoalWidget on the home dashboard showing one goal at a time
- Persistent goal selection across page reloads via localStorage
- Full goals management page: create, edit, and delete goals
- "Goal reached!" indicator when balance meets or exceeds target

### Learn

- Static Canadian financial content cards covering TFSA, RRSP, FHSA, credit card basics, budgeting, and net worth
- Expandable card layout — each card is collapsed by default and expands inline
- AI chat assistant powered by Claude (claude-opus-4-6) with adaptive thinking and streaming responses
- System prompt scoped to Canadian personal finance
- Single/double layout toggle applies to the Learn page — double view shows cards and chat side by side

### Dashboard UX

- Single-column and double-column dashboard layouts
- Shared layout toggle across dashboard, account pages, and the Learn page
- Click-through navigation from dashboard summary cards and account cards
- Time-based greeting — "Good morning / afternoon / evening, [name]" — with first name cached in localStorage to eliminate the flash between page load and profile fetch
- Full-page skeleton loading screens: all dashboard sections render animated placeholder shapes while data is fetching, preventing layout shift
- Every major dashboard section is independently collapsible:
  - Monthly Snapshot
  - Budgets
  - 50/30/20 Budget Rule
  - Financial Insights
  - Recurring Transactions
  - Upcoming Schedule
  - Net Worth History
  - Account Balances
  - Open New Account
  - Savings Goals widget
- Collapse state is local to each card — collapsing one card never affects siblings
- Smooth height animation using the CSS `grid-template-rows: 0fr / 1fr` technique
- Card headers and action buttons (e.g. "Apply due") remain visible when collapsed
- Chevron indicator rotates to reflect expanded/collapsed state
- Account list drag-to-reorder within each account type group, persisted to localStorage

### Date And Time Handling

- Transaction editing supports date and time changes
- Frontend date-range queries use local calendar boundaries
- UI shows the detected browser timezone
- Backend timestamps now use timezone-aware storage

## Frontend Architecture

The homepage is structured around a component-per-section pattern, keeping `page.tsx` as a thin data-orchestration layer:

| Component | Location |
|-----------|----------|
| `MonthlySnapshot` | `app/_components/_monthlySnapshot/` |
| `BudgetsCard` | `app/_components/_budgets/` |
| `RecurringTransactionsCard` | `app/_components/_recurringTransactions/` |
| `RecurringCalendar` | `app/_components/_recurringCalendar/` |
| `NetWorthHistory` | `app/_components/_netWorthHistory/` |
| `AccountBalancesCard` | `app/_components/_accountBalances/` |
| `OpenAccountCard` | `app/_components/_openAccount/` |
| `GoalWidget` | `app/_components/_goalWidget/` |
| `DraggableAccountList` | `app/_components/_accountList/` |
| `InsightsCard` | `app/_components/_insights/` |
| `BudgetRuleCard` | `app/_components/_budgetRule/` |
| `DashboardSkeleton` | `app/_components/_dashboardSkeleton/` |
| `CollapsibleCard` | `src/components/collapsible-card.tsx` |

`CollapsibleCard` is a shared UI primitive used by all dashboard sections. It accepts `eyebrow`, `title`, `description`, and `headerRight` slots and handles the collapse toggle and animation internally.

`InsightsCard` consumes a rule engine (`_insights/insights.ts`) that evaluates all dashboard data synchronously — no extra API calls.

`BudgetRuleCard` fetches a category-breakdown endpoint (`GET /api/accounts/summary/category-breakdown`) that groups spending by `(category, account)` for the selected date range.

## Testing

### Frontend Coverage

- Vitest + Testing Library + jsdom
- Dashboard and onboarding rendering coverage
- Account grouping coverage
- Contribution room calculation coverage (`contribution-room.test.ts`) — TFSA lifetime room, net contribution netting, same-type transfer exclusion, year filtering, FHSA constants
- Over-contribution warning logic coverage (`over-contribution.test.ts`) — red/amber/none severity for TFSA, RRSP, and FHSA; boundary cases; FHSA dual-limit tie-breaking; overage amounts in messages

### Backend Coverage

- Service tests for account, profile, and budget logic
- Route tests for account and budget endpoints
- Service and route tests for recurring transaction rules
- Validation coverage for profile updates plus transaction and merchant input sanitization

## Development Notes

- Prisma migrations should be applied after pulling schema changes:

```bash
cd backend
npx prisma migrate dev
```

- The app now depends on timezone-aware database timestamps for correct local-time display and filtering.
- The frontend proxy expects the backend API to be running on `http://localhost:3001` unless `NEXT_PUBLIC_API_URL` is set.
- The Learn page AI chat requires an `ANTHROPIC_API_KEY` set in `frontend/.env.local`.
