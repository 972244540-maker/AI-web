import { NextResponse } from 'next/server';
import { saveEmotionRecord } from '@/lib/emotions';

export async function POST(request: Request) {
  try {
    const { deviceId, score, label, note } = await request.json();

    if (!deviceId || score === undefined || !label) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const record = await saveEmotionRecord(deviceId, score, label, note);

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('Save emotion error:', error);
    return NextResponse.json(
      { error: '保存失败' },
      { status: 500 }
    );
  }
}
