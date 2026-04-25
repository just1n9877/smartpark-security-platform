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

export function evidenceToUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const normalized = path.replace(/\\/g, '/');
  const storageIndex = normalized.indexOf('/storage/');
  const rel = storageIndex >= 0 ? normalized.slice(storageIndex + '/storage/'.length) : normalized.replace(/^storage\//, '');
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

export async function registerApi(username: string, email: string, password: string): Promise<void> {
  await apiFetch<UserPublic>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
}

export type ApiAlert = {
  id: number;
  job_id: number | null;
  level: string;
  alert_type: string;
  rule_id: number | null;
  compound_event_id: number | null;
  triggered_at: string;
  track_id: number | null;
  camera_id: number | null;
  keyframe_path: string | null;
  evidence_clip_path: string | null;
  reason: string | null;
  reason_json: Record<string, unknown> | null;
  is_confirmed: boolean;
  feedback?: ApiFeedback | null;
  correlations?: {
    id: number;
    related_alert_id: number | null;
    camera_id: number | null;
    relation_type: string;
    details?: Record<string, unknown> | null;
  }[];
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
  location: string | null;
  risk_level: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type FeedbackLabel =
  | 'true_alert'
  | 'false_positive'
  | 'uncertain'
  | 'delivery'
  | 'visitor'
  | 'work'
  | 'suspicious'
  | 'other';

export type UserPublic = {
  id: number;
  username: string;
  email: string | null;
  role: 'admin' | 'guard';
};

export type ApiFeedback = {
  id: number;
  alert_id: number;
  user_id: number;
  label: FeedbackLabel;
  note: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ApiJob = {
  id: number;
  video_path: string;
  camera_id: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  trajectory_points_count?: number;
  trajectory_summaries_count?: number;
  alerts_count?: number;
};

export type SceneRule = {
  id: number;
  camera_id: number | null;
  name: string;
  rule_type: 'area' | 'line_crossing' | 'door' | 'direction' | 'object_proximity' | string;
  geometry: Record<string, unknown>;
  risk_level: number;
  is_enabled: boolean;
  schedule_json: Record<string, unknown> | null;
  allowed_direction: string | null;
  dwell_threshold_sec: number;
  config_json: Record<string, unknown> | null;
  created_at: string;
};

export type SceneRulePayload = Omit<SceneRule, 'id' | 'created_at'>;

export type Person = {
  id: number;
  name: string;
  person_type: 'employee' | 'visitor' | 'contractor' | 'blacklist' | 'unknown' | string;
  employee_no: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  face_profiles: {
    id: number;
    person_id: number;
    image_path: string;
    quality_score: number;
    is_active: boolean;
    created_at: string;
  }[];
  authorizations: {
    id: number;
    person_id: number;
    rule_id: number | null;
    camera_id: number | null;
    schedule_json: Record<string, unknown> | null;
    is_enabled: boolean;
    created_at: string;
  }[];
};

export type RecognitionLog = {
  id: number;
  job_id: number | null;
  camera_id: number | null;
  track_id: number | null;
  person_id: number | null;
  confidence: number;
  status: string;
  snapshot_path: string | null;
  created_at: string;
};

export type TrackIdentity = {
  id: number;
  job_id: number | null;
  camera_id: number | null;
  track_id: number;
  person_id: number | null;
  identity_status: string;
  authorization_status: string;
  confidence: number;
  first_seen_at: string;
  last_seen_at: string;
  evidence_path: string | null;
  details_json: Record<string, unknown> | null;
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

export async function fetchCameras(): Promise<ApiCamera[]> {
  return apiFetch<ApiCamera[]>('/cameras');
}

export async function createCamera(body: {
  name: string;
  rtsp_url?: string | null;
  location?: string | null;
  risk_level?: number;
  is_active?: boolean;
  notes?: string | null;
}): Promise<ApiCamera> {
  return apiFetch<ApiCamera>('/cameras', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchSceneRules(cameraId?: number): Promise<SceneRule[]> {
  const qs = cameraId ? `?camera_id=${cameraId}` : '';
  return apiFetch<SceneRule[]>(`/scene-rules${qs}`);
}

export async function createSceneRule(body: SceneRulePayload): Promise<SceneRule> {
  return apiFetch<SceneRule>('/scene-rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchPersons(): Promise<Person[]> {
  return apiFetch<Person[]>('/face/persons');
}

export async function createPerson(body: {
  name: string;
  person_type: string;
  employee_no?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_active?: boolean;
}): Promise<Person> {
  return apiFetch<Person>('/face/persons', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function uploadFaceProfile(personId: number, file: File): Promise<Person['face_profiles'][number]> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<Person['face_profiles'][number]>(`/face/persons/${personId}/faces`, {
    method: 'POST',
    body: form,
  });
}

export async function createPersonAuthorization(body: {
  person_id: number;
  rule_id?: number | null;
  camera_id?: number | null;
  schedule_json?: Record<string, unknown> | null;
  is_enabled?: boolean;
}): Promise<Person['authorizations'][number]> {
  return apiFetch<Person['authorizations'][number]>('/face/authorizations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchRecognitionLogs(): Promise<RecognitionLog[]> {
  return apiFetch<RecognitionLog[]>('/face/recognition-logs');
}

export async function fetchTrackIdentities(): Promise<TrackIdentity[]> {
  return apiFetch<TrackIdentity[]>('/face/track-identities');
}

export async function sendAssistantMessage(message: string): Promise<{ answer: string; suggestions: string[]; source: string }> {
  return apiFetch<{ answer: string; suggestions: string[]; source: string }>('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function uploadJob(file: File, cameraId?: number | null): Promise<{ id: number; video_path: string; status: string }> {
  const form = new FormData();
  form.append('file', file);
  if (cameraId != null) form.append('camera_id', String(cameraId));
  return apiFetch<{ id: number; video_path: string; status: string }>('/jobs', { method: 'POST', body: form });
}

export async function runJob(jobId: number): Promise<{ job_id: number; status: string; video_path?: string }> {
  return apiFetch<{ job_id: number; status: string; video_path?: string }>(`/jobs/${jobId}/run`, { method: 'POST' });
}
