'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Bell,
  Edit,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Lock,
  Plus,
  Save,
  Shield,
  SlidersHorizontal,
  Trash2,
  ToggleLeft,
  ToggleRight,
  User,
  Users,
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';
import {
  changePassword,
  createUser,
  disableUser,
  fetchMe,
  fetchNotificationPreference,
  fetchSecurityLogs,
  fetchSettings,
  fetchUsers,
  patchNotificationPreference,
  patchSettings,
  updateMe,
  updateUser,
  type AdminUserPayload,
  type NotificationPreference,
  type SecurityAuditLog,
  type SettingsOut,
  type SettingsPatch,
  type UserProfilePayload,
  type UserPublic,
} from '@/lib/api';

const tabs = [
  { id: 'pipeline', label: '预警策略', icon: SlidersHorizontal },
  { id: 'profile', label: '个人信息', icon: User },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'roles', label: '角色权限', icon: Shield },
  { id: 'notifications', label: '通知设置', icon: Bell },
  { id: 'security', label: '安全设置', icon: Lock },
] as const;

type TabId = (typeof tabs)[number]['id'];

function settingsDraft(s: SettingsOut): SettingsPatch {
  const ml = s.unified_ml;
  return {
    consecutive_frames_for_escalation: s.effective.consecutive_frames_for_escalation,
    dwell_warning_sec: s.effective.dwell_warning_sec,
    dwell_alert_sec: s.effective.dwell_alert_sec,
    cooldown_sec: s.effective.cooldown_sec,
    reversal_alert_k: s.effective.reversal_alert_k,
    feedback_window_n: s.tuning.feedback_window_n,
    high_fp_threshold: s.tuning.high_fp_threshold,
    max_consecutive_frames: s.tuning.max_consecutive_frames,
    ml_enabled: ml?.ml_enabled ?? true,
    ml_iforest_min_anomaly_01: ml?.ml_iforest_min_anomaly_01 ?? 0.55,
    ml_gru_min_anomaly_01: ml?.ml_gru_min_anomaly_01 ?? 0.5,
    ml_emit_separate_alerts: ml?.ml_emit_separate_alerts ?? true,
    retrain_on_feedback: ml?.retrain_on_feedback ?? false,
    retrain_feedback_delay_sec: ml?.retrain_feedback_delay_sec ?? 10,
    retrain_interval_hours: ml?.retrain_interval_hours ?? 0,
    holdout_job_fraction: ml?.holdout_job_fraction ?? 0.2,
    rtsp_max_workers: ml?.rtsp_max_workers ?? 4,
    stream_alert_merge_sec: ml?.stream_alert_merge_sec ?? 45,
  };
}

function userDraft(u?: UserPublic | null): UserProfilePayload {
  return {
    full_name: u?.full_name ?? '',
    email: u?.email ?? '',
    phone: u?.phone ?? '',
    department: u?.department ?? '',
    title: u?.title ?? '',
  };
}

