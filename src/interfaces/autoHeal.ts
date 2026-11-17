// Contracts for the CI auto-heal tool (src/scripts/autoHeal.ts). The agent's reply is untrusted,
// so AgentPatch only describes a reply after parseAgentPatch has validated it.
export interface AutoHealConfig {
  anthropicApiKey: string;
  model: string;
  logPath: string;
  baseBranch: string;
  runId: string;
}

export interface PatchFile {
  path: string;
  content: string;
}

export interface AgentPatch {
  summary: string;
  files: PatchFile[];
}

export interface CommandResult {
  code: number;
  output: string;
}
