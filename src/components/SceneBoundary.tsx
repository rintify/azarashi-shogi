import { Component } from 'react';
import type { ReactNode } from 'react';
interface Props {
  children: ReactNode;
  onFallback: () => void;
}
export class SceneBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="scene-fallback">
          <p>この環境では3D表示を開始できませんでした。</p>
          <button className="primary-button" onClick={this.props.onFallback}>
            マス一覧であそぶ
          </button>
        </div>
      );
    return this.props.children;
  }
}
