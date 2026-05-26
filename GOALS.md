# Bloom — Product Goals & Feature Roadmap

This document is a living reference for Bloom's feature roadmap, written from the perspective of a senior product engineer reviewing a beginner-friendly Canadian personal finance platform. Use it to guide implementation priorities and maintain product direction.

**Target audience:** Canadians who are not investing-savvy — beginners learning budgeting, young adults/students/new grads, people intimidated by financial terminology.

**Design philosophy:** Education over complexity. Reduce financial anxiety. Make finance feel approachable. Prefer actionable insights over raw data dumps. Reward good habits. Never overwhelm.

---

## Current State Assessment

### Strengths
- Solid data model with real Canadian account types (TFSA / RRSP / FHSA)
- Recurring transaction engine with manual apply
- Upcoming payment calendar with overdue/due-soon/upcoming status
- Good chart coverage (net worth history, monthly trends, budget progress, account balances)
- Working AI assistant scoped to Canadian personal finance
- Collapsible dashboard cards for a clean, customizable layout
- Component-driven dashboard architecture (`page.tsx` is a thin orchestration layer)

### Weak Points
- Dashboard is informational but not prescriptive — shows data, never tells users what to do with it
- Goals are just a progress bar tied to an account balance; no target dates, contribution tracking, or guidance
- The Learn page is static and disconnected from the user's actual numbers
- No measure of "how am I doing overall?" — users with good habits receive no positive feedback
- No onboarding beyond profile setup — a new user with one account has no idea what to do next
- No spending pattern detection or automatic insights
- No milestone celebrations or positive reinforcement moments
- No mobile-first design thinking

---

## Feature Proposals

Each feature includes: problem, why it helps beginners, size, complexity, files/systems, UI behavior, backend implications, timing recommendation, and priority score.

---

### 1. Financial Health Score

**Problem:** Users have raw numbers but no way to interpret "am I doing well?"

**Why it helps beginners:** A single score removes paralysis. It tells them: "you're at 62/100 — here's what's dragging it down." Beginners need a north star metric before they can optimize anything.

**Size:** Medium | **Complexity:** Medium | **Priority: 9/10** | **Status: ✅ Done**

**Files/systems:**
- New utility `frontend/src/lib/financial-health-score.ts`
- New component `app/_components/_financialHealth/FinancialHealthScore.tsx`
- No backend changes — all inputs already exist on dashboard load

**UI behavior:**
- Card with a large number (0–100) and a letter grade (A–F)
- Five sub-scores as small progress bars: Savings Rate / Budget Adherence / Debt Ratio / Emergency Coverage / Net Worth Trend
- Each sub-score links to a brief explanation
- Color: red < 40, amber 40–70, green > 70

**Backend/database implications:** None. Computed from data already fetched on dashboard load.

**Now vs later:** Now. Adds enormous perceived value with minimal risk.

---

### 2. "What Should I Do Next?" Card

**Problem:** The dashboard shows state but never suggests action. A user with idle cash, no TFSA contribution, and an over-budget category has no idea what to tackle first.

**Why it helps beginners:** Decision paralysis is the #1 enemy of beginners. A prioritized list of 2–3 actionable nudges cuts through the noise.

**Size:** Medium | **Complexity:** Medium | **Priority: 9/10** | **Status: ✅ Done**

**Files/systems:**
- New utility `frontend/src/lib/insights.ts` — rule-based engine consuming dashboard data
- New component `app/_components/_insights/InsightsCard.tsx`
- No backend changes needed initially

**UI behavior:**
- Card titled "Your Next Moves" with 2–3 numbered items:
  - "💡 You have $2,400 sitting in chequing. Consider moving some to your TFSA — you have $7,000 in contribution room."
  - "⚠️ You're over budget on Dining by $68. You have 11 days left this month."
  - "✅ Your emergency fund covers 2.4 months of expenses. Target: 3–6 months."
- Each item is one line with a supporting detail; tapping navigates to the relevant section

**Backend/database implications:** None initially. A future version could persist dismissed insights.

**Now vs later:** High value now. Rule-based logic is simple and immediately differentiates Bloom from generic trackers.

