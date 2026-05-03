'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle, Search, RefreshCw, Clock, MapPin,
  Eye, ChevronDown, Shield, ArrowUpDown, Bell, Zap, Loader2, Brain,
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';
import {
  fetchAlerts,
  fetchAlertTrajectory,
  keyframeToUrl,
  submitAlertFeedback,
  type AlertTrajectory,
  type FeedbackLabel,
} from '@/lib/api';

const alertsFetcher = () => fetchAlerts(200);

function trajectoryFetcher(id: number) {
  return () => fetchAlertTrajectory(id);
}

/** 告警级别映射为界面展示样式 */
function uiLevel(raw: string): 'critical' | 'warning' | 'medium' | 'low' {
  if (raw === 'critical') return 'critical';
  if (raw === 'high') return 'warning';
  if (raw === 'medium') return 'medium';
  if (raw === 'low') return 'low';
  if (raw === 'alert') return 'critical';
  if (raw === 'warning') return 'medium';
  if (raw === 'info') return 'low';
  return 'medium';
}

const borderLeftByUi: Record<string, string> = {
  critical: 'border-l-red-500',
  warning: 'border-l-amber-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-emerald-500',
};

const levelConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: '紧急' },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: '严重' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: '一般' },
  low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: '低风险' },
};

const statusConfig = {
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: '待确认' },
  resolved: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '已确认' },
};

const typeIcon: Record<string, React.ElementType> = {
  trajectory_warning: Zap,
  dwell_warning: Clock,
  roi_intrusion: Shield,
  trajectory_ml_iforest: Brain,
  trajectory_ml_gru: Brain,
  default: AlertTriangle,
};

const FEEDBACK_OPTIONS: { value: FeedbackLabel; label: string }[] = [
  { value: 'true_alert', label: '真实告警' },
  { value: 'false_positive', label: '误报' },
  { value: 'uncertain', label: '暂不确定' },
  { value: 'delivery', label: '外卖/快递' },
  { value: 'visitor', label: '访客' },
  { value: 'work', label: '施工/运维' },
  { value: 'suspicious', label: '需关注' },
  { value: 'other', label: '其他' },
];

