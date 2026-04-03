# Sprint 55: STT — Voice Input

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-55: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
让用户可以用语音跟大师说话。麦克风录音 → Gemini API 转写 → 文字注入对话。Push-to-talk 模式。

## Assigned To
opus

## Deliverables
- [ ] `src/services/companion/stt.ts` — 新建：STT 服务
- [ ] 集成到 CompanionEngine — 修改 engine.ts 添加 STT 管理

## Acceptance Criteria

### 1. STT Service (stt.ts)

```typescript
export class STTService {
  private apiKey: string
  private recording: boolean = false
  
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY ?? ''
  }
  
  isAvailable(): boolean
  
  /** 开始录音 */
  startRecording(): Promise<void>
  
  /** 停止录音并转写 */
  stopAndTranscribe(): Promise<string | null>
  
  /** 是否正在录音 */
  isRecording(): boolean
}
```

#### 录音实现

**方案：使用系统命令录音（跨平台）**

macOS:
```typescript
// 使用 sox (如果安装了) 或 rec 命令录制 PCM 音频
// 或者用 macOS 原生 afrecord（不存在）
// 最可靠：用 Bun 的 spawn 调用 sox
const recorder = Bun.spawn(['sox', '-d', '-t', 'wav', '-r', '16000', '-c', '1', tmpFile])
```

**更简单的方案：直接用 Gemini API 的文件上传 + 转写**

实际上，由于终端环境录音比较复杂（需要 sox/ffmpeg 等外部依赖），采用更实际的方案：

1. **检测录音能力**：尝试执行 `which sox` 或 `which rec`
2. **如果有 sox**：用 sox 录制 WAV 文件
3. **如果没有**：STT 标记为不可用，提示用户安装 sox (`brew install sox`)
4. **录制的音频发送到 Gemini API 进行转写**

#### Gemini 音频转写 API

使用 Gemini 2.5 Flash（跟 vision 用同一个模型，不需要 Live API）：

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}

Body:
{
  "contents": [{
    "parts": [
      { "text": "请将以下音频转写为文字。只输出转写结果，不要添加任何解释。" },
      { "inlineData": { "mimeType": "audio/wav", "data": "{base64_audio}" } }
    ]
  }],
  "generationConfig": {
    "temperature": 0.1,
    "maxOutputTokens": 500
  }
}
```

#### Push-to-Talk 流程

```
用户按键 → startRecording() → 录音中...
用户松键 → stopAndTranscribe() → 发送到 Gemini → 返回文字
文字注入到对话作为用户消息
```

具体键绑定由 REPL 处理（不在 STT 服务范围内）。STT 只提供 start/stop/transcribe API。

#### 超时保护

- 最大录音时长：30 秒，超过自动停止
- 转写 API 超时：15 秒
- 空音频检测：如果录制的文件 < 1KB，视为静默，跳过转写

### 2. 集成到 CompanionEngine

在 engine.ts 中添加：
```typescript
private readonly stt: STTService

// 公开方法
async startListening(): Promise<void>
async stopListeningAndGetText(): Promise<string | null>
isListening(): boolean
isSTTAvailable(): boolean
```

注意：STT 的实际触发（键盘事件）由 REPL 或其他 UI 层处理。CompanionEngine 只暴露 API。

### 3. 错误处理

- 无 GEMINI_API_KEY → STT 禁用
- 无 sox → STT 禁用，log 提示安装
- 录音失败 → 返回 null
- 转写失败 → 返回 null
- 超时 → 自动停止录音
- 所有错误不影响文字交互

## Build & Verification
1. `bun run build` 成功
2. STTService 检测 sox 可用性
3. 录音 → WAV 文件 → base64 → Gemini API 转写链路完整
4. 30 秒最大录音保护
5. 集成到 CompanionEngine
6. 无 sox 时优雅降级
