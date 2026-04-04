# Bloom

Full-stack banking demo application with Google sign-in, account management, profile onboarding, and financial dashboards.

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
- Vitest
- Supertest

### Database

- PostgreSQL

### Authentication

- Google OAuth via NextAuth

### Testing

- Vitest
- Testing Library
- jsdom

## Project Structure

- `frontend/` - Next.js application
- `backend/` - Express API and Prisma schema

### Features

#### Authentication

- Google login integration
- Route protection via NextAuth middleware
- User-specific data isolation

#### Profile And Onboarding

- First-time users are prompted to complete their Bloom profile
- Profile fields stored in Prisma
- Separate first name, last name, username, and email
- Username uniqueness validation
- Sidebar and greeting use Prisma profile data

#### Account Management

- Create multiple accounts
- View balances per account
- Freeze, unfreeze, and delete accounts
- Support transfers between accounts

#### Transactions

- Add deposits, withdrawals, and transfers
- Track transaction history
- Timestamped records for all actions

#### Data Visualization

- Graphs showing account balances over time
- Visual overview of financial activity

#### Test Coverage

- Backend service tests for profile validation and username uniqueness
- Backend API tests for `GET /api/profile` and `PUT /api/profile`
- Frontend tests for first-time onboarding and returning-user dashboard rendering
