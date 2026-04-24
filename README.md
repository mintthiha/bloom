# Bloom

Bloom is a full-stack personal finance demo app with Google sign-in, profile onboarding, account tracking, recurring transactions, budgeting, and account-level analytics.

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

- `frontend/` - Next.js app, auth integration, dashboard UI, profile onboarding, and account pages
- `backend/` - Express API, Prisma schema, account/profile/budget services, and backend tests

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
- Transaction history filtering by:
  - type
  - category
  - description search
  - preset date range
  - custom date range
- Transaction editing
- Transaction deletion with confirmation dialog
- Linked transfer edit/delete support for newly created transfer pairs

### Recurring Transactions

- Create named recurring deposit and withdrawal rules
- Supported schedules:
  - Weekly
  - Biweekly
  - Monthly
- Required rule names make edit and delete flows easier to understand
- Optional categories and descriptions
- Optional end dates
- Pause and resume recurring rules
- Edit recurring rules without changing previously generated transactions
- Delete recurring rules with confirmation dialog and success toast
- Manual `Apply due` action creates due recurring entries as normal transactions
- Generated recurring transactions update balances, budgets, analytics, and transaction history

### Budgeting And Analytics

- Monthly category budgets
- Budget usage, remaining amount, and over-budget state
- Budget detail pages with:
  - daily spending chart
  - account totals
  - transaction activity
- Account analytics and balance history charts
- Monthly cash-flow summary

### Dashboard UX

- Single-column and double-column dashboard layouts
- Shared layout toggle across dashboard and account pages
- Click-through navigation from dashboard summary cards and account cards

### Date And Time Handling

- Transaction editing supports date and time changes
- Frontend date-range queries use local calendar boundaries
- UI shows the detected browser timezone
- Backend timestamps now use timezone-aware storage

## Testing

### Frontend Coverage

- Vitest + Testing Library + jsdom
- Dashboard and onboarding rendering coverage
- Account grouping coverage

### Backend Coverage

- Service tests for account, profile, and budget logic
- Route tests for account and budget endpoints
- Service and route tests for recurring transaction rules
- Validation coverage for profile and transaction updates

## Development Notes

- Prisma migrations should be applied after pulling schema changes:

```bash
cd backend
npx prisma migrate dev
```

- The app now depends on timezone-aware database timestamps for correct local-time display and filtering.
- The frontend proxy expects the backend API to be running on `http://localhost:3001` unless `NEXT_PUBLIC_API_URL` is set.