// 告警相关类型
export type AlertLevel = 'critical' | 'warning' | 'medium' | 'low';
export type AlertStatus = 'pending' | 'handling' | 'resolved' | 'falseAlarm';
export type AlertType = 
  | '入侵检测' 
  | '人脸识别' 
  | '聚集预警' 
  | '火焰检测' 
  | '异常行为' 
  | '区域入侵' 
  | '烟雾检测'
  | '周界入侵';

export interface AlertRecord {
  id: number;
  type: AlertType;
  level: AlertLevel;
  location: string;
  time: string;
  description: string;
  status: AlertStatus;
  source: string;
}

// 摄像头相关类型
export type CameraStatus = 'online' | 'warning' | 'offline';

export interface CameraRecord {
  id: number;
  name: string;
  location: string;
  status: CameraStatus;
  persons: number;
  area: string;
  fps?: number;
  resolution?: string;
}

// 统计数据类型
export interface StatData {
  id: number;
  label: string;
  value: number;
  total?: number;
  icon: React.ElementType;
  color: 'cyan' | 'amber' | 'emerald' | 'purple';
  trend?: string;
  suffix?: string;
}

// 导航项类型
export interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

// 图表数据类型
export interface ChartDataPoint {
  time: string;
  value: number;
  [key: string]: string | number;
}

// 用户信息类型
export interface UserInfo {
  id: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'operator' | 'viewer';
  department?: string;
}

// 系统指标类型
export interface SystemMetric {
  label: string;
  value: number;
  color: 'cyan' | 'emerald' | 'purple' | 'amber';
  unit?: string;
}

// AI 检测类型
export interface AIDetection {
  type: string;
  count: number;
  color: string;
}
