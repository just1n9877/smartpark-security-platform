'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  HardDrive, Server, Cpu, Wifi, Settings, Database, Monitor,
  RefreshCw, Plus, Search, Power, Eye, MoreHorizontal, Signal, Clock, Activity, Loader2, Trash2, X, Check
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';
import { createDevice, deleteDevice, fetchDevices, updateDevice, type Device } from '@/lib/api';

const deviceTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  server: { icon: Server, color: 'cyan', label: '服务器' },
  storage: { icon: Database, color: 'emerald', label: '存储' },
  ai: { icon: Cpu, color: 'purple', label: 'AI计算' },
  network: { icon: Wifi, color: 'blue', label: '网络设备' },
  backup: { icon: HardDrive, color: 'amber', label: '备份' },
  stream: { icon: Monitor, color: 'pink', label: '流媒体' },
};

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  online: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '在线' },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: '告警' },
  offline: { color: 'text-slate-400', bg: 'bg-slate-500/10', label: '离线' },
};

export default function DevicesPage() {
  const { data: devices, isLoading, error, mutate } = useSWR<Device[]>('devices', fetchDevices, {
    refreshInterval: 15000,
  });
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState({
    name: '',
    device_type: 'server',
    location: '',
    status: 'online',
    ip_address: '',
    cpu_percent: 0,
    memory_percent: 0,
    disk_percent: 0,
    uptime: '',
    notes: '',
  });

  const filteredDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (devices ?? [])
      .filter((d) => filterType === 'all' || d.device_type === filterType)
      .filter((d) => filterStatus === 'all' || d.status === filterStatus)
      .filter((d) => !q || d.name.toLowerCase().includes(q) || (d.location ?? '').toLowerCase().includes(q) || (d.ip_address ?? '').toLowerCase().includes(q));
  }, [devices, filterType, filterStatus, query]);

  const getTypeIcon = (type: string) => deviceTypeConfig[type]?.icon || Server;

  const getMetricColor = (value: number) => {
    if (value > 80) return 'text-red-400';
    if (value > 60) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getMetricBg = (value: number) => {
    if (value > 80) return 'bg-red-500';
    if (value > 60) return 'bg-amber-500';
    return 'bg-gradient-to-r from-cyan-500 to-emerald-500';
  };

  function emptyDeviceForm() {
    return { name: '', device_type: 'server', location: '', status: 'online', ip_address: '', cpu_percent: 0, memory_percent: 0, disk_percent: 0, uptime: '', notes: '' };
  }

  function openAddDevice() {
    setEditingDevice(null);
    setNewDevice(emptyDeviceForm());
    setShowAddModal(true);
  }

  function openEditDevice(device: Device) {
    setEditingDevice(device);
    setNewDevice({
      name: device.name,
      device_type: device.device_type,
      location: device.location ?? '',
      status: device.status,
      ip_address: device.ip_address ?? '',
      cpu_percent: device.cpu_percent,
      memory_percent: device.memory_percent,
      disk_percent: device.disk_percent,
      uptime: device.uptime ?? '',
      notes: device.notes ?? '',
    });
    setShowAddModal(true);
  }

  async function handleSaveDevice() {
    if (!newDevice.name) {
      setMessage('请填写设备名称');
      return;
    }
    try {
      const payload = {
        ...newDevice,
        location: newDevice.location || null,
        ip_address: newDevice.ip_address || null,
        uptime: newDevice.uptime || null,
        notes: newDevice.notes || null,
      };
      if (editingDevice) {
        await updateDevice(editingDevice.id, payload);
      } else {
        await createDevice(payload);
      }
      setShowAddModal(false);
      setEditingDevice(null);
      setMessage(editingDevice ? '设备已更新' : '设备已保存');
      setNewDevice(emptyDeviceForm());
      await mutate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败');
    }
  }

  async function updateDeviceStatus(device: Device, status: string) {
    try {
      await updateDevice(device.id, { status });
      setMessage(`设备 ${device.name} 状态已更新为 ${statusConfig[status]?.label ?? status}`);
      await mutate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '更新失败');
    }
  }

  async function removeDevice(device: Device) {
    if (!window.confirm(`确定删除设备「${device.name}」吗？`)) return;
    try {
      await deleteDevice(device.id);
      setSelectedDevice(null);
      setMessage('设备已删除');
      await mutate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '删除失败');
    }
  }

  return (
    <Sidebar currentPath="/devices">
      <Header 
        title="设备管理" 
        subtitle="服务器、网络设备与算力节点运行状态"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Signal className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">{(devices ?? []).filter(d => d.status === 'online').length}/{devices?.length ?? 0} 在线</span>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => mutate()} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
            <RefreshCw className={`w-5 h-5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={openAddDevice} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors">
            <Plus className="w-4 h-4" />
            添加设备
          </button>
        </div>
      </Header>

      <div className="flex-1 p-6 overflow-y-auto">
        {message && <div className="mb-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-sm">{message}</div>}
        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">设备加载失败：{error instanceof Error ? error.message : String(error)}</div>}
        {isLoading && !devices && <p className="mb-4 flex items-center gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" />加载设备…</p>}
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: '设备总数', value: devices?.length ?? 0, color: 'cyan' },
            { label: '在线设备', value: (devices ?? []).filter(d => d.status === 'online').length, color: 'emerald' },
            { label: '告警设备', value: (devices ?? []).filter(d => d.status === 'warning').length, color: 'amber' },
            { label: '离线设备', value: (devices ?? []).filter(d => d.status === 'offline').length, color: 'slate' },
          ].map((stat, index) => (
            <div key={index} className="dashboard-card rounded-2xl p-4">
              <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color === 'slate' ? 'text-slate-400' : `text-${stat.color}-400`}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索设备..." 
                className="pl-9 pr-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">类型:</span>
              {['all', 'server', 'storage', 'ai', 'network'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterType === type 
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  {type === 'all' ? '全部' : deviceTypeConfig[type]?.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">状态:</span>
            {['all', 'online', 'warning', 'offline'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === status 
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
                }`}
              >
                {status === 'all' ? '全部' : statusConfig[status].label}
              </button>
            ))}
          </div>
        </div>

        {/* 设备列表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDevices.map((device) => {
            const status = statusConfig[device.status] ?? statusConfig.offline;
            const TypeIcon = getTypeIcon(device.device_type);
            const isSelected = selectedDevice?.id === device.id;

            return (
              <div
                key={device.id}
                onClick={() => setSelectedDevice(isSelected ? null : device)}
                className={`dashboard-card rounded-2xl p-5 cursor-pointer transition-all hover:ring-2 hover:ring-cyan-500/30 ${
                  isSelected ? 'ring-2 ring-cyan-400' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
                      <TypeIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{device.name}</h4>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <span>{device.location}</span>
                        <span>·</span>
                        <span>{device.ip_address ?? '未填写 IP'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                    <button className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors">
                      <MoreHorizontal className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* 性能指标 */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                    { label: 'CPU', value: device.cpu_percent },
                    { label: '内存', value: device.memory_percent },
                    { label: '磁盘', value: device.disk_percent },
                  ].map((metric, index) => (
                    <div key={index} className="p-3 rounded-xl bg-slate-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">{metric.label}</span>
                        <span className={`text-xs font-medium ${getMetricColor(metric.value)}`}>
                          {metric.value}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${getMetricBg(metric.value)}`}
                          style={{ width: `${metric.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 展开详情 */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-slate-700/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-800/50">
                        <p className="text-xs text-slate-500 mb-1">运行时间</p>
                        <p className="text-sm text-white flex items-center gap-1">
                          <Clock className="w-4 h-4 text-cyan-400" />
                          {device.uptime ?? '未记录'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-800/50">
                        <p className="text-xs text-slate-500 mb-1">最后检查</p>
                        <p className="text-sm text-white flex items-center gap-1">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          {new Date(device.last_check_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateDeviceStatus(device, 'online')} className="flex-1 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />
                        标记在线
                      </button>
                      <button type="button" onClick={() => openEditDevice(device)} className="px-4 py-2 rounded-xl bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        编辑
                      </button>
                      <button type="button" onClick={() => removeDevice(device)} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-300 text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {device.status === 'online' ? (
                        <button type="button" onClick={() => updateDeviceStatus(device, 'warning')} className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors">
                          标记告警
                        </button>
                      ) : (
                        <button type="button" onClick={() => updateDeviceStatus(device, 'online')} className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors flex items-center gap-2">
                          <Power className="w-4 h-4" />
                          标记在线
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredDevices.length === 0 && (
          <div className="dashboard-card rounded-2xl p-12 text-center">
            <Server className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">暂无设备信息</h3>
            <p className="text-sm text-slate-500">当前筛选条件下没有设备记录</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="dashboard-card rounded-2xl p-6 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{editingDevice ? '编辑设备' : '添加设备'}</h3>
              <button type="button" onClick={() => { setShowAddModal(false); setEditingDevice(null); }} className="p-2 rounded-lg hover:bg-slate-700/50">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={newDevice.name} onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })} placeholder="设备名称" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <select value={newDevice.device_type} onChange={(e) => setNewDevice({ ...newDevice, device_type: e.target.value })} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
                {Object.entries(deviceTypeConfig).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
              </select>
              <input value={newDevice.location} onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })} placeholder="位置" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={newDevice.ip_address} onChange={(e) => setNewDevice({ ...newDevice, ip_address: e.target.value })} placeholder="IP 地址" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <select value={newDevice.status} onChange={(e) => setNewDevice({ ...newDevice, status: e.target.value })} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
                <option value="online">在线</option>
                <option value="warning">告警</option>
                <option value="offline">离线</option>
              </select>
              <input value={newDevice.uptime} onChange={(e) => setNewDevice({ ...newDevice, uptime: e.target.value })} placeholder="运行时间，如 3天2小时" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input type="number" min={0} max={100} value={newDevice.cpu_percent} onChange={(e) => setNewDevice({ ...newDevice, cpu_percent: Number(e.target.value) })} placeholder="CPU %" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input type="number" min={0} max={100} value={newDevice.memory_percent} onChange={(e) => setNewDevice({ ...newDevice, memory_percent: Number(e.target.value) })} placeholder="内存 %" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input type="number" min={0} max={100} value={newDevice.disk_percent} onChange={(e) => setNewDevice({ ...newDevice, disk_percent: Number(e.target.value) })} placeholder="磁盘 %" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={newDevice.notes} onChange={(e) => setNewDevice({ ...newDevice, notes: e.target.value })} placeholder="备注" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => { setShowAddModal(false); setEditingDevice(null); }} className="px-5 py-2.5 rounded-xl bg-slate-700 text-white">取消</button>
              <button type="button" onClick={handleSaveDevice} className="px-5 py-2.5 rounded-xl bg-cyan-500 text-white flex items-center gap-2">
                <Check className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
