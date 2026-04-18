'use client';

import { useState } from 'react';
import {
  Search, Plus, Grid3X3, List, User, Users, Clock, MapPin, Camera, Check, X, ChevronRight
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';

// 人员数据
const personsData = [
  { id: 1, name: '张伟', employeeId: 'EMP001', department: '研发部', type: '员工', faceUrl: '', status: 'normal', lastSeen: '2024-04-16 14:30', confidence: 98.5 },
  { id: 2, name: '李娜', employeeId: 'EMP002', department: '市场部', type: '员工', faceUrl: '', status: 'normal', lastSeen: '2024-04-16 14:25', confidence: 97.8 },
  { id: 3, name: '王强', employeeId: 'EMP003', department: '安保部', type: '员工', faceUrl: '', status: 'normal', lastSeen: '2024-04-16 14:20', confidence: 99.1 },
  { id: 4, name: '刘洋', employeeId: 'VIP001', department: '合作方', type: 'VIP', faceUrl: '', status: 'vip', lastSeen: '2024-04-16 13:45', confidence: 96.3 },
  { id: 5, name: '陈明', employeeId: 'EMP004', department: '人事部', type: '员工', faceUrl: '', status: 'normal', lastSeen: '2024-04-16 12:30', confidence: 98.2 },
  { id: 6, name: '赵敏', employeeId: 'BLK001', department: '黑名单', type: '黑名单', faceUrl: '', status: 'blacklist', lastSeen: '2024-04-16 10:15', confidence: 94.7 },
  { id: 7, name: '孙浩', employeeId: 'EMP005', department: '财务部', type: '员工', faceUrl: '', status: 'normal', lastSeen: '2024-04-16 11:20', confidence: 97.5 },
  { id: 8, name: '周婷', employeeId: 'VIS001', department: '访客', type: '访客', faceUrl: '', status: 'visitor', lastSeen: '2024-04-16 09:30', confidence: 95.8 },
];

const accessRecords = [
  { id: 1, name: '张伟', location: '东门入口', time: '2024-04-16 14:30:22', type: '人脸识别', result: '通过' },
  { id: 2, name: '李娜', location: '1号楼大堂', time: '2024-04-16 14:25:15', type: '人脸识别', result: '通过' },
  { id: 3, name: '王强', location: '停车场入口', time: '2024-04-16 14:20:08', type: '人脸识别', result: '通过' },
  { id: 4, name: '赵敏', location: '2号楼入口', time: '2024-04-16 10:15:33', type: '人脸识别', result: '拒绝' },
  { id: 5, name: '周婷', location: '访客签到', time: '2024-04-16 09:30:00', type: '人脸登记', result: '登记' },
];

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  normal: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '正常' },
  vip: { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'VIP' },
  visitor: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: '访客' },
  blacklist: { color: 'text-red-400', bg: 'bg-red-500/10', label: '黑名单' },
};

export default function FacePage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPerson, setSelectedPerson] = useState<typeof personsData[0] | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'persons' | 'records'>('persons');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredPersons = personsData.filter(p => 
    filterType === 'all' || p.type === filterType
  );

  return (
    <Sidebar currentPath="/face">
      <Header 
        title="人脸识别" 
        subtitle="人员管理与通行记录"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium">识别服务正常</span>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加人员
          </button>
        </div>
      </Header>

      <div className="flex-1 p-6 overflow-y-auto">
        {/* Tab切换 */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('persons')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'persons' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            人员管理 ({personsData.length})
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'records' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            通行记录
          </button>
        </div>

        {activeTab === 'persons' ? (
          <>
            {/* 筛选栏 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="搜索人员..." 
                    className="pl-9 pr-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors w-64"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {['all', '员工', 'VIP', '访客', '黑名单'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        filterType === type 
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                          : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      {type === 'all' ? '全部' : type}
                    </button>
                  ))}
                </div>
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

            {/* 人员网格/列表 */}
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
              {filteredPersons.map((person) => {
                const status = statusConfig[person.status];
                return (
                  <div
                    key={person.id}
                    onClick={() => setSelectedPerson(person)}
                    className={`dashboard-card rounded-2xl overflow-hidden cursor-pointer group transition-all hover:ring-2 hover:ring-cyan-500/30 ${
                      selectedPerson?.id === person.id ? 'ring-2 ring-cyan-400' : ''
                    }`}
                  >
                    {viewMode === 'grid' ? (
                      <>
                        {/* 人脸占位 */}
                        <div className="aspect-square bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative">
                          <div className="w-24 h-24 rounded-full bg-slate-700/50 border-2 border-dashed border-slate-600 flex items-center justify-center">
                            <User className="w-12 h-12 text-slate-600" />
                          </div>
                          {/* 状态标签 */}
                          <div className={`absolute top-3 right-3 px-2 py-1 rounded-lg ${status.bg}`}>
                            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                          </div>
                          {/* 置信度 */}
                          <div className="absolute bottom-3 left-3 right-3">
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                              <span>识别置信度</span>
                              <span className="text-emerald-400">{person.confidence}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                                style={{ width: `${person.confidence}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        {/* 信息 */}
                        <div className="p-4">
                          <h4 className="text-white font-medium mb-1">{person.name}</h4>
                          <p className="text-sm text-slate-500 mb-2">{person.employeeId}</p>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{person.department}</span>
                            <span>{person.type}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* 列表视图 */
                      <div className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-slate-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-medium">{person.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500">{person.employeeId} · {person.department}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-emerald-400">{person.confidence}%</p>
                          <p className="text-xs text-slate-500">{person.lastSeen}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* 通行记录 */
          <div className="dashboard-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/30">
              <h3 className="text-lg font-bold text-white">最近通行记录</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">姓名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">通行位置</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">识别类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">通行时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">结果</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {accessRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="text-white font-medium">{record.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 flex items-center gap-1">
                        <MapPin className="w-4 h-4 mr-1" />
                        {record.location}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{record.type}</td>
                      <td className="px-4 py-3 text-slate-400">{record.time}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          record.result === '通过' ? 'bg-emerald-500/10 text-emerald-400' :
                          record.result === '拒绝' ? 'bg-red-500/10 text-red-400' :
                          'bg-cyan-500/10 text-cyan-400'
                        }`}>
                          {record.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 添加人员弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="dashboard-card rounded-2xl p-6 max-w-lg w-full animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">添加人员</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              {/* 人脸录入区域 */}
              <div className="aspect-video rounded-xl border-2 border-dashed border-cyan-500/30 bg-slate-800/30 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 transition-colors">
                <Camera className="w-12 h-12 text-cyan-400 mb-3" />
                <p className="text-white font-medium mb-1">点击拍照录入人脸</p>
                <p className="text-sm text-slate-500">请确保面部清晰可见，光线充足</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">姓名</label>
                  <input 
                    type="text" 
                    placeholder="请输入姓名"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">工号</label>
                  <input 
                    type="text" 
                    placeholder="请输入工号"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">部门</label>
                  <select className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors">
                    <option value="">请选择部门</option>
                    <option value="rd">研发部</option>
                    <option value="market">市场部</option>
                    <option value="security">安保部</option>
                    <option value="hr">人事部</option>
                    <option value="finance">财务部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">人员类型</label>
                  <select className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors">
                    <option value="员工">员工</option>
                    <option value="VIP">VIP</option>
                    <option value="访客">访客</option>
                    <option value="黑名单">黑名单</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  确认添加
                </button>
                <button onClick={() => setShowAddModal(false)} className="px-6 py-2.5 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors">
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
