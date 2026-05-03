'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Camera, AlertTriangle, Users, Activity, Bell, Settings,
  ChevronRight, Eye, Zap, MapPin, Clock, Map,
  Grid3X3, List, Check, X, Loader2,
} from 'lucide-react';
import { Sidebar, Header, StatCard } from '@/components/Sidebar';
import { fetchAlerts, fetchCameras, fetchDashboardSummary, type ApiAlert } from '@/lib/api';

const summaryFetcher = () => fetchDashboardSummary();
const alertsFetcher = () => fetchAlerts(5);
const camerasFetcher = () => fetchCameras();

function uiLevel(raw: string): string {
  if (raw === 'critical') return 'critical';
  if (raw === 'high') return 'warning';
  if (raw === 'medium') return 'medium';
  if (raw === 'low') return 'low';
  if (raw === 'alert') return 'critical';
  if (raw === 'warning') return 'warning';
  return raw;
}

function levelStyle(level: string) {
  const colors: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    alert: 'text-red-400 bg-red-500/10 border-red-500/30',
  };
  return colors[level] || 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
}

export default function DashboardPage() {
  const { data: summary, isLoading: sLoading, error: sError } = useSWR('dash-summary', summaryFetcher, {
    refreshInterval: 10000,
  });
  const { data: recentAlerts, isLoading: aLoading, error: aError } = useSWR('dash-alerts', alertsFetcher, {
    refreshInterval: 8000,
  });
  const { data: cameras, isLoading: cLoading, error: cError } = useSWR('dash-cameras', camerasFetcher, {
    refreshInterval: 15000,
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAlert, setSelectedAlert] = useState<ApiAlert | null>(null);

  const statsData = useMemo(() => {
    const s = summary;
    if (!s) {
      return [
        { id: 1, label: '已登记摄像头', value: 0, icon: Camera, color: 'cyan' as const, trend: '' },
        { id: 2, label: '今日告警', value: 0, icon: AlertTriangle, color: 'amber' as const, trend: '' },
        { id: 3, label: '反馈条数', value: 0, icon: Users, color: 'emerald' as const, trend: '' },
        { id: 4, label: '分析任务总数', value: 0, icon: Activity, color: 'cyan' as const, trend: '' },
      ];
    }
    const fp =
      s.feedback_false_positive_rate != null
        ? `误报占比 ${(s.feedback_false_positive_rate * 100).toFixed(1)}%`
        : '';
    return [
      {
        id: 1,
        label: '已登记摄像头',
        value: s.cameras_count,
        icon: Camera,
        color: 'cyan' as const,
        trend: '',
      },
      {
        id: 2,
        label: '今日告警',
        value: s.alerts_today,
        icon: AlertTriangle,
        color: 'amber' as const,
        trend: '',
      },
      {
        id: 3,
        label: '反馈条数',
        value: s.feedback_total,
        icon: Users,
        color: 'emerald' as const,
        trend: fp,
      },
      {
        id: 4,
        label: '分析任务总数',
        value: s.recent_jobs_count,
        icon: Activity,
        color: 'cyan' as const,
        trend: '',
      },
    ];
  }, [summary]);

  const jobStatusLines = useMemo(() => {
    const j = summary?.jobs_by_status;
    if (!j) return [];
    return Object.entries(j).map(([k, v]) => ({ k, v }));
  }, [summary]);

  const loading = sLoading && !summary;
  const hasError = Boolean(sError || aError || cError);

  return (
    <Sidebar currentPath="/dashboard">
      <Header
        title="仪表盘"
        subtitle="园区态势、告警趋势与设备运行概览"
        statusBadge={
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${hasError ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
            <div className={`w-2 h-2 rounded-full ${hasError ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span className={`text-sm font-medium ${hasError ? 'text-red-400' : 'text-emerald-400'}`}>
              {hasError ? '服务异常' : '运行正常'}
            </span>
          </div>
        }
      />

      <div className="flex-1 p-6 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 mb-4">
            <Loader2 className="w-5 h-5 animate-spin" />
            加载统计…
          </div>
        )}
        {hasError && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            数据加载异常：
            {[sError, aError, cError]
              .filter(Boolean)
              .map((e) => (e instanceof Error ? e.message : String(e)))
              .join('；')}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statsData.map((stat) => (
            <StatCard key={stat.id} {...stat} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 dashboard-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-cyan-400" />
                最近告警
              </h3>
              <Link href="/alerts" className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                查看全部
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {aLoading && !recentAlerts?.length ? (
              <p className="text-slate-500 text-sm">加载中…</p>
            ) : (
              <div className="space-y-3">
                {(recentAlerts ?? []).map((alert) => {
                  const ul = uiLevel(alert.level);
                  return (
                    <div
                      key={alert.id}
                      onClick={() => setSelectedAlert(alert)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${levelStyle(ul)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white">{alert.alert_type}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/50">{alert.level}</span>
                          </div>
                          <p className="text-sm text-slate-400">
                            轨迹 #{alert.track_id ?? '—'} · job {alert.job_id ?? '—'}
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          {new Date(alert.triggered_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!recentAlerts?.length && (
                  <p className="text-slate-500 text-sm">暂无告警，请先运行视频分析任务。</p>
                )}
              </div>
            )}
          </div>

          <div className="dashboard-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                摄像头
              </h3>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
            {cLoading && !cameras?.length ? (
              <p className="text-slate-500 text-sm">加载中…</p>
            ) : (
              <div className={`space-y-3 ${viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : ''}`}>
                {(cameras ?? []).map((camera) => (
                  <div
                    key={camera.id}
                    className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                          <Camera className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#1e293b]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{camera.name}</p>
                        <p className="text-xs text-slate-500 truncate">{camera.notes || '无备注'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!cameras?.length && (
                  <p className="text-slate-500 text-sm">暂无摄像头记录，可在实时监控页添加。</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="dashboard-card rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-purple-400" />
              分析任务状态
            </h3>
            <div className="space-y-3">
              {jobStatusLines.length === 0 && <p className="text-slate-500 text-sm">暂无数据</p>}
              {jobStatusLines.map(({ k, v }) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-cyan-400 font-medium">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-4">展示最近分析任务的处理状态。</p>
          </div>

          <div className="dashboard-card rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-400" />
              快捷入口
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/alerts"
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/40 transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-cyan-400" />
                </div>
                <span className="text-sm font-medium text-white">告警中心</span>
              </Link>
              <Link
                href="/analytics"
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-amber-500/40 transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-sm font-medium text-white">数据分析</span>
              </Link>
              <Link href="/rules" className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/40 transition-all flex items-center gap-3">
                <Map className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-medium text-white">场景规则</span>
              </Link>
              <Link href="/settings" className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/40 transition-all flex items-center gap-3">
                <Settings className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-white">系统设置</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {selectedAlert && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="dashboard-card rounded-2xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">告警详情</h3>
              <button type="button" onClick={() => setSelectedAlert(null)} className="p-2 rounded-lg hover:bg-slate-700/50">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${levelStyle(uiLevel(selectedAlert.level))}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-lg text-white">{selectedAlert.alert_type}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/50">{selectedAlert.level}</span>
                </div>
                <p className="text-sm text-slate-400">轨迹 #{selectedAlert.track_id ?? '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-slate-500 mb-1">时间</p>
                  <p className="text-sm text-white flex items-center gap-1">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    {new Date(selectedAlert.triggered_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-slate-500 mb-1">摄像头</p>
                  <p className="text-sm text-white flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    {selectedAlert.camera_id ?? '未绑定'}
                  </p>
                </div>
              </div>
              <Link
                href="/alerts"
                className="flex w-full py-2.5 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                去告警中心反馈
              </Link>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
