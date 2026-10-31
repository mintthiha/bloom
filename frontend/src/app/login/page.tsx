import { AuthPanel } from "./_components/_authPanel/AuthPanel";
import { LoginShowcase } from "./_components/_showcase/LoginShowcase";

/** Sign-in page: the branded showcase (large screens) beside the sign-in options. */
export default function LoginPage() {
  return (
    <div
      className="grid h-screen overflow-hidden lg:grid-cols-2"
      style={{ background: "var(--surface-0)" }}
    >
      <LoginShowcase />
      <AuthPanel />
    </div>
  );
}
