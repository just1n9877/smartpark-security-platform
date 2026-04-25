'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Camera, Check, Loader2, Map, Plus, Route, Shield, Target, X } from 'lucide-react';
import { Header, Sidebar } from '@/components/Sidebar';
import {
  createSceneRule,
  fetchCameras,
  fetchSceneRules,
  type ApiCamera,
  type SceneRule,
} from '@/lib/api';

const ruleTypes = [
  { value: 'area', label: '区域禁区', icon: Shield, hint: '用多边形标出仓库、机房等区域' },
  { value: 'line_crossing', label: '边界/越线', icon: Route, hint: '画一条警戒线，检测跨越瞬间' },
  { value: 'door', label: '门/入口', icon: Map, hint: '标记门口，检测接近、停留和禁止方向进入' },
  { value: 'direction', label: '方向规则', icon: Route, hint: '设置通道允许方向' },
  { value: 'object_proximity', label: '敏感点靠近', icon: Target, hint: '标记配电箱、服务器柜等点位' },
] as const;

const defaultGeometry: Record<string, Record<string, unknown>> = {
  area: { points: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]] },
  line_crossing: { points: [[0.2, 0.5], [0.8, 0.5]] },
  door: { points: [[0.4, 0.35], [0.6, 0.35], [0.6, 0.65], [0.4, 0.65]], forbidden_direction: 'outside_to_inside' },
  direction: { allowed_direction: 'left_to_right', points: [[0.2, 0.5], [0.8, 0.5]] },
  object_proximity: { point: [0.5, 0.5], radius: 0.08 },
};

function rulesFetcher() {
  return fetchSceneRules();
}

function camerasFetcher() {
  return fetchCameras();
}

export default function RulesPage() {
  const { data: rules, isLoading, mutate } = useSWR<SceneRule[]>('scene-rules', rulesFetcher);
  const { data: cameras } = useSWR<ApiCamera[]>('rule-cameras', camerasFetcher);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    camera_id: '',
    name: '',
    rule_type: 'area',
    risk_level: 3,
    dwell_threshold_sec: 8,
    allowed_direction: '',
    geometry: JSON.stringify(defaultGeometry.area, null, 2),
  });

  const stats = useMemo(() => {
    const rows = rules ?? [];
    return {
      total: rows.length,
      enabled: rows.filter((r) => r.is_enabled).length,
      high: rows.filter((r) => r.risk_level >= 4).length,
    };
  }, [rules]);

  function selectType(ruleType: string) {
    setForm((prev) => ({
      ...prev,
      rule_type: ruleType,
      geometry: JSON.stringify(defaultGeometry[ruleType] ?? {}, null, 2),
      allowed_direction: ruleType === 'direction' ? 'left_to_right' : '',
    }));
  }

  async function saveRule() {
    setSaving(true);
    setError(null);
    try {
      const geometry = JSON.parse(form.geometry) as Record<string, unknown>;
      await createSceneRule({
        camera_id: form.camera_id ? Number(form.camera_id) : null,
        name: form.name,
        rule_type: form.rule_type,
        geometry,
        risk_level: form.risk_level,
        is_enabled: true,
        schedule_json: { authorized_windows: [{ start: '06:00', end: '22:00' }] },
        allowed_direction: form.allowed_direction || null,
        dwell_threshold_sec: form.dwell_threshold_sec,
        config_json: { created_from: 'frontend_rules_page' },
      });
      setShowModal(false);
      setForm({
        camera_id: '',
        name: '',
        rule_type: 'area',
        risk_level: 3,
        dwell_threshold_sec: 8,
        allowed_direction: '',
        geometry: JSON.stringify(defaultGeometry.area, null, 2),
      });
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sidebar currentPath="/rules">
      <Header
        title="场景规则配置"
        subtitle="让系统知道哪些区域、边界、入口、方向和设备属于受控对象"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-medium">{stats.enabled} 条启用</span>
          </div>
        }
      >
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建规则
        </button>
      </Header>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="dashboard-card rounded-2xl p-4">
            <p className="text-sm text-slate-400">规则总数</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="dashboard-card rounded-2xl p-4">
            <p className="text-sm text-slate-400">启用规则</p>
            <p className="text-2xl font-bold text-emerald-300">{stats.enabled}</p>
          </div>
          <div className="dashboard-card rounded-2xl p-4">
            <p className="text-sm text-slate-400">高风险规则</p>
            <p className="text-2xl font-bold text-red-300">{stats.high}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          {ruleTypes.map((type) => (
            <div key={type.value} className="dashboard-card rounded-2xl p-4 border border-cyan-500/10">
              <type.icon className="w-6 h-6 text-cyan-400 mb-3" />
              <h3 className="text-white font-medium mb-1">{type.label}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{type.hint}</p>
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            加载规则…
          </div>
        )}

        <div className="space-y-3">
          {(rules ?? []).map((rule) => (
            <div key={rule.id} className="dashboard-card rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium">{rule.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {rule.rule_type}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      风险 {rule.risk_level}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    摄像头 {rule.camera_id ?? '离线任务默认'} · 停留阈值 {rule.dwell_threshold_sec}s ·
                    {rule.is_enabled ? ' 已启用' : ' 已停用'}
                  </p>
                </div>
                <Camera className="w-5 h-5 text-slate-500" />
              </div>
            </div>
          ))}
          {!isLoading && !(rules ?? []).length && (
            <div className="dashboard-card rounded-2xl p-12 text-center text-slate-500">
              暂无规则。可以先新建区域、越线、门/入口、方向或敏感点规则。
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="dashboard-card rounded-2xl p-6 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">新建场景规则</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-700/50">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="规则名称" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <select value={form.camera_id} onChange={(e) => setForm({ ...form, camera_id: e.target.value })} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
                <option value="">离线任务默认/不绑定摄像头</option>
                {(cameras ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.rule_type} onChange={(e) => selectType(e.target.value)} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
                {ruleTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="number" min={1} max={5} value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: Number(e.target.value) })} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input type="number" min={1} value={form.dwell_threshold_sec} onChange={(e) => setForm({ ...form, dwell_threshold_sec: Number(e.target.value) })} placeholder="停留阈值秒" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={form.allowed_direction} onChange={(e) => setForm({ ...form, allowed_direction: e.target.value })} placeholder="允许方向，如 left_to_right" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
            </div>
            <textarea value={form.geometry} onChange={(e) => setForm({ ...form, geometry: e.target.value })} className="mt-4 w-full min-h-40 rounded-xl bg-slate-900/80 border border-slate-700/50 text-slate-200 text-sm p-3 font-mono" />
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl bg-slate-700 text-white">取消</button>
              <button type="button" onClick={saveRule} disabled={saving || !form.name} className="px-5 py-2.5 rounded-xl bg-cyan-500 text-white disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
