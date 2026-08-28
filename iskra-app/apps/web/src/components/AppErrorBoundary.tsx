import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; resetKey: string };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ISKRA route failed", error, info);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="route-error" role="alert">
        <p>THE SIGNAL DROPPED</p>
        <h1>This page needs another try.</h1>
        <span>Your account and venue activity are safe.</span>
        <div>
          <button type="button" onClick={() => this.setState({ error: null })}>Try again</button>
          <a href="/">Return home</a>
        </div>
      </main>
    );
  }
}
