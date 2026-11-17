// CI auto-heal entry point (Lab 8). Runs only in the `auto-fix` workflow job after Jest failed:
// it sends the failure log and the application source to an AI agent, applies the returned
// source-only patch, re-runs typecheck and tests, then pushes a branch and opens a pull request.
// It is operational tooling: no Express, Mongoose, or database access.
import { execFile } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { loadAutoHealConfig } from '../config/autoHeal';
import type { AgentPatch, AutoHealConfig, CommandResult, PatchFile } from '../interfaces/autoHeal';
import {
  extractReferencedPaths,
  findToolInput,
  isEditableSourcePath,
  parseAgentPatch,
} from '../validation/autoHeal.validation';

const MESSAGES_PATH = '/v1/messages';
const API_VERSION = '2023-06-01';
const TOOL_NAME = 'submit_patch';
const MAX_LOG_CHARS = 30_000;
const MAX_OUTPUT_BUFFER = 32 * 1024 * 1024;

const TASK_INSTRUCTION =
  'Parse the attached Jest failure log. Locate the source code causing the failure in src/ and ' +
  'generate a patch that fixes the bug without breaking existing tests.';

const SYSTEM_PROMPT = [
  'You are a CI repair agent for a TypeScript/Express/Mongoose backend.',
  TASK_INSTRUCTION,
  'Rules: fix the production code, never the tests. Do not edit, delete, skip, or loosen any test,',
  'assertion, fixture, or configuration. Treat the tests as the specification of correct behavior.',
  'Make the smallest change that fixes the root cause, and keep the existing style and types.',
  'Reply only by calling the submit_patch tool. For each changed file return its complete new content.',
].join(' ');

const PATCH_TOOL = {
  name: TOOL_NAME,
  description: 'Submit the fix as complete replacement contents of the changed source files.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Root cause of the failure and what the patch changes, in a few sentences.',
      },
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Repository-relative path under src/.' },
            content: { type: 'string', description: 'Complete new file content.' },
          },
          required: ['path', 'content'],
        },
      },
    },
    required: ['summary', 'files'],
  },
} as const;

async function main(): Promise<void> {
  const config = loadAutoHealConfig(process.env);
  const log = tail(await readFile(config.logPath, 'utf8'), MAX_LOG_CHARS);

  const allPaths = await listSourcePaths();
  const editable = await readFiles(allPaths.filter(isEditableSourcePath));
  // Tests named in the log are shown read-only, as the specification the fix must satisfy.
  const referencedTests = extractReferencedPaths(log).filter(
    (path) => allPaths.includes(path) && !isEditableSourcePath(path),
  );
  const tests = await readFiles(referencedTests);

  const patch = parseAgentPatch(await askAgent(config, log, editable, tests));
  const changed = await applyPatch(patch, editable);
  console.log(`Agent patched: ${changed.join(', ')}`);

  const typecheck = await run('npm', ['run', 'typecheck']);
  const jest = await run('npm', ['test']);
  const verified = typecheck.code === 0 && jest.code === 0;
  console.log(`Verification after patch: ${verified ? 'passed' : 'FAILED'}`);

  const branch = `fix/auto-heal-${config.runId}`;
  await exec('git', ['config', 'user.name', 'github-actions[bot]']);
  await exec('git', [
    'config',
    'user.email',
    '41898282+github-actions[bot]@users.noreply.github.com',
  ]);
  await exec('git', ['checkout', '-b', branch]);
  await exec('git', ['add', '--', ...changed]);
  await exec('git', ['commit', '-m', `fix: auto-heal failing tests (run ${config.runId})`]);
  await exec('git', ['push', 'origin', branch]);

  const body = buildPullRequestBody(config, patch, changed, verified, jest);
  const createArgs = [
    ...['pr', 'create', '--base', config.baseBranch, '--head', branch],
    ...['--title', `fix: auto-heal failing tests (run ${config.runId})`, '--body', body],
    ...(verified ? [] : ['--draft']),
  ];
  console.log((await exec('gh', createArgs)).trim());
}

