# Sprint 54: TTS — Master Voice Output

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-54: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
让交易大师有声音。使用 Gemini 2.5 Pro Preview TTS API，每个 archetype 分配独特的声音风格。大师的文字消息可以同时用语音朗读出来。

## Assigned To
opus

## Deliverables
- [ ] `src/services/companion/tts.ts` — 新建：TTS 服务，Gemini TTS API 集成
- [ ] `src/services/companion/voice-config.ts` — 新建：9 archetype → 声音映射配置
- [ ] 集成到 CompanionEngine — 修改 engine.ts，消息推送时可选语音输出

## Acceptance Criteria

### 1. Voice Config (voice-config.ts)

9 个 archetype 到 Gemini TTS 声音的映射：

```typescript
export interface VoiceProfile {
  voiceName: string        // Gemini 预置声音名
  stylePrompt: string      // 自然语言风格指令
  speakingRate: number     // 0.5-2.0, 默认 1.0
  language: string         // 'zh-CN' 或 'en-US'
}

export const ARCHETYPE_VOICES: Record<string, VoiceProfile> = {
  value_investor: {
    voiceName: 'Sulafat',      // 温暖、稳重
    stylePrompt: 'Speak warmly like a wise grandfather sharing life lessons. Slow, measured pace.',
    speakingRate: 0.9,
    language: 'zh-CN',
  },
  trend_follower: {
    voiceName: 'Kore',         // 坚定、果断
    stylePrompt: 'Speak firmly and decisively, like a trader calling out positions on the floor.',
    speakingRate: 1.1,
    language: 'zh-CN',
  },
  macro_trader: {
    voiceName: 'Charon',       // 沉稳、知性
    stylePrompt: 'Speak with gravitas, like a central banker delivering a policy statement.',
    speakingRate: 0.95,
    language: 'zh-CN',
  },
  quant: {
    voiceName: 'Enceladus',    // 精确、冷静
    stylePrompt: 'Speak precisely and calmly, like a mathematician presenting a proof.',
    speakingRate: 1.0,
    language: 'zh-CN',
  },
  strategist: {
    voiceName: 'Fenrir',       // 威严、指挥
    stylePrompt: 'Speak with commanding authority, like a general briefing before battle.',
    speakingRate: 0.9,
    language: 'zh-CN',
  },
  philosopher: {
    voiceName: 'Aoede',        // 沉思、深远
    stylePrompt: 'Speak contemplatively, with pauses for reflection, like a philosopher in dialogue.',
    speakingRate: 0.85,
    language: 'zh-CN',
  },
  first_principles: {
    voiceName: 'Puck',         // 活力、清晰
    stylePrompt: 'Speak with energetic clarity, like a tech founder pitching the future.',
    speakingRate: 1.15,
    language: 'zh-CN',
  },
  crypto_native: {
    voiceName: 'Leda',         // 神秘、低沉
    stylePrompt: 'Speak with mysterious undertones, like someone who knows secrets about the future of money.',
    speakingRate: 1.0,
    language: 'zh-CN',
  },
  scientist: {
    voiceName: 'Orbit',        // 精确、好奇
    stylePrompt: 'Speak with precise curiosity, like a scientist explaining a discovery.',
    speakingRate: 1.0,
    language: 'zh-CN',
  },
}
```

注意：Gemini TTS 预置声音名称可能需要验证。如果某些名称不可用，使用 fallback。查阅 Gemini TTS 文档中实际可用的声音列表。已知可用的包括：Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr 等。

### 2. TTS Service (tts.ts)

```typescript
export class TTSService {
  private apiKey: string
  private model: string = 'gemini-2.5-flash-preview-tts'
  
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY ?? ''
  }
  
  /** 是否可用 */
  isAvailable(): boolean { return this.apiKey.length > 0 }
  
  /** 将文本转为语音并播放 */
  async speak(text: string, voice: VoiceProfile): Promise<void>
  
  /** 停止当前播放 */
  stop(): void
}
```

