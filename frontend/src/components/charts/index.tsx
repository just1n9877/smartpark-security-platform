'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
} from 'recharts';

// 颜色配置
const CHART_COLORS = {
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
};

// 通用图表Tooltip
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-slate-800/95 backdrop-blur-sm border border-cyan-500/20 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

// 面积图组件
interface AreaChartComponentProps {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  xAxisKey: string;
  color?: keyof typeof CHART_COLORS;
  gradient?: boolean;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  animated?: boolean;
}

export function AreaChartComponent({
  data,
  dataKey,
  xAxisKey,
  color = 'cyan',
  gradient = true,
  height = 300,
  showGrid = true,
  showTooltip = true,
  animated = true,
}: AreaChartComponentProps) {
  const colorValue = CHART_COLORS[color];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {gradient && (
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colorValue} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colorValue} stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
        )}
        <XAxis 
          dataKey={xAxisKey} 
          stroke="#64748b" 
          fontSize={12}
          tickLine={false}
          axisLine={{ stroke: 'rgba(100, 116, 139, 0.2)' }}
        />
        <YAxis 
          stroke="#64748b" 
          fontSize={12}
          tickLine={false}
          axisLine={{ stroke: 'rgba(100, 116, 139, 0.2)' }}
        />
        {showTooltip && <Tooltip content={<ChartTooltip />} />}
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={colorValue}
          strokeWidth={2}
          fill={gradient ? `url(#gradient-${color})` : colorValue}
          animationDuration={animated ? 1000 : 0}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// 饼图组件
interface PieChartComponentProps {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

export function PieChartComponent({
  data,
  height = 300,
  showLegend = true,
  showTooltip = true,
  innerRadius = 60,
  outerRadius = 100,
}: PieChartComponentProps) {
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={height}>
        <PieChart>
          {showTooltip && <Tooltip content={<ChartTooltip />} />}
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {showLegend && (
        <div className="flex-1 space-y-2">
          {data.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <span 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-slate-300 truncate">{entry.name}</span>
              <span className="text-sm text-slate-500 ml-auto">{entry.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 柱状图组件
interface BarChartComponentProps {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  xAxisKey: string;
  color?: keyof typeof CHART_COLORS;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  horizontal?: boolean;
}

export function BarChartComponent({
  data,
  dataKey,
  xAxisKey,
  color = 'cyan',
  height = 300,
  showGrid = true,
  showTooltip = true,
  horizontal = false,
}: BarChartComponentProps) {
  const colorValue = CHART_COLORS[color];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart 
        data={data} 
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
        )}
        {horizontal ? (
          <>
            <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} />
            <YAxis type="category" dataKey={xAxisKey} stroke="#64748b" fontSize={12} tickLine={false} width={60} />
          </>
        ) : (
          <>
            <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={12} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
          </>
        )}
        {showTooltip && <Tooltip content={<ChartTooltip />} />}
        <Bar 
          dataKey={dataKey} 
          fill={colorValue} 
          radius={[4, 4, 0, 0]}
          animationDuration={800}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 折线图组件
interface LineChartComponentProps {
  data: Array<Record<string, string | number>>;
  lines: Array<{
    dataKey: string;
    name: string;
    color: keyof typeof CHART_COLORS;
  }>;
  xAxisKey: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showDots?: boolean;
}

export function LineChartComponent({
  data,
  lines,
  xAxisKey,
  height = 300,
  showGrid = true,
  showTooltip = true,
  showDots = true,
}: LineChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
        )}
        <XAxis 
          dataKey={xAxisKey} 
          stroke="#64748b" 
          fontSize={12}
          tickLine={false}
        />
        <YAxis 
          stroke="#64748b" 
          fontSize={12}
          tickLine={false}
        />
        {showTooltip && <Tooltip content={<ChartTooltip />} />}
        {lines.map((line, index) => (
          <Line
            key={index}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={CHART_COLORS[line.color]}
            strokeWidth={2}
            dot={showDots ? { fill: CHART_COLORS[line.color], strokeWidth: 0, r: 3 } : false}
            activeDot={{ r: 5, strokeWidth: 0 }}
            animationDuration={1000}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// 实时数据图表 (带自动更新)
interface LiveChartProps {
  data: Array<{ time: string; value: number }>;
  maxPoints?: number;
  interval?: number;
  color?: keyof typeof CHART_COLORS;
  height?: number;
  label?: string;
}

export function LiveChart({
  maxPoints = 20,
  interval = 3000,
  color = 'cyan',
  height = 200,
  label = '实时数据',
}: LiveChartProps) {
  const [data, setData] = useState<Array<{ time: string; value: number }>>(() => {
    // 初始化数据
    const initial = [];
    const now = Date.now();
    for (let i = maxPoints - 1; i >= 0; i--) {
      initial.push({
        time: new Date(now - i * interval).toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        }),
        value: Math.floor(Math.random() * 50) + 30,
      });
    }
    return initial;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setData(prev => {
        const newPoint = {
          time: new Date().toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          }),
          value: Math.floor(Math.random() * 50) + 30,
        };
        return [...prev.slice(-(maxPoints - 1)), newPoint];
      });
    }, interval);

    return () => clearInterval(timer);
  }, [interval, maxPoints]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-500">实时</span>
        </div>
      </div>
      <AreaChartComponent
        data={data}
        dataKey="value"
        xAxisKey="time"
        color={color}
        height={height}
        showGrid={false}
      />
    </div>
  );
}
