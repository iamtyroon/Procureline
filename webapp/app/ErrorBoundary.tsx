import { Component, ReactNode } from "react";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.error !== null) {
      return (
        <div className="bg-destructive/30 p-8 flex flex-col gap-4 container">
          <h1 className="text-xl font-bold">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            {this.state.error.message}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
