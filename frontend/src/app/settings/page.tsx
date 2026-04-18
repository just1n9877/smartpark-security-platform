'use client';

import { useState } from 'react';
import {
  User, Users, Shield, Bell, Lock, Eye, EyeOff,
  Save, Plus, Edit, Trash2, Key, Upload, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';

const tabs = [
  { id: 'profile', label: '个人信息', icon: User },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'roles', label: '角色权限', icon: Shield },
  { id: 'notifications', label: '通知设置', icon: Bell },
  { id: 'security', label: '安全设置', icon: Lock },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);

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
