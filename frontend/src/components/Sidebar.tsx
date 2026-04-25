'use client';

import { useState, createContext, useContext, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import {
  Shield, Camera, AlertTriangle, Fingerprint, MessageSquare, BarChart3, HardDrive, LogOut, Settings, Map,
  ChevronLeft, ChevronRight, Grid3X3, TrendingUp, TrendingDown, Menu, X
} from 'lucide-react';
import { clearAuth } from '@/lib/api';

// 侧边栏上下文
interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
  isMobileOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isExpanded: true,
  toggleSidebar: () => {},
  isMobileOpen: false,
  toggleMobileSidebar: () => {},
  closeMobileSidebar: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

// StatCard 组件 - 优化响应式
interface StatCardProps {
  id: number;
  label: string;
  value: number;
  total?: number;
  icon: React.ElementType;
  color: 'cyan' | 'amber' | 'emerald' | 'purple';
  trend?: string;
  suffix?: string;
}

export function StatCard({ icon: Icon, label, value, total, trend, suffix = '', color }: StatCardProps) {
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
  
  const trendColor = trend?.startsWith('+') ? 'text-emerald-400' : trend?.startsWith('-') ? 'text-red-400' : 'text-slate-400';
  const TrendIcon = trend?.startsWith('+') ? TrendingUp : TrendingDown;

  return (
    <div className={`dashboard-card rounded-xl sm:rounded-2xl p-4 sm:p-5 bg-gradient-to-br ${colorClasses[color]} border transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/10`}>
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl ${iconColors[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {trend}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-xl sm:text-2xl font-bold text-white">
          {value.toLocaleString()}{suffix}
          {total && <span className="text-slate-500 text-sm sm:text-lg">/{total}</span>}
        </div>
        <div className="text-xs sm:text-sm text-slate-400">{label}</div>
      </div>
      {total && (
        <div className="mt-2 sm:mt-3 h-1 sm:h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-1000"
            style={{ width: `${(value / total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Header 组件 - 优化响应式
interface HeaderProps {
  title: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  children?: ReactNode;
  showMobileMenu?: boolean;
  onMobileMenuClick?: () => void;
}

export function Header({ title, subtitle, statusBadge, children, showMobileMenu, onMobileMenuClick }: HeaderProps) {
  return (
    <div className="border-b border-cyan-500/10 bg-[#030712]/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showMobileMenu && (
            <button 
              onClick={onMobileMenuClick}
              className="md:hidden p-2 rounded-lg hover:bg-slate-700/50 transition-colors lg:hidden"
              aria-label="菜单"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
            {subtitle && <p className="text-xs sm:text-sm text-slate-400 mt-0.5 hidden sm:block">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {statusBadge}
          {children}
        </div>
      </div>
    </div>
  );
}

// 侧边栏配置
const navItems = [
  { icon: Grid3X3, label: '仪表盘', href: '/dashboard' },
  { icon: Camera, label: '实时监控', href: '/monitor' },
  { icon: AlertTriangle, label: '告警中心', href: '/alerts' },
  { icon: Map, label: '场景规则', href: '/rules' },
  { icon: Fingerprint, label: '人脸识别', href: '/face' },
  { icon: MessageSquare, label: 'AI助手', href: '/assistant' },
  { icon: HardDrive, label: '设备管理', href: '/devices' },
  { icon: BarChart3, label: '数据分析', href: '/analytics' },
  { icon: Settings, label: '系统设置', href: '/settings' },
];

interface SidebarProps {
  currentPath: string;
  children: React.ReactNode;
}

export function Sidebar({ currentPath, children }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsExpanded(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 从 localStorage 读取保存的状态
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-expanded');
    if (saved !== null && !isMobile) {
      setIsExpanded(saved === 'true');
    }
  }, [isMobile]);

  const toggleSidebar = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (!isMobile) {
      localStorage.setItem('sidebar-expanded', String(newState));
    }
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileOpen(false);
  };

  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar, isMobileOpen, toggleMobileSidebar, closeMobileSidebar }}>
      <div className="min-h-screen bg-[#030712] flex">
        {/* 动态光效 */}
        <div 
          className="fixed w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none z-0 transition-opacity duration-300"
          style={{
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.6) 0%, transparent 70%)',
          }}
        />

        {/* 移动端遮罩层 */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            onClick={closeMobileSidebar}
          />
        )}

        {/* 移动端抽屉侧边栏 */}
        <aside 
          className={`fixed left-0 top-0 h-full sidebar-tech flex flex-col z-40 transform transition-transform duration-300 ease-out md:hidden ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ width: '280px' }}
        >
          {/* 顶部区域：Logo + 关闭按钮 */}
          <div className="p-4 border-b border-cyan-500/10">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="flex items-center gap-3 min-w-0" onClick={closeMobileSidebar}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-neon whitespace-nowrap" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    SmartGuard
                  </h1>
                  <p className="text-xs text-slate-500 whitespace-nowrap">AI安防系统</p>
                </div>
              </Link>
              
              <button
                onClick={closeMobileSidebar}
                className="w-8 h-8 rounded-lg bg-slate-800/50 border border-cyan-500/20 flex items-center justify-center hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all"
              >
                <X className="w-4 h-4 text-cyan-400" />
              </button>
            </div>
          </div>

          {/* 导航菜单 */}
          <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = currentPath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileSidebar}
                    className={`nav-item flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:text-cyan-400 transition-all duration-200 group relative ${
                      isActive ? 'active text-cyan-400 bg-cyan-500/10' : ''
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <div className="absolute right-0 w-1 h-8 bg-cyan-400 rounded-l-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* 桌面端侧边栏 */}
        <aside 
          className={`hidden md:flex sidebar-tech flex-col relative z-20 transition-all duration-300 ease-out ${
            isExpanded ? 'w-64' : 'w-20'
          }`}
        >
          {/* 顶部区域：Logo + 展开/收缩按钮 */}
          <div className="p-4 border-b border-cyan-500/10">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 hover:border-cyan-400 transition-colors">
                  <Shield className="w-6 h-6 text-cyan-400" />
                </div>
                <div className={`overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
                }`}>
                  <h1 className="text-lg font-bold text-neon whitespace-nowrap" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    SmartGuard
                  </h1>
                  <p className="text-xs text-slate-500 whitespace-nowrap">AI安防系统</p>
                </div>
              </Link>
              
              {/* 展开/收缩按钮 - 移到顶部右侧 */}
              <button
                onClick={toggleSidebar}
                className="w-8 h-8 rounded-lg bg-slate-800/50 border border-cyan-500/20 flex items-center justify-center hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all flex-shrink-0 group"
                title={isExpanded ? '收起侧边栏' : '展开侧边栏'}
              >
                {isExpanded ? (
                  <ChevronLeft className="w-4 h-4 text-cyan-400 transition-transform group-hover:-translate-x-0.5" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-cyan-400 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </div>
          </div>

          {/* 导航菜单 */}
          <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = currentPath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-cyan-400 transition-all duration-200 group relative ${
                      isActive ? 'active text-cyan-400 bg-cyan-500/10' : ''
                    }`}
                    title={!isExpanded ? item.label : undefined}
                  >
                    {/* 激活状态左侧竖线 */}
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-r-full bg-gradient-to-b from-cyan-400 to-emerald-400 transition-all duration-200 ${
                      isActive ? 'h-6' : 'h-0 group-hover:h-3'
                    }`} />
                    
                    <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                      isActive ? 'text-cyan-400' : 'group-hover:scale-110'
                    }`} />
                    
                    {isExpanded && (
                      <span className="font-medium whitespace-nowrap overflow-hidden text-sm">
                        {item.label}
                      </span>
                    )}
                    
                    {/* 收缩状态显示工具提示 */}
                    {!isExpanded && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 border border-cyan-500/30 rounded-lg text-sm text-cyan-400 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-lg">
                        {item.label}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800" />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* 底部区域：用户信息 */}
          <div className="p-3 border-t border-cyan-500/10">
            <button
              type="button"
              onClick={() => {
                clearAuth();
                window.location.href = '/login';
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-700/50 transition-colors group text-left"
              title={!isExpanded ? '退出登录' : undefined}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-cyan-400 font-bold text-sm">A</span>
              </div>
              {isExpanded && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">退出登录</p>
                    <p className="text-xs text-slate-500 truncate">清除令牌并返回登录</p>
                  </div>
                  <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors flex-shrink-0" />
                </>
              )}
            </button>
          </div>
        </aside>

        {/* 主内容区 - 响应式调整 */}
        <main className={`flex-1 flex flex-col relative z-10 overflow-hidden transition-all duration-300 ease-out ${
          isMobile ? '' : isExpanded ? '' : 'lg:mr-0'
        }`}>
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
