import { Component, type ReactNode } from 'react';

interface StartupErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onFailure: () => void;
}

interface StartupErrorBoundaryState {
  readonly failed: boolean;
}

/** Leaves the static startup screen in control if the initial React tree fails. */
export class StartupErrorBoundary extends Component<
  StartupErrorBoundaryProps,
  StartupErrorBoundaryState
> {
  override state: StartupErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): StartupErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.onFailure();
  }

  override render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
