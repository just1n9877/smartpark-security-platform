'use client';

import { useState } from 'react';
import {
  HardDrive, Server, Cpu, Wifi, Settings, Database, Monitor,
  RefreshCw, Plus, Search, Power, Eye, MoreHorizontal, Signal, Clock, Activity
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';

// 设备数据
const devicesData = [
  { id: 1, name: '主服务器-01', type: 'server', location: '机房A', status: 'online', ip: '192.168.1.10', cpu: 34, memory: 56, disk: 42, uptime: '99天12小时', lastCheck: '2024-04-16 14:30' },
  { id: 2, name: '存储服务器-01', type: 'storage', location: '机房A', status: 'online', ip: '192.168.1.11', cpu: 23, memory: 45, disk: 78, uptime: '120天8小时', lastCheck: '2024-04-16 14:29' },
  { id: 3, name: 'AI计算节点-01', type: 'ai', location: '机房B', status: 'online', ip: '192.168.1.20', cpu: 67, memory: 82, disk: 35, uptime: '45天15小时', lastCheck: '2024-04-16 14:30' },
  { id: 4, name: 'AI计算节点-02', type: 'ai', location: '机房B', status: 'warning', ip: '192.168.1.21', cpu: 89, memory: 91, disk: 42, uptime: '45天15小时', lastCheck: '2024-04-16 14:30' },
  { id: 5, name: '网络交换机-01', type: 'network', location: '机房A', status: 'online', ip: '192.168.1.1', cpu: 12, memory: 23, disk: 0, uptime: '180天0小时', lastCheck: '2024-04-16 14:28' },
  { id: 6, name: '备份服务器-01', type: 'backup', location: '机房C', status: 'offline', ip: '192.168.1.30', cpu: 0, memory: 0, disk: 0, uptime: '-', lastCheck: '2024-04-16 10:15' },
  { id: 7, name: '流媒体服务器-01', type: 'stream', location: '机房A', status: 'online', ip: '192.168.1.40', cpu: 45, memory: 52, disk: 28, uptime: '60天6小时', lastCheck: '2024-04-16 14:30' },
  { id: 8, name: '人脸识别服务器-01', type: 'ai', location: '机房B', status: 'online', ip: '192.168.1.50', cpu: 56, memory: 68, disk: 22, uptime: '30天12小时', lastCheck: '2024-04-16 14:30' },
];

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
  const [selectedDevice, setSelectedDevice] = useState<typeof devicesData[0] | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredDevices = devicesData
    .filter(d => filterType === 'all' || d.type === filterType)
    .filter(d => filterStatus === 'all' || d.status === filterStatus);

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

  return (
    <Sidebar currentPath="/devices">
      <Header 
        title="设备管理" 
        subtitle="服务器与网络设备监控"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Signal className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">{devicesData.filter(d => d.status === 'online').length}/{devicesData.length} 在线</span>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
            <RefreshCw className="w-5 h-5 text-slate-400" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors">
            <Plus className="w-4 h-4" />
            添加设备
          </button>
        </div>
      </Header>

      <div className="flex-1 p-6 overflow-y-auto">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: '服务器总数', value: devicesData.length, color: 'cyan' },
            { label: '在线设备', value: devicesData.filter(d => d.status === 'online').length, color: 'emerald' },
            { label: '告警设备', value: devicesData.filter(d => d.status === 'warning').length, color: 'amber' },
            { label: '离线设备', value: devicesData.filter(d => d.status === 'offline').length, color: 'slate' },
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
            const typeConfig = deviceTypeConfig[device.type];
            const status = statusConfig[device.status];
            const TypeIcon = getTypeIcon(device.type);
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
                    <div className={`w-12 h-12 rounded-xl bg-${typeConfig.color}-500/10 border border-${typeConfig.color}-500/20 flex items-center justify-center`}>
                      <TypeIcon className={`w-6 h-6 text-${typeConfig.color}-400`} />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{device.name}</h4>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <span>{device.location}</span>
                        <span>·</span>
                        <span>{device.ip}</span>
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
                    { label: 'CPU', value: device.cpu },
                    { label: '内存', value: device.memory },
                    { label: '磁盘', value: device.disk },
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
                          {device.uptime}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-800/50">
                        <p className="text-xs text-slate-500 mb-1">最后检查</p>
                        <p className="text-sm text-white flex items-center gap-1">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          {device.lastCheck}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="flex-1 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />
                        查看详情
                      </button>
                      <button className="px-4 py-2 rounded-xl bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                      </button>
                      {device.status === 'online' ? (
                        <button className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors">
                          重启
                        </button>
                      ) : (
                        <button className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors flex items-center gap-2">
                          <Power className="w-4 h-4" />
                          启动
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
    </Sidebar>
  );
}
