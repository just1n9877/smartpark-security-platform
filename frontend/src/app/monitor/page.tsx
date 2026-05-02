'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Camera, Check, Eye, Loader2, Maximize2, Plus, Power, RefreshCw, Search, Video, Wifi, X } from 'lucide-react';
import { Header, Sidebar } from '@/components/Sidebar';
import { createCamera, fetchCameras, prepareCameraWebRtc, startCameraStream, stopCameraStream, type ApiCamera } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

function camerasFetcher() {
  return fetchCameras();
}

type WebRtcState = {
  cameraId: number;
  loading: boolean;
  pageUrl?: string;
  error?: string;
};

function CameraPreview({
  camera,
  enlarged = false,
  webrtc,
  onRetry,
}: {
  camera: ApiCamera;
  enlarged?: boolean;
  webrtc?: WebRtcState | null;
  onRetry?: () => void;
}) {
  const activeWebRtc = webrtc?.cameraId === camera.id ? webrtc : null;

  if (enlarged && camera.rtsp_url && activeWebRtc?.pageUrl) {
    return (
      <div className="relative aspect-video bg-slate-950 min-h-[320px]">
        <iframe
          title={`${camera.name} WebRTC`}
          src={activeWebRtc.pageUrl}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0 bg-black"
        />
      </div>
    );
  }

  return (
    <div className={`relative aspect-video bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center ${enlarged ? 'min-h-[320px]' : ''}`}>
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.18) 1px, transparent 1px)',
        backgroundSize: enlarged ? '48px 48px' : '32px 32px',
      }} />
      <div className="relative flex flex-col items-center gap-3 text-center px-6">
        <div className={`${enlarged ? 'w-24 h-24' : 'w-16 h-16'} rounded-2xl bg-slate-900/70 border border-cyan-500/20 flex items-center justify-center`}>
          <Video className={`${enlarged ? 'w-12 h-12' : 'w-8 h-8'} text-slate-500`} />
        </div>
        {enlarged && (
          <div className="text-sm text-slate-400 max-w-xl">
            {!camera.rtsp_url && <p>该摄像头未配置视频流地址。</p>}
            {camera.rtsp_url && activeWebRtc?.loading && (
              <p className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在连接 WebRTC 实时画面…
              </p>
            )}
            {camera.rtsp_url && activeWebRtc?.error && (
              <div className="space-y-3">
                <p className="text-red-300">WebRTC 连接失败：{activeWebRtc.error}</p>
                <button type="button" onClick={onRetry} className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-xs hover:bg-cyan-400">
                  重试连接
                </button>
              </div>
            )}
            {camera.rtsp_url && !activeWebRtc?.loading && !activeWebRtc?.error && <p>准备 WebRTC 实时画面…</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MonitorPage() {
  const { toast } = useToast();
  const { data: cameras, isLoading, error, mutate } = useSWR<ApiCamera[]>('monitor-cameras', camerasFetcher, {
    refreshInterval: 10000,
  });
  const [selectedCamera, setSelectedCamera] = useState<ApiCamera | null>(null);
  const [webrtcState, setWebrtcState] = useState<WebRtcState | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [query, setQuery] = useState('');
  const [newCamera, setNewCamera] = useState({
    name: '',
    location: '',
    rtsp_url: '',
    risk_level: 2,
    notes: '',
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (cameras ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || (c.location ?? '').toLowerCase().includes(q));
  }, [cameras, query]);

  useEffect(() => {
    if (!selectedCamera) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCamera(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCamera]);

  useEffect(() => {
    if (!selectedCamera) {
      setWebrtcState(null);
      return;
    }
    if (!selectedCamera.rtsp_url) {
      setWebrtcState(null);
      return;
    }

    let cancelled = false;
    setWebrtcState({ cameraId: selectedCamera.id, loading: true });
    prepareCameraWebRtc(selectedCamera.id)
      .then((info) => {
        if (!cancelled) {
          setWebrtcState({ cameraId: selectedCamera.id, loading: false, pageUrl: info.page_url });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setWebrtcState({
            cameraId: selectedCamera.id,
            loading: false,
            error: e instanceof Error ? e.message : '无法准备 WebRTC 播放地址',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCamera]);

  async function retryWebRtc() {
    if (!selectedCamera?.rtsp_url) return;
    setWebrtcState({ cameraId: selectedCamera.id, loading: true });
    try {
      const info = await prepareCameraWebRtc(selectedCamera.id);
      setWebrtcState({ cameraId: selectedCamera.id, loading: false, pageUrl: info.page_url });
    } catch (e) {
      setWebrtcState({
        cameraId: selectedCamera.id,
        loading: false,
        error: e instanceof Error ? e.message : '无法准备 WebRTC 播放地址',
      });
    }
  }

  async function handleAddCamera() {
    if (!newCamera.name) {
      toast.error('添加失败', '请填写摄像头名称');
      return;
    }
    try {
      await createCamera({
        name: newCamera.name,
        location: newCamera.location || null,
        rtsp_url: newCamera.rtsp_url || null,
        risk_level: newCamera.risk_level,
        is_active: true,
        notes: newCamera.notes || null,
      });
      toast.success('添加成功', `摄像头 "${newCamera.name}" 已保存`);
      setShowAddModal(false);
      setNewCamera({ name: '', location: '', rtsp_url: '', risk_level: 2, notes: '' });
      await mutate();
    } catch (e) {
      toast.error('添加失败', e instanceof Error ? e.message : '服务暂不可用，请稍后重试');
    }
  }

  async function toggleStream(camera: ApiCamera, action: 'start' | 'stop') {
    try {
      if (action === 'start') {
        await startCameraStream(camera.id);
      } else {
        await stopCameraStream(camera.id);
      }
      toast.success(action === 'start' ? '已请求启动' : '已请求停止', camera.name);
    } catch (e) {
      toast.error('操作失败', e instanceof Error ? e.message : '摄像头操作失败');
    }
  }

  return (
    <Sidebar currentPath="/monitor">
      <Header
        title="实时监控"
        subtitle="多摄像头运行状态与视频分析控制"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-medium">{cameras?.length ?? 0} 个摄像头</span>
          </div>
        }
      >
        <button type="button" onClick={() => mutate()} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
          <RefreshCw className={`w-5 h-5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <button type="button" onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400">
          <Plus className="w-4 h-4" />
          添加摄像头
        </button>
      </Header>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="dashboard-card rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索摄像头或位置" className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-500" />
        </div>

        {isLoading && !cameras && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            加载摄像头…
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            摄像头列表加载失败：{error instanceof Error ? error.message : String(error)}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((camera) => (
            <div key={camera.id} className="dashboard-card rounded-2xl overflow-hidden">
              <div className="relative group">
                <CameraPreview camera={camera} />
                <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-emerald-500/80 text-white text-xs">
                  {camera.is_active ? '已启用' : '已停用'}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCamera(camera)}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/90 text-white text-xs font-medium shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  放大查看
                </button>
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <button type="button" onClick={() => setSelectedCamera(camera)} title="查看详情" className="p-2 rounded-lg bg-white/20 hover:bg-white/30">
                    <Eye className="w-4 h-4 text-white" />
                  </button>
                  <button type="button" onClick={() => toggleStream(camera, 'start')} title="启动分析" className="p-2 rounded-lg bg-white/20 hover:bg-white/30">
                    <Power className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-medium">{camera.name}</h3>
                    <p className="text-sm text-slate-500">{camera.location ?? '未填写位置'}</p>
                  </div>
                  <Wifi className={camera.rtsp_url ? 'w-5 h-5 text-emerald-400' : 'w-5 h-5 text-slate-500'} />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-3">
                  <span>风险 {camera.risk_level}</span>
                  <span>{camera.rtsp_url ? 'RTSP 已配置' : '未配置 RTSP'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="dashboard-card rounded-2xl p-12 text-center text-slate-500">
            暂无摄像头，请点击右上角添加摄像头。
          </div>
        )}
      </div>

      {selectedCamera && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCamera(null)}>
          <div className="dashboard-card rounded-2xl max-w-4xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold">{selectedCamera.name}</h3>
                <p className="text-sm text-slate-500">{selectedCamera.location ?? '未填写位置'}</p>
              </div>
              <button type="button" onClick={() => setSelectedCamera(null)} className="p-2 rounded-lg hover:bg-slate-700/50">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <CameraPreview camera={selectedCamera} enlarged webrtc={webrtcState} onRetry={retryWebRtc} />
            <div className="p-4 flex gap-3">
              <button type="button" onClick={() => toggleStream(selectedCamera, 'start')} className="px-4 py-2 rounded-xl bg-emerald-500 text-white">启动分析</button>
              <button type="button" onClick={() => toggleStream(selectedCamera, 'stop')} className="px-4 py-2 rounded-xl bg-slate-700 text-white">停止分析</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="dashboard-card rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">添加摄像头</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-slate-700/50">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <input value={newCamera.name} onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })} placeholder="摄像头名称" className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={newCamera.location} onChange={(e) => setNewCamera({ ...newCamera, location: e.target.value })} placeholder="安装位置" className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={newCamera.rtsp_url} onChange={(e) => setNewCamera({ ...newCamera, rtsp_url: e.target.value })} placeholder="RTSP 地址，可选" className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input type="number" min={1} max={5} value={newCamera.risk_level} onChange={(e) => setNewCamera({ ...newCamera, risk_level: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <textarea value={newCamera.notes} onChange={(e) => setNewCamera({ ...newCamera, notes: e.target.value })} placeholder="备注" className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm min-h-20" />
              <button type="button" onClick={handleAddCamera} className="w-full py-2.5 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
