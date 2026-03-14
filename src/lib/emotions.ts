import { supabase } from './supabase';

// 情绪记录类型
export interface EmotionRecord {
  id?: string;
  device_id: string;
  date: string; // YYYY-MM-DD
  score: number; // 1-5 分
  label: string; // 焦虑/平静/低落/开心/一般
  note?: string;
  created_at?: string;
}

// 本地存储键名
const STORAGE_KEYS = {
  emotions: 'ai-healer-emotions',
};

// 情绪标签映射
export const EMOTION_LABELS = {
  1: '低落',
  2: '焦虑',
  3: '一般',
  4: '平静',
  5: '开心',
};

// 获取今日日期字符串
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// 保存情绪记录
export async function saveEmotionRecord(
  deviceId: string,
  score: number,
  label: string,
  note?: string
): Promise<EmotionRecord | null> {
  const date = getTodayDate();

  if (supabase) {
    // 先检查今天是否已有记录，有则更新
    const { data: existing } = await supabase
      .from('emotion_records')
      .select('id')
      .eq('device_id', deviceId)
      .eq('date', date)
      .single();

    if (existing) {
      const { data } = await supabase
        .from('emotion_records')
        .update({ score, label, note })
        .eq('id', existing.id)
        .select()
        .single();
      return data;
    } else {
      const { data } = await supabase
        .from('emotion_records')
        .insert({ device_id: deviceId, date, score, label, note })
        .select()
        .single();
      return data;
    }
  }

  // 本地存储降级
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEYS.emotions);
  const records: EmotionRecord[] = stored ? JSON.parse(stored) : [];

  // 更新或添加今日记录
  const existingIndex = records.findIndex(r => r.date === date && r.device_id === deviceId);
  const newRecord: EmotionRecord = {
    id: Date.now().toString(),
    device_id: deviceId,
    date,
    score,
    label,
    note,
    created_at: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    records[existingIndex] = newRecord;
  } else {
    records.push(newRecord);
  }

  localStorage.setItem(STORAGE_KEYS.emotions, JSON.stringify(records));
  return newRecord;
}

// 获取最近N天的情绪记录
export async function getEmotionRecords(deviceId: string, days: number = 7): Promise<EmotionRecord[]> {
  if (supabase) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data } = await supabase
      .from('emotion_records')
      .select('*')
      .eq('device_id', deviceId)
      .gte('date', startDateStr)
      .order('date', { ascending: true });

    return data || [];
  }

  // 本地存储降级
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEYS.emotions);
  const allRecords: EmotionRecord[] = stored ? JSON.parse(stored) : [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  return allRecords
    .filter(r => r.device_id === deviceId && r.date >= startDateStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 获取今日情绪
export async function getTodayEmotion(deviceId: string): Promise<EmotionRecord | null> {
  const today = getTodayDate();

  if (supabase) {
    const { data } = await supabase
      .from('emotion_records')
      .select('*')
      .eq('device_id', deviceId)
      .eq('date', today)
      .single();

    return data || null;
  }

  // 本地存储降级
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEYS.emotions);
  const records: EmotionRecord[] = stored ? JSON.parse(stored) : [];

  return records.find(r => r.device_id === deviceId && r.date === today) || null;
}
