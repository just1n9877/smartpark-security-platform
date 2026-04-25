'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  BarChart3, Calendar, Download,
  AlertTriangle, Camera, Shield, Activity, Loader2,
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';
import {
  apiFetch,
  fetchDashboardMetrics,
  runJob,
  uploadJob,
  evidenceToUrl,
  type ApiAlert,
  type ApiJob,
  type DashboardMetrics,
  type DashboardSummary,
} from '@/lib/api';

const summaryFetcher = () => apiFetch<DashboardSummary>('/dashboard/summary');
const alertsFetcher = () => apiFetch<ApiAlert[]>('/alerts?limit=500');
const metricsFetcher = () => fetchDashboardMetrics();
const jobsFetcher = () => apiFetch<ApiJob[]>('/jobs?limit=20');

export default function AnalyticsPage() {
  const { data: summary, isLoading: sLoad } = useSWR('analytics-summary', summaryFetcher, {
    refreshInterval: 15000,
  });
  const { data: alerts, isLoading: aLoad } = useSWR('analytics-alerts-types', alertsFetcher);
  const { data: metrics, isLoading: mLoad } = useSWR<DashboardMetrics>('analytics-metrics', metricsFetcher, {
    refreshInterval: 30000,
  });
  const { data: jobs, mutate: mutateJobs } = useSWR<ApiJob[]>('analytics-jobs', jobsFetcher, {
    refreshInterval: 5000,
  });

  const [selectedArea, setSelectedArea] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [jobMessage, setJobMessage] = useState<string | null>(null);

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setJobMessage(null);
    try {
      const job = await uploadJob(file);
      await runJob(job.id);
      setJobMessage(`任务 ${job.id} 已上传并开始分析`);
      await mutateJobs();
    } catch (e) {
      setJobMessage(e instanceof Error ? e.message : '上传或启动失败');
    } finally {
      setUploading(false);
    }
  }

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
  const latestFpr = metrics?.latest_evaluation?.report_json?.fpr_feedback_approx;

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

        <div className="dashboard-card rounded-2xl p-5 mb-6 border border-cyan-500/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                视频分析任务
              </h3>
              <p className="text-sm text-slate-500">从前端上传视频、启动分析、查看任务状态和原视频。</p>
            </div>
            <label className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 cursor-pointer">
              {uploading ? '上传中…' : '上传并分析视频'}
              <input type="file" accept="video/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {jobMessage && <p className="text-sm text-cyan-300 mb-3">{jobMessage}</p>}
          <div className="space-y-2">
            {(jobs ?? []).map((job) => {
              const url = evidenceToUrl(job.video_path);
              return (
                <div key={job.id} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white text-sm">任务 #{job.id} · {job.status}</p>
                    <p className="text-xs text-slate-500">告警 {job.alerts_count ?? 0} · 轨迹 {job.trajectory_summaries_count ?? 0}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => runJob(job.id).then(() => mutateJobs())} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs">重新分析</button>
                    {url && <a href={url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs">查看视频</a>}
                  </div>
                </div>
              );
            })}
            {!jobs?.length && <p className="text-sm text-slate-500">暂无任务。</p>}
          </div>
        </div>

        <div className="dashboard-card rounded-2xl p-5 mb-6 border border-cyan-500/20">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            Holdout 评测与分桶（GET /dashboard/metrics）
          </h3>
          {mLoad && !metrics ? (
            <p className="text-slate-500 text-sm">加载指标…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400 mb-1">最新评测 FPR（反馈误报近似）</p>
                <p className="text-2xl font-mono text-amber-300">
                  {latestFpr != null ? `${(Number(latestFpr) * 100).toFixed(2)}%` : '—（admin 执行 POST /admin/evaluation/run）'}
                </p>
                {metrics?.latest_evaluation?.created_at && (
                  <p className="text-xs text-slate-500 mt-1">
                    时间 {new Date(metrics.latest_evaluation.created_at).toLocaleString('zh-CN')}
                  </p>
                )}
              </div>
              <div>
                <p className="text-slate-400 mb-2">历史 FPR 曲线（评测次数）</p>
                <div className="flex items-end gap-1 h-24">
                  {(metrics?.evaluation_history ?? []).map((h, i) => {
                    const v = h.fpr_feedback_approx != null ? Number(h.fpr_feedback_approx) : 0;
                    const pct = Math.min(100, v * 100 * 2);
                    return (
                      <div key={h.id} className="flex-1 flex flex-col items-center gap-1" title={`id ${h.id}`}>
                        <div
                          className="w-full bg-cyan-500/40 rounded-t min-h-[4px]"
                          style={{ height: `${Math.max(pct, 4)}%` }}
                        />
                        <span className="text-[10px] text-slate-600">{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-2">
                <p className="text-slate-400 mb-2">全量告警按摄像头 / 离线任务桶</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(metrics?.alerts_all_time_by_camera_bucket ?? {}).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-2 py-1 rounded-lg bg-slate-800/80 text-slate-300 text-xs border border-slate-700/50"
                    >
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

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
