# Recurring Transactions Automation Handoff

This file is for the separate automation agent/test repo. It covers the new recurring transactions feature added after the previous automation handoff.

The automation repo already has a tag definition file. Reuse that source of truth. If equivalent tags already exist, use those instead of creating duplicates.

## Feature Summary

Bloom now supports recurring transaction rules.

Users can:

- create named recurring deposit rules
- create named recurring withdrawal rules
- choose weekly, biweekly, or monthly frequency
- choose a start date
- optionally choose an end date
- add category and optional description
- pause and resume rules
- edit existing rules
- delete rules after confirmation
- manually apply due recurring transactions

Generated recurring entries become normal transactions. They should update:

- account balances
- transaction history
- budget usage
- monthly summaries
- account analytics

Important product rule:

- Editing or deleting a recurring rule does not change transactions that were already generated from that rule.
- Edits affect future recurring runs only.
- Deleting a rule removes the schedule only.

## Suggested Tags

Use the automation repo's existing tag catalog if these exact names differ.

- `@Recurring_Transactions`
- `@Recurring_Create`
- `@Recurring_Edit`
- `@Recurring_Delete`
- `@Recurring_Apply_Due`
- `@Recurring_Pause_Resume`
- `@Deposit`
- `@Withdrawal`
- `@Budget`
- `@Transaction_History`
- `@Date_Range`
- `@Timezone`
- `@Regression`
- `@API_Recurring`
- `@Validation`
- `@Delete`

Recommended examples:

- Create recurring salary: `@Recurring_Transactions @Recurring_Create @Deposit`
- Create recurring rent: `@Recurring_Transactions @Recurring_Create @Withdrawal`
- Edit recurring rule: `@Recurring_Transactions @Recurring_Edit @Regression`
- Delete recurring rule: `@Recurring_Transactions @Recurring_Delete @Delete`
- Apply due rules: `@Recurring_Transactions @Recurring_Apply_Due @Regression`
- API validation: `@API_Recurring @Validation`

## UI Automation Scenarios

### 1. Create Recurring Withdrawal

Scenario:

- Log in as an existing user.
- Ensure the user has at least one non-credit account.
- Open the dashboard.
- In `Recurring Transactions`, create a rule:
  - name: `Monthly rent`
  - account: a chequing account
  - type: `Withdrawal`
  - amount: `1200`
  - frequency: `Monthly`
  - category: `Rent`
  - start date: a due date
  - description: optional
- Verify the rule appears in the recurring list.
- Verify the rule card shows:
  - name
  - amount
  - frequency
  - account
  - category/description metadata
  - next run date

Suggested tags:

- `@Recurring_Transactions`
- `@Recurring_Create`
- `@Withdrawal`

### 2. Create Recurring Deposit

Scenario:

- Create a recurring deposit rule:
  - name: `Main payroll`
  - type: `Deposit`
  - amount: `2500`
  - frequency: `Biweekly`
  - category: `Salary`
- Verify the rule appears as active.
- Verify the rule name is the primary card label.

Suggested tags:

- `@Recurring_Transactions`
- `@Recurring_Create`
- `@Deposit`

### 3. Required Rule Name Validation

Scenario:

- Try to create a recurring rule without a name.
- Verify the UI shows a validation error.
- Verify no rule is created.

Suggested tags:

- `@Recurring_Transactions`
- `@Validation`

### 4. Edit Recurring Rule

Scenario:

- Create or seed a recurring rule.
- Click `Edit`.
- Verify the form enters edit mode and shows:
  - `Editing recurring rule: <name>`
  - `Cancel edit`
  - submit button text `Save changes`
- Change:
  - name
  - amount
  - frequency
  - category
  - description
- Save changes.
- Verify the existing card updates instead of creating a duplicate rule.
- Verify a success toast is shown.

Suggested tags:

- `@Recurring_Transactions`
- `@Recurring_Edit`
- `@Regression`

### 5. Cancel Recurring Edit

Scenario:

- Click `Edit` on a recurring rule.
- Change fields in the form.
- Click `Cancel edit`.
- Verify the form returns to create mode.
- Verify the original recurring rule remains unchanged.

Suggested tags:

- `@Recurring_Transactions`
- `@Recurring_Edit`

### 6. Pause And Resume Rule

Scenario:

- Create or seed an active recurring rule.
- Click `Pause`.
- Verify the rule status changes to `Paused`.
- Click `Resume`.
- Verify the rule status changes back to `Active`.

Suggested tags:

- `@Recurring_Transactions`
- `@Recurring_Pause_Resume`

### 7. Delete Recurring Rule

Scenario:

- Create or seed a recurring rule named `Monthly rent`.
- Click `Delete`.
- Verify a confirmation dialog appears.
- Verify the dialog title includes the rule name:
  - `Delete recurring rule "Monthly rent"?`
- Click `Cancel`.
- Verify the rule remains.
- Click `Delete` again.
- Confirm deletion.
- Verify the rule is removed.
- Verify toast copy:
  - `Recurring transaction "Monthly rent" deleted`

Suggested tags:

- `@Recurring_Transactions`
- `@Recurring_Delete`
- `@Delete`

