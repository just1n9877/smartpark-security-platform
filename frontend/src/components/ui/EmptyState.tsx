'use client';

import { ReactNode } from 'react';
import { LucideIcon, Search, Camera, Users, AlertTriangle, FileText, Settings, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// 预设的空状态类型
export type EmptyStateType = 
  | 'cameras' 
  | 'alerts' 
  | 'users' 
  | 'search' 
  | 'documents' 
  | 'settings' 
  | 'custom';

const emptyStatePresets: Record<EmptyStateType, { icon: LucideIcon; title: string; description: string }> = {
  cameras: {
    icon: Camera,
    title: '暂无摄像头',
    description: '系统尚未配置任何摄像头，请先添加摄像头设备',
  },
  alerts: {
    icon: AlertTriangle,
    title: '暂无告警',
    description: '当前没有告警记录，系统运行正常',
  },
  users: {
    icon: Users,
    title: '暂无用户',
    description: '用户列表为空，请添加新用户',
  },
  search: {
    icon: Search,
    title: '未找到结果',
    description: '没有找到匹配的数据，请尝试其他搜索词',
  },
  documents: {
    icon: FileText,
    title: '暂无文档',
    description: '暂无相关文档资料',
  },
  settings: {
    icon: Settings,
    title: '暂无设置项',
    description: '当前分类下没有可配置的选项',
  },
  custom: {
    icon: Inbox,
    title: '暂无数据',
    description: '当前没有数据',
  },
};

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  const Icon = icon || Inbox;

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${className}`}>
      {/* 图标区域 */}
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-cyan-400" />
      </div>

      {/* 标题 */}
      <h3 className="text-xl font-bold text-white mb-2">
        {title}
      </h3>

      {/* 描述 */}
      {description && (
        <p className="text-sm text-slate-400 text-center max-w-md mb-6">
          {description}
        </p>
      )}

      {/* 操作按钮 */}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}

// 预设空状态组件
export function CamerasEmpty({ onAction }: { onAction?: () => void }) {
  const preset = emptyStatePresets.cameras;
  return (
    <EmptyState
      icon={preset.icon}
      title={preset.title}
      description={preset.description}
      action={
        onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors"
          >
            <Camera className="w-4 h-4" />
            添加摄像头
          </button>
        )
      }
    />
  );
}

export function AlertsEmpty() {
  const preset = emptyStatePresets.alerts;
  return (
    <EmptyState
      icon={preset.icon}
      title={preset.title}
      description={preset.description}
    />
  );
}

export function UsersEmpty({ onAction }: { onAction?: () => void }) {
  const preset = emptyStatePresets.users;
  return (
    <EmptyState
      icon={preset.icon}
      title={preset.title}
      description={preset.description}
      action={
        onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors"
          >
            <Users className="w-4 h-4" />
            添加用户
          </button>
        )
      }
    />
  );
}

export function SearchEmpty({ keyword }: { keyword?: string }) {
  const preset = emptyStatePresets.search;
  return (
    <EmptyState
      icon={preset.icon}
      title={preset.title}
      description={
        keyword 
          ? `没有找到与 "${keyword}" 相关的结果，请尝试其他关键词`
          : preset.description
      }
    />
  );
}

export function DocumentsEmpty() {
  const preset = emptyStatePresets.documents;
  return (
    <EmptyState
      icon={preset.icon}
      title={preset.title}
      description={preset.description}
    />
  );
}

export function SettingsEmpty() {
  const preset = emptyStatePresets.settings;
  return (
    <EmptyState
      icon={preset.icon}
      title={preset.title}
      description={preset.description}
    />
  );
}

// 可组合的空状态组件
export function ListEmpty({ 
  type = 'custom',
  onAction,
  customIcon,
  customTitle,
  customDescription 
}: {
  type?: EmptyStateType;
  onAction?: () => void;
  customIcon?: LucideIcon;
  customTitle?: string;
  customDescription?: string;
}) {
  const preset = emptyStatePresets[type];
  
  return (
    <EmptyState
      icon={customIcon || preset.icon}
      title={customTitle || preset.title}
      description={customDescription || preset.description}
      action={
        onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors"
          >
            <span>添加</span>
          </button>
        )
      }
    />
  );
}
