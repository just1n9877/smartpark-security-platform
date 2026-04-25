'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Sparkles, Copy, ThumbsUp,
  ThumbsDown, Clock, AlertTriangle, Shield, Camera,
  Map, Lightbulb
} from 'lucide-react';
import { Sidebar, Header } from '@/components/Sidebar';
import { sendAssistantMessage } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  likes?: number;
  suggestions?: string[];
}

// 快捷问题
const quickQuestions = [
  { icon: Shield, text: '今日安全态势如何？', color: 'cyan' },
  { icon: AlertTriangle, text: '有哪些待处理的告警？', color: 'amber' },
  { icon: Camera, text: '查看摄像头在线状态', color: 'emerald' },
  { icon: Map, text: '如何配置禁区和门口规则？', color: 'purple' },
];

// 建议操作
const suggestedActions = [
  '生成今日安全报告',
  '分析周界告警趋势',
  '检查设备运行状态',
  '优化识别算法参数',
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '您好！我是SmartGuard AI助手，可以帮您：\n\n• 查询系统运行状态和安全态势\n• 分析告警数据并提供处理建议\n• 调取摄像头画面和人员通行记录\n• 生成各类统计报告\n\n请问有什么可以帮您的？',
      timestamp: new Date(),
      suggestions: ['今日安全态势如何？', '有哪些待处理的告警？', '生成今日报告']
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageIdCounter = useRef(2);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `user-${messageIdCounter.current++}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await sendAssistantMessage(userMessage.content);
      const assistantMessage: Message = {
        id: `assistant-${messageIdCounter.current++}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        suggestions: response.suggestions,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: `assistant-${messageIdCounter.current++}`,
        role: 'assistant',
        content: e instanceof Error ? `助手接口调用失败：${e.message}` : '助手接口调用失败',
        timestamp: new Date(),
        suggestions: ['检查后端服务', '重新登录', '查看系统状态'],
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  };

  const handleQuickQuestion = (question: string) => {
    setInputValue(question);
    setTimeout(() => handleSend(), 100);
  };

  return (
    <Sidebar currentPath="/assistant">
      <Header 
        title="AI助手" 
        subtitle="智能安防问答与数据分析"
        statusBadge={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-medium">AI在线</span>
          </div>
        }
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* 头像 */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                message.role === 'assistant' 
                  ? 'bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30' 
                  : 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30'
              }`}>
                {message.role === 'assistant' ? (
                  <Bot className="w-5 h-5 text-cyan-400" />
                ) : (
                  <User className="w-5 h-5 text-purple-400" />
                )}
              </div>

              {/* 消息内容 */}
              <div className={`max-w-[70%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block p-4 rounded-2xl ${
                  message.role === 'assistant'
                    ? 'bg-slate-800/80 border border-slate-700/50 rounded-tl-sm'
                    : 'bg-cyan-500/20 border border-cyan-500/30 rounded-tr-sm'
                }`}>
                  <p className="text-white whitespace-pre-line text-sm leading-relaxed">
                    {message.content}
                  </p>
                </div>

                {/* 时间 */}
                <div className={`flex items-center gap-2 mt-1 text-xs text-slate-500 ${
                  message.role === 'user' ? 'justify-end' : ''
                }`}>
                  <Clock className="w-3 h-3" />
                  <span>{message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* 建议操作 */}
                {message.suggestions && message.role === 'assistant' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {/* 点赞/踩 */}
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2">
                    <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 正在输入指示器 */}
          {isTyping && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
                <Bot className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-tl-sm p-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-slate-400">AI正在思考...</span>
                </div>
              </div>
            </div>
          )}

          {/* 快捷问题（当没有消息或只有欢迎消息时显示） */}
          {messages.length === 1 && (
            <div className="mt-8">
              <p className="text-sm text-slate-500 mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                试试这样问我：
              </p>
              <div className="grid grid-cols-2 gap-3">
                {quickQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickQuestion(question.text)}
                    className={`p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-${question.color}-500/50 transition-all group text-left`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-${question.color}-500/10 border border-${question.color}-500/20 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <question.icon className={`w-5 h-5 text-${question.color}-400`} />
                      </div>
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{question.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-4 border-t border-slate-700/30 bg-slate-900/50">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="输入您的问题，按Enter发送..."
                className="w-full px-4 py-3 pr-24 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                rows={1}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                </button>
                <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="p-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-4">
                {suggestedActions.slice(0, 3).map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(action)}
                    className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-600">按 Enter 发送 · Shift+Enter 换行</span>
            </div>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
