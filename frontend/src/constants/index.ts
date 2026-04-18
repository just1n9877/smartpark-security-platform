import type { AlertLevel, AlertStatus, CameraStatus } from '@/types';

// 告警级别配置
export const ALERT_LEVELS: Record<AlertLevel, {
  priority: number;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  critical: { 
    priority: 0, 
    label: '紧急', 
    color: 'text-red-400', 
    bg: 'bg-red-500/10', 
    border: 'border-red-500/30' 
  },
  warning: { 
    priority: 1, 
    label: '高危', 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/30' 
  },
  medium: { 
    priority: 2, 
    label: '中等', 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-500/10', 
    border: 'border-yellow-500/30' 
  },
  low: { 
    priority: 3, 
    label: '低', 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/30' 
  },
};

// 告警状态配置
export const ALERT_STATUS: Record<AlertStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  pending: { 
    label: '待处理', 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/10' 
  },
  handling: { 
    label: '处理中', 
    color: 'text-cyan-400', 
    bg: 'bg-cyan-500/10' 
  },
  resolved: { 
    label: '已解决', 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10' 
  },
  falseAlarm: { 
    label: '误报', 
    color: 'text-slate-400', 
    bg: 'bg-slate-500/10' 
  },
};

// 摄像头状态配置
export const CAMERA_STATUS: Record<CameraStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  online: { 
    label: '在线', 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500' 
  },
  warning: { 
    label: '异常', 
    color: 'text-amber-400', 
    bg: 'bg-amber-500' 
  },
  offline: { 
    label: '离线', 
    color: 'text-red-400', 
    bg: 'bg-red-500' 
  },
};

// 告警类型图标映射
export const ALERT_TYPE_ICONS: Record<string, string> = {
  '入侵检测': 'Shield',
  '人脸识别': 'UserX',
  '聚集预警': 'Users',
  '火焰检测': 'Flame',
  '异常行为': 'Zap',
  '区域入侵': 'Shield',
  '烟雾检测': 'AlertTriangle',
  '周界入侵': 'Shield',
};

// 主题颜色配置
export const THEME_COLORS = {
  primary: '#06b6d4',
  accent: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  purple: '#8b5cf6',
} as const;

// 动画时长配置
export const ANIMATION = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

// 间距配置
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const;
