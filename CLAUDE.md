# Bloom — Claude Instructions

## Modularity

Never add new feature logic directly to `page.tsx` or other existing files if it can live in its own module. When implementing a new feature or UI section:

- Create a dedicated file for it
- Place it in a semantically named subfolder under `_components/`
- Use underscore-prefixed folder names (e.g. `_import`, `_accountActions`, `_accountTransactions`) to mark them as private/non-route in Next.js

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

## UI Components — Use shadcn/ui and Sonner First

Before building a custom UI component, check whether shadcn/ui or the existing shared component library already provides it.

- **Toasts / notifications** → always use `toast` from `sonner`. Never use inline `opError` / `opSuccess` state for user feedback. Import and call `toast.success(...)` or `toast.error(...)` directly in the component that performs the action.
- **Dialogs / confirms** → use shadcn `AlertDialog` before writing a custom modal.
- **Delete actions** → every delete must go through two steps: (1) an `AlertDialog` asking "Are you sure?" with the item name in the description, and (2) a `toast.success("X deleted")` after the deletion completes. Never delete immediately on button click.
- **Create actions** → always call `toast.success("X created")` (or equivalent) immediately after a successful creation so the user gets visual confirmation. Sonner's `toast.success` renders green by default — use it as-is.
- **Other UI primitives** (buttons, inputs, selects, etc.) → check `src/components/ui/` for an existing shadcn component before writing raw HTML with inline styles.

Shared, non-route-specific components (e.g. `BackToHome`) belong in `src/components/`, not inside a route's `_components/` folder.

## Naming

Use full, descriptive names for all identifiers — functions, constants, variables, and types. Abbreviations are not acceptable unless they are universally understood domain terms (e.g. `id`, `url`).

- **Functions**: name for what they do — `formatCurrency`, not `fmt`; `handleSubmit`, not `onSub`
- **Constants**: name for what they represent — `inputStyle`, not `s`; `ACCOUNT_TYPE_META`, not `META`
- **Variables**: spell out intent — `isSubmitting`, not `loading2`; `selectedAccountId`, not `selId`

If a name needs a comment to explain what it refers to, the name is wrong — rename it instead.

## Comments

Add a JSDoc comment above every function — including handlers, helpers, and hooks. The comment should explain the **why or what** in one line, not restate the function name.

```ts
/** Saves the updated nickname via the API and notifies the parent with the updated account. */
async function handleSave() { ... }

/** Syncs the local input value when the nickname prop changes after a parent refresh. */
useEffect(() => { ... }, [nickname, editing]);
```

## State Ownership (Controlled Component Pattern)

When a child component needs to change state that the parent also reads, the state belongs in the parent. Pass the value and a setter callback as props.

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

## Post-Implementation Checklist

After every implementation, run all three of the following and fix any failures before reporting the task complete:

```bash
# 1. Frontend formatting
cd frontend && npm run format:check

# 2. Frontend tests
cd frontend && npm test -- --watchAll=false

# 3. Backend tests
cd backend && npm test -- --watchAll=false
```

If `format:check` fails, run `npx prettier --write src` from the `frontend/` directory to auto-fix, then re-verify.

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
