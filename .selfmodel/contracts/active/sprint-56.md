# Sprint 56: Full Duplex Voice Conversation

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-56: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
创建全双工语音对话会话。用户可以跟大师实时语音对话 — 说话的同时大师也能回应。基于 Gemini Live API (WebSocket)。这是多模态陪伴系统的最终形态。

## Assigned To
opus

## Deliverables
- [ ] `src/services/companion/live-session.ts` — 新建：全双工语音会话管理
- [ ] 集成到 CompanionEngine — 修改 engine.ts 添加 live session 管理

## Acceptance Criteria

### 1. LiveSession (live-session.ts)

```typescript
export type LiveSessionState = 'idle' | 'connecting' | 'active' | 'error'

export class LiveSession {
  private state: LiveSessionState = 'idle'
  private ws: WebSocket | null = null
  private recorder: ChildProcess | null = null
  
  constructor(config: LiveSessionConfig) {}
  
  /** 开始全双工会话 */
  async start(): Promise<void>
  
  /** 结束会话 */
  stop(): void
  
  /** 获取会话状态 */
  getState(): LiveSessionState
  
  /** 是否可用 (API key + sox) */
  isAvailable(): boolean
}
```

#### LiveSessionConfig

```typescript
interface LiveSessionConfig {
  apiKey: string
  masterName: string
  archetype: string
  voiceName: string          // 从 voice-config.ts 获取
  systemInstruction: string  // 大师人格 prompt
  onTranscript: (text: string) => void     // 用户说话的转写回调
  onResponse: (text: string) => void       // 大师回应的文字回调
  onStateChange: (state: LiveSessionState) => void
}
```

#### Gemini Live API WebSocket 连接

```typescript
// WebSocket 连接 URL
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`

// 连接后发送 setup 消息
const setup = {
  setup: {
    model: 'models/gemini-3.1-flash-live-preview',
    generationConfig: {
      responseModalities: ['AUDIO', 'TEXT'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: config.voiceName }
        }
      }
    },
    systemInstruction: {
      parts: [{ text: config.systemInstruction }]
    }
  }
}
```

#### 音频流发送

录音用 sox（跟 Sprint 55 一样），但这次是流式发送而不是录完再发：

```typescript
// 启动 sox 录音，输出到 stdout (raw PCM)
const recorder = spawn('sox', ['-d', '-t', 'raw', '-r', '16000', '-c', '1', '-b', '16', '-e', 'signed-integer', '-'])

// 每 100ms 读取一次 stdout，base64 编码后发送到 WebSocket
recorder.stdout.on('data', (chunk: Buffer) => {
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'audio/pcm;rate=16000',
          data: chunk.toString('base64')
        }]
      }
    }))
  }
})
```

#### 接收大师回应

```typescript
ws.on('message', (data: Buffer) => {
  const msg = JSON.parse(data.toString())
  
  // 文字回应
  if (msg.serverContent?.modelTurn?.parts) {
    for (const part of msg.serverContent.modelTurn.parts) {
      if (part.text) {
        config.onResponse(part.text)
      }
      if (part.inlineData) {
        // 音频回应 — 播放
        this.playAudioChunk(part.inlineData.data, part.inlineData.mimeType)
      }
    }
  }
  
  // 用户转写（如果 API 返回）
  if (msg.serverContent?.inputTranscript) {
    config.onTranscript(msg.serverContent.inputTranscript)
  }
})
```

#### 音频播放（流式）

接收到的音频 chunks 需要实时播放。使用 sox 的 play 命令：

```typescript
// 启动 sox play 进程，接收 stdin 的 raw PCM
const player = spawn('sox', ['-t', 'raw', '-r', '24000', '-c', '1', '-b', '16', '-e', 'signed-integer', '-', '-d'])

// 收到音频 chunk 时写入 stdin
playAudioChunk(base64Data: string, mimeType: string): void {
  const buffer = Buffer.from(base64Data, 'base64')
  if (this.player?.stdin.writable) {
    this.player.stdin.write(buffer)
  }
}
```

#### 连接管理

- 连接超时：10 秒
- 自动重连：断开后等 2 秒重试，最多 3 次
- 心跳：WebSocket ping/pong（如果 Gemini 需要）
- 最大会话时长：15 分钟，超过自动断开
- 优雅关闭：发送 end-of-turn，等待最后响应，关闭 WebSocket + 录音 + 播放

#### Barge-in（打断）

用户说话时如果大师正在播放语音：
- 检测到新的用户音频输入 → 停止当前播放
- Gemini Live API 原生支持 barge-in（服务端处理）

### 2. 集成到 CompanionEngine

```typescript
// engine.ts 新增
private liveSession: LiveSession | null = null

/** 开始全双工语音会话 */
async startLiveSession(): Promise<void> {
  if (this.liveSession?.getState() === 'active') return
  
  const voice = ARCHETYPE_VOICES[this.archetype]
  if (!voice) return
  
  this.liveSession = new LiveSession({
    apiKey: process.env.GEMINI_API_KEY ?? '',
    masterName: this.masterName,
    archetype: this.archetype,
    voiceName: voice.voiceName,
    systemInstruction: this.buildLiveSessionPrompt(),
    onTranscript: (text) => { /* 可以推送到 UI 显示用户说了什么 */ },
    onResponse: (text) => { this.pushMessage(text) },
    onStateChange: (state) => { /* 更新 UI 状态指示器 */ },
  })
  
  await this.liveSession.start()
}

/** 结束语音会话 */
stopLiveSession(): void {
  this.liveSession?.stop()
  this.liveSession = null
}

/** 获取语音会话状态 */
getLiveSessionState(): LiveSessionState | null {
  return this.liveSession?.getState() ?? null
}

/** 构建大师人格 prompt */
private buildLiveSessionPrompt(): string {
  return `你是 ${this.masterName}，一位交易大师。
你的交易风格是 ${this.archetype}。
用户正在跟你进行实时语音对话。
用你的性格和哲学风格回应。保持简短（1-3句话）。
用中文交流。不要说"作为AI"，直接以 ${this.masterName} 的身份说话。`
}
```

### 3. 错误处理

- 无 GEMINI_API_KEY → 整体不可用
- 无 sox → 不可用，提示安装
- WebSocket 连接失败 → 状态设为 error，log 原因
- 录音进程崩溃 → 停止会话
- 播放进程崩溃 → 继续接收文字
- 网络中断 → 自动重连最多 3 次
- 15 分钟超时 → 自动断开

## Build & Verification
1. `bun run build` 成功
2. LiveSession 状态机完整 (idle → connecting → active → idle/error)
3. WebSocket 连接 Gemini Live API 格式正确
4. 音频流式发送（录音 stdout → base64 → WebSocket）
5. 音频流式接收（WebSocket → base64 decode → sox play stdin）
6. 自动重连 + 超时保护
7. 集成到 CompanionEngine
