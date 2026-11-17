import type { AgentPatch, PatchFile } from '../interfaces/autoHeal';

// Pure guards for the auto-heal tool: no I/O. They decide which files an agent may touch and
// whether its reply is well formed. Tests are never editable, so the agent cannot "fix" a
// failure by weakening an assertion.
const MAX_PATCH_FILES = 5;
const MAX_FILE_CHARS = 200_000;
const SOURCE_PATH_PATTERN = /^src\/[A-Za-z0-9_./-]+\.ts$/;
const REFERENCED_PATH_PATTERN = /src\/[A-Za-z0-9_./-]+\.ts/g;

export function isEditableSourcePath(path: string): boolean {
  return (
    SOURCE_PATH_PATTERN.test(path) &&
    !path.includes('..') &&
    !path.includes('//') &&
    !/^src\/(tests?|scripts)\//.test(path) &&
    !path.includes('/__tests__/') &&
    !path.endsWith('.test.ts')
  );
}

// Source paths named in a Jest log, in order of first appearance.
export function extractReferencedPaths(log: string): string[] {
  return [...new Set(log.match(REFERENCED_PATH_PATTERN) ?? [])];
}

// Returns the input of the first tool_use block with the given name in an Anthropic-style Messages
// API response, or undefined when the response has no such block.
export function findToolInput(response: unknown, toolName: string): unknown {
  if (!isRecord(response) || !Array.isArray(response.content)) {
    return undefined;
  }
  for (const block of response.content as unknown[]) {
    if (isRecord(block) && block.type === 'tool_use' && block.name === toolName) {
      return block.input;
    }
  }
  return undefined;
}

export function parseAgentPatch(input: unknown): AgentPatch {
  if (!isRecord(input) || typeof input.summary !== 'string' || !Array.isArray(input.files)) {
    throw new Error('Agent reply is not a patch: expected { summary, files }.');
  }
  const rawFiles = input.files as unknown[];
  if (rawFiles.length < 1 || rawFiles.length > MAX_PATCH_FILES) {
    throw new Error(`Agent patch must change between 1 and ${MAX_PATCH_FILES} files.`);
  }
  const files = rawFiles.map(parsePatchFile);
  if (new Set(files.map((file) => file.path)).size !== files.length) {
    throw new Error('Agent patch lists the same file twice.');
  }
  return { summary: input.summary.trim().slice(0, 2000), files };
}

function parsePatchFile(value: unknown): PatchFile {
  if (!isRecord(value) || typeof value.path !== 'string' || typeof value.content !== 'string') {
    throw new Error('Agent patch file must be { path, content }.');
  }
  if (!isEditableSourcePath(value.path)) {
    throw new Error(`Agent patch touches a path that is not editable: ${value.path}`);
  }
  if (value.content.length === 0 || value.content.length > MAX_FILE_CHARS) {
    throw new Error(`Agent patch content has an invalid size for ${value.path}.`);
  }
  return { path: value.path, content: value.content };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
