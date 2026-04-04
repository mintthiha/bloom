# Bloom

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

### Backend

- Node.js
- Express 5
- TypeScript
- Prisma ORM

### Database

- PostgreSQL

### Authentication

- Google OAuth via NextAuth

## Project Structure

- `frontend/` - Next.js application
- `backend/` - Express API and Prisma schema


## A full-stack financial tracking application that allows users to manage accounts, track transactions, and visualize their financial activity.

### Features

#### Authentication

- Google login integration
- User-specific data isolation (each user sees only their own accounts)
#### Account Management

- Create multiple accounts (e.g., checking, savings)
- View balances per account
- Support for transfers between accounts

#### Transactions
- Add deposits, withdrawals, and transfers
- Track transaction history
- Timestamped records for all actions

#### Data Visualization
- Graphs showing account balances over time
- Visual overview of financial activity