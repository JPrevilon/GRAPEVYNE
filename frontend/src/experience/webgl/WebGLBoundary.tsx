import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from "react";

interface WebGLBoundaryProps extends PropsWithChildren {
  onError: (error: Error) => void;
  resetKey: string;
}

interface WebGLBoundaryState {
  error: Error | null;
}

export class WebGLBoundary extends Component<
  WebGLBoundaryProps,
  WebGLBoundaryState
> {
  state: WebGLBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WebGLBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    this.props.onError(error);
  }

  componentDidUpdate(previousProps: WebGLBoundaryProps) {
    if (
      previousProps.resetKey !== this.props.resetKey &&
      this.state.error !== null
    ) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) return null;
    return this.props.children;
  }
}
