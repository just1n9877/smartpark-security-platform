'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  BarChart3, Calendar, Download,
  AlertTriangle, Camera, Shield, Activity, Loader2,
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';
import { apiFetch, type ApiAlert, type DashboardSummary } from '@/lib/api';

const summaryFetcher = () => apiFetch<DashboardSummary>('/dashboard/summary');
const alertsFetcher = () => apiFetch<ApiAlert[]>('/alerts?limit=500');

export default function AnalyticsPage() {
  const { data: summary, isLoading: sLoad } = useSWR('analytics-summary', summaryFetcher, {
    refreshInterval: 15000,
  });
  const { data: alerts, isLoading: aLoad } = useSWR('analytics-alerts-types', alertsFetcher);

  const [selectedArea, setSelectedArea] = useState('all');

  const alertTrendData = useMemo(() => {
    if (!summary?.alerts_by_day_7d?.length) {
      return [{ date: '—', count: 0 }];
    }
    return summary.alerts_by_day_7d.map((d) => ({
      date: d.date.slice(5),
      count: d.count,
    }));
  }, [summary]);

  const maxAlertCount = Math.max(...alertTrendData.map((d) => d.count), 1);

  const typeDistribution = useMemo(() => {
    const list = alerts ?? [];
    const map = new Map<string, number>();
    for (const a of list) {
      map.set(a.alert_type, (map.get(a.alert_type) ?? 0) + 1);
    }
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const total = list.length || 1;
    return entries.map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }, [alerts]);

  const statisticsCards = useMemo(() => {
    const s = summary;
    const sum7 =
      s?.alerts_by_day_7d?.reduce((acc, x) => acc + x.count, 0) ?? 0;
    const fpPct =
      s?.feedback_false_positive_rate != null
        ? `${(s.feedback_false_positive_rate * 100).toFixed(1)}%`
        : '—';
    return [
      {
        title: '近 7 日告警总数',
        value: String(sum7),
        change: '后端聚合',
        trend: 'up' as const,
        icon: AlertTriangle,
        color: 'amber' as const,
      },
      {
        title: '今日告警',
        value: String(s?.alerts_today ?? 0),
        change: '实时',
        trend: 'up' as const,
        icon: Activity,
        color: 'cyan' as const,
      },
      {
        title: '反馈误报占比',
        value: fpPct,
        change: '基于 Feedback 表',
        trend: 'down' as const,
        icon: Shield,
        color: 'emerald' as const,
      },
      {
        title: '已登记摄像头',
        value: String(s?.cameras_count ?? 0),
        change: '设备表',
        trend: 'up' as const,
        icon: Camera,
        color: 'purple' as const,
      },
    ];
  }, [summary]);

  const loading = (sLoad && !summary) || (aLoad && !alerts);

  return (
    <Sidebar currentPath="/analytics">
      <Header
        title="数据分析"
        subtitle="近 7 日与告警类型来自后端；以下为真实 API 数据"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400 text-sm font-medium">GET /dashboard/summary</span>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <span className="pl-9 pr-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
              近 7 日（固定窗口）
            </span>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-500 text-sm cursor-not-allowed"
            title="导出尚未接后端"
          >
            <Download className="w-4 h-4" />
            导出（占位）
          </button>
        </div>
      </Header>

      <div className="flex-1 p-6 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 mb-4">
            <Loader2 className="w-5 h-5 animate-spin" />
            加载统计数据…
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statisticsCards.map((stat, index) => {
            const colorClasses = {
              amber: 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5',
              cyan: 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5',
              emerald: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5',
              purple: 'border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-500/5',
            };
            const iconColors = {
              amber: 'bg-amber-500/20 text-amber-400',
              cyan: 'bg-cyan-500/20 text-cyan-400',
              emerald: 'bg-emerald-500/20 text-emerald-400',
              purple: 'bg-purple-500/20 text-purple-400',
            };
            return (
              <div
                key={index}
                className={`dashboard-card rounded-2xl p-5 border transition-all hover:scale-[1.02] ${colorClasses[stat.color]}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl ${iconColors[stat.color]} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs text-slate-500">{stat.change}</span>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-slate-400">{stat.title}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="dashboard-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                告警趋势（近 7 日）
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-2 h-48">
                {alertTrendData.map((item, index) => {
                  const heightPercent = (item.count / maxAlertCount) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col items-center">
                        <div className="text-xs text-slate-400 font-medium mb-1">{item.count}</div>
                        <div
                          className="w-full bg-gradient-to-t from-cyan-500/20 to-cyan-500/40 rounded-t-lg transition-all hover:from-cyan-500/30 hover:to-cyan-500/50 min-h-[8px]"
                          style={{ height: `${Math.max(heightPercent, 4)}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500">{item.date}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="dashboard-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                告警类型分布（当前列表）
              </h3>
            </div>
            {typeDistribution.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无告警数据</p>
            ) : (
              <div className="space-y-4">
                {typeDistribution.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white font-medium">{item.type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">{item.count} 条</span>
                        <span className="text-xs text-cyan-400 font-medium">{item.percentage}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-1000"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-card rounded-2xl p-5 mb-6 border border-dashed border-slate-600/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              区域分析
            </h3>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-white text-sm"
            >
              <option value="all">全部（演示筛选 UI）</option>
            </select>
          </div>
          <p className="text-sm text-slate-500">
            后端当前未按地理区域聚合告警；此区块仅为界面占位，避免与「已上线能力」混淆。
          </p>
        </div>

        <div className="dashboard-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              说明
            </h3>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            图表与卡片数据来自 FastAPI <code className="text-cyan-400/90">/dashboard/summary</code> 与{' '}
            <code className="text-cyan-400/90">/alerts</code>。不包含未实现的火焰检测、人脸识别等业务指标。
          </p>
        </div>
      </div>
    </Sidebar>
  );
}
