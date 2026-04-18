'use client';

import { ReactNode } from 'react';

// 基础骨架屏
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
  const baseClasses = 'animate-pulse bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-[length:200%_100%]';
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'circular' ? '40px' : '100%'),
    height: height || (variant === 'circular' ? '40px' : variant === 'text' ? '16px' : '100px'),
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// 统计卡片骨架屏
export function StatCardSkeleton() {
  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-start justify-between mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <Skeleton width={60} height={20} />
      </div>
      <div className="space-y-2">
        <Skeleton width="60%" height={28} />
        <Skeleton width="40%" height={16} />
      </div>
    </div>
  );
}

// 表格骨架屏
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* 表头 */}
      <div className="flex gap-4 p-4 bg-slate-800/50 rounded-lg">
        <Skeleton width="20%" height={16} />
        <Skeleton width="20%" height={16} />
        <Skeleton width="20%" height={16} />
        <Skeleton width="20%" height={16} />
        <Skeleton width="20%" height={16} />
      </div>
      
      {/* 数据行 */}
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-4 p-4 bg-slate-800/30 rounded-lg">
          <Skeleton width="20%" height={16} />
          <Skeleton width="20%" height={16} />
          <Skeleton width="20%" height={16} />
          <Skeleton width="20%" height={16} />
          <Skeleton width="20%" height={16} />
        </div>
      ))}
    </div>
  );
}

// 卡片列表骨架屏
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-start justify-between mb-4">
            <Skeleton variant="circular" width={48} height={48} />
            <Skeleton width={60} height={24} />
          </div>
          <div className="space-y-2">
            <Skeleton width="80%" height={20} />
            <Skeleton width="50%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
}

// 内容骨架屏
export function ContentSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* 标题区域 */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width={200} height={28} />
          <Skeleton width={150} height={16} />
        </div>
        <Skeleton width={120} height={40} />
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <Skeleton width={150} height={24} className="mb-6" />
          <Skeleton width="100%" height={300} />
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <Skeleton width={150} height={24} className="mb-6" />
          <Skeleton width="100%" height={300} />
        </div>
      </div>
    </div>
  );
}

// 列表项骨架屏
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" height={14} />
      </div>
      <Skeleton width={80} height={32} />
    </div>
  );
}

// 图片骨架屏
export function ImageSkeleton({ aspectRatio = '16/9' }: { aspectRatio?: string }) {
  return (
    <div 
      className="relative bg-slate-800/50 rounded-xl overflow-hidden"
      style={{ aspectRatio }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Skeleton width="100%" height="100%" />
      </div>
    </div>
  );
}

// 页面骨架屏
export function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <ContentSkeleton />
    </div>
  );
}
