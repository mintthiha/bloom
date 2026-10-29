import { Component, type ReactNode } from "react";

/**
 * Test stand-in for `app/error.tsx`: shows "Caught: <message>" for whatever its children throw,
 * so a test can assert that a load failure reached the route's error boundary.
 */
export class TestErrorBoundary extends Component<
  { children: ReactNode },
  { caughtError: Error | null }
> {
  state = { caughtError: null as Error | null };

  /** Records the thrown error so the next render shows it instead of the children. */
  static getDerivedStateFromError(caughtError: Error) {
    return { caughtError };
  }

  render() {
    return this.state.caughtError ? (
      <p>Caught: {this.state.caughtError.message}</p>
    ) : (
      this.props.children
    );
  }
}
