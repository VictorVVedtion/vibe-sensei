import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import { useEffect } from 'react';
import { useNotifications } from 'src/context/notifications.js';
import { getIsRemoteMode } from '../../bootstrap/state.js';
import { Text } from '../../ink.js';
import { hasClaudeAiMcpEverConnected } from '../../services/mcp/claudeai.js';
import type { MCPServerConnection } from '../../services/mcp/types.js';
import { getMainLoopModel } from '../../utils/model/model.js';
type Props = {
  mcpClients?: MCPServerConnection[];
};
const EMPTY_MCP_CLIENTS: MCPServerConnection[] = [];
export function useMcpConnectivityStatus(t0) {
  const $ = _c(4);
  const {
    mcpClients: t1
  } = t0;
  const mcpClients = t1 === undefined ? EMPTY_MCP_CLIENTS : t1;
  const {
    addNotification
  } = useNotifications();
  let t2;
  let t3;
  if ($[0] !== addNotification || $[1] !== mcpClients) {
    t2 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      const failedLocalClients = mcpClients.filter(_temp);
      const failedClaudeAiClients = mcpClients.filter(_temp2);
      const needsAuthLocalServers = mcpClients.filter(_temp3);
      const needsAuthClaudeAiServers = mcpClients.filter(_temp4);
      // Vibe Sensei multi-provider: suppress claude.ai connector nags
      // when the active session isn't using an Anthropic model. These
      // connectors are Claude-Pro-gated features (Google Drive, Notion,
      // etc. via Anthropic's OAuth proxy) — nagging a Gemini/OpenAI
      // user to re-auth them is noise. Local MCP server warnings still
      // fire because those are user-installed and provider-agnostic.
      const currentModel = getMainLoopModel();
      const suppressClaudeAiNags = typeof currentModel === 'string' && currentModel.includes('/');
      const showFailedClaudeAi = !suppressClaudeAiNags && failedClaudeAiClients.length > 0;
      const showNeedsAuthClaudeAi = !suppressClaudeAiNags && needsAuthClaudeAiServers.length > 0;
      if (failedLocalClients.length === 0 && !showFailedClaudeAi && needsAuthLocalServers.length === 0 && !showNeedsAuthClaudeAi) {
        return;
      }
      if (failedLocalClients.length > 0) {
        addNotification({
          key: "mcp-failed",
          jsx: <><Text color="error">{failedLocalClients.length} MCP{" "}{failedLocalClients.length === 1 ? "server" : "servers"} failed</Text><Text dimColor={true}> · /mcp</Text></>,
          priority: "medium"
        });
      }
      if (showFailedClaudeAi) {
        addNotification({
          key: "mcp-claudeai-failed",
          jsx: <><Text color="error">{failedClaudeAiClients.length} claude.ai{" "}{failedClaudeAiClients.length === 1 ? "connector" : "connectors"}{" "}unavailable</Text><Text dimColor={true}> · /mcp</Text></>,
          priority: "medium"
        });
      }
      if (needsAuthLocalServers.length > 0) {
        addNotification({
          key: "mcp-needs-auth",
          jsx: <><Text color="warning">{needsAuthLocalServers.length} MCP{" "}{needsAuthLocalServers.length === 1 ? "server needs" : "servers need"}{" "}auth</Text><Text dimColor={true}> · /mcp</Text></>,
          priority: "medium"
        });
      }
      if (showNeedsAuthClaudeAi) {
        addNotification({
          key: "mcp-claudeai-needs-auth",
          jsx: <><Text color="warning">{needsAuthClaudeAiServers.length} claude.ai{" "}{needsAuthClaudeAiServers.length === 1 ? "connector needs" : "connectors need"}{" "}auth</Text><Text dimColor={true}> · /mcp</Text></>,
          priority: "medium"
        });
      }
    };
    t3 = [addNotification, mcpClients];
    $[0] = addNotification;
    $[1] = mcpClients;
    $[2] = t2;
    $[3] = t3;
  } else {
    t2 = $[2];
    t3 = $[3];
  }
  useEffect(t2, t3);
}
function _temp4(client_2) {
  return client_2.type === "needs-auth" && client_2.config.type === "claudeai-proxy" && hasClaudeAiMcpEverConnected(client_2.name);
}
function _temp3(client_1) {
  return client_1.type === "needs-auth" && client_1.config.type !== "claudeai-proxy";
}
function _temp2(client_0) {
  return client_0.type === "failed" && client_0.config.type === "claudeai-proxy" && hasClaudeAiMcpEverConnected(client_0.name);
}
function _temp(client) {
  return client.type === "failed" && client.config.type !== "sse-ide" && client.config.type !== "ws-ide" && client.config.type !== "claudeai-proxy";
}
