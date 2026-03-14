'use client';

import { useState, useEffect, useRef } from 'react';
import { getDeviceId, getMemories, getConversations, saveMemory, saveConversation } from '@/lib/supabase';
import { getEmotionRecords, getTodayEmotion, EMOTION_LABELS, EmotionRecord } from '@/lib/emotions';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

// 情绪颜色
function getEmotionColor(score: number): string {
  switch (score) {
    case 1: return '#EF4444'; // 低落-红
    case 2: return '#F97316'; // 焦虑-橙
    case 3: return '#EAB308'; // 一般-黄
    case 4: return '#22C55E'; // 平静-绿
    case 5: return '#10B981'; // 开心-深绿
    default: return '#EAB308';
  }
}

// 情绪曲线组件
function EmotionCurve({ records }: { records: EmotionRecord[] }) {
  if (records.length === 0) return null;

  const days = 7;
  const width = 280;
  const height = 80;
  const padding = 20;

  // 生成最近7天的数据
  const today = new Date();
  const dateLabels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dateLabels.push(d.toISOString().split('T')[0]);
  }

  const dataMap = new Map(records.map(r => [r.date, r.score]));
  const points: number[] = dateLabels.map(date => dataMap.get(date) || 0);

  // 计算SVG路径
  const stepX = (width - padding * 2) / (days - 1);
  const yScale = (height - padding * 2) / 4;

  let pathD = '';
  let filledD = '';
  let firstPoint = true;

  points.forEach((score, i) => {
    if (score > 0) {
      const x = padding + i * stepX;
      const y = height - padding - (score - 1) * yScale;

      if (firstPoint) {
        pathD = `M ${x} ${y}`;
        filledD = `M ${x} ${height - padding} L ${x} ${y}`;
        firstPoint = false;
      } else {
        pathD += ` L ${x} ${y}`;
        filledD += ` L ${x} ${y}`;
      }
    }
  });

  return (
    <div className="mt-4 p-4 bg-white rounded-xl shadow-sm">
      <div className="text-xs text-[#9B9B9B] mb-2">情绪曲线</div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* 背景线 */}
        {[1, 2, 3, 4, 5].map(i => (
          <line
            key={i}
            x1={padding}
            y1={height - padding - (i - 1) * yScale}
            x2={width - padding}
            y2={height - padding - (i - 1) * yScale}
            stroke="#E5E5E5"
            strokeWidth="1"
          />
        ))}
        {/* 数据线 */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#C4A77D"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* 数据点 */}
        {points.map((score, i) => {
          if (score === 0) return null;
          const x = padding + i * stepX;
          const y = height - padding - (score - 1) * yScale;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill={getEmotionColor(score)}
            />
          );
        })}
      </svg>
      <div className="flex justify-between mt-1">
        {dateLabels.map((d, i) => (
          <span key={i} className="text-[10px] text-[#9B9B9B]">
            {i === days - 1 ? '今天' : `${d.slice(5)}`}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [memories, setMemories] = useState<any[]>([]);
  const [emotionRecords, setEmotionRecords] = useState<EmotionRecord[]>([]);
  const [todayEmotion, setTodayEmotion] = useState<EmotionRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'curve' | 'records'>('chat'); // 标签页状态
  const [showMicroAction, setShowMicroAction] = useState(true); // 模拟：显示微行动卡片
  const [microActionDone, setMicroActionDone] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const deviceIdRef = useRef('');

  // 初始化 - 加载真实数据
  useEffect(() => {
    deviceIdRef.current = getDeviceId();
    setIsReady(true);
  }, []);

  // 加载历史数据
  useEffect(() => {
    if (isReady) {
      loadHistory();
    }
  }, [isReady]);

  // 恢复真实API调用
  // 加载历史
  async function loadHistory() {
    const [conversationHistory, userMemories, emotions, today] = await Promise.all([
      getConversations(deviceIdRef.current),
      getMemories(deviceIdRef.current),
      getEmotionRecords(deviceIdRef.current),
      getTodayEmotion(deviceIdRef.current),
    ]);

    setMemories(userMemories);
    setEmotionRecords(emotions);
    setTodayEmotion(today);

    if (conversationHistory.length > 0) {
      setMessages(conversationHistory);
    } else {
      // 首次欢迎语
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '嗨，欢迎回来。今天过得怎么样？有什么想聊聊的吗？',
      }]);
    }
  }

  // 发送消息
  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // 添加用户消息
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    }]);

    // 保存用户消息到本地
    saveConversation(deviceIdRef.current, 'user', userMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          deviceId: deviceIdRef.current,
          memories,
        }),
      });

      const data = await response.json();

      if (data.message) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
        }]);
        // 保存AI回复到本地
        saveConversation(deviceIdRef.current, 'assistant', data.message);
      } else if (data.error) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '抱歉，我现在有点累了，我们下次再聊吧。',
        }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '发送失败，请检查网络后重试',
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  // 保存重要记忆
  async function handleSaveMemory() {
    const content = prompt('记录一件重要的事情（AI会记住）：');
    if (content) {
      try {
        await saveMemory(deviceIdRef.current, content);
        const newMemories = await getMemories(deviceIdRef.current);
        setMemories(newMemories);
      } catch (err) {
        console.error('Error saving memory:', err);
        alert('保存失败，请重试');
      }
    }
  }

  // 键盘提交
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <header className="sticky top-0 bg-[#FAF8F5]/80 backdrop-blur-sm z-10 px-6 py-4 text-center border-b border-black/5">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-xl">🌿</span>
          <span className="font-semibold text-[#3D3D3D]">AI 疗愈助手</span>
          {/* 今日情绪状态 */}
          {todayEmotion && (
            <button
              onClick={() => setActiveTab('curve')}
              className="ml-2 text-sm px-2 py-1 rounded-full bg-white shadow-sm hover:shadow transition-shadow"
              style={{ color: getEmotionColor(todayEmotion.score) }}
            >
              {todayEmotion.score === 1 ? '😢' : todayEmotion.score === 2 ? '😰' : todayEmotion.score === 3 ? '😐' : todayEmotion.score === 4 ? '😊' : '😄'}
            </button>
          )}
        </div>
        {/* 标签导航 */}
        <div className="flex justify-center gap-1 bg-white rounded-full p-1 shadow-sm max-w-xs mx-auto">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-1.5 px-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              activeTab === 'chat' ? 'bg-[#C4A77D] text-white' : 'text-[#6B6358] hover:bg-gray-50'
            }`}
          >
            💬 聊天
          </button>
          <button
            onClick={() => setActiveTab('curve')}
            className={`flex-1 py-1.5 px-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              activeTab === 'curve' ? 'bg-[#C4A77D] text-white' : 'text-[#6B6358] hover:bg-gray-50'
            }`}
          >
            📈 曲线
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`flex-1 py-1.5 px-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              activeTab === 'records' ? 'bg-[#C4A77D] text-white' : 'text-[#6B6358] hover:bg-gray-50'
            }`}
          >
            📝 记录
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        ref={chatRef}
        className="max-w-2xl mx-auto px-5 py-4 overflow-y-auto"
        style={{ minHeight: 'calc(100vh - 200px)', paddingBottom: activeTab === 'chat' ? '120px' : '20px' }}
      >
        {/* 聊天标签页 */}
        {activeTab === 'chat' && (
          <>
            <div className="text-center text-xs text-[#9B9B9B] mt-4 mb-8">
              今天 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`flex gap-3 mb-5 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fadeIn`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${
                    msg.role === 'user'
                      ? 'bg-[#C4A77D] text-white'
                      : 'bg-[#E8DFD0]'
                  }`}
                >
                  {msg.role === 'user' ? '👤' : '🌿'}
                </div>
                <div
                  className={`max-w-[75%] px-5 py-4 rounded-[20px] text-[15px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#C4A77D] text-white rounded-tr-[6px]'
                      : 'bg-white text-[#3D3D3D] rounded-tl-[6px] shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 mb-5">
                <div className="w-9 h-9 rounded-full bg-[#E8DFD0] flex items-center justify-center text-base">
                  🌿
                </div>
                <div className="bg-white px-5 py-4 rounded-[20px] rounded-tl-[6px] shadow-sm">
                  <span className="inline-block w-2 h-2 bg-[#9B9B9B] rounded-full mr-1 animate-pulse" style={{ animationDelay: '0ms' }}></span>
                  <span className="inline-block w-2 h-2 bg-[#9B9B9B] rounded-full mr-1 animate-pulse" style={{ animationDelay: '150ms' }}></span>
                  <span className="inline-block w-2 h-2 bg-[#9B9B9B] rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}

            {/* 微行动卡片 */}
            {showMicroAction && messages.length > 0 && !microActionDone && (
              <div className="mb-6 animate-fadeIn">
                <div className="bg-gradient-to-r from-[#E8DFD0] to-[#F5F0E8] rounded-2xl p-5 shadow-sm border border-[#D4C4B0]/30">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🌿</span>
                    <span className="font-medium text-[#5D5347]">今日微行动</span>
                  </div>
                  <p className="text-[#6B6358] text-[15px] leading-relaxed mb-4">
                    去阳台深呼吸3次 - 只需要2分钟，暂时离开书本，让大脑休息一下
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setMicroActionDone(true);
                        alert('太棒了！🌟 你迈出了自我关爱的一大步！记得照顾好自己哦～');
                      }}
                      className="flex-1 bg-[#C4A77D] text-white py-2.5 px-4 rounded-full text-sm font-medium hover:bg-[#B39568] transition-colors active:scale-95"
                    >
                      做了，感觉好多了
                    </button>
                    <button
                      onClick={() => setShowMicroAction(false)}
                      className="flex-1 bg-white text-[#6B6358] py-2.5 px-4 rounded-full text-sm font-medium hover:bg-[#F5F0E8] transition-colors"
                    >
                      稍后做
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 记忆展示 */}
            {memories.length > 0 && (
              <div className="mt-8 pt-6 border-t border-black/5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">💭</span>
                  <span className="text-xs text-[#9B9B9B]">我记住的</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {memories.map((m) => (
                    <span
                      key={m.id}
                      className="text-xs bg-white text-[#6B6358] px-3 py-1.5 rounded-full shadow-sm"
                    >
                      {m.content}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 情绪曲线标签页 */}
        {activeTab === 'curve' && (
          <div className="mt-4">
            <div className="p-5 bg-white rounded-2xl shadow-sm">
              <h2 className="text-lg font-medium text-[#3D3D3D] mb-4">情绪趋势</h2>
              {emotionRecords.length > 0 ? (
                <EmotionCurve records={emotionRecords} />
              ) : (
                <div className="text-center py-8 text-[#9B9B9B]">
                  <span className="text-4xl mb-3 block">📊</span>
                  <p>还没有情绪记录</p>
                  <p className="text-sm mt-1">记录你的情绪，了解自己的心情变化</p>
                </div>
              )}
            </div>

            {/* 快速记录情绪 */}
            <div className="mt-4 p-4 bg-white rounded-xl shadow-sm">
              <div className="text-xs text-[#9B9B9B] mb-3">记录今天的情绪</div>
              <div className="flex justify-between gap-2">
                {[
                  { score: 1, label: '低落', emoji: '😢', color: '#EF4444' },
                  { score: 2, label: '焦虑', emoji: '😰', color: '#F97316' },
                  { score: 3, label: '一般', emoji: '😐', color: '#EAB308' },
                  { score: 4, label: '平静', emoji: '😊', color: '#22C55E' },
                  { score: 5, label: '开心', emoji: '😄', color: '#10B981' },
                ].map((e) => (
                  <button
                    key={e.score}
                    onClick={async () => {
                      try {
                        await fetch('/api/emotion', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            deviceId: deviceIdRef.current,
                            score: e.score,
                            label: e.label,
                          }),
                        });
                        const records = await getEmotionRecords(deviceIdRef.current);
                        setEmotionRecords(records);
                      } catch (err) {
                        console.error('Error:', err);
                      }
                    }}
                    className="flex-1 py-3 px-1 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors active:bg-gray-200"
                  >
                    <div className="text-xl">{e.emoji}</div>
                    <div className="text-[10px] text-gray-500 mt-1">{e.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 情绪统计 */}
            {emotionRecords.length > 0 && (
              <div className="mt-4 p-5 bg-white rounded-2xl shadow-sm">
                <h3 className="text-sm font-medium text-[#3D3D3D] mb-3">本周统计</h3>
                <div className="flex justify-around text-center">
                  <div>
                    <div className="text-2xl font-semibold text-[#C4A77D]">{emotionRecords.length}</div>
                    <div className="text-xs text-[#9B9B9B]">记录次数</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-[#C4A77D]">
                      {emotionRecords.length > 0
                        ? (emotionRecords.reduce((sum, r) => sum + r.score, 0) / emotionRecords.length).toFixed(1)
                        : '-'}
                    </div>
                    <div className="text-xs text-[#9B9B9B]">平均分数</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-[#C4A77D]">
                      {emotionRecords.length > 0
                        ? EMOTION_LABELS[emotionRecords[emotionRecords.length - 1].score as keyof typeof EMOTION_LABELS]
                        : '-'}
                    </div>
                    <div className="text-xs text-[#9B9B9B]">今日情绪</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 情绪记录标签页 */}
        {activeTab === 'records' && (
          <div className="mt-4">
            <div className="p-5 bg-white rounded-2xl shadow-sm">
              <h2 className="text-lg font-medium text-[#3D3D3D] mb-4">情绪记录</h2>
              {emotionRecords.length > 0 ? (
                <div className="space-y-3">
                  {[...emotionRecords].reverse().map((record, index) => (
                    <div
                      key={record.id || index}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                        style={{ backgroundColor: getEmotionColor(record.score) + '20' }}
                      >
                        {record.score === 1 ? '😢' : record.score === 2 ? '😰' : record.score === 3 ? '😐' : record.score === 4 ? '😊' : '😄'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[#3D3D3D]">
                          {EMOTION_LABELS[record.score as keyof typeof EMOTION_LABELS]}
                        </div>
                        <div className="text-xs text-[#9B9B9B]">
                          {new Date(record.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: getEmotionColor(record.score) + '20', color: getEmotionColor(record.score) }}
                      >
                        {record.score}分
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[#9B9B9B]">
                  <span className="text-4xl mb-3 block">📝</span>
                  <p>还没有情绪记录</p>
                  <p className="text-sm mt-1">点击"情绪曲线"标签记录今天的情绪</p>
                </div>
              )}
            </div>

            {/* 快速记录 */}
            <div className="mt-4 p-4 bg-white rounded-xl shadow-sm">
              <div className="text-xs text-[#9B9B9B] mb-3">快速记录</div>
              <div className="flex justify-between gap-2">
                {[
                  { score: 1, label: '低落', emoji: '😢' },
                  { score: 2, label: '焦虑', emoji: '😰' },
                  { score: 3, label: '一般', emoji: '😐' },
                  { score: 4, label: '平静', emoji: '😊' },
                  { score: 5, label: '开心', emoji: '😄' },
                ].map((e) => (
                  <button
                    key={e.score}
                    onClick={async () => {
                      try {
                        await fetch('/api/emotion', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            deviceId: deviceIdRef.current,
                            score: e.score,
                            label: e.label,
                          }),
                        });
                        const records = await getEmotionRecords(deviceIdRef.current);
                        setEmotionRecords(records);
                      } catch (err) {
                        console.error('Error:', err);
                      }
                    }}
                    className="flex-1 py-2 px-1 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors active:bg-gray-200"
                  >
                    <div className="text-lg">{e.emoji}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Input Area - Only show on chat tab */}
      {activeTab === 'chat' && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#FAF8F5] border-t border-black/5 px-5 py-4">
          {/* 快速情绪记录 */}
          <div className="max-w-2xl mx-auto mb-3 flex justify-center gap-2">
            {[
              { score: 1, emoji: '😢' },
              { score: 2, emoji: '😰' },
              { score: 3, emoji: '😐' },
              { score: 4, emoji: '😊' },
              { score: 5, emoji: '😄' },
            ].map((e) => (
              <button
                key={e.score}
                onClick={async () => {
                  try {
                    const labels = ['', '低落', '焦虑', '一般', '平静', '开心'];
                    await fetch('/api/emotion', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        deviceId: deviceIdRef.current,
                        score: e.score,
                        label: labels[e.score],
                      }),
                    });
                    const [records, today] = await Promise.all([
                      getEmotionRecords(deviceIdRef.current),
                      getTodayEmotion(deviceIdRef.current),
                    ]);
                    setEmotionRecords(records);
                    setTodayEmotion(today);
                  } catch (err) {
                    console.error('Error recording emotion:', err);
                    alert('记录失败，请重试');
                  }
                }}
                className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-lg hover:scale-110 transition-transform active:scale-90"
                title={`记录${['', '低落', '焦虑', '一般', '平静', '开心'][e.score]}`}
              >
                {e.emoji}
              </button>
            ))}
          </div>
          <div className="max-w-2xl mx-auto flex gap-3 items-end">
            <button
              onClick={handleSaveMemory}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-lg hover:bg-[#E8DFD0] transition-colors active:scale-95"
              title="记录重要事情"
            >
              💾
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="今天感觉怎么样？"
              rows={1}
              className="flex-1 bg-white border-none rounded-3xl px-5 py-3 text-[15px] resize-none outline-none shadow-sm max-h-32"
              style={{ height: 'auto' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="w-12 h-12 rounded-full bg-[#C4A77D] text-white flex items-center justify-center hover:bg-[#B39568] transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease;
        }
      `}</style>
    </div>
  );
}