---

### 3. Savings Rate Indicator

**Problem:** Users have income and spending numbers but never see the number that matters most: what percentage of income they're keeping.

**Why it helps beginners:** Financial educators universally say savings rate is the most important variable in building wealth. Beginners need to see it clearly.

**Size:** Small | **Complexity:** Low | **Priority: 9/10** | **Status: ✅ Done**

**Files/systems:**
- `app/_components/_monthlySnapshot/MonthlySnapshot.tsx` — add a fourth stat tile

**UI behavior:**
- Fourth stat tile alongside Income / Spending / Net: "Savings Rate: 22%"
- Color: red < 10%, amber 10–19%, green ≥ 20%
- Tooltip: "Saving 22% of your income. Most financial plans suggest 20% as a starting target."
- Shows "N/A" when income is zero

**Backend/database implications:** None. `(income - spending) / income` is already computed.

**Now vs later:** Now. Two lines of code, extremely high perceived value.

---

### 4. TFSA / RRSP / FHSA Contribution Room Tracker

**Problem:** Canadians routinely over-contribute to TFSAs (1%/month CRA penalty) or massively under-utilize RRSP deduction room. No tool in the app tracks this.

**Why it helps beginners:** This is Canada-specific and high-stakes. Over-contribution is a real, costly mistake. Under-contribution is a missed tax-saving opportunity.

**Size:** Medium | **Complexity:** Medium | **Priority: 9/10**

**Files/systems:**
- `backend/prisma/schema.prisma`: extend Profile with `tfsaBirthYear`, `tfsaRoomUsedElsewhere`, `rrspContributionRoom`
- New Prisma migration
- Profile page: add room input fields
- Account detail page for TFSA/RRSP/FHSA: new `ContributionRoomPanel` component

**UI behavior:**
- On a TFSA account page: "Estimated TFSA room: $34,500 remaining (based on your birth year + deposits in Bloom)"
- Setup prompt if not configured: "Enter your birth year to estimate your TFSA room →"
- RRSP panel: input field for CRA RRSP deduction limit and a usage meter
- FHSA panel: shows annual ($8k) and lifetime ($40k) limits vs Bloom deposits

