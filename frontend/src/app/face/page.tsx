'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Camera, Check, Edit, Fingerprint, Loader2, Plus, Shield, Trash2, Upload, User, UserX, X } from 'lucide-react';
import { Header, Sidebar } from '@/components/Sidebar';
import {
  createPerson,
  createPersonAuthorization,
  deletePersonAuthorization,
  evidenceToUrl,
  fetchCameras,
  fetchPersons,
  fetchRecognitionLogs,
  fetchSceneRules,
  fetchTrackIdentities,
  updatePerson,
  uploadFaceProfile,
  type ApiCamera,
  type Person,
  type RecognitionLog,
  type SceneRule,
  type TrackIdentity,
} from '@/lib/api';

const personTypeLabels: Record<string, string> = {
  employee: '员工',
  visitor: '访客',
  contractor: '施工/运维',
  blacklist: '黑名单',
  unknown: '未知',
};

const personTypeClasses: Record<string, string> = {
  employee: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  visitor: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  contractor: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  blacklist: 'text-red-300 bg-red-500/10 border-red-500/30',
  unknown: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
};

function personsFetcher() {
  return fetchPersons();
}

export default function FacePage() {
  const { data: persons, isLoading, error: personsError, mutate } = useSWR<Person[]>('face-persons', personsFetcher);
  const { data: rules, error: rulesError } = useSWR<SceneRule[]>('face-rules', () => fetchSceneRules());
  const { data: cameras, error: camerasError } = useSWR<ApiCamera[]>('face-cameras', fetchCameras);
  const { data: logs, error: logsError } = useSWR<RecognitionLog[]>('face-logs', fetchRecognitionLogs, { refreshInterval: 10000 });
  const { data: identities, error: identitiesError } = useSWR<TrackIdentity[]>('face-track-identities', fetchTrackIdentities, { refreshInterval: 10000 });

  const [showModal, setShowModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [newPerson, setNewPerson] = useState({
    name: '',
    person_type: 'employee',
    employee_no: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [authForm, setAuthForm] = useState({ person_id: '', rule_id: '', camera_id: '' });
  const loadError = personsError || rulesError || camerasError || logsError || identitiesError;

  const stats = useMemo(() => {
    const rows = persons ?? [];
    return {
      total: rows.length,
      faceProfiles: rows.reduce((sum, p) => sum + p.face_profiles.length, 0),
      blacklist: rows.filter((p) => p.person_type === 'blacklist').length,
      unknownTracks: (identities ?? []).filter((x) => x.identity_status === 'unknown').length,
    };
  }, [persons, identities]);

  function resetPersonForm() {
    setEditingPerson(null);
    setFaceFile(null);
    setNewPerson({ name: '', person_type: 'employee', employee_no: '', email: '', phone: '', notes: '' });
    setMessage(null);
  }

  function openCreatePerson() {
    resetPersonForm();
    setShowModal(true);
  }

  function openEditPerson(person: Person) {
    setEditingPerson(person);
    setNewPerson({
      name: person.name,
      person_type: person.person_type,
      employee_no: person.employee_no ?? '',
      email: person.email ?? '',
      phone: person.phone ?? '',
      notes: person.notes ?? '',
    });
    setMessage(null);
    setShowModal(true);
  }

  async function savePerson() {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: newPerson.name,
        person_type: newPerson.person_type,
        employee_no: newPerson.employee_no || null,
        email: newPerson.email || null,
        phone: newPerson.phone || null,
        notes: newPerson.notes || null,
        is_active: true,
      };
      if (editingPerson) {
        await updatePerson(editingPerson.id, { ...payload, is_active: editingPerson.is_active });
      } else {
        const created = await createPerson(payload);
        if (faceFile) {
          await uploadFaceProfile(created.id, faceFile);
        }
      }
      setShowModal(false);
      resetPersonForm();
      await mutate();
      setMessage(editingPerson ? '人员已保存' : faceFile ? '人员与人脸照片已保存' : '人员已保存，请继续上传人脸照片');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function togglePersonActive(person: Person) {
    setMessage(null);
    try {
      await updatePerson(person.id, { is_active: !person.is_active });
      setMessage(person.is_active ? '人员已停用' : '人员已启用');
      await mutate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '更新人员状态失败');
    }
  }

  async function removeAuthorization(authorizationId: number) {
    setMessage(null);
    try {
      await deletePersonAuthorization(authorizationId);
      setMessage('授权已撤销');
      await mutate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '撤销授权失败');
    }
  }

  async function handleFaceUpload(personId: number, file: File | null) {
    if (!file) return;
    setMessage(null);
    try {
      await uploadFaceProfile(personId, file);
      setMessage('人脸照片已上传并提取本地特征');
      await mutate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '上传失败');
    }
  }

  async function saveAuthorization() {
    if (!authForm.person_id) return;
    setMessage(null);
    try {
      await createPersonAuthorization({
        person_id: Number(authForm.person_id),
        rule_id: authForm.rule_id ? Number(authForm.rule_id) : null,
        camera_id: authForm.camera_id ? Number(authForm.camera_id) : null,
        schedule_json: { authorized_windows: [{ start: '06:00', end: '22:00' }] },
        is_enabled: true,
      });
      setAuthForm({ person_id: '', rule_id: '', camera_id: '' });
      setMessage('授权规则已保存');
      await mutate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '授权保存失败');
    }
  }

  return (
    <Sidebar currentPath="/face">
      <Header
        title="人脸识别与人员授权"
        subtitle="人员库、人脸模板、区域授权与轨迹身份识别结果"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <Fingerprint className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-medium">{stats.faceProfiles} 个人脸模板</span>
          </div>
        }
      >
        <button type="button" onClick={openCreatePerson} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400">
          <Plus className="w-4 h-4" />
          新增人员
        </button>
      </Header>

      <div className="flex-1 p-6 overflow-y-auto">
        {message && <div className="mb-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-sm">{message}</div>}
        {loadError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            人脸模块数据加载失败：{loadError instanceof Error ? loadError.message : String(loadError)}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="dashboard-card rounded-2xl p-4"><p className="text-sm text-slate-400">人员总数</p><p className="text-2xl font-bold text-white">{stats.total}</p></div>
          <div className="dashboard-card rounded-2xl p-4"><p className="text-sm text-slate-400">人脸模板</p><p className="text-2xl font-bold text-cyan-300">{stats.faceProfiles}</p></div>
          <div className="dashboard-card rounded-2xl p-4"><p className="text-sm text-slate-400">黑名单</p><p className="text-2xl font-bold text-red-300">{stats.blacklist}</p></div>
          <div className="dashboard-card rounded-2xl p-4"><p className="text-sm text-slate-400">未知轨迹</p><p className="text-2xl font-bold text-amber-300">{stats.unknownTracks}</p></div>
        </div>

        <div className="dashboard-card rounded-2xl p-5 mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-400" />人员授权配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select value={authForm.person_id} onChange={(e) => setAuthForm({ ...authForm, person_id: e.target.value })} className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
              <option value="">选择人员</option>
              {(persons ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={authForm.rule_id} onChange={(e) => setAuthForm({ ...authForm, rule_id: e.target.value })} className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
              <option value="">全部规则/不限定</option>
              {(rules ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select value={authForm.camera_id} onChange={(e) => setAuthForm({ ...authForm, camera_id: e.target.value })} className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
              <option value="">全部摄像头/不限定</option>
              {(cameras ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={saveAuthorization} disabled={!authForm.person_id} className="px-4 py-2 rounded-xl bg-emerald-500 text-white disabled:opacity-50">保存授权</button>
          </div>
          <p className="text-xs text-slate-500 mt-3">授权状态会进入告警分级：黑名单、未知人员、未授权人员会提高风险等级。</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-3">
            {isLoading && <p className="text-slate-400 flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />加载人员库…</p>}
            {(persons ?? []).map((person) => (
              <div key={person.id} className="dashboard-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-white font-medium">{person.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${personTypeClasses[person.person_type] ?? personTypeClasses.unknown}`}>
                        {personTypeLabels[person.person_type] ?? person.person_type}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${person.is_active ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-slate-300 bg-slate-500/10 border-slate-500/30'}`}>
                        {person.is_active ? '启用' : '停用'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{person.employee_no || '无编号'} · {person.email || '无邮箱'} · 授权 {person.authorizations.length} 条</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button type="button" onClick={() => openEditPerson(person)} className="px-3 py-2 rounded-xl bg-slate-700 text-slate-100 text-sm flex items-center gap-2">
                      <Edit className="w-4 h-4" />
                      编辑
                    </button>
                    <button type="button" onClick={() => togglePersonActive(person)} className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-200 text-sm border border-amber-500/30">
                      {person.is_active ? '停用' : '启用'}
                    </button>
                    <label className="px-3 py-2 rounded-xl bg-cyan-500/20 text-cyan-200 text-sm cursor-pointer hover:bg-cyan-500/30 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      上传人脸
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFaceUpload(person.id, e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {person.face_profiles.map((face) => (
                    <a key={face.id} href={evidenceToUrl(face.image_path) ?? '#'} target="_blank" rel="noreferrer" className="px-2 py-1 rounded-lg bg-slate-800/80 text-xs text-slate-300 border border-slate-700/50">
                      模板 #{face.id} · 质量 {face.quality_score.toFixed(2)}
                    </a>
                  ))}
                  {!person.face_profiles.length && <span className="text-xs text-amber-300">未上传人脸照片，无法被自动识别</span>}
                </div>
                {person.authorizations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/40 space-y-2">
                    <p className="text-xs text-slate-500">授权记录</p>
                    {person.authorizations.map((auth) => (
                      <div key={auth.id} className="flex items-center justify-between gap-3 text-xs rounded-lg bg-slate-800/50 px-3 py-2">
                        <span className="text-slate-300">
                          授权 #{auth.id} · 规则 {auth.rule_id ?? '全部'} · 摄像头 {auth.camera_id ?? '全部'} · {auth.is_enabled ? '启用' : '停用'}
                        </span>
                        <button type="button" onClick={() => removeAuthorization(auth.id)} className="text-red-300 hover:text-red-200 flex items-center gap-1">
                          <Trash2 className="w-3 h-3" />
                          撤销
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!isLoading && !(persons ?? []).length && (
              <div className="dashboard-card rounded-2xl p-12 text-center text-slate-500">
                暂无人员，请新增人员并上传人脸照片。
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="dashboard-card rounded-2xl p-4">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Camera className="w-5 h-5 text-cyan-400" />最近识别记录</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(logs ?? []).slice(0, 8).map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-800/50 text-sm">
                    <p className="text-white">轨迹 #{log.track_id ?? '—'} · {log.status}</p>
                    <p className="text-xs text-slate-500">置信度 {log.confidence.toFixed(3)} · {new Date(log.created_at).toLocaleString('zh-CN')}</p>
                  </div>
                ))}
                {!logs?.length && <p className="text-sm text-slate-500">暂无识别记录。</p>}
              </div>
            </div>
            <div className="dashboard-card rounded-2xl p-4">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2"><UserX className="w-5 h-5 text-amber-400" />轨迹身份状态</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(identities ?? []).slice(0, 8).map((item) => (
                  <div key={item.id} className="p-3 rounded-xl bg-slate-800/50 text-sm">
                    <p className="text-white">轨迹 #{item.track_id} · {item.identity_status}</p>
                    <p className="text-xs text-slate-500">授权 {item.authorization_status} · 置信度 {item.confidence.toFixed(3)}</p>
                  </div>
                ))}
                {!identities?.length && <p className="text-sm text-slate-500">暂无轨迹身份。</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="dashboard-card rounded-2xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{editingPerson ? '编辑人员' : '新增人员'}</h3>
              <button type="button" onClick={() => { setShowModal(false); resetPersonForm(); }} className="p-2 rounded-lg hover:bg-slate-700/50"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={newPerson.name} onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })} placeholder="姓名" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <select value={newPerson.person_type} onChange={(e) => setNewPerson({ ...newPerson, person_type: e.target.value })} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm">
                <option value="employee">员工</option>
                <option value="visitor">访客</option>
                <option value="contractor">施工/运维</option>
                <option value="blacklist">黑名单</option>
              </select>
              <input value={newPerson.employee_no} onChange={(e) => setNewPerson({ ...newPerson, employee_no: e.target.value })} placeholder="员工/访客编号" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={newPerson.email} onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })} placeholder="邮箱" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={newPerson.phone} onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })} placeholder="电话" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
              <input value={newPerson.notes} onChange={(e) => setNewPerson({ ...newPerson, notes: e.target.value })} placeholder="备注" className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm" />
            </div>
            {!editingPerson && (
              <label className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3 cursor-pointer hover:border-cyan-500/40">
                <span className="text-sm text-slate-300">
                  {faceFile ? `已选择照片：${faceFile.name}` : '选择人脸照片（保存时自动上传并提取特征）'}
                </span>
                <Upload className="w-4 h-4 text-cyan-300" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFaceFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => { setShowModal(false); resetPersonForm(); }} className="px-5 py-2.5 rounded-xl bg-slate-700 text-white">取消</button>
              <button type="button" onClick={savePerson} disabled={saving || !newPerson.name} className="px-5 py-2.5 rounded-xl bg-cyan-500 text-white disabled:opacity-50 flex items-center gap-2">
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