const roleLabels: Record<string, string> = {
  admin: '管理员',
  guard: '值班人员',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pipeline');
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pipelineDraft, setPipelineDraft] = useState<SettingsPatch>({});
  const [profileDraft, setProfileDraft] = useState<UserProfilePayload>({});
  const [passwordDraft, setPasswordDraft] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserPublic | null>(null);
  const [userForm, setUserForm] = useState<AdminUserPayload>({ role: 'guard', is_active: true });

  const { data: me, error: meError, mutate: mutateMe } = useSWR<UserPublic>('settings-me', fetchMe, {
    onSuccess: (u) => setProfileDraft(userDraft(u)),
  });
  const { data: st, error: settingsError, mutate: mutateSettings } = useSWR<SettingsOut>('settings-system', fetchSettings, {
    onSuccess: (s) => setPipelineDraft(settingsDraft(s)),
  });
  const { data: users, error: usersError, mutate: mutateUsers } = useSWR<UserPublic[]>(
    me?.role === 'admin' ? 'settings-users' : null,
    fetchUsers,
  );
  const { data: notification, error: notificationError, mutate: mutateNotification } = useSWR<NotificationPreference>(
    'settings-notification',
    fetchNotificationPreference,
  );
  const { data: logs, error: logsError, mutate: mutateLogs } = useSWR<SecurityAuditLog[]>(
    me?.role === 'admin' ? 'settings-security-logs' : null,
    () => fetchSecurityLogs(80),
  );

  const loadError = meError || settingsError || usersError || notificationError || logsError;
  const isAdmin = me?.role === 'admin';

  const roleStats = useMemo(() => {
    const rows = users ?? [];
    return {
      admin: rows.filter((u) => u.role === 'admin').length,
      guard: rows.filter((u) => u.role === 'guard').length,
      active: rows.filter((u) => u.is_active !== false).length,
      disabled: rows.filter((u) => u.is_active === false).length,
    };
  }, [users]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function savePipeline() {
    if (!isAdmin) return;
    await run(async () => {
      const next = await patchSettings(pipelineDraft);
      setPipelineDraft(settingsDraft(next));
      await mutateSettings(next, false);
    }, '预警策略已保存');
  }

  async function resetPipeline() {
    if (!isAdmin) return;
    await run(async () => {
      const next = await patchSettings({ reset_to_yaml_defaults: true });
      setPipelineDraft(settingsDraft(next));
      await mutateSettings(next, false);
    }, '已恢复 YAML 默认配置');
  }

  async function saveProfile() {
    await run(async () => {
      const next = await updateMe(profileDraft);
      setProfileDraft(userDraft(next));
      await mutateMe(next, false);
    }, '个人信息已保存');
  }

  function openUserModal(user?: UserPublic) {
    setEditingUser(user ?? null);
    setUserForm(user ? {
      full_name: user.full_name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      department: user.department ?? '',
      title: user.title ?? '',
      role: user.role,
      is_active: user.is_active !== false,
    } : { username: '', password: '', role: 'guard', is_active: true });
    setShowUserModal(true);
  }

  async function saveUser() {
    if (!isAdmin) return;
    await run(async () => {
      if (editingUser) {
        await updateUser(editingUser.id, userForm);
      } else {
        if (!userForm.username || !userForm.password) throw new Error('请填写用户名和初始密码');
        await createUser(userForm as Required<Pick<AdminUserPayload, 'username' | 'password'>> & AdminUserPayload);
      }
      setShowUserModal(false);
      await mutateUsers();
      await mutateLogs();
    }, editingUser ? '用户已更新' : '用户已创建');
  }

  async function toggleUser(user: UserPublic) {
    if (!isAdmin) return;
    await run(async () => {
      if (user.is_active === false) {
        await updateUser(user.id, { is_active: true });
      } else {
        await disableUser(user.id);
      }
      await mutateUsers();
      await mutateLogs();
    }, user.is_active === false ? '用户已启用' : '用户已停用');
  }

  async function saveNotification(partial: Partial<Omit<NotificationPreference, 'updated_at'>>) {
    await run(async () => {
      const next = await patchNotificationPreference(partial);
      await mutateNotification(next, false);
      await mutateLogs();
    }, '通知设置已保存');
  }

  async function savePassword() {
    if (passwordDraft.new_password !== passwordDraft.confirm) {
      setMessage('两次输入的新密码不一致');
      return;
    }
    await run(async () => {
      await changePassword({
        current_password: passwordDraft.current_password,
        new_password: passwordDraft.new_password,
      });
      setPasswordDraft({ current_password: '', new_password: '', confirm: '' });
      await mutateLogs();
    }, '密码已修改');
  }

  const numberFields: [keyof SettingsPatch, string, number, number, number][] = [
    ['consecutive_frames_for_escalation', '确认帧数 M', 2, 30, 1],
    ['dwell_warning_sec', '预警停留秒', 0.1, 3600, 0.5],
    ['dwell_alert_sec', '告警停留秒', 0.1, 3600, 0.5],
    ['cooldown_sec', '冷却秒', 1, 86400, 1],
    ['reversal_alert_k', '折返阈值 K', 1, 100, 1],
    ['feedback_window_n', '反馈窗口 N', 5, 500, 1],
    ['high_fp_threshold', '高误报阈值', 0.05, 0.95, 0.01],
    ['max_consecutive_frames', 'M 上限', 3, 30, 1],
    ['ml_iforest_min_anomaly_01', 'IForest 阈值', 0.05, 0.99, 0.01],
    ['ml_gru_min_anomaly_01', 'GRU-AE 阈值', 0.05, 0.99, 0.01],
    ['retrain_feedback_delay_sec', '反馈后训练延迟秒', 0, 86400, 1],
    ['rtsp_max_workers', 'RTSP 并发数', 1, 32, 1],
    ['stream_alert_merge_sec', '流式告警合并秒', 5, 600, 1],
  ];

  return (
    <Sidebar currentPath="/settings">
      <Header title="系统设置" subtitle="用户、权限、通知、安全审计与预警策略" />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-slate-700/30 bg-slate-900/30 p-4">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {message && (
            <div className="mb-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              {message}
            </div>
          )}
          {loadError && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              加载失败：{loadError instanceof Error ? loadError.message : String(loadError)}
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="max-w-5xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">预警与去抖策略</h3>
                <p className="text-sm text-slate-400">管理员可调整告警阈值、模型策略和视频流处理参数。</p>
              </div>
              {!st ? (
                <p className="text-slate-400 flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />加载配置…</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="dashboard-card rounded-2xl p-5">
                      <p className="text-sm text-slate-500">当前 M</p>
                      <p className="text-3xl font-bold text-cyan-300">{st.effective.consecutive_frames_for_escalation}</p>
                    </div>
                    <div className="dashboard-card rounded-2xl p-5">
                      <p className="text-sm text-slate-500">误报窗口</p>
                      <p className="text-3xl font-bold text-emerald-300">{st.tuning.feedback_window_n}</p>
                    </div>
                    <div className="dashboard-card rounded-2xl p-5">
                      <p className="text-sm text-slate-500">全局反馈样本</p>
                      <p className="text-3xl font-bold text-amber-300">{st.feedback_rollup.global.sample_size}</p>
                    </div>
                  </div>

                  <div className="dashboard-card rounded-2xl p-5 space-y-4">
                    <h4 className="text-white font-medium">可写参数</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      {numberFields.map(([key, label, min, max, step]) => (
                        <label key={key} className="space-y-1">
                          <span className="text-slate-400">{label}</span>
                          <input
                            type="number"
                            min={min}
                            max={max}
                            step={step}
                            value={Number(pipelineDraft[key] ?? 0)}
                            onChange={(e) => setPipelineDraft({ ...pipelineDraft, [key]: Number(e.target.value) })}
                            disabled={!isAdmin}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white disabled:opacity-50"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                      {[
                        ['ml_enabled', '启用 ML'],
                        ['ml_emit_separate_alerts', '输出单独模型告警'],
                        ['retrain_on_feedback', '反馈触发训练'],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(pipelineDraft[key as keyof SettingsPatch])}
                            disabled={!isAdmin}
                            onChange={(e) => setPipelineDraft({ ...pipelineDraft, [key]: e.target.checked })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={savePipeline} disabled={!isAdmin || busy} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm disabled:opacity-50">
                        保存配置
                      </button>
                      <button type="button" onClick={resetPipeline} disabled={!isAdmin || busy} className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm disabled:opacity-50">
                        恢复 YAML 默认
                      </button>
                      {!isAdmin && <span className="text-xs text-slate-500 self-center">仅管理员可修改配置。</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-6">
              <h3 className="text-lg font-bold text-white">个人信息</h3>
              <div className="dashboard-card rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ['full_name', '姓名'],
                  ['email', '邮箱'],
                  ['phone', '电话'],
                  ['department', '部门'],
                  ['title', '职位'],
                ].map(([key, label]) => (
                  <label key={key} className="space-y-2">
                    <span className="text-sm text-slate-400">{label}</span>
                    <input
                      value={String(profileDraft[key as keyof UserProfilePayload] ?? '')}
                      onChange={(e) => setProfileDraft({ ...profileDraft, [key]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm"
                    />
                  </label>
                ))}
                <div className="md:col-span-2 text-sm text-slate-500">
                  用户名：{me?.username ?? '—'} · 角色：{me ? roleLabels[me.role] : '—'}
                </div>
              </div>
              <button type="button" onClick={saveProfile} disabled={busy} className="px-6 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" />
                保存个人资料
              </button>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">用户管理</h3>
                <button type="button" onClick={() => openUserModal()} disabled={!isAdmin} className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  <Plus className="w-4 h-4" />
                  添加用户
                </button>
              </div>
              {!isAdmin ? (
                <div className="dashboard-card rounded-2xl p-8 text-slate-400">仅管理员可管理用户。</div>
              ) : (
                <div className="dashboard-card rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-slate-400">用户</th>
                        <th className="px-4 py-3 text-left text-xs text-slate-400">角色</th>
                        <th className="px-4 py-3 text-left text-xs text-slate-400">状态</th>
                        <th className="px-4 py-3 text-right text-xs text-slate-400">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                      {(users ?? []).map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <p className="text-white font-medium">{u.full_name || u.username}</p>
                            <p className="text-xs text-slate-500">{u.email || '无邮箱'} · {u.department || '无部门'}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{roleLabels[u.role]}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-lg text-xs ${u.is_active === false ? 'bg-slate-500/10 text-slate-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                              {u.is_active === false ? '停用' : '启用'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={() => openUserModal(u)} className="p-1.5 rounded-lg hover:bg-slate-700/50">
                              <Edit className="w-4 h-4 text-cyan-300" />
                            </button>
                            <button type="button" onClick={() => toggleUser(u)} className="p-1.5 rounded-lg hover:bg-slate-700/50">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white">角色权限</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: '管理员', desc: '可管理用户、系统策略、安全日志和所有业务配置', count: roleStats.admin },
                  { name: '值班人员', desc: '可查看与处理告警、维护摄像头和业务资料，不能修改管理员配置', count: roleStats.guard },
                  { name: '启用账号', desc: '当前可登录账号数量', count: roleStats.active },
                  { name: '停用账号', desc: '已被管理员禁用的账号数量', count: roleStats.disabled },
                ].map((role) => (
                  <div key={role.name} className="dashboard-card rounded-2xl p-5">
                    <Shield className="w-6 h-6 text-cyan-400 mb-3" />
                    <h4 className="text-white font-medium">{role.name}</h4>
                    <p className="text-sm text-slate-500 mt-1">{role.desc}</p>
                    <p className="text-2xl font-bold text-cyan-300 mt-4">{role.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl space-y-6">
              <h3 className="text-lg font-bold text-white">通知设置</h3>
              {notification ? (
                <div className="space-y-4">
                  {[
                    ['email_enabled', '邮件通知', '接收告警邮件推送'],
                    ['sms_enabled', '短信通知', '接收紧急告警短信'],
                    ['app_enabled', '应用推送', '接收系统应用通知'],
                    ['wechat_enabled', '微信推送', '绑定微信接收通知'],
                  ].map(([key, label, desc]) => {
                    const enabled = Boolean(notification[key as keyof NotificationPreference]);
                    return (
                      <div key={key} className="dashboard-card rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">{label}</h4>
                          <p className="text-sm text-slate-500">{desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => saveNotification({ [key]: !enabled })}
                          className={`p-2 rounded-xl transition-colors ${enabled ? 'bg-cyan-500/20' : 'bg-slate-700/50'}`}
                        >
                          {enabled ? <ToggleRight className="w-8 h-8 text-cyan-400" /> : <ToggleLeft className="w-8 h-8 text-slate-500" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-400 flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />加载通知设置…</p>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-4xl space-y-6">
              <h3 className="text-lg font-bold text-white">安全设置</h3>
              <div className="dashboard-card rounded-2xl p-5 space-y-4">
                <h4 className="text-white font-medium flex items-center gap-2"><Key className="w-5 h-5 text-cyan-400" />修改密码</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordDraft.current_password}
                      onChange={(e) => setPasswordDraft({ ...passwordDraft, current_password: e.target.value })}
                      placeholder="当前密码"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      {showPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                  <input type="password" value={passwordDraft.new_password} onChange={(e) => setPasswordDraft({ ...passwordDraft, new_password: e.target.value })} placeholder="新密码" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
                  <input type="password" value={passwordDraft.confirm} onChange={(e) => setPasswordDraft({ ...passwordDraft, confirm: e.target.value })} placeholder="确认新密码" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
                </div>
                <button type="button" onClick={savePassword} disabled={busy || !passwordDraft.current_password || !passwordDraft.new_password} className="px-5 py-2.5 rounded-xl bg-cyan-500 text-white text-sm disabled:opacity-50">
                  修改密码
                </button>
              </div>

              <div className="dashboard-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium">安全审计日志</h4>
                  <button type="button" onClick={() => mutateLogs()} disabled={!isAdmin} className="text-sm text-cyan-300 disabled:text-slate-600">刷新</button>
                </div>
                {!isAdmin ? (
                  <p className="text-sm text-slate-500">仅管理员可查看全局安全日志。</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {(logs ?? []).map((log) => (
                      <div key={log.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-800/50">
                        <div>
                          <p className="text-sm text-white">{log.action} · {log.status}</p>
                          <p className="text-xs text-slate-500">user {log.user_id ?? '—'} · {log.ip_address ?? 'unknown'} · {log.detail ?? '无详情'}</p>
                        </div>
                        <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString('zh-CN')}</p>
                      </div>
                    ))}
                    {!logs?.length && <p className="text-sm text-slate-500">暂无安全日志。</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowUserModal(false)}>
          <div className="dashboard-card rounded-2xl p-6 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{editingUser ? '编辑用户' : '添加用户'}</h3>
              <button type="button" onClick={() => setShowUserModal(false)} className="p-2 rounded-lg hover:bg-slate-700/50">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!editingUser && (
                <input value={userForm.username ?? ''} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} placeholder="用户名" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              )}
              <input value={userForm.full_name ?? ''} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} placeholder="姓名" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={userForm.email ?? ''} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="邮箱" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={userForm.phone ?? ''} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} placeholder="电话" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={userForm.department ?? ''} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} placeholder="部门" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={userForm.title ?? ''} onChange={(e) => setUserForm({ ...userForm, title: e.target.value })} placeholder="职位" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <select value={userForm.role ?? 'guard'} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'guard' })} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
                <option value="guard">值班人员</option>
                <option value="admin">管理员</option>
              </select>
              <input type="password" value={userForm.password ?? ''} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder={editingUser ? '新密码（留空不改）' : '初始密码'} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={userForm.is_active !== false} onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })} />
              账号启用
            </label>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-5 py-2.5 rounded-xl bg-slate-700 text-white">取消</button>
              <button type="button" onClick={saveUser} disabled={busy} className="px-5 py-2.5 rounded-xl bg-cyan-500 text-white disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
