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
