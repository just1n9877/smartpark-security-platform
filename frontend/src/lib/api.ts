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

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function detailToMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join('；');
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return '';
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  const text = await res.text();
  if (!text) return new ApiError(res.status, `HTTP ${res.status}`);
  try {
    const json = JSON.parse(text) as { detail?: unknown; message?: unknown };
    const detail = json.detail ?? json.message ?? json;
    const message = detailToMessage(detail) || `HTTP ${res.status}`;
    return new ApiError(res.status, message, detail);
  } catch {
    return new ApiError(res.status, text || `HTTP ${res.status}`);
  }
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

  if (res.status === 401 || res.status === 403) {
    clearAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(res.status, '登录状态已失效，请重新登录');
  }

  if (!res.ok) {
    throw await parseErrorResponse(res);
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

export type CameraWebRtc = {
  camera_id: number;
  path: string;
  page_url: string;
  whep_url: string;
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
  full_name?: string | null;
  phone?: string | null;
  department?: string | null;
  title?: string | null;
  is_active?: boolean;
  created_at?: string | null;
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

export type PersonPayload = {
  name?: string;
  person_type?: string;
  employee_no?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export type Device = {
  id: number;
  name: string;
  device_type: string;
  location: string | null;
  status: 'online' | 'warning' | 'offline' | string;
  ip_address: string | null;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  uptime: string | null;
  last_check_at: string;
  notes: string | null;
};

export type DevicePayload = {
  name: string;
  device_type: string;
  location?: string | null;
  status?: string;
  ip_address?: string | null;
  cpu_percent?: number;
  memory_percent?: number;
  disk_percent?: number;
  uptime?: string | null;
  notes?: string | null;
};

export type UserProfilePayload = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  title?: string | null;
};

export type AdminUserPayload = UserProfilePayload & {
  username?: string;
  password?: string;
  role?: 'admin' | 'guard';
  is_active?: boolean;
};

export type NotificationPreference = {
  email_enabled: boolean;
  sms_enabled: boolean;
  app_enabled: boolean;
  wechat_enabled: boolean;
  updated_at: string;
};

export type SecurityAuditLog = {
  id: number;
  user_id: number | null;
  action: string;
  ip_address: string | null;
  status: string;
  detail: string | null;
  created_at: string;
};

export async function fetchMe(): Promise<UserPublic> {
  return apiFetch<UserPublic>('/auth/me');
}

export async function updateMe(body: UserProfilePayload): Promise<UserPublic> {
  return apiFetch<UserPublic>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function changePassword(body: { current_password: string; new_password: string }): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchUsers(): Promise<UserPublic[]> {
  return apiFetch<UserPublic[]>('/users');
}

export async function createUser(body: Required<Pick<AdminUserPayload, 'username' | 'password'>> & AdminUserPayload): Promise<UserPublic> {
  return apiFetch<UserPublic>('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateUser(userId: number, body: AdminUserPayload): Promise<UserPublic> {
  return apiFetch<UserPublic>(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function disableUser(userId: number): Promise<void> {
  return apiFetch<void>(`/users/${userId}`, { method: 'DELETE' });
}

export async function fetchNotificationPreference(): Promise<NotificationPreference> {
  return apiFetch<NotificationPreference>('/users/me/notifications');
}

export async function patchNotificationPreference(body: Partial<Omit<NotificationPreference, 'updated_at'>>): Promise<NotificationPreference> {
  return apiFetch<NotificationPreference>('/users/me/notifications', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function fetchSecurityLogs(limit = 50): Promise<SecurityAuditLog[]> {
  return apiFetch<SecurityAuditLog[]>(`/users/security-logs?limit=${limit}`);
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>('/dashboard/summary');
}

export async function fetchAlerts(limit = 200): Promise<ApiAlert[]> {
  return apiFetch<ApiAlert[]>(`/alerts?limit=${limit}`);
}

export async function submitAlertFeedback(alertId: number, body: { label: FeedbackLabel; note?: string | null }): Promise<ApiFeedback> {
  return apiFetch<ApiFeedback>(`/alerts/${alertId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
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

export async function updateCamera(cameraId: number, body: Partial<Omit<ApiCamera, 'id' | 'created_at'>>): Promise<ApiCamera> {
  return apiFetch<ApiCamera>(`/cameras/${cameraId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteCamera(cameraId: number): Promise<void> {
  return apiFetch<void>(`/cameras/${cameraId}`, { method: 'DELETE' });
}

export async function startCameraStream(cameraId: number): Promise<{ camera_id: number; started: boolean }> {
  return apiFetch<{ camera_id: number; started: boolean }>(`/cameras/${cameraId}/start`, { method: 'POST' });
}

export async function stopCameraStream(cameraId: number): Promise<{ camera_id: number; stopped: boolean }> {
  return apiFetch<{ camera_id: number; stopped: boolean }>(`/cameras/${cameraId}/stop`, { method: 'POST' });
}

export async function prepareCameraWebRtc(cameraId: number): Promise<CameraWebRtc> {
  return apiFetch<CameraWebRtc>(`/cameras/${cameraId}/webrtc`, { method: 'POST' });
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

export async function updateSceneRule(ruleId: number, body: Partial<SceneRulePayload>): Promise<SceneRule> {
  return apiFetch<SceneRule>(`/scene-rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteSceneRule(ruleId: number): Promise<void> {
  return apiFetch<void>(`/scene-rules/${ruleId}`, { method: 'DELETE' });
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

export async function updatePerson(personId: number, body: PersonPayload): Promise<Person> {
  return apiFetch<Person>(`/face/persons/${personId}`, {
    method: 'PUT',
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

export async function deletePersonAuthorization(authorizationId: number): Promise<void> {
  return apiFetch<void>(`/face/authorizations/${authorizationId}`, { method: 'DELETE' });
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

export async function fetchJobs(limit = 20): Promise<ApiJob[]> {
  return apiFetch<ApiJob[]>(`/jobs?limit=${limit}`);
}

export async function fetchJob(jobId: number): Promise<ApiJob> {
  return apiFetch<ApiJob>(`/jobs/${jobId}`);
}

export async function runJob(jobId: number): Promise<{ job_id: number; status: string; video_path?: string }> {
  return apiFetch<{ job_id: number; status: string; video_path?: string }>(`/jobs/${jobId}/run`, { method: 'POST' });
}

export async function fetchDevices(): Promise<Device[]> {
  return apiFetch<Device[]>('/devices');
}

export async function createDevice(body: DevicePayload): Promise<Device> {
  return apiFetch<Device>('/devices', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateDevice(deviceId: number, body: Partial<DevicePayload>): Promise<Device> {
  return apiFetch<Device>(`/devices/${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteDevice(deviceId: number): Promise<void> {
  return apiFetch<void>(`/devices/${deviceId}`, { method: 'DELETE' });
}
