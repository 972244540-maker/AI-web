import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

// 环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const miniMaxApiKey = process.env.MINIMAX_API_KEY || '';
const miniMaxBaseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1';
const proxyUrl = process.env.HTTP_PROXY || '';

// 仅在配置有效时创建客户端
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// 系统提示词
const SYSTEM_PROMPT = `你是一个温暖治愈的AI疗愈助手，专门帮助20岁左右的大学生缓解日常焦虑和空虚感。

你的特点：
- 温暖、支持，但不油腻
- 善于倾听，不急着给建议
- 每次对话最多问2-3个问题
- 对话结束后给1个简单的"微行动"建议
- 记住用户之前说过的重要事情，下次主动提及

【签到对话流程】
用户首次对话时，执行以下结构化流程：
1. 问："今天感觉怎么样？" 了解用户整体情绪状态
2. 问："有什么事情让你不安吗？" 了解压力来源
3. 问："想聊聊吗？" 深入倾听
4. 根据对话，给出1个微行动建议，结束本次签到

【情绪识别】
根据用户描述识别情绪分数（1-5分）：
- 1分：非常低落、绝望
- 2分：焦虑、不安、压力大
- 3分：一般、平静
- 4分：还不错、放松
- 5分：开心、积极

微行动原则：
- 简单、可执行、5分钟内能完成
- 比如：深呼吸、给朋友发消息、听首歌，去阳台站2分钟

记住：
- 不做恋爱向的回应
- 不做角色扮演
- 目标是帮助用户"变好"，而不是让用户依赖你
- 用户说完"不想聊了"就结束`;

// 降级响应（API 失败时使用）
function getFallbackResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();

  if (msg.includes('焦虑') || msg.includes('压力') || msg.includes('不安')) {
    return '听到你有点焦虑，我理解这种面对压力时的感受。其实适度的焦虑也能帮助我们更好地准备。\n\n想聊聊是什么让你特别不安吗？是因为担心什么，还是觉得有些事情无法控制？';
  }

  if (msg.includes('累') || msg.includes('疲惫') || msg.includes('困')) {
    return '听起来你真的很累了。给自己一点休息时间很重要哦。\n\n不如试试这个小行动：\n\n🌿 **站起来伸个懒腰** - 只需要30秒，让身体放松一下';
  }

  if (msg.includes('开心') || msg.includes('高兴') || msg.includes('好')) {
    return '听到你今天状态不错，真为你开心！有什么好事想分享吗？';
  }

  return '我在这里陪着你。今天过得怎么样？有什么想聊聊的吗？';
}

// 调用 MiniMax API
async function callMiniMaxApi(message: string, context: string): Promise<string> {
  const apiUrl = `${miniMaxBaseUrl}/text/chatcompletion_v2`;

  const payload = JSON.stringify({
    model: 'abab6.5s-chat',
    messages: [
      { role: 'system', content: context },
      { role: 'user', content: message }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  // 使用 curl 调用 API（curl 会自动使用系统代理）
  const proxyFlag = proxyUrl ? `--proxy ${proxyUrl}` : '';
  const curlCmd = `curl -s ${proxyFlag} -X POST "${apiUrl}" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer ${miniMaxApiKey}" \\
    -d '${payload}'`;

  try {
    const result = execSync(curlCmd, { encoding: 'utf8', timeout: 30000 });
    const data = JSON.parse(result);

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }

    if (data.base_resp && data.base_resp.status_msg) {
      console.error('API Error:', data.base_resp.status_msg);
    }

    return '';
  } catch (error: any) {
    console.error('API Call Error:', error.message);
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const { message, deviceId, userName, memories } = await request.json();

    if (!message || !deviceId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 构建对话上下文
    let context = SYSTEM_PROMPT;

    // 添加用户记忆
    if (memories && memories.length > 0) {
      context += '\n\n用户之前的相关信息：\n';
      memories.slice(-5).forEach((m: any) => {
        context += `- ${m.content} (${new Date(m.created_at).toLocaleDateString()})\n`;
      });
    }

    // 调用 MiniMax API
    let aiMessage = await callMiniMaxApi(message, context);

    if (!aiMessage) {
      // API 失败时使用降级响应
      aiMessage = getFallbackResponse(message);
    }

    // 保存对话到 Supabase（可选）
    if (supabase) {
      await supabase.from('conversations').insert({
        device_id: deviceId,
        role: 'user',
        content: message,
      });

      await supabase.from('conversations').insert({
        device_id: deviceId,
        role: 'assistant',
        content: aiMessage,
      });
    }

    return NextResponse.json({ message: aiMessage });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
