'use client';

import { useEffect, useState } from 'react';
import {
  User, Users, Shield, Bell, Lock, Eye, EyeOff,
  Save, Plus, Edit, Trash2, Key, Upload, ToggleLeft, ToggleRight, SlidersHorizontal,
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';
import { fetchMe, fetchSettings, patchSettings, type SettingsOut, type UserPublic } from '@/lib/api';

const tabs = [
  { id: 'pipeline', label: '预警策略', icon: SlidersHorizontal },
  { id: 'profile', label: '个人信息', icon: User },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'roles', label: '角色权限', icon: Shield },
  { id: 'notifications', label: '通知设置', icon: Bell },
  { id: 'security', label: '安全设置', icon: Lock },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [showPassword, setShowPassword] = useState(false);
  const [me, setMe] = useState<UserPublic | null>(null);
  const [st, setSt] = useState<SettingsOut | null>(null);
  const [pipeErr, setPipeErr] = useState<string | null>(null);
  const [pipeBusy, setPipeBusy] = useState(false);

  useEffect(() => {
    if (activeTab !== 'pipeline') return;
    let cancelled = false;
    (async () => {
      try {
        const [u, s] = await Promise.all([fetchMe(), fetchSettings()]);
        if (!cancelled) {
          setMe(u);
          setSt(s);
          setPipeErr(null);
        }
      } catch (e) {
        if (!cancelled) setPipeErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  async function refreshPipeline() {
    setPipeBusy(true);
    try {
      const s = await fetchSettings();
      setSt(s);
      setPipeErr(null);
    } catch (e) {
      setPipeErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPipeBusy(false);
    }
  }

  async function resetYamlDefaults() {
    if (!me || me.role !== 'admin') return;
    setPipeBusy(true);
    try {
      const s = await patchSettings({ reset_to_yaml_defaults: true });
      setSt(s);
      setPipeErr(null);
    } catch (e) {
      setPipeErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPipeBusy(false);
    }
  }

  return (
    <Sidebar currentPath="/settings">
      <Header 
        title="系统设置" 
        subtitle="系统配置与用户管理"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <div className="w-64 border-r border-slate-700/30 bg-slate-900/30 p-4">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
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

        {/* 主内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'pipeline' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">预警与去抖（SystemConfig）</h3>
                <p className="text-sm text-slate-400">
                  与验收阶段4一致：流水线日志会打印当前确认帧数 M；误报反馈滚动统计超阈值时自动 M+1（见{' '}
                  <code className="text-cyan-400/90">docs/demo_script.md</code>）。先验视频域说明见 README，勿将 RepCount 表述为园区行走数据。
                </p>
              </div>
              {pipeErr && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {pipeErr}
                </div>
              )}
              {!st && !pipeErr && (
                <p className="text-slate-400 text-sm">加载中…</p>
              )}
              {st && (
                <>
                  <div className="dashboard-card rounded-2xl p-5 space-y-4">
                    <h4 className="text-white font-medium">当前生效（DB + YAML 基准合并）</h4>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-slate-500">确认帧数 M</dt>
                        <dd className="text-cyan-300 font-mono">{st.effective.consecutive_frames_for_escalation}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">预警停留阈值（s）</dt>
                        <dd className="text-slate-200 font-mono">
                          warn {st.effective.dwell_warning_sec.toFixed(2)} / alert {st.effective.dwell_alert_sec.toFixed(2)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">冷却（s）</dt>
                        <dd className="text-slate-200 font-mono">{st.effective.cooldown_sec.toFixed(1)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">折返告警阈值 K</dt>
                        <dd className="text-slate-200 font-mono">{st.effective.reversal_alert_k}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="dashboard-card rounded-2xl p-5 space-y-2">
                    <h4 className="text-white font-medium">YAML 文件基准（config/pipeline_alerts.yaml）</h4>
                    <p className="text-xs text-slate-500 font-mono">
                      M={st.yaml_baseline.consecutive_frames_for_escalation} · dwell_warn={st.yaml_baseline.dwell_warning_sec} ·
                      dwell_alert={st.yaml_baseline.dwell_alert_sec}
                    </p>
                  </div>
                  <div className="dashboard-card rounded-2xl p-5 space-y-3">
                    <h4 className="text-white font-medium">自动调参参数</h4>
                    <p className="text-sm text-slate-400">
                      窗口 N={st.tuning.feedback_window_n}，误报率阈值={st.tuning.high_fp_threshold}，M 上限=
                      {st.tuning.max_consecutive_frames}；更新 {new Date(st.tuning.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="dashboard-card rounded-2xl p-5 space-y-3">
                    <h4 className="text-white font-medium">滚动误报率（最近 N 条反馈）</h4>
                    <p className="text-sm text-slate-400">
                      全局：样本 {st.feedback_rollup.global.sample_size}，误报 {st.feedback_rollup.global.false_positives}
                      {st.feedback_rollup.global.false_positive_rate != null
                        ? `，率 ${(st.feedback_rollup.global.false_positive_rate * 100).toFixed(1)}%`
                        : ''}
                    </p>
                    <div className="max-h-48 overflow-y-auto text-xs text-slate-500 space-y-1">
                      {st.feedback_rollup.by_camera.map((c) => (
                        <div key={`${c.camera_id ?? 'na'}-${c.camera_name}`}>
                          {c.camera_name}: n={c.sample_size} fp={c.false_positives}
                          {c.false_positive_rate != null ? ` (${(c.false_positive_rate * 100).toFixed(1)}%)` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => refreshPipeline()}
                      disabled={pipeBusy}
                      className="px-4 py-2 rounded-xl bg-slate-700 text-white text-sm hover:bg-slate-600 disabled:opacity-50"
                    >
                      刷新
                    </button>
                    {me?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => resetYamlDefaults()}
                        disabled={pipeBusy}
                        className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm hover:bg-cyan-500 disabled:opacity-50"
                      >
                        恢复 YAML 默认
                      </button>
                    )}
                    {me && me.role !== 'admin' && (
                      <span className="text-xs text-slate-500 self-center">仅管理员可 PATCH 重置，当前为值班账号。</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-2xl">
              <h3 className="text-lg font-bold text-white mb-6">个人信息</h3>
              
              {/* 头像 */}
              <div className="mb-6">
                <label className="block text-sm text-slate-400 mb-3">头像</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <User className="w-10 h-10 text-cyan-400" />
                  </div>
                  <button className="px-4 py-2 rounded-xl bg-slate-800/50 text-white text-sm font-medium border border-slate-700/50 hover:border-cyan-500/50 transition-colors flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    更换头像
                  </button>
                </div>
              </div>

              {/* 表单 */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">姓名</label>
                    <input 
                      type="text" 
                      defaultValue="管理员"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">工号</label>
                    <input 
                      type="text" 
                      defaultValue="ADMIN001"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">邮箱</label>
                  <input 
                    type="email" 
                    defaultValue="admin@smartpark.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">手机号</label>
                  <input 
                    type="tel" 
                    defaultValue="138****8888"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">部门</label>
                  <select className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors">
                    <option>安保部</option>
                    <option>技术部</option>
                    <option>运维部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">职位</label>
                  <input 
                    type="text" 
                    defaultValue="系统管理员"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-700/30 flex gap-3">
                <button className="px-6 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  保存修改
                </button>
                <button className="px-6 py-2.5 rounded-xl bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors">
                  重置
                </button>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">用户管理</h3>
                <button className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  添加用户
                </button>
              </div>
              
              <div className="dashboard-card rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">用户</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">角色</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">状态</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">最后登录</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {[
                      { name: '管理员', email: 'admin@smartpark.com', role: '超级管理员', status: 'online' },
                      { name: '张伟', email: 'zhangwei@smartpark.com', role: '运维人员', status: 'online' },
                      { name: '李娜', email: 'lina@smartpark.com', role: '普通用户', status: 'offline' },
                    ].map((user, index) => (
                      <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{user.role}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            user.status === 'online' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                          }`}>
                            {user.status === 'online' ? '在线' : '离线'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">2024-04-16 14:30</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors">
                              <Edit className="w-4 h-4 text-slate-400" />
                            </button>
                            <button className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">角色权限</h3>
                <button className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  添加角色
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: '超级管理员', desc: '拥有系统所有权限', count: 1, color: 'cyan' },
                  { name: '运维人员', desc: '设备管理与监控', count: 3, color: 'emerald' },
                  { name: '普通用户', desc: '查看监控与告警', count: 10, color: 'purple' },
                  { name: '访客', desc: '仅查看权限', count: 5, color: 'slate' },
                ].map((role, index) => (
                  <div key={index} className="dashboard-card rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-${role.color}-500/10 border border-${role.color}-500/20 flex items-center justify-center`}>
                          <Shield className={`w-5 h-5 text-${role.color}-400`} />
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{role.name}</h4>
                          <p className="text-xs text-slate-500">{role.desc}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">{role.count}人</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2 rounded-xl bg-slate-800/50 text-white text-sm font-medium hover:bg-slate-700/50 transition-colors flex items-center justify-center gap-2">
                        <Edit className="w-4 h-4" />
                        编辑
                      </button>
                      <button className="px-4 py-2 rounded-xl bg-slate-800/50 text-slate-400 text-sm font-medium hover:bg-slate-700/50 transition-colors">
                        权限
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl">
              <h3 className="text-lg font-bold text-white mb-6">通知设置</h3>
              
              <div className="space-y-4">
                {[
                  { label: '邮件通知', desc: '接收告警邮件推送', enabled: true },
                  { label: '短信通知', desc: '接收紧急告警短信', enabled: true },
                  { label: '应用推送', desc: '接收系统应用通知', enabled: true },
                  { label: '微信推送', desc: '绑定微信接收通知', enabled: false },
                ].map((item, index) => (
                  <div key={index} className="dashboard-card rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">{item.label}</h4>
                      <p className="text-sm text-slate-500">{item.desc}</p>
                    </div>
                    <button className={`p-2 rounded-xl transition-colors ${item.enabled ? 'bg-cyan-500/20' : 'bg-slate-700/50'}`}>
                      {item.enabled ? (
                        <ToggleRight className="w-8 h-8 text-cyan-400" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-500" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl">
              <h3 className="text-lg font-bold text-white mb-6">安全设置</h3>
              
              <div className="space-y-6">
                <div className="dashboard-card rounded-2xl p-5">
                  <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                    <Key className="w-5 h-5 text-cyan-400" />
                    修改密码
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">当前密码</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? 'text' : 'password'}
                          placeholder="请输入当前密码"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                        <button 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5 text-slate-400" /> : <Eye className="w-5 h-5 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">新密码</label>
                      <input 
                        type="password"
                        placeholder="请输入新密码"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">确认新密码</label>
                      <input 
                        type="password"
                        placeholder="请再次输入新密码"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                      />
                    </div>
                    <button className="px-6 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      修改密码
                    </button>
                  </div>
                </div>

                <div className="dashboard-card rounded-2xl p-5">
                  <h4 className="text-white font-medium mb-4">安全日志</h4>
                  <div className="space-y-3">
                    {[
                      { time: '2024-04-16 14:30', action: '登录系统', ip: '192.168.1.100', status: 'success' },
                      { time: '2024-04-16 10:15', action: '修改密码', ip: '192.168.1.100', status: 'success' },
                      { time: '2024-04-15 18:20', action: '异地登录', ip: '192.168.1.200', status: 'warning' },
                    ].map((log, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50">
                        <div>
                          <p className="text-sm text-white">{log.action}</p>
                          <p className="text-xs text-slate-500">{log.ip}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">{log.time}</p>
                          <span className={`text-xs ${
                            log.status === 'success' ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {log.status === 'success' ? '成功' : '警告'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
