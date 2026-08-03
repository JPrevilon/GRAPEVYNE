import { Component, type PropsWithChildren, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorPanel } from "@/components/ui/StatePanels";

interface BoundaryProps extends PropsWithChildren {
  resetKey: string;
}

interface BoundaryState {
  hasError: boolean;
}

class RouteErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) {
      console.error("[GRAPEVYNE] A route failed; the safe recovery view is active.", {
        errorName: error.name,
      });
    }
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="gv-page-shell">
        <ErrorPanel
          action={
            <div className="gv-page-hero__actions">
              <Button onClick={() => window.location.reload()} variant="primary">
                Try this page again
              </Button>
              <ButtonLink to="/" variant="secondary">
                Return home
              </ButtonLink>
            </div>
          }
          description="This recovery view does not change saved cellar data. Reload this page or return home to continue."
          eyebrow="Application recovery"
          headingLevel="h1"
          title="THIS PAGE COULD NOT BE OPENED"
        />
      </div>
    );
  }
}

export default function AppErrorBoundary({ children }: PropsWithChildren) {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={`${location.pathname}${location.search}${location.hash}`}>
      {children}
    </RouteErrorBoundary>
  );
}
