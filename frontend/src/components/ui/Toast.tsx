'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

// Toast 类型
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast 提供者
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);

    // 自动移除
    const duration = toast.duration || 4000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// 使用 Toast 的 Hook
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const toast = {
    success: (title: string, message?: string) => 
      context.addToast({ type: 'success', title, message }),
    error: (title: string, message?: string) => 
      context.addToast({ type: 'error', title, message }),
    warning: (title: string, message?: string) => 
      context.addToast({ type: 'warning', title, message }),
    info: (title: string, message?: string) => 
      context.addToast({ type: 'info', title, message }),
  };

  return { ...context, toast };
}

// Toast 容器
function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

// 单个 Toast 项
interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const config = {
    success: {
      icon: CheckCircle,
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      iconColor: 'text-emerald-400',
      progressColor: 'bg-emerald-400',
    },
    error: {
      icon: XCircle,
      bg: 'bg-red-500/10 border-red-500/30',
      iconColor: 'text-red-400',
      progressColor: 'bg-red-400',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-500/10 border-amber-500/30',
      iconColor: 'text-amber-400',
      progressColor: 'bg-amber-400',
    },
    info: {
      icon: Info,
      bg: 'bg-cyan-500/10 border-cyan-500/30',
      iconColor: 'text-cyan-400',
      progressColor: 'bg-cyan-400',
    },
  };

  const { icon: Icon, bg, iconColor, progressColor } = config[toast.type];

  return (
    <div 
      className={`
        ${bg}
        backdrop-blur-md rounded-xl border p-4
        shadow-lg shadow-black/20
        animate-[slideIn_0.3s_ease-out]
      `}
      style={{
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
      
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-slate-400 mt-1">{toast.message}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      
      {/* 进度条 */}
      <div className="mt-3 h-1 bg-slate-700/50 rounded-full overflow-hidden">
        <div 
          className={`h-full ${progressColor} rounded-full transition-all`}
          style={{ 
            animation: `shrink ${toast.duration || 4000}ms linear forwards`,
          }}
        />
      </div>
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
