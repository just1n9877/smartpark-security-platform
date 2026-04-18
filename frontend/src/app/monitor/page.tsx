'use client';

import { useState } from 'react';
import {
  Camera, Play, Pause, Volume2, VolumeX, Maximize2, Settings, Search,
  Grid3X3, List, Plus, Eye, Power, Wifi, Check, X
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';
import { useToast } from '@/components/ui/Toast';

// 摄像头类型定义
interface CameraData {
  id: number;
  name: string;
  location: string;
  status: 'online' | 'warning' | 'offline';
  persons: number;
  area: string;
  fps: number;
  resolution: string;
  rtsp?: string;
}

// 初始摄像头数据
const initialCameras: CameraData[] = [
  { id: 1, name: '东门入口', location: '东门', status: 'online', persons: 12, area: '出入口', fps: 30, resolution: '4K' },
  { id: 2, name: '1号楼大堂', location: '1号楼', status: 'online', persons: 8, area: '大堂', fps: 25, resolution: '1080P' },
  { id: 3, name: '停车场A区', location: '停车场', status: 'online', persons: 5, area: '停车场', fps: 30, resolution: '4K' },
  { id: 4, name: '仓库周界', location: '仓库', status: 'warning', persons: 0, area: '周界', fps: 30, resolution: '4K' },
  { id: 5, name: '中央广场', location: '广场', status: 'online', persons: 23, area: '公共区域', fps: 25, resolution: '1080P' },
  { id: 6, name: '员工宿舍区', location: '宿舍', status: 'online', persons: 6, area: '住宿区', fps: 30, resolution: '4K' },
  { id: 7, name: '2号楼走廊', location: '2号楼', status: 'online', persons: 3, area: '办公区', fps: 25, resolution: '1080P' },
  { id: 8, name: '餐厅区域', location: '餐厅', status: 'offline', persons: 0, area: '餐饮区', fps: 0, resolution: '1080P' },
];

const aiDetections = [
  { type: '入侵检测', count: 5, color: 'red' },
  { type: '人员聚集', count: 2, color: 'amber' },
  { type: '火焰检测', count: 0, color: 'orange' },
  { type: '异常行为', count: 1, color: 'purple' },
];

export default function MonitorPage() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  // 添加摄像头表单状态
  const [newCamera, setNewCamera] = useState({
    name: '',
    location: '',
    area: '',
    rtsp: ''
  });

  const [cameras, setCameras] = useState<CameraData[]>(initialCameras);

  const filteredCameras = cameras.filter(cam => 
    filterStatus === 'all' || cam.status === filterStatus
  );

  // 添加摄像头处理函数
  const handleAddCamera = () => {
    if (!newCamera.name || !newCamera.location || !newCamera.area) {
      toast.error('添加失败', '请填写所有必填字段');
      return;
    }

    const camera: CameraData = {
      id: Date.now(),
      name: newCamera.name,
      location: newCamera.location,
      area: newCamera.area,
      rtsp: newCamera.rtsp,
      status: 'online',
      persons: 0,
      fps: 25,
      resolution: '1080P'
    };

    setCameras([...cameras, camera]);
    toast.success('添加成功', `摄像头 "${newCamera.name}" 已成功添加`);
    setShowAddModal(false);
    setNewCamera({ name: '', location: '', area: '', rtsp: '' });
  };

  return (
    <Sidebar currentPath="/monitor">
      <Header 
        title="实时监控" 
        subtitle="多画面实时视频监控与AI智能分析"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400 text-sm font-medium">直播中</span>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索摄像头..." 
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors w-48"
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加摄像头
          </button>
        </div>
      </Header>

      <div className="flex-1 p-6 overflow-y-auto">
        {/* AI 检测统计 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {aiDetections.map((detection, index) => (
            <div key={index} className="dashboard-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">AI检测</span>
                <div className={`w-2 h-2 rounded-full bg-${detection.color}-400 animate-pulse`} />
              </div>
              <p className="text-2xl font-bold text-white">{detection.count}</p>
              <p className="text-sm text-slate-500 mt-1">{detection.type}</p>
            </div>
          ))}
        </div>

        {/* 控制栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">筛选:</span>
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
                {status === 'all' ? '全部' : status === 'online' ? '在线' : status === 'warning' ? '告警' : '离线'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 摄像头网格/列表 */}
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
          {filteredCameras.map((camera) => (
            <div
              key={camera.id}
              className={`dashboard-card rounded-2xl overflow-hidden cursor-pointer group transition-all hover:ring-2 hover:ring-cyan-500/30 ${
                selectedCamera?.id === camera.id ? 'ring-2 ring-cyan-400' : ''
              }`}
              onClick={() => setSelectedCamera(camera)}
            >
              {viewMode === 'grid' ? (
                <>
                  {/* 视频预览区域 */}
                  <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900">
                    {/* 模拟视频画面 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Camera className="w-12 h-12 text-slate-600" />
                    </div>
                    
                    {/* 状态标识 */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-sm ${
                        camera.status === 'online' ? 'bg-emerald-500/80' : 
                        camera.status === 'warning' ? 'bg-amber-500/80' : 'bg-slate-700/80'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${camera.status === 'online' ? 'bg-white animate-pulse' : 'bg-white'}`} />
                        <span className="text-xs text-white font-medium">
                          {camera.status === 'online' ? '直播' : camera.status === 'warning' ? '告警' : '离线'}
                        </span>
                      </div>
                    </div>

                    {/* AI标注 */}
                    {camera.status === 'online' && camera.persons > 0 && (
                      <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-purple-500/80 backdrop-blur-sm">
                        <span className="text-xs text-white font-medium">AI: {camera.persons}人</span>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                      >
                        {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                      </button>
                      <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                      </button>
                      <button className="p-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
                        <Maximize2 className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>

                  {/* 信息区域 */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-white font-medium">{camera.name}</h4>
                        <p className="text-sm text-slate-500">{camera.location}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Power className={`w-4 h-4 ${camera.status === 'online' ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <Wifi className={`w-4 h-4 ${camera.status === 'online' ? 'text-emerald-400' : 'text-slate-500'}`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{camera.area}</span>
                      <span>{camera.resolution}</span>
                      <span>{camera.fps}fps</span>
                    </div>
                  </div>
                </>
              ) : (
                /* 列表视图 */
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    camera.status === 'online' ? 'bg-emerald-500/10' : 
                    camera.status === 'warning' ? 'bg-amber-500/10' : 'bg-slate-700/50'
                  }`}>
                    <Camera className={`w-6 h-6 ${
                      camera.status === 'online' ? 'text-emerald-400' : 
                      camera.status === 'warning' ? 'text-amber-400' : 'text-slate-500'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{camera.name}</h4>
                    <p className="text-sm text-slate-500">{camera.location} · {camera.area}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      camera.status === 'online' ? 'text-emerald-400' : 
                      camera.status === 'warning' ? 'text-amber-400' : 'text-slate-500'
                    }`}>
                      {camera.status === 'online' ? '在线' : camera.status === 'warning' ? '告警' : '离线'}
                    </div>
                    <p className="text-xs text-slate-500">{camera.resolution}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                      <Eye className="w-4 h-4 text-slate-400" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                      <Settings className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 添加摄像头弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="dashboard-card rounded-2xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">添加摄像头</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">摄像头名称 <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入摄像头名称"
                  value={newCamera.name}
                  onChange={(e) => setNewCamera({...newCamera, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">安装位置 <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入安装位置"
                  value={newCamera.location}
                  onChange={(e) => setNewCamera({...newCamera, location: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">所属区域 <span className="text-red-400">*</span></label>
                <select 
                  value={newCamera.area}
                  onChange={(e) => setNewCamera({...newCamera, area: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                >
                  <option value="">请选择区域</option>
                  <option value="出入口">出入口</option>
                  <option value="大堂">大堂</option>
                  <option value="停车场">停车场</option>
                  <option value="周界">周界</option>
                  <option value="公共区域">公共区域</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">RTSP地址</label>
                <input 
                  type="text" 
                  placeholder="rtsp://..."
                  value={newCamera.rtsp}
                  onChange={(e) => setNewCamera({...newCamera, rtsp: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleAddCamera}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  确认添加
                </button>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setNewCamera({ name: '', location: '', area: '', rtsp: '' });
                  }} 
                  className="px-6 py-2.5 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
