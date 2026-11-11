// PreToolUse guard for Claude Code. Blocks (exit 2, reason on stderr):
//  - reading or writing .env files (except .env.example), through any tool or shell command
//  - git push to main
//  - gh pr merge (the developer merges)
// Branch protection on GitHub is the real enforcement for main; this hook stops mistakes earlier.
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const input = JSON.parse(await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data || '{}'));
}));

const tool = input.tool_name ?? '';
const args = input.tool_input ?? {};

function block(reason) {
  process.stderr.write(`Blocked by .claude/hooks/guard.mjs: ${reason}\n`);
  process.exit(2);
}

const isSecretEnvFile = (name) => /^\.env(\..+)?$/.test(name) && name !== '.env.example';

// File tools
const filePath = args.file_path ?? args.notebook_path ?? args.path;
if (typeof filePath === 'string' && isSecretEnvFile(basename(filePath))) {
  block(`${tool} on ${basename(filePath)} is not allowed. Never read or write .env files.`);
}

if (tool === 'Bash' || tool === 'PowerShell') {
  const command = String(args.command ?? '');

  // A .env token at the start of a word or path segment, e.g. `cat .env`, `backend/.env.local`, `"./.env"`
  for (const match of command.matchAll(/(?:^|[\s'"=/\\<>])(\.env(?:\.[\w.-]+)?)(?=$|[\s'";|&)<>])/g)) {
    if (isSecretEnvFile(match[1])) {
      block(`commands that touch ${match[1]} are not allowed. Never read or print .env files.`);
    }
  }

  if (/\bgh\s+pr\s+merge\b/.test(command)) {
    block('gh pr merge is not allowed. The developer reviews and merges every PR.');
  }

  // Each `git ... push ...` segment of the command
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    if (!/\bgit\b.*\bpush\b/.test(segment)) continue;
    if (/(^|[\s:+])(refs\/heads\/)?main(\s|$)/.test(segment) || /\s--(all|mirror)\b/.test(segment)) {
      block('pushing to main is not allowed. Push a feature branch and open a PR.');
    }
    // A bare `git push` pushes the current branch
    let branch = '';
    try {
      branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: input.cwd || undefined, encoding: 'utf8' }).trim();
    } catch {
      // not a git repo or git missing: nothing to check
    }
    if (branch === 'main') {
      block('the current branch is main. Create a feature branch (feat/<name> or fix/<name>) first.');
    }
  }
}

process.exit(0);
