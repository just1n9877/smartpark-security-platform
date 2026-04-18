'use client';

import { ReactNode } from 'react';

// 通用卡片组件
interface TechCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function TechCard({ 
  children, 
  className = '', 
  hover = false,
  glow = false,
  padding = 'md'
}: TechCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div 
      className={`
        rounded-2xl 
        bg-gradient-to-br from-slate-800/50 to-slate-900/50 
        border border-cyan-500/10
        backdrop-blur-sm
        transition-all duration-200
        ${paddingClasses[padding]}
        ${hover ? 'hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/10 hover:border-cyan-500/20' : ''}
        ${glow ? 'shadow-[0_0_30px_rgba(6,182,212,0.15)]' : ''}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}

// 统计卡片
interface StatCardProps {
  label: string;
  value: number | string;
  total?: number;
  icon: React.ElementType;
  color: 'cyan' | 'amber' | 'emerald' | 'purple';
  trend?: string;
  suffix?: string;
}

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  total, 
  trend, 
  suffix = '', 
  color 
}: StatCardProps) {
  const colorClasses = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
  };
  
  const iconColors = {
    cyan: 'text-cyan-400 bg-cyan-500/20',
    amber: 'text-amber-400 bg-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
  };

  const trendColor = trend?.startsWith('+') 
    ? 'text-emerald-400' 
    : trend?.startsWith('-') 
      ? 'text-red-400' 
      : 'text-slate-400';

  const TrendIcon = trend?.startsWith('+') ? '↑' : trend?.startsWith('-') ? '↓' : null;

  return (
    <TechCard hover className={`bg-gradient-to-br ${colorClasses[color]} border`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${iconColors[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            {TrendIcon && <span>{TrendIcon}</span>}
            {trend}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix}
          {total && <span className="text-slate-500 text-lg">/{total}</span>}
        </div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
      {total && typeof value === 'number' && (
        <div className="mt-3 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-1000"
            style={{ width: `${(value / total) * 100}%` }}
          />
        </div>
      )}
    </TechCard>
  );
}

// 徽章组件
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
}

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'sm',
  dot = false,
  pulse = false 
}: BadgeProps) {
  const variantClasses = {
    default: 'bg-slate-700/50 text-slate-300',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/10 text-red-400 border-red-500/30',
    info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  };

  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    info: 'bg-cyan-400',
  };

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border
        text-xs font-medium
        ${variantClasses[variant]}
        ${size === 'md' ? 'text-sm px-3 py-1' : ''}
      `.trim()}
    >
      {dot && (
        <span 
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} ${pulse ? 'animate-pulse' : ''}`} 
        />
      )}
      {children}
    </span>
  );
}

// 状态指示器
interface StatusDotProps {
  status: 'online' | 'warning' | 'offline';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function StatusDot({ status, size = 'md', pulse = false }: StatusDotProps) {
  const colors = {
    online: 'bg-emerald-400',
    warning: 'bg-amber-400',
    offline: 'bg-red-400',
  };

  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  return (
    <span 
      className={`
        inline-block rounded-full 
        ${colors[status]} 
        ${sizes[size]}
        ${pulse ? 'animate-pulse' : ''}
      `.trim()}
    />
  );
}

// 进度条组件
interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'cyan' | 'emerald' | 'amber' | 'red' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

export function ProgressBar({ 
  value, 
  max = 100, 
  color = 'cyan',
  size = 'md',
  showLabel = false,
  animated = true 
}: ProgressBarProps) {
  const colorClasses = {
    cyan: 'bg-gradient-to-r from-cyan-500 to-cyan-400',
    emerald: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    amber: 'bg-gradient-to-r from-amber-500 to-amber-400',
    red: 'bg-gradient-to-r from-red-500 to-red-400',
    purple: 'bg-gradient-to-r from-purple-500 to-purple-400',
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className="w-full">
      <div className={`w-full bg-slate-700/50 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div 
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-1000 ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-slate-400">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}

// 空状态组件
interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-slate-500" />
        </div>
      )}
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// 骨架屏组件
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ 
  className = '', 
  variant = 'rectangular',
  width,
  height 
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={`
        animate-pulse bg-gradient-to-r 
        from-slate-700/50 via-slate-600/50 to-slate-700/50 
        bg-[length:200%_100%]
        animate-[shimmer_2s_infinite]
        ${variantClasses[variant]}
        ${className}
      `.trim()}
      style={{ 
        width: width || '100%',
        height: height || (variant === 'text' ? '1rem' : '100%')
      }}
    />
  );
}

// 加载状态组件
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function LoadingSpinner({ size = 'md', color = 'text-cyan-400' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <svg
      className={`animate-spin ${sizes[size]} ${color}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// 加载Overlay
interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = '加载中...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-cyan-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