async function askAgent(
  config: AutoHealConfig,
  log: string,
  sources: PatchFile[],
  tests: PatchFile[],
): Promise<unknown> {
  const prompt = [
    TASK_INSTRUCTION,
    `## Jest failure log (tail)\n${log}`,
    `## Test files named in the log (read-only)\n${renderFiles(tests)}`,
    `## Application source (editable)\n${renderFiles(sources)}`,
  ].join('\n\n');

  const response = await fetch(`${config.apiBaseUrl}${MESSAGES_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 16_000,
      // DeepSeek only honors a forced tool_choice when thinking is off.
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      tools: [PATCH_TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  // The error body is not printed: it can echo request details.
  if (!response.ok) {
    throw new Error(`Model API request failed with HTTP ${response.status}.`);
  }
  const input = findToolInput(await response.json(), TOOL_NAME);
  if (input === undefined) {
    throw new Error('Agent did not return a submit_patch call.');
  }
  return input;
}

// Writes only files whose content actually changes; returns their paths.
async function applyPatch(patch: AgentPatch, current: PatchFile[]): Promise<string[]> {
  const changed: string[] = [];
  for (const file of patch.files) {
    const before = current.find((candidate) => candidate.path === file.path);
    if (before === undefined) {
      throw new Error(`Agent patch targets a file that does not exist: ${file.path}`);
    }
    if (before.content !== file.content) {
      await writeFile(file.path, file.content, 'utf8');
      changed.push(file.path);
    }
  }
  if (changed.length === 0) {
    throw new Error('Agent patch changes nothing.');
  }
  return changed;
}

function buildPullRequestBody(
  config: AutoHealConfig,
  patch: AgentPatch,
  changed: string[],
  verified: boolean,
  jest: CommandResult,
): string {
  return [
    `Automated repair for the failing Jest run of workflow run ${config.runId}, generated by \`${config.model}\`.`,
    `## Agent diagnosis\n${patch.summary}`,
    `## Files changed\n${changed.map((path) => `- \`${path}\``).join('\n')}`,
    `## Verification in CI\nTypecheck and \`npm test\` after the patch: **${verified ? 'passed' : 'FAILED (draft PR)'}**.`,
    `<details><summary>Last Jest output</summary>\n\n\`\`\`text\n${tail(jest.output, 3000)}\n\`\`\`\n\n</details>`,
    '## Human review audit log\n_Pending. The agent cannot approve its own patch; a human reviewer must record the review here before merging._',
  ].join('\n\n');
}

async function listSourcePaths(): Promise<string[]> {
  const entries = await readdir('src', { recursive: true });
  return entries
    .map((entry) => `src/${entry.split('\\').join('/')}`)
    .filter((path) => path.endsWith('.ts'))
    .sort();
}

async function readFiles(paths: string[]): Promise<PatchFile[]> {
  return Promise.all(
    paths.map(async (path): Promise<PatchFile> => ({
      path,
      content: await readFile(path, 'utf8'),
    })),
  );
}

function renderFiles(files: PatchFile[]): string {
  return files.map((file) => `### ${file.path}\n${file.content}`).join('\n\n');
}

function tail(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

// Runs a command without a shell and never rejects; a non-zero exit is reported in the result.
function run(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(command, args, { maxBuffer: MAX_OUTPUT_BUFFER }, (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
      resolve({ code, output: `${stdout}${stderr}` });
    });
  });
}

async function exec(command: string, args: string[]): Promise<string> {
  const result = await run(command, args);
  if (result.code !== 0) {
    throw new Error(`\`${command} ${args[0] ?? ''}\` failed:\n${tail(result.output, 2000)}`);
  }
  return result.output;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Auto-heal failed.');
  process.exitCode = 1;
});
