# Sprint 53: Chart Vision — Gemini Integration

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-53: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
让大师能"看"K线图表。截取 TradingView 图表截图，发送到 Gemini 2.5 Flash 多模态 API，大师用自己的性格风格点评图表形态。

## Assigned To
opus

## Deliverables
- [ ] `src/services/companion/vision.ts` — 新建：VisionService 图表分析服务
- [ ] `src/services/companion/chart-capture.ts` — 新建：TradingView 截图工具
- [ ] `src/services/companion/gemini-client.ts` — 新建：Gemini API REST 客户端
- [ ] 集成到 CompanionEngine — 修改 engine.ts

## Acceptance Criteria

### 1. Gemini API 客户端 (gemini-client.ts)

简单的 REST 客户端，调用 Gemini 2.5 Flash API：

```typescript
export class GeminiClient {
  private apiKey: string
  private model: string = 'gemini-2.5-flash'
  
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY ?? ''
  }
  
  /** 是否可用（有 API key） */
  isAvailable(): boolean { return this.apiKey.length > 0 }
  
  /** 发送图片 + 文本 prompt，获取文本响应 */
  async analyzeImage(imageBase64: string, prompt: string): Promise<string>
}
```

API 调用格式（Gemini REST API）：
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}

Body:
{
  "contents": [{
    "parts": [
      { "text": "{prompt}" },
      { "inlineData": { "mimeType": "image/jpeg", "data": "{base64}" } }
    ]
  }],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 500
  }
}
```

响应解析：`response.candidates[0].content.parts[0].text`

错误处理：
- 无 API key → isAvailable() 返回 false，不调用
- HTTP 429 → 抛出 RateLimitError
- HTTP 401/403 → 抛出 AuthError
- Timeout (15s) → 抛出 TimeoutError
- 空响应/格式错误 → 抛出 ParseError
- 所有错误在 VisionService 层捕获并优雅降级

### 2. ChartCapture (chart-capture.ts)

截取 TradingView 图表的截图：

```typescript
export class ChartCapture {
  /** 检查 TradingView web 服务是否运行 */
  async isAvailable(): Promise<boolean>
  
  /** 截取图表截图，返回 base64 JPEG */
  async capture(): Promise<string | null>
}
```

实现方式 — **不用 Puppeteer**（太重）。用更轻量的方式：

**方案 A（推荐）：fetch + canvas export**
TradingView web 在 :3456 运行。检查是否可达：
```typescript
async isAvailable(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:3456', { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch { return false }
}
```

截图：由于我们不能直接从 Node 端截取浏览器 canvas，用一个更实际的方式 — **调用 TradingView 的 chart export API**。

TradingView Lightweight Charts 有 `chart.takeScreenshot()` 方法返回 canvas。但这在浏览器端。

**简化方案：用 screencapture CLI 工具（macOS）**
```typescript
async capture(): Promise<string | null> {
  try {
    const tmpFile = `/tmp/vibe-chart-${Date.now()}.jpg`
    // macOS screencapture 截取整个屏幕，或者特定窗口
    // 由于我们不一定知道窗口 ID，用 web 端点替代
    // 实际上：为 web 前端添加一个截图端点
    const res = await fetch('http://localhost:3456/api/screenshot', { 
      signal: AbortSignal.timeout(5000) 
    })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  } catch { return null }
}
```

**需要在 web 前端添加截图 API 端点：**
在 `src/services/chart/udf-server.ts` 中添加 `/api/screenshot` 路由。使用 `chart.takeScreenshot()` 导出 canvas 到 PNG，通过 HTTP 返回。

或者更简单：**如果 web 前端不可用，跳过整个视觉功能。** 这是一个增强功能，不是核心。

**最终方案：** 
1. 先检查 :3456 是否可达
2. 如果可达，fetch `/api/screenshot`
3. 如果端点不存在（尚未实现），先在 web 端添加
4. 如果不可达，返回 null（静默跳过）

### 3. VisionService (vision.ts)

```typescript
export class VisionService {
  private gemini: GeminiClient
  private chartCapture: ChartCapture
  
  /** 分析当前图表，返回大师风格的点评 */
  async analyzeChart(masterArchetype: string, masterName: string): Promise<string | null>
}
```

prompt 构造：
```typescript
const prompt = `你是 ${masterName}，一位 ${archetypeDescription} 风格的交易大师。
请分析这张K线图表，用你的性格和交易哲学风格简短点评（2-3句话）。
关注：趋势方向、关键形态、支撑阻力位、成交量变化。
用中文回答，保持你的角色人格。不要说"作为AI"或"根据图表"，直接以你的身份说话。`
```

archetype 风格描述映射：
```
value_investor: "价值投资者，关注基本面和安全边际"
trend_follower: "趋势追随者，关注价格动量和突破"
macro_trader: "宏观交易者，关注市场周期和宏观因素"
quant: "量化交易者，关注统计模式和概率"
strategist: "战略家，关注大局和时机"
philosopher: "哲学家，关注市场本质和人性"
first_principles: "第一性原理思考者，从基本事实推理"
crypto_native: "加密原生交易者，关注链上数据和叙事"
scientist: "科学家，关注数据模式和假设验证"
```

### 4. 集成到 CompanionEngine

在 engine.ts 中：
- 添加 VisionService 实例
- 新增 `analyzeChart()` 公开方法（可被外部调用，如用户命令）
- 在 ProactiveMonitor 的市场触发器中，如果检测到大幅价格变动 + VisionService 可用 → 自动分析
- 分析结果通过 companionReaction 推送，emotion 设为对应状态

### 5. Web 端截图端点（如需要）

在 `src/services/chart/udf-server.ts` 中添加：
```
GET /api/screenshot → 返回当前图表的 PNG 截图
```

如果 TradingView Lightweight Charts 在 Node 端无法直接截图（因为是浏览器端渲染），则：
1. 在 web 前端 JS 中添加截图逻辑（`chart.takeScreenshot()` + POST 回服务器）
2. 或者暂时跳过截图功能，VisionService 标记为 "需要 --web 模式 + 用户手动提供截图"

**选择最简单可行的方案。如果截图实现太复杂，VisionService 可以先接受手动传入的图片路径。**

## 环境变量
- `GEMINI_API_KEY` — Gemini API 密钥，从环境变量读取
- 不存在时 VisionService 整体禁用，不报错

## Build & Verification
1. `bun run build` 成功
2. GeminiClient 正确构造 API 请求
3. 无 GEMINI_API_KEY 时优雅降级（不崩溃）
4. ChartCapture 在 :3456 不可用时返回 null
5. VisionService 组合 capture + analyze 流程
6. 集成到 CompanionEngine
