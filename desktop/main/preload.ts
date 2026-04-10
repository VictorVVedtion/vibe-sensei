import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── UDF ──
  getUdfPort: () => ipcRenderer.invoke('udf:port'),
  isUdfReady: () => ipcRenderer.invoke('udf:isReady'),
  onUdfReady: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('udf:ready', handler)
    return () => {
      ipcRenderer.removeListener('udf:ready', handler)
    }
  },

  // ── Window Controls ──
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // ── Trading State ──
  requestTradingState: () => ipcRenderer.send('trading:state:request'),
  onTradingState: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state)
    ipcRenderer.on('trading:state', handler)
    return () => {
      ipcRenderer.removeListener('trading:state', handler)
    }
  },

  // ── Guardian Master ──
  requestGuardianMaster: () => ipcRenderer.send('guardian:master:request'),
  onGuardianMaster: (callback: (master: any) => void) => {
    const handler = (_event: any, master: any) => callback(master)
    ipcRenderer.on('guardian:master', handler)
    return () => {
      ipcRenderer.removeListener('guardian:master', handler)
    }
  },

  // ── Guardian Alerts ──
  onGuardianAlert: (callback: (alert: any) => void) => {
    const handler = (_event: any, alert: any) => callback(alert)
    ipcRenderer.on('guardian:alert', handler)
    return () => {
      ipcRenderer.removeListener('guardian:alert', handler)
    }
  },

  // ── Companion Emotion ──
  requestCompanionState: () => ipcRenderer.send('companion:emotion:request'),
  onCompanionEmotion: (callback: (emotion: any) => void) => {
    const handler = (_event: any, emotion: any) => callback(emotion)
    ipcRenderer.on('companion:emotion', handler)
    return () => {
      ipcRenderer.removeListener('companion:emotion', handler)
    }
  },

  // ── Companion Speech ──
  onCompanionSpeech: (callback: (speech: any) => void) => {
    const handler = (_event: any, speech: any) => callback(speech)
    ipcRenderer.on('companion:speech', handler)
    return () => {
      ipcRenderer.removeListener('companion:speech', handler)
    }
  },

  // ── Tilt State ──
  onTiltState: (callback: (tilt: any) => void) => {
    const handler = (_event: any, tilt: any) => callback(tilt)
    ipcRenderer.on('tilt:state', handler)
    return () => {
      ipcRenderer.removeListener('tilt:state', handler)
    }
  },

  // ── Playbook ──
  onPlaybookCard: (callback: (card: any) => void) => {
    const handler = (_event: any, card: any) => callback(card)
    ipcRenderer.on('playbook:card', handler)
    return () => {
      ipcRenderer.removeListener('playbook:card', handler)
    }
  },
  executePlaybook: (playbookId: string, params?: Record<string, unknown>) =>
    ipcRenderer.send('playbook:execute', { playbookId, params }),

  // ── Trade Review ──
  onTradeReview: (callback: (review: any) => void) => {
    const handler = (_event: any, review: any) => callback(review)
    ipcRenderer.on('trade:review', handler)
    return () => {
      ipcRenderer.removeListener('trade:review', handler)
    }
  },

  // ── Anti Portfolio ──
  onAntiPortfolio: (callback: (portfolio: any) => void) => {
    const handler = (_event: any, portfolio: any) => callback(portfolio)
    ipcRenderer.on('anti:portfolio', handler)
    return () => {
      ipcRenderer.removeListener('anti:portfolio', handler)
    }
  },

  // ── Council Debate ──
  onCouncilDebate: (callback: (debate: any) => void) => {
    const handler = (_event: any, debate: any) => callback(debate)
    ipcRenderer.on('council:debate', handler)
    return () => {
      ipcRenderer.removeListener('council:debate', handler)
    }
  },

  // ── News Alert ──
  onNewsAlert: (callback: (alert: any) => void) => {
    const handler = (_event: any, alert: any) => callback(alert)
    ipcRenderer.on('news:alert', handler)
    return () => {
      ipcRenderer.removeListener('news:alert', handler)
    }
  },

  // ── Chart Context (reverse bridge) ──
  sendChartContext: (context: any) =>
    ipcRenderer.send('chart:context', context),

  // ── Trade History ──
  requestTradeHistory: () => ipcRenderer.send('trade:history:request'),
  onTradeHistory: (callback: (history: any) => void) => {
    const handler = (_event: any, history: any) => callback(history)
    ipcRenderer.on('trade:history', handler)
    return () => {
      ipcRenderer.removeListener('trade:history', handler)
    }
  },

  // ── Weekly Review ──
  requestWeeklyReview: () => ipcRenderer.send('weekly:review:request'),
  onWeeklyReview: (callback: (review: any) => void) => {
    const handler = (_event: any, review: any) => callback(review)
    ipcRenderer.on('weekly:review', handler)
    return () => {
      ipcRenderer.removeListener('weekly:review', handler)
    }
  },

  // ── Risk Map ──
  requestRiskMap: () => ipcRenderer.send('risk:map:request'),
  onRiskMap: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('risk:map', handler)
    return () => {
      ipcRenderer.removeListener('risk:map', handler)
    }
  },

  // ── Cross-Venue Portfolio ──
  requestCrossVenuePortfolio: () => ipcRenderer.send('portfolio:cross_venue:request'),
  onCrossVenuePortfolio: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('portfolio:cross_venue', handler)
    return () => {
      ipcRenderer.removeListener('portfolio:cross_venue', handler)
    }
  },

  // ── Venue Status ──
  requestVenueStatus: () => ipcRenderer.send('venue:status:request'),
  onVenueStatus: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('venue:status', handler)
    return () => {
      ipcRenderer.removeListener('venue:status', handler)
    }
  },

  // ── Layout Persistence ──
  getLayoutState: () => ipcRenderer.invoke('layout:state:request'),
})
