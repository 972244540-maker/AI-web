'use client';

import { useState, useEffect, useRef } from 'react';
import { getDeviceId, getMemories, getConversations, saveMemory, saveConversation } from '@/lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [memories, setMemories] = useState<any[]>([]);
  const [showMicroAction, setShowMicroAction] = useState(true); // 模拟：显示微行动卡片
  const [microActionDone, setMicroActionDone] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const deviceId = useRef('');

  // 初始化 - 加载真实数据
  useEffect(() => {
    deviceId.current = getDeviceId();
    loadHistory();
  }, []);

  // 恢复真实API调用
  // 加载历史
  async function loadHistory() {
    const [conversationHistory, userMemories] = await Promise.all([
      getConversations(deviceId.current),
      getMemories(deviceId.current),
    ]);

    setMemories(userMemories);

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
    saveConversation(deviceId.current, 'user', userMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          deviceId: deviceId.current,
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
        saveConversation(deviceId.current, 'assistant', data.message);
      } else if (data.error) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '抱歉，我现在有点累了，我们下次再聊吧。',
        }]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // 保存重要记忆
  async function handleSaveMemory() {
    const content = prompt('记录一件重要的事情（AI会记住）：');
    if (content) {
      await saveMemory(deviceId.current, content);
      const newMemories = await getMemories(deviceId.current);
      setMemories(newMemories);
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
        <div className="flex items-center justify-center gap-2">
          <span className="text-xl">🌿</span>
          <span className="font-semibold text-[#3D3D3D]">AI 疗愈助手</span>
        </div>
      </header>

      {/* Chat Container */}
      <main
        ref={chatRef}
        className="max-w-2xl mx-auto px-5 py-4 pb-32 overflow-y-auto"
        style={{ minHeight: 'calc(100vh - 140px)' }}
      >
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

        {/* 微行动卡片 - Mock UI */}
        {showMicroAction && messages.length > 0 && (
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
                  onClick={() => setMicroActionDone(true)}
                  className="flex-1 bg-[#C4A77D] text-white py-2.5 px-4 rounded-full text-sm font-medium hover:bg-[#B39568] transition-colors"
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

        {/* 记忆展示 - Mock UI */}
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
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FAF8F5] border-t border-black/5 px-5 py-4">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <button
            onClick={handleSaveMemory}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-lg hover:bg-[#E8DFD0] transition-colors"
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
            className="w-12 h-12 rounded-full bg-[#C4A77D] text-white flex items-center justify-center hover:bg-[#B39568] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

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