**Backend/database implications:** New nullable fields on Profile. Deposits to registered accounts in Bloom compute "used room within the app" (won't reflect external contributions, but useful as an estimate).

**Now vs later:** Now. Genuine differentiator for a Canadian-focused app.

---

### 5. 50/30/20 Budget Rule Visualizer

**Problem:** The Learn page explains 50/30/20 as a concept but users have no way to see how their actual spending maps to it.

**Why it helps beginners:** The 50/30/20 rule is the most beginner-friendly budgeting framework. Seeing real data plotted against it makes the abstract concrete.

**Size:** Small–Medium | **Complexity:** Low | **Priority: 8/10** | **Status: ✅ Done**

**Files/systems:**
- New component `app/_components/_budgetRule/BudgetRuleCard.tsx`
- Default category mapping (Rent/Utilities/Healthcare = Needs; Dining/Entertainment/Shopping = Wants; TFSA/RRSP deposits = Savings) with user override
- Optional: `BudgetCategoryTag` table on backend

**UI behavior:**
- Three bands: Needs / Wants / Savings with actual % and ideal %
- Donut chart or stacked bar makes the split immediately visual
- "Your Needs are 58% of spending. Target is 50%. Your largest Needs expense is Rent ($1,400)."
- Gentle, non-judgmental tone — this is education, not criticism

**Backend/database implications:** Optional `BudgetCategoryTag` table. Can start with a hardcoded default mapping.

**Now vs later:** Now. Directly ties Learn content to real data.

---

### 6. Debt Payoff Timeline (Credit Card Focus)

**Problem:** Credit accounts show a balance but there's no projection of when the debt gets paid off or how much interest it will cost.

**Why it helps beginners:** The most common financial mistake young adults make is carrying credit card debt. Showing the real cost in dollars creates urgency without lecturing.

**Size:** Medium | **Complexity:** Low–Medium | **Priority: 8/10**

**Files/systems:**
- New panel `app/account/[id]/_components/_debtPayoff/DebtPayoffPanel.tsx`
- Pure frontend computation — no backend changes needed
- Optional: `interestRate` field on Account model for user to input their APR

**UI behavior:**
- On credit card account pages: "Debt Payoff Planner" collapsible section
- Input: APR (default 19.99%, editable) and monthly payment amount
- Output: "At $150/month: paid off in 18 months, total interest = $387"
- Compare three scenarios: minimum payment / current amount / custom
- "Paying just $50 more per month saves $210 in interest and gets you debt-free 6 months sooner"

**Backend/database implications:** Optional `interestRate` (Float, nullable) on Account. Can skip initially — use a text input with a default.

**Now vs later:** Now for the computation panel; interest rate field optional later.

---

### 7. Contextual "Ask Bloom" AI Button

**Problem:** The AI assistant only exists on the Learn page. A user looking at their RRSP account or reading a budget detail has no contextual help available.

**Why it helps beginners:** Beginners constantly have questions while looking at numbers. Putting help where the question arises removes the friction of navigating away.

**Size:** Medium | **Complexity:** Medium | **Priority: 8/10**

**Files/systems:**
- New shared component `src/components/ask-bloom-drawer.tsx` — a slide-in chat panel
- "Ask Bloom" button added to account pages, budget detail, and goals page
- Pre-populate the first message with page context
- Reuses the existing `/api/learn/chat` streaming endpoint

**UI behavior:**
- Small amber "Ask Bloom ✦" button in the top-right of relevant pages
- Opens a right-side drawer (not a full page) with the chat interface
- Pre-fills context message based on current page: "I'm on the Budgets page. My Dining budget is over by $68 this month."
- Maintains session history while the drawer is open

**Backend/database implications:** None. Same API endpoint and model.

**Now vs later:** Now. Reuses existing infrastructure; just needs the drawer shell and context injection.

---

### 8. Enhanced Savings Goals (Target Dates + ETA)

**Problem:** Goals show `$X of $Y (Z%)` but give no answer to "am I on track?" or "when will I get there?"

**Why it helps beginners:** Progress without a timeline is abstract. "I'll reach my emergency fund goal in 4 months at this rate" is motivating in a way that "47% complete" is not.

**Size:** Medium | **Complexity:** Medium | **Priority: 8/10**

**Files/systems:**
- `backend/prisma/schema.prisma`: add `targetDate` (DateTime, optional) and `monthlyContributionTarget` (Float, optional) to SavingsGoal
- `backend/src/services/savingsGoalService.ts`: compute `monthsToGoal` from recent deposit velocity into the linked account
- `frontend/src/app/goals/` and `GoalWidget`: display ETA and monthly pace

**UI behavior:**
- "At your current pace ($340/month), you'll reach this goal in ~6 months — around November 2026."
- If target date is set: "You need $480/month to hit your target by December."
- "On track" / "Behind pace" / "Ahead of pace" badge
- GoalWidget shows ETA in collapsed view: "~6 months away"

**Backend/database implications:** New optional schema fields on SavingsGoal. Service analyzes 90-day deposit history into the linked account to estimate contribution rate.

**Now vs later:** Now. Straightforward schema addition with high payoff on the most emotionally significant feature.

---

### 9. Emergency Fund Wizard

**Problem:** The app has no concept of an emergency fund — which financial educators call "step 1" for anyone who doesn't have one.

**Why it helps beginners:** An emergency fund is the foundation of financial security. Most beginners don't know what it is, how much they need, or how to set one up. Bloom can guide them through this in 2 minutes.

**Size:** Medium | **Complexity:** Low–Medium | **Priority: 8/10**

**Files/systems:**
- New `goalType` enum on SavingsGoal (`EMERGENCY_FUND | CUSTOM`)
- Wizard flow on goals page: explain → calculate target → pick account → create goal
- `MonthlySnapshot.tsx`: "Emergency Fund Coverage: 1.8 months" computed from monthly spending

**UI behavior:**
- "Set up emergency fund" prompt on goals page if none exists
- Three-step wizard: what is it → auto-calculate target (3–6x monthly spending) → pick account and confirm
- Dashboard indicator: "Emergency Fund: 1.8 months covered" — green ≥ 3, amber 1–3, red < 1

**Backend/database implications:** New `goalType` enum field on SavingsGoal. `emergencyFundMonths` computed from goals service + monthly summary data.

**Now vs later:** Now. Ties existing spending data to actionable guidance; differentiates from generic apps.

---

### 10. Milestone Celebrations

**Problem:** Financial progress is invisible and slow. Reaching $1,000 in savings, turning net worth positive, or completing a goal should feel like an achievement.

**Why it helps beginners:** Positive reinforcement is critical for habit formation. Most finance apps are relentlessly neutral. A moment of celebration makes a boring number memorable.

**Size:** Small | **Complexity:** Low | **Priority: 7/10**

**Files/systems:**
- New utility `frontend/src/lib/milestones.ts` — defines thresholds and detection logic
- Net worth snapshot logic: detect when net worth crosses $0, $1k, $5k, $10k, $25k, $50k for the first time
- Goal completion: enhance existing "Goal reached!" state with confetti + toast
- Optional: `Milestone` table or `milestones` JSON field on Profile to prevent re-triggering

**UI behavior:**
- Toast: "🎉 Your net worth just turned positive for the first time. That's a big deal."
- Goal completion: animate progress bar to 100%, confetti burst on GoalWidget
- Profile page: small "achievements" section — factual, non-gamey ("Net worth turned positive — May 2026")

**Backend/database implications:** Optional `milestones` JSON field on Profile to track which have fired.

**Now vs later:** Now for goal completion flourish and net worth milestone toast. Tracking table can follow.

---

### 11. Monthly Budget Review Digest

**Problem:** There is no end-of-month moment that prompts reflection. Users who log in on June 1st see the new month with no summary of May.

**Why it helps beginners:** Reflection is the mechanism by which budgeting becomes a habit. A monthly review prompt — even a simple one — dramatically increases engagement.

**Size:** Medium | **Complexity:** Low | **Priority: 7/10**

**Files/systems:**
- `app/_components/_monthlySnapshot/MonthlySnapshot.tsx`: when viewing previous month, add a review summary section
- Or: detect first login of a new month and show a "How did last month go?" summary card
- Dismissal state via localStorage

**UI behavior:**
- Non-intrusive card that appears once per month: "May is over. Here's how you did:"
  - Savings rate: 18% (↑ 4% vs April)
  - Over budget: Dining (+$42)
  - Under budget: Transport (-$87)
  - Net worth change: +$340
- One suggested action: "Consider adjusting your Dining budget or reducing one restaurant visit per week."
- Dismissible with "Got it" (state in localStorage)

**Backend/database implications:** None. All data accessible via the existing date range query system.

**Now vs later:** Now. Zero backend changes, high retention impact.

---

### 12. Recurring Transaction Smart Suggestions

**Problem:** Users manually create recurring rules, but common bill patterns (consistent $95 from "Rogers" every month) are detectable automatically.

**Why it helps beginners:** Removes the burden of noticing "I forgot to set up my phone bill." The app does the noticing for them.

**Size:** Medium | **Complexity:** Medium–High | **Priority: 6/10**

**Files/systems:**
- New `backend/src/services/patternService.ts`: analyze transactions for same merchant + similar amount + regular interval
- New endpoint or integrate into `GET /api/recurring`
- New "Suggestions" section in `RecurringTransactionsCard.tsx`

**UI behavior:**
- Subtle "Suggestions" section above the manual form:
  - "We noticed $95 from Rogers every month → Create recurring rule?"
  - One-click "Set up" pre-fills the form
  - "Dismiss" hides a suggestion
- Shows 1–3 suggestions max

**Backend/database implications:** Read-only analysis of transaction history. Optionally a `dismissed_suggestions` JSON field on Profile.

**Now vs later:** Later. Complex analysis logic; high value but not foundational.

---

### 13. Financial Literacy Progress Tracker

**Problem:** The Learn page has six cards that users read once and never return to. No sense of "what have I covered?"

**Why it helps beginners:** Progress indicators increase completion rates on educational content.

**Size:** Small | **Complexity:** Low | **Priority: 7/10**

**Files/systems:**
- `app/learn/_components/_cardsSection/LearningCards.tsx`: add "read" state per card
- Persist to `localStorage` (or Profile field for cross-device sync)
- Learn page header: progress bar "4 of 6 topics explored"

**UI behavior:**
- Each expanded card gets a subtle "✓ Explored" badge
- Top of page: "You've explored 4 of 6 topics. Next up: Net Worth →"
- Completion: "You've completed the Bloom Finance Course! 🎓" with link to AI chat

**Backend/database implications:** localStorage only initially. Optional `learnProgress` JSON on Profile for sync.

**Now vs later:** Now. Tiny effort, real UX improvement.

---

### 14. Spending Insight Feed

**Problem:** The app has all the data to generate insights ("you spent 40% more on dining this month") but surfaces none automatically.

**Why it helps beginners:** Beginners don't know to look for patterns. Surfacing patterns that are in their data already feels like having a smart advisor.

**Size:** Medium | **Complexity:** Medium | **Priority: 7/10**

**Files/systems:**
- `frontend/src/lib/insights.ts`: rule-based insight engine
- New `InsightsFeed` component in `app/_components/_insights/`
- Inputs: monthly summary, previous month summary, budget data, account data

**Sample insight rules:**
- "Your top spending category this month is [X] at [Y]% of total spending."
- "You spent [Z]% more on [category] vs last month."
- "You're on track to spend [projected] this month — [above/below] last month."
- "You have [N] recurring rules that haven't run yet this month."

**UI behavior:**
- 3–5 auto-generated insights as compact list items
- One sentence each, no jargon
- Color coded: green (positive), amber (neutral), red (concerning)

**Backend/database implications:** None — all inputs available on dashboard load.

**Now vs later:** Now for the rule engine. Add more rules incrementally.

---

### 15. RRSP Tax Savings Estimator

**Problem:** Most Canadians don't contribute to their RRSP because the benefit feels abstract. "$1,500 back at tax time" is concrete. "You'll reduce your taxes" is not.

**Why it helps beginners:** RRSP under-contribution is one of the most common and costly Canadian financial mistakes.

**Size:** Small–Medium | **Complexity:** Low | **Priority: 8/10**

**Files/systems:**
- New panel on RRSP account detail page: `app/account/[id]/_components/_rrspEstimator/RrspEstimatorPanel.tsx`
- Pure frontend computation — no backend changes

**UI behavior:**
- Input: "My marginal tax rate is approximately [dropdown: 20% / 26% / 33% / 43% / 53% with income ranges]"
- Output: "Contributing $5,000 to your RRSP saves you approximately $1,300 in federal tax this year."
- Secondary: "If you have $12,000 in unused room, maxing it out saves ~$3,120."
- Link to Learn page RRSP card

**Backend/database implications:** None. Pure frontend calculation.

**Now vs later:** Now. Trivial to implement, very high Canadian relevance.

---

### 16. Goal Contribution Guide (Monthly Pace Slider)

**Problem:** Users have a savings goal but no guidance on how much to set aside each month to reach it.

**Why it helps beginners:** Translates an abstract goal into a concrete monthly action that fits their budget.

**Size:** Small | **Complexity:** Low | **Priority: 7/10**

**Files/systems:**
- `app/goals/_components/_goalList/GoalList.tsx`: add contribution calculator inline
- Uses `targetDate` (from Feature 8) and current balance

**UI behavior:**
- Below each goal: "To reach $5,000 by December, set aside $280/month."
- Interactive slider: adjust monthly contribution and see estimated completion date update in real time
- "Can I afford this?" links to Monthly Snapshot

**Backend/database implications:** Requires `targetDate` on SavingsGoal (see Feature 8).

**Now vs later:** Bundle with Feature 8.

---

### 17. Negative Net Worth Empathy Mode

**Problem:** Young adults with student debt see a red negative net worth and feel shame. The app is silent about it.

**Why it helps beginners:** Financial anxiety is the top reason people avoid tracking their finances. Acknowledging difficulty and normalizing it increases retention.

**Size:** Small | **Complexity:** Low | **Priority: 7/10**

**Files/systems:**
- `app/_components/_netWorthHistory/NetWorthHistory.tsx`: conditional empathy note below the chart

**UI behavior:**
- When net worth is negative: "Having a negative net worth early in life is completely normal — student loans, a car, or a credit card balance affect most people's starting point. What matters is the direction, not the number."
- When improving month-over-month but still negative: "↑ Up $420 from last month. You're moving in the right direction."
- When turning positive for the first time: trigger Feature 10 (Milestone Celebration)

**Backend/database implications:** None.

**Now vs later:** Now. One paragraph of JSX with enormous emotional impact for the target audience.

---

### 18. First-Time User Guided Tour

**Problem:** After completing profile setup, users land on an empty dashboard with no guidance. The onboarding ends too early.

**Why it helps beginners:** The biggest drop-off in finance apps is the "now what?" moment after sign-up. A guided checklist eliminates it.

**Size:** Medium | **Complexity:** Low–Medium | **Priority: 9/10**

**Files/systems:**
- New `OnboardingChecklist` component for new users with 0 accounts
- Track completion in localStorage or a new `onboardingCompletedSteps` JSON field on Profile
- Steps: Create first account → Add first transaction → Set up a budget → Create a savings goal → Explore Learn

**UI behavior:**
- Compact checklist card at top of dashboard for new users: "Get started with Bloom — 5 steps"
- "✓ Profile set up · ○ Add your first account · ○ Set a budget..."
- Disappears once all steps are complete
- Non-blocking — users can dismiss it and use the app freely

**Backend/database implications:** One JSON field on Profile to track step completion, or localStorage only for simplicity.

**Now vs later:** Now. New user retention is the highest-value problem to solve early.

---

### 19. Account Health Indicator (Per-Account)

**Problem:** Individual accounts have no health context. Is $340 in chequing enough? Is a $4,200 credit card balance concerning?

**Why it helps beginners:** Per-account context reduces anxiety and helps users understand what each account is "for."

**Size:** Small–Medium | **Complexity:** Low | **Priority: 7/10**

**Files/systems:**
- `app/account/[id]/_components/`: new `AccountContextPanel.tsx`
- Uses existing monthly summary data for chequing runway calculation
- Uses credit balance for utilization estimate

**UI behavior — per account type:**
- **Chequing:** "Covers ~3.2 weeks of your typical monthly spending"
- **Savings:** "This is 47% of your 3-month emergency fund target"
- **TFSA:** "Up $340 this year — growing tax-free"
- **Credit:** "Balance is 34% of estimated credit limit — try to stay under 30% for a good credit score"
- **RRSP:** "Contributing regularly? RRSP grows tax-sheltered until retirement."

**Backend/database implications:** None — all computed from existing data.

**Now vs later:** Now for Chequing and Credit (highest value). Others can follow.

---

### 20. Overdue Recurring Indicator in Navigation

**Problem:** The "Apply due" button is inside the Recurring Transactions card. When the card is collapsed or the user is on another page, there is no signal that bills are overdue.

**Why it helps beginners:** Beginners especially forget that recurring transactions need manual application. A persistent indicator prevents ledger drift.

**Size:** Small | **Complexity:** Low | **Priority: 7/10**

**Files/systems:**
- Sidebar or header navigation component
- `dueRecurringCount` is already computed — just needs to surface outside the card

**UI behavior:**
- Sidebar nav item or header: small red dot when `dueRecurringCount > 0`
- Optional: amber banner above dashboard cards: "3 recurring transactions are overdue — apply them now to keep your balances accurate"
- The RecurringCalendar already shows overdue items in red — the nav badge completes the feedback loop

**Backend/database implications:** None.

**Now vs later:** Now. Approximately 20 minutes of work.

---

## Top 10 Highest-Impact Features

| Rank | Feature | Why It's High Impact |
|------|---------|---------------------|
| 1 | First-Time User Guided Tour (#18) | Highest-impact moment in any app: the first 5 minutes. Prevents immediate churn. |
| 2 | Financial Health Score (#1) ✅ | Creates a north-star metric that gives users a reason to return and improve. |
| 3 | "What Should I Do Next?" Card (#2) | Turns a data tracker into a financial coach. The single biggest UX upgrade. |
| 4 | Savings Rate Indicator (#3) | The most important financial metric, one computation away. Massive perceived value. |
| 5 | TFSA/RRSP Contribution Room Tracker (#4) | Canada-specific, high-stakes, zero competitors in the beginner space. |
| 6 | Emergency Fund Wizard (#9) | Teaches the most important concept in personal finance, guided within the app. |
| 7 | RRSP Tax Savings Estimator (#15) | Turns RRSP from abstract to "that's $1,500 back this year." Creates immediate action. |
| 8 | Contextual "Ask Bloom" AI Button (#7) | Puts help where the question arises. Dramatically reduces confusion and drop-off. |
| 9 | Debt Payoff Timeline (#6) | Makes the cost of credit card debt viscerally real. Creates urgency without lecturing. |
| 10 | 50/30/20 Rule Visualizer (#5) | Bridges the Learn page theory with their actual numbers. Makes education actionable. |

---

## Quick Wins

*High UX value, low implementation effort — can each ship in a single focused session.*

| Feature | Est. Effort | Value |
|---------|------------|-------|
| Savings Rate Indicator (#3) | ~30 min | Immediate "wow" moment on the dashboard |
| Negative Net Worth Empathy Note (#17) | ~15 min | High emotional impact, one paragraph of JSX |
| Milestone Celebration Toast (#10) | ~1 hr | First positive feedback loop in the app |
| Financial Literacy Progress Tracker (#13) | ~1 hr | Makes the Learn page feel alive and sticky |
| Recurring Apply Sidebar Badge (#20) | ~20 min | Completes an existing feedback loop |
| Monthly Budget Review Banner (#11) | ~2 hrs | Highest-retention habit for almost no backend cost |
| RRSP Tax Savings Estimator (#15) | ~1 hr | Pure frontend math, very high Canadian relevance |
| Goal Contribution Guide Slider (#16) | ~1 hr | Makes goals actionable instead of decorative |

---

## Long-Term Vision

### Phase 1 — Make It Smarter
The app currently shows data. The next level is interpreting it. The Financial Health Score, Insights Feed, and "Next Steps" card are the foundation of turning Bloom from a ledger into a financial coach. None of these require AI — they're deterministic rules applied to data that already exists.

### Phase 2 — Canadian Financial Literacy Platform
Bloom's largest untapped differentiator is its Canadian focus. No mainstream beginner app (Mint, YNAB, Copilot) nails TFSA/RRSP/FHSA the way a Canada-native product can. Contribution room tracking, tax optimization, and FHSA guidance for first-time homebuyers are features the Big Banks' apps handle poorly. Bloom can own this space for the beginner audience.

### Phase 3 — Goal-Centered Experience
The app's emotional core should be goals. Currently goals are a sidebar feature. The long-term vision is goals driving the entire dashboard: "You're saving for a house down payment, an emergency fund, and a Europe trip. Here's how your spending this month affects each one." Every transaction, budget, and recurring rule connects back to a goal.

### Phase 4 — Behavioral Finance Layer
The research on why people succeed or fail financially is clear: psychology matters more than math. Bloom could build a light behavioral finance layer — a spending personality quiz, habit streaks for logging transactions, spending friction ("you've hit your dining budget — are you sure?"), and weekly check-in prompts. This applies behavioral economics to the hardest problem in personal finance: getting people to actually change their habits.

### Phase 5 — Guided Investing Introduction
Once a user has an emergency fund, no credit card debt, and consistent savings, Bloom could offer a "What's next?" path into beginner investing: explaining index funds, introducing the concept of a TFSA investment account (not just savings), and linking to Canada-appropriate brokerage resources (Questrade, Wealthsimple). This is the natural graduation from beginner budgeter to beginner investor — a space with virtually no good beginner-focused guidance.
