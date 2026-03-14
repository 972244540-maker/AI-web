import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 仅在配置有效时创建客户端
export const supabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// 本地存储键名
const STORAGE_KEYS = {
  conversations: 'ai-healer-conversations',
  memories: 'ai-healer-memories',
};

// 获取设备ID（如果没有则创建）
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  let deviceId = localStorage.getItem(STORAGE_KEYS.conversations + '-device');
  if (!deviceId) {
    deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem(STORAGE_KEYS.conversations + '-device', deviceId);
  }
  return deviceId;
}

// 获取用户记忆
export async function getMemories(deviceId: string) {
  // 优先使用 Supabase，否则使用本地存储
  if (supabase) {
    const { data } = await supabase
      .from('memories')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(10);
    return data || [];
  }

  // 本地存储降级
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEYS.memories);
  const allMemories = stored ? JSON.parse(stored) : [];
  return allMemories.filter((m: any) => m.device_id === deviceId).slice(0, 10);
}

// 保存记忆
export async function saveMemory(deviceId: string, content: string) {
  if (supabase) {
    const { data } = await supabase
      .from('memories')
      .insert({ device_id: deviceId, content })
      .select();
    return data;
  }

  // 本地存储降级
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEYS.memories);
  const memories = stored ? JSON.parse(stored) : [];
  const newMemory = {
    id: Date.now().toString(),
    device_id: deviceId,
    content,
    created_at: new Date().toISOString(),
  };
  memories.unshift(newMemory);
  localStorage.setItem(STORAGE_KEYS.memories, JSON.stringify(memories.slice(0, 10)));
  return [newMemory];
}

// 获取对话历史
export async function getConversations(deviceId: string, limit = 20) {
  if (supabase) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).reverse();
  }

  // 本地存储降级
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEYS.conversations);
  const allConversations = stored ? JSON.parse(stored) : [];
  const filtered = allConversations.filter((c: any) => c.device_id === deviceId);
  return filtered.slice(-limit).reverse();
}

// 保存对话
export async function saveConversation(deviceId: string, role: string, content: string) {
  if (supabase) {
    await supabase.from('conversations').insert({ device_id: deviceId, role, content });
    return;
  }

  // 本地存储降级
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem(STORAGE_KEYS.conversations);
  const conversations = stored ? JSON.parse(stored) : [];
  conversations.push({
    id: Date.now().toString(),
    device_id: deviceId,
    role,
    content,
    created_at: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
}
