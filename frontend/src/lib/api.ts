/**
 * FastAPI 后端（智慧园区安防平台）
 * NEXT_PUBLIC_API_BASE_URL，默认 http://127.0.0.1:8000
 */

export const TOKEN_STORAGE_KEY = 'smartguard_access_token';

export function getApiBase(): string {
  return (
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
    'http://127.0.0.1:8000'
  ).replace(/\/$/, '');
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/** storage/frames/... → 可访问 URL */
export function keyframeToUrl(keyframePath: string | null | undefined): string | null {
  if (!keyframePath) return null;
  const rel = keyframePath.replace(/^storage\//, '').replace(/\\/g, '/');
  return `${getApiBase()}/media/${rel}`;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = typeof window !== 'undefined' ? getStoredToken() : null;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${base}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export async function loginApi(username: string, password: string): Promise<void> {
  const data = await apiFetch<{ access_token: string; token_type: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setStoredToken(data.access_token);
}

export type ApiAlert = {
  id: number;
  job_id: number | null;
  level: string;
  alert_type: string;
  triggered_at: string;
  track_id: number | null;
  camera_id: number | null;
  keyframe_path: string | null;
  is_confirmed: boolean;
  /** 轨迹统计特征（与流水线 trajectory_analytics 一致） */
  trajectory_features?: Record<string, number> | null;
  /** IsolationForest + GRU-AE 推理结果 */
  ml_scores?: Record<string, unknown> | null;
  /** 0–1，综合异常分（取子模型 anomaly_01 最大者） */
  ai_combined_score?: number | null;
};

export type DashboardSummary = {
  alerts_today: number;
  alerts_by_day_7d: { date: string; count: number }[];
  feedback_false_positive_rate: number | null;
  feedback_total: number;
  jobs_by_status: Record<string, number>;
  cameras_count: number;
  recent_jobs_count: number;
};

export type DashboardMetrics = {
  latest_evaluation: {
    id: number;
    report_json: Record<string, unknown>;
    note: string | null;
    created_at: string;
  } | null;
  evaluation_history: {
    id: number;
    created_at: string;
    fpr_feedback_approx: number | null | undefined;
    alerts_total: number | null | undefined;
    by_camera_bucket: Record<string, number> | null | undefined;
  }[];
  alerts_all_time_by_camera_bucket: Record<string, number>;
};

export type AlertTrajectory = {
  alert_id: number;
  job_id: number | null;
  track_id: number | null;
  frame_width: number;
  frame_height: number;
  points: { frame_idx: number; cx: number; cy: number }[];
  narrative: string;
  alert_type: string | null;
};

export type ApiCamera = {
  id: number;
  name: string;
  rtsp_url: string | null;
  notes: string | null;
  created_at: string;
};

export type FeedbackLabel =
  | 'false_positive'
  | 'delivery'
  | 'visitor'
  | 'work'
  | 'suspicious'
  | 'other';

export type UserPublic = {
  id: number;
  username: string;
  role: 'admin' | 'guard';
};

export type PipelineSettingsBlock = {
  consecutive_frames_for_escalation: number;
  dwell_warning_sec: number;
  dwell_alert_sec: number;
  cooldown_sec: number;
  reversal_alert_k: number;
};

export type FeedbackRollupStats = {
  sample_size: number;
  false_positives: number;
  false_positive_rate: number | null;
};

export type CameraFeedbackRollup = {
  camera_id: number | null;
  camera_name: string;
  sample_size: number;
  false_positives: number;
  false_positive_rate: number | null;
};

export type UnifiedMlPolicyOut = {
  ml_enabled: boolean;
  ml_iforest_min_anomaly_01: number;
  ml_gru_min_anomaly_01: number;
  ml_emit_separate_alerts: boolean;
  active_model_version: string | null;
  retrain_on_feedback: boolean;
  retrain_feedback_delay_sec: number;
  retrain_interval_hours: number;
  holdout_job_fraction: number;
  rtsp_max_workers: number;
  stream_alert_merge_sec: number;
};

export type SettingsOut = {
  effective: PipelineSettingsBlock;
  yaml_baseline: PipelineSettingsBlock;
  tuning: {
    feedback_window_n: number;
    high_fp_threshold: number;
    max_consecutive_frames: number;
    updated_at: string;
  };
  feedback_rollup: {
    window_n: number;
    global: FeedbackRollupStats;
    by_camera: CameraFeedbackRollup[];
  };
  unified_ml?: UnifiedMlPolicyOut;
};

export type SettingsPatch = {
  reset_to_yaml_defaults?: boolean;
  consecutive_frames_for_escalation?: number;
  dwell_warning_sec?: number;
  dwell_alert_sec?: number;
  cooldown_sec?: number;
  reversal_alert_k?: number;
  feedback_window_n?: number;
  high_fp_threshold?: number;
  max_consecutive_frames?: number;
  ml_enabled?: boolean;
  ml_iforest_min_anomaly_01?: number;
  ml_gru_min_anomaly_01?: number;
  ml_emit_separate_alerts?: boolean;
  retrain_on_feedback?: boolean;
  retrain_feedback_delay_sec?: number;
  retrain_interval_hours?: number;
  holdout_job_fraction?: number;
  rtsp_max_workers?: number;
  stream_alert_merge_sec?: number;
};

export async function fetchMe(): Promise<UserPublic> {
  return apiFetch<UserPublic>('/auth/me');
}

export async function fetchSettings(): Promise<SettingsOut> {
  return apiFetch<SettingsOut>('/settings');
}

export async function patchSettings(body: SettingsPatch): Promise<SettingsOut> {
  return apiFetch<SettingsOut>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  return apiFetch<DashboardMetrics>('/dashboard/metrics');
}

export async function fetchAlertTrajectory(alertId: number): Promise<AlertTrajectory> {
  return apiFetch<AlertTrajectory>(`/alerts/${alertId}/trajectory`);
}