export default function AlertsPage() {
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null);

  const { data, error, isLoading, mutate } = useSWR('alerts-list', alertsFetcher, {
    refreshInterval: 8000,
    revalidateOnFocus: true,
  });

  const trajKey = expandedAlert ? `alert-traj-${expandedAlert}` : null;
  const { data: trajData, isLoading: trajLoading, error: trajError } = useSWR<AlertTrajectory>(
    trajKey,
    expandedAlert ? trajectoryFetcher(expandedAlert) : null,
    { revalidateOnFocus: false },
  );
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterConfirmed, setFilterConfirmed] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'level'>('time');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = data ?? [];
    return list.map((a) => {
      const ul = uiLevel(a.level);
      return {
        raw: a,
        id: a.id,
        type: a.alert_type,
        level: ul,
        time: new Date(a.triggered_at).toLocaleString('zh-CN'),
        description: `${a.reason ?? a.alert_type} · 轨迹 #${a.track_id ?? '—'} · job ${a.job_id ?? '—'}${
          a.ai_combined_score != null ? ` · AI异常分 ${a.ai_combined_score.toFixed(2)}` : ''
        }`,
        location:
          a.camera_id != null ? `摄像头 ID ${a.camera_id}` : '未绑定摄像头（离线任务）',
        source: a.keyframe_path ? '关键帧已存证' : '无关键帧',
        status: a.feedback ? 'resolved' : 'pending',
        keyframeUrl: keyframeToUrl(a.keyframe_path),
      };
    });
  }, [data]);

  const filteredAlerts = useMemo(() => {
    let r = rows;
    if (filterLevel !== 'all') {
      r = r.filter((x) => x.level === filterLevel);
    }
    if (filterConfirmed === 'pending') r = r.filter((x) => x.status === 'pending');
    if (filterConfirmed === 'resolved') r = r.filter((x) => x.status === 'resolved');
    return [...r].sort((a, b) => {
      if (sortBy === 'level') {
        const order = { critical: 0, warning: 1, medium: 2, low: 3 };
        return order[a.level as keyof typeof order] - order[b.level as keyof typeof order];
      }
      return new Date(b.raw.triggered_at).getTime() - new Date(a.raw.triggered_at).getTime();
    });
  }, [rows, filterLevel, filterConfirmed, sortBy]);

  const pendingCount = rows.filter((x) => x.status === 'pending').length;

  const getTypeIcon = (type: string) => {
    const key = type.toLowerCase().replace(/\s/g, '_');
    return typeIcon[key] || typeIcon.default;
  };

  async function submitFeedback(alertId: number, label: FeedbackLabel) {
    setSubmittingId(alertId);
    setFeedbackMsg(null);
    try {
      await submitAlertFeedback(alertId, { label, note: feedbackNote.trim() || null });
      setFeedbackMsg('反馈已保存');
      setFeedbackNote('');
      await mutate();
    } catch (e) {
      setFeedbackMsg(e instanceof Error ? e.message : '提交失败');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <Sidebar currentPath="/alerts">
      <Header
        title="告警中心"
        subtitle="轨迹规则 + IsolationForest / GRU 自编码器（模型见 models/）"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-400 text-sm font-medium">{pendingCount} 条待确认</span>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => mutate()}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-5 h-5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Header>

      <div className="flex-1 p-6 overflow-y-auto">
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            加载失败：{String(error)}。请确认已登录，或稍后重试。
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {(['critical', 'warning', 'medium', 'low'] as const).map((level) => {
            const config = levelConfig[level];
            const count = (data ?? []).filter((a) => uiLevel(a.level) === level).length;
            return (
              <div
                key={level}
                onClick={() => setFilterLevel(filterLevel === level ? 'all' : level)}
                className={`dashboard-card rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${
                  filterLevel === level ? 'ring-2 ring-cyan-400/50' : ''
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${config.color.replace('text-', 'bg-')} mb-2`} />
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-sm text-slate-400">{config.label}</p>
              </div>
            );
          })}
        </div>

        <div className="dashboard-card rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">共 {filteredAlerts.length} 条（筛选后）</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-400">级别:</span>
              {['all', 'critical', 'warning', 'medium', 'low'].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFilterLevel(level)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterLevel === level
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  {level === 'all' ? '全部' : levelConfig[level]?.label ?? level}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">状态:</span>
              {['all', 'pending', 'resolved'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterConfirmed(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterConfirmed === s
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  {s === 'all' ? '全部' : statusConfig[s as 'pending' | 'resolved'].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSortBy(sortBy === 'time' ? 'level' : 'time')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600 transition-colors"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="text-sm">{sortBy === 'time' ? '按时间' : '按级别'}</span>
            </button>
          </div>
        </div>

        {isLoading && !data && (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            加载告警…
          </div>
        )}

        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const level = levelConfig[alert.level];
            const status = statusConfig[alert.status as 'pending' | 'resolved'];
            const Icon = getTypeIcon(alert.type);
            const isExpanded = expandedAlert === alert.id;

            return (
              <div key={alert.id} className="dashboard-card rounded-2xl overflow-hidden transition-all">
                <div
                  className={`p-4 border-l-4 ${borderLeftByUi[alert.level] ?? 'border-l-slate-500'} cursor-pointer`}
                  onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl ${level.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${level.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="text-white font-medium">{alert.type}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${level.bg} ${level.color}`}>
                              {level.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400">{alert.description}</p>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {alert.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {alert.source}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-slate-700/30">
                    {(alert.raw.ai_combined_score != null ||
                      alert.raw.ml_scores ||
                      alert.raw.trajectory_features) && (
                      <div className="mt-4 space-y-2 text-xs">
                        <p className="text-slate-500 font-medium">轨迹 AI 分析</p>
                        {alert.raw.ai_combined_score != null && (
                          <p className="text-slate-300">
                            综合异常分（0–1，越高越偏离园区常态）：{' '}
                            <span className="text-amber-400 font-mono">
                              {alert.raw.ai_combined_score.toFixed(3)}
                            </span>
                          </p>
                        )}
                        {alert.raw.trajectory_features && (
                          <pre className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/50 text-slate-400 overflow-x-auto max-h-32">
                            {JSON.stringify(alert.raw.trajectory_features, null, 2)}
                          </pre>
                        )}
                        {alert.raw.ml_scores && (
                          <pre className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/50 text-slate-400 overflow-x-auto max-h-40">
                            {JSON.stringify(alert.raw.ml_scores, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                    {trajLoading && expandedAlert === alert.id && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        加载轨迹详情…
                      </div>
                    )}
                    {trajError && expandedAlert === alert.id && (
                      <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                        轨迹加载失败：{trajError instanceof Error ? trajError.message : String(trajError)}
                      </div>
                    )}
                    {trajData && expandedAlert === alert.id && (
                      <div className="mt-4 space-y-3">
                        <p className="text-xs text-slate-500 font-medium">轨迹叙事（2D 路径 · 坐标与视频分辨率一致）</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{trajData.narrative}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                          {alert.keyframeUrl && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">关键帧</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={alert.keyframeUrl}
                                alt="keyframe"
                                className="w-full max-h-48 rounded-xl border border-slate-700/50 object-contain bg-black/40"
                              />
                            </div>
                          )}
                          <div className="w-full">
                            <p className="text-xs text-slate-500 mb-1">
                              轨迹折线（viewBox {trajData.frame_width}×{trajData.frame_height}）
                            </p>
                            <svg
                              viewBox={`0 0 ${trajData.frame_width} ${trajData.frame_height}`}
                              className="w-full h-48 rounded-xl bg-slate-900/90 border border-cyan-500/20"
                              preserveAspectRatio="xMidYMid meet"
                            >
                              <polyline
                                fill="none"
                                stroke="rgb(34,211,238)"
                                strokeWidth={Math.max(2, trajData.frame_width / 200)}
                                points={trajData.points.map((p) => `${p.cx},${p.cy}`).join(' ')}
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}
                    {alert.keyframeUrl && expandedAlert === alert.id && !trajData && (
                      <div className="mt-4">
                        <p className="text-xs text-slate-500 mb-2">关键帧</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={alert.keyframeUrl}
                          alt="keyframe"
                          className="max-h-64 rounded-xl border border-slate-700/50 object-contain bg-black/40"
                        />
                      </div>
                    )}
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-slate-500">
                        安保反馈（一条告警只有一个最终反馈，可在这里修改）
                      </p>
                      {alert.raw.feedback && (
                        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-sm text-cyan-100">
                          当前反馈：{FEEDBACK_OPTIONS.find((x) => x.value === alert.raw.feedback?.label)?.label ?? alert.raw.feedback.label}
                          {alert.raw.feedback.note ? ` · ${alert.raw.feedback.note}` : ''}
                        </div>
                      )}
                      <textarea
                        value={feedbackNote}
                        onChange={(e) => setFeedbackNote(e.target.value)}
                        placeholder="可选备注"
                        className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm p-3 min-h-[72px] focus:outline-none focus:border-cyan-500/50"
                      />
                      <div className="flex flex-wrap gap-2">
                        {FEEDBACK_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={submittingId === alert.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              submitFeedback(alert.id, opt.value);
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-700/80 text-slate-200 text-sm hover:bg-cyan-500/20 hover:text-cyan-300 border border-slate-600 disabled:opacity-50"
                          >
                            {submittingId === alert.id ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}{' '}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {feedbackMsg && expandedAlert === alert.id && (
                        <p className="text-xs text-cyan-400/90">{feedbackMsg}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!isLoading && filteredAlerts.length === 0 && (
          <div className="dashboard-card rounded-2xl p-12 text-center">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">暂无告警</h3>
            <p className="text-sm text-slate-500">请先提交视频分析任务，或调整筛选条件</p>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