### 8. Apply Due Recurring Rule

Scenario:

- Seed or create a recurring rule with `nextRunAt` due today or in the past.
- Click `Apply due`.
- Verify a toast indicates the number of applied recurring transactions.
- Verify the generated transaction appears in the related account transaction history.
- Verify the account balance updates.

Suggested tags:

- `@Recurring_Transactions`
- `@Recurring_Apply_Due`
- `@Regression`

### 9. Apply Due With No Due Rules

Scenario:

- Ensure all recurring rules have a future next run date.
- Click `Apply due`.
- Verify the app shows:
  - `No recurring transactions are due`
- Verify no transaction is created.

Suggested tags:

- `@Recurring_Transactions`
- `@Recurring_Apply_Due`

### 10. Apply Due Withdrawal With Insufficient Funds

Scenario:

- Seed a withdrawal rule due today with an amount greater than the account balance.
- Click `Apply due`.
- Verify the UI shows the failure message from the backend.
- Verify no generated withdrawal is created.
- Verify the rule remains active.

Suggested tags:

- `@Recurring_Transactions`
- `@Recurring_Apply_Due`
- `@Validation`

### 11. Generated Transaction Affects Budget

Scenario:

- Create a budget for a category such as `Rent`.
- Apply a due recurring withdrawal in category `Rent`.
- Verify the budget's current spending increases.
- Verify budget detail page includes the generated transaction.

Suggested tags:

- `@Recurring_Transactions`
- `@Budget`
- `@Regression`

### 12. Generated Transaction Uses Local Date Correctly

Scenario:

- Run browser in a known timezone if the automation framework supports it.
- Create/apply a recurring rule with a local start date.
- Verify generated transaction appears on the expected local calendar date.

Suggested tags:

- `@Recurring_Transactions`
- `@Timezone`
- `@Date_Range`

## API Automation Scenarios

Base API path through backend:

- `/api/recurring`

Depending on the automation repo setup, API tests may hit the backend directly or go through the frontend proxy `/api/bloom/recurring`.

### 1. List Recurring Rules

Endpoint:

- `GET /api/recurring`

Verify:

- requires `X-User-Id`
- returns only the current user's rules
- includes account metadata:
  - `accountOwnerName`
  - `accountNickname`
  - `accountType`

Suggested tags:

- `@API_Recurring`

### 2. Create Recurring Rule

Endpoint:

- `POST /api/recurring`

Body example:

```json
{
  "accountId": "account-id",
  "name": "Monthly rent",
  "type": "WITHDRAWAL",
  "amount": 1200,
  "category": "Rent",
  "description": "Apartment rent",
  "frequency": "MONTHLY",
  "startDate": "2026-05-01T16:00:00.000Z"
}
```

Verify:

- creates a rule
- trims/sanitizes `name`, `category`, and `description`
- sets `nextRunAt` to `startDate`
- rejects missing/empty `name`
- rejects invalid amount
- rejects invalid type
- rejects invalid frequency
- rejects invalid dates
- rejects `endDate` before `startDate`

Suggested tags:

- `@API_Recurring`
- `@Recurring_Create`
- `@Validation`

### 3. Edit Recurring Rule

Endpoint:

- `PUT /api/recurring/:id`

Verify:

- updates the existing rule
- keeps previously generated transactions unchanged
- recalculates future `nextRunAt` using the rule's last applied date where applicable
- rejects invalid payloads
- rejects rules outside the current user's ownership

Suggested tags:

- `@API_Recurring`
- `@Recurring_Edit`
- `@Regression`

### 4. Pause / Resume Recurring Rule

Endpoint:

- `PATCH /api/recurring/:id`

Body:

```json
{
  "active": false
}
```

Verify:

- `active: false` pauses rule
- `active: true` resumes rule
- rejects non-boolean `active`
- rejects rules outside current user's ownership

Suggested tags:

- `@API_Recurring`
- `@Recurring_Pause_Resume`

### 5. Delete Recurring Rule

Endpoint:

- `DELETE /api/recurring/:id`

Verify:

- deletes the rule
- does not delete previously generated transactions
- rejects rules outside current user's ownership

Suggested tags:

- `@API_Recurring`
- `@Recurring_Delete`
- `@Delete`

### 6. Apply Due Recurring Rules

Endpoint:

- `POST /api/recurring/apply-due`

Verify:

- applies due rules for the current user only
- creates normal deposit/withdrawal transactions
- advances `nextRunAt`
- updates `lastRunAt`
- handles multiple missed occurrences if the app was unused for a while
- returns applied and failed counts
- reports insufficient funds failures without creating invalid withdrawals

Suggested tags:

- `@API_Recurring`
- `@Recurring_Apply_Due`
- `@Regression`

## Important Implementation Notes

- Recurring rules are not generated automatically by a background scheduler yet.
- The user must click `Apply due`.
- Credit accounts should not be shown as recurring-rule targets in the UI.
- Generated entries should behave like regular transactions.
- Rule edits affect future runs only.
- Rule deletion removes the schedule only.
- Existing generated transactions remain in account history.