#### Gemini TTS API 调用

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={API_KEY}

Body:
{
  "contents": [{
    "parts": [{ "text": "{stylePrompt}\n\n{text}" }]
  }],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": {
          "voiceName": "{voiceName}"
        }
      }
    }
  }
}
```

响应解析：
```typescript
// response.candidates[0].content.parts[0].inlineData.data → base64 PCM audio
// response.candidates[0].content.parts[0].inlineData.mimeType → "audio/pcm" 或 "audio/wav"
```

#### 音频播放

解码 base64 → 写入临时 WAV 文件 → 用系统命令播放：

```typescript
// macOS
import { spawn } from 'child_process'

async playAudio(audioBase64: string): Promise<void> {
  const tmpFile = `/tmp/vibe-tts-${Date.now()}.wav`
  // 写入 WAV 文件（如果返回的是 raw PCM，需要加 WAV header）
  await Bun.write(tmpFile, Buffer.from(audioBase64, 'base64'))
  
  // 播放
  const player = spawn('afplay', [tmpFile])
  this.currentPlayer = player
  
  player.on('close', () => {
    // 清理临时文件
    try { require('fs').unlinkSync(tmpFile) } catch {}
  })
}

stop(): void {
  if (this.currentPlayer) {
    this.currentPlayer.kill()
    this.currentPlayer = null
  }
}
```

非 macOS fallback：检测平台，Linux 用 `aplay`，Windows 用 `powershell -c (New-Object Media.SoundPlayer ...)。如果都不可用，静默跳过。

#### WAV Header 构造

如果 Gemini 返回 raw PCM (24kHz, 16-bit, mono)，需要手动加 WAV header：

```typescript
function createWavBuffer(pcmData: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44)
  const dataSize = pcmData.length
  const fileSize = dataSize + 36
  
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)           // fmt chunk size
  header.writeUInt16LE(1, 20)            // PCM format
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28)
  header.writeUInt16LE(channels * bitsPerSample / 8, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  
  return Buffer.concat([header, pcmData])
}
```

### 3. 集成到 CompanionEngine

在 engine.ts 中：

```typescript
import { TTSService } from './tts.js'
import { ARCHETYPE_VOICES } from './voice-config.js'

// 在 CompanionEngine 中添加：
private readonly tts: TTSService
private ttsEnabled: boolean = true

constructor(...) {
  // ...existing...
  this.tts = new TTSService()
}

// deliverMessage 中添加语音输出：
private deliverMessage(msg: ProactiveMessage): void {
  // ...existing push logic...
  
  // 同时语音播放（异步，不阻塞）
  if (this.ttsEnabled && this.tts.isAvailable()) {
    const voice = ARCHETYPE_VOICES[this.archetype]
    if (voice) {
      this.tts.speak(msg.message, voice).catch(err => {
        console.error('[CompanionEngine] TTS error:', err instanceof Error ? err.message : err)
      })
    }
  }
}

// 公开方法
setTTSEnabled(enabled: boolean): void { this.ttsEnabled = enabled }
isTTSEnabled(): boolean { return this.ttsEnabled && this.tts.isAvailable() }
```

TTS 是可选增强。如果 GEMINI_API_KEY 不存在或播放失败，纯文字正常工作。

### 4. 错误处理

- 无 GEMINI_API_KEY → TTS 整体禁用
- API 超时 (15s) → 跳过这次语音
- API 429 → 跳过并 log
- 音频播放失败 → 跳过并 log
- 平台不支持音频 → 静默禁用 TTS
- 所有错误不影响文字消息推送

## Build & Verification
1. `bun run build` 成功
2. TTSService 正确构造 Gemini TTS API 请求
3. 9 个 archetype 都有声音映射
4. WAV header 构造正确 (24kHz, 16-bit, mono)
5. macOS afplay 播放 + 临时文件清理
6. 无 API key 时优雅降级
7. engine.ts 集成 TTS 到消息推送流程
