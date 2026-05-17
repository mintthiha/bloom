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
