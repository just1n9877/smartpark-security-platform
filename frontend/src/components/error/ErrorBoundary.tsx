'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // 调用回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 上报错误到监控服务
    console.error('❌ Error caught by boundary:', error, errorInfo);
    
    // TODO: 发送到 Sentry 或其他错误监控服务
    // Sentry.captureException(error, { extra: errorInfo });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/30 rounded-2xl p-8 text-center">
              {/* 错误图标 */}
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>

              {/* 错误标题 */}
              <h2 className="text-xl font-bold text-white mb-3">
                页面出现了一些问题
              </h2>

              {/* 错误信息 */}
              <p className="text-slate-400 text-sm mb-6">
                {this.state.error?.message || '发生了未知错误，请稍后重试'}
              </p>

              {/* 错误详情（开发环境） */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left bg-slate-800/50 rounded-lg p-4 mb-6">
                  <summary className="text-sm text-cyan-400 cursor-pointer mb-2">
                    错误详情（开发模式）
                  </summary>
                  <pre className="text-xs text-red-300 overflow-x-auto whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.resetError}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  重试
                </button>
                
                <a
                  href="/dashboard"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  返回首页
                </a>
              </div>

              {/* 联系支持 */}
              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 mb-2">
                  如果问题持续存在，请联系技术支持
                </p>
                <a
                  href="mailto:support@smartguard.com"
                  className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  support@smartguard.com
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 简化版错误边界（用于包裹单个组件）
interface SimpleErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function SimpleErrorBoundary({ children, fallback }: SimpleErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        fallback || (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-400">组件加载失败</p>
              <button
                onClick={() => window.location.reload()}
                className="ml-auto text-xs text-amber-300 hover:text-amber-200"
              >
                刷新页面
              </button>
            </div>
          </div>
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}
