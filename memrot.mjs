#!/usr/bin/env node
// memrot — lint your AI coding agent's memory files. Zero dependencies, fully local, no AI calls.
// Usage: memrot [paths...] [--root DIR] [--budget N] [--json] [--no-color] [--max-lines N]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = { root: process.cwd(), budget: 3000, maxLines: 200, json: false, all: false, fix: false, color: process.stdout.isTTY, paths: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--root') opt.root = path.resolve(args[++i]);
  else if (a === '--budget') opt.budget = +args[++i];
  else if (a === '--max-lines') opt.maxLines = +args[++i];
  else if (a === '--json') opt.json = true;
  else if (a === '--all') opt.all = true;
  else if (a === '--fix') opt.fix = true;
  else if (a === '--no-color') opt.color = false;
  else if (a === '-h' || a === '--help') { help(); process.exit(0); }
  else opt.paths.push(a);
}
function help() {
  console.log(`memrot — lint AI agent memory files (CLAUDE.md, AGENTS.md, MEMORY.md, memory/*.md ...)

  memrot [paths...]        files or folders (default: auto-detect in current dir)
  --root DIR                project root used to check that referenced paths exist
  --budget N                token budget for all memory files together (default 3000)
  --max-lines N             per-file line limit (default 200)
  --json                    machine-readable output
  --fix                     safe auto-fix: repair non-UTF-8 files (UTF-8/Big5/GBK/Shift-JIS), drop exact duplicate lines (writes .bak)
  --all                     also show low-priority notes (duplicates, relative time)
Exit code 1 if any error-level finding.`);
}

const c = (code, s) => (opt.color ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = s => c(31, s), yellow = s => c(33, s), dim = s => c(2, s), bold = s => c(1, s), green = s => c(32, s);

// ---------- collect files ----------
const NAMES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', 'MEMORY.md', '.cursorrules', 'copilot-instructions.md'];
const SKIP = new Set(['node_modules', '.git', 'Build', 'build', 'dist', 'Library', 'Temp', 'obj', 'bin', 'out', '.venv', 'venv', '__pycache__', 'target']);
function walk(p, out, depth = 0) {
  let st; try { st = fs.statSync(p); } catch { return; }
  if (st.isFile()) { if (/\.(md|mdc|mdx|markdown)$/i.test(p) || NAMES.includes(path.basename(p))) out.add(path.resolve(p)); return; }
  if (!st.isDirectory() || depth > 3) return;
  for (const e of fs.readdirSync(p)) {
    if (SKIP.has(e)) continue;
    walk(path.join(p, e), out, depth + 1);
  }
}
const files = new Set();
if (opt.paths.length) opt.paths.forEach(p => walk(p, files));
else {
  for (const n of NAMES) { const f = path.join(opt.root, n); if (fs.existsSync(f)) files.add(f); }
  for (const d of ['.claude', 'memory', '.cursor/rules', '.github']) {
    const dp = path.join(opt.root, d); if (fs.existsSync(dp)) walk(dp, files);
  }
}
if (!files.size) { console.error('No memory files found. Pass paths explicitly: memrot path/to/memory'); process.exit(2); }

// ---------- helpers ----------
const cjk = /[㐀-鿿぀-ヿ가-힯]/g;
const tokens = s => { const n = (s.match(cjk) || []).length; return Math.ceil(n * 1 + (s.length - n) / 4); };
const norm = s => s.toLowerCase().replace(/[\s　]+/g, ' ').replace(/[`*_>#\-•]/g, '').trim();
const findings = [];
const add = (file, line, level, rule, msg) => findings.push({ file, line, level, rule, msg });
const rel = f => path.relative(process.cwd(), f) || f;

const baseIdx = new Set(); let idxN = 0;
(function idx(d, depth) {
  if (depth > 6 || idxN > 60000) return;
  let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    idxN++; baseIdx.add(e.name.toLowerCase());
    if (e.isDirectory()) idx(path.join(d, e.name), depth + 1);
  }
})(opt.root, 0);
const exists = (ref, fileDir) => {
  if (!/[\/]/.test(ref) && baseIdx.has(ref.toLowerCase())) return true;
  const cands = [path.resolve(fileDir, ref), path.resolve(opt.root, ref), path.resolve(opt.root, ref.replace(/^[\\/]/, ''))];
  if (/^~[\\/]/.test(ref)) cands.push(path.join(process.env.HOME || process.env.USERPROFILE || '', ref.slice(2)));
  if (path.isAbsolute(ref)) cands.push(ref);
  return cands.some(p => fs.existsSync(p));
};
const looksLikePath = t =>
  !/^(https?:|mailto:|#|\/\/)/.test(t) && !/[*?<>{}$|=]/.test(t) && !/YYYY|MM-DD|xxx|<|your-/i.test(t) && !/\s/.test(t) &&
  (/[\\/]/.test(t) && /\.[A-Za-z0-9]{1,6}$/.test(t) || /^[\w.-]+\.(md|js|mjs|ts|tsx|py|java|json|yaml|yml|toml|sh|ps1|cs|go|rs|html|css)$/i.test(t)) &&
  !/^\d+(\.\d+)+$/.test(t);

let pkgScripts = null;
try { pkgScripts = JSON.parse(fs.readFileSync(path.join(opt.root, 'package.json'), 'utf8')).scripts || {}; } catch {}

const allLines = []; // for cross-file duplicates
let totalTokens = 0;
const NEG = /(never|do not|don't|dont|must not|avoid|不要|不可|不准|不得|禁止|別|切勿|千萬不要)/gi;
const REL_TIME = /\b(today|yesterday|tomorrow|this week|next week|right now|currently|recently|just now)\b|今天|昨天|明天|這週|本週|下週|剛剛|最近|目前|現在/i;

for (const file of files) {
  let text; try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  if (text.includes('�')) add(file, 1, 'error', 'encoding', 'file is not valid UTF-8 — agents will read garbled text');
  const lines = text.split(/\r?\n/);
  const dir = path.dirname(file);
  const tk = tokens(text); totalTokens += tk;

  if (lines.length > opt.maxLines) add(file, 1, 'warn', 'oversize', `${lines.length} lines (limit ${opt.maxLines}) — agents may truncate or ignore the tail`);
  if (Buffer.byteLength(text) > 25 * 1024) add(file, 1, 'warn', 'oversize', `${(Buffer.byteLength(text) / 1024).toFixed(1)} KB (>25 KB) is loaded into every session`);

  let inFence = false;
  const negIndex = []; // [line, negated, core]
  lines.forEach((raw, i) => {
    const ln = i + 1;
    if (/^\s*```/.test(raw)) { inFence = !inFence; return; }
    if (inFence) return;
    const line = raw.trim();
    if (!line) return;

    // markdown links -> local files
    for (const m of raw.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      let t = m[1].split('#')[0].trim();
      if (!t || /^(https?:|mailto:)/.test(t) || /\s/.test(t) || !/[\/.]/.test(t) || !/^[ -~㐀-鿿]+$/.test(t) || !/\.[A-Za-z0-9]{1,6}$|[\/]$/.test(t)) continue;
      try { t = decodeURIComponent(t); } catch {}
      if (!exists(t, dir)) add(file, ln, 'error', 'broken-link', `link target not found: ${t}`);
    }
    // backticked paths
    for (const m of raw.matchAll(/`([^`]+)`/g)) {
      const t = m[1].trim();
      if (looksLikePath(t) && !exists(t, dir)) add(file, ln, 'warn', 'stale-path', `referenced path not found: ${t}`);
      const run = t.match(/^(?:npm|pnpm|yarn|bun)\s+run\s+([\w:.-]+)/);
      if (run && pkgScripts && !(run[1] in pkgScripts)) add(file, ln, 'warn', 'stale-command', `package.json has no script "${run[1]}"`);
    }
    if (REL_TIME.test(line) && !/^#/.test(line) && line.length > 12) add(file, ln, 'info', 'relative-time', 'relative time words rot quickly — use an absolute date');

    // duplicates (cross-file)
    const n = norm(line);
    if (n.length >= 24) allLines.push({ file, ln, n });

    // contradiction candidates
    const hasNeg = NEG.test(line); NEG.lastIndex = 0;
    const core = n.replace(NEG, ' ').replace(/\b(always|must|should|please|務必|一律|都要|要)\b/gi, ' ').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
    NEG.lastIndex = 0;
    if (core.length >= 10) negIndex.push({ ln, hasNeg, core });
  });

  // contradictions within a file: same core, opposite polarity
  const seen = new Map();
  for (const x of negIndex) {
    const key = x.core;
    const prev = seen.get(key);
    if (prev && prev.hasNeg !== x.hasNeg) add(file, x.ln, 'warn', 'contradiction', `looks like the opposite of line ${prev.ln}`);
    else if (!prev) seen.set(key, x);
  }
}

// duplicates across/inside files
const byText = new Map();
for (const x of allLines) { (byText.get(x.n) || byText.set(x.n, []).get(x.n)).push(x); }
for (const [, arr] of byText) {
  if (arr.length < 2) continue;
  const first = arr[0];
  for (const d of arr.slice(1)) add(d.file, d.ln, 'info', 'duplicate', `same text as ${rel(first.file)}:${first.ln} — duplicated lines cost tokens twice`);
}

if (totalTokens > opt.budget) add([...files][0], 1, 'warn', 'budget', `memory files total ≈${totalTokens} tokens (budget ${opt.budget}) across ${files.size} files — trim or split`);

// ---------- --fix ----------
if (opt.fix) {
  let fixed = 0;
  for (const file of files) {
    const raw = fs.readFileSync(file);
    let text = null, changed = false;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw); }
    catch {
      const encs = ['big5', 'gbk', 'shift_jis'];
      const lines = raw.toString('latin1').split('\n');
      const out = lines.map(l => {
        const b = Buffer.from(l, 'latin1');
        try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch {}
        let best = null;
        for (const e of encs) { try { const t = new TextDecoder(e, { fatal: true }).decode(b); if (!best || (t.match(cjk) || []).length > (best.match(cjk) || []).length) best = t; } catch {} }
        return best ?? b.toString('utf8');
      });
      text = out.join('\n'); changed = true;
    }
    // drop exact duplicate non-trivial lines within the same file (outside code fences)
    const seen = new Set(); let fence = false;
    const kept = text.split('\n').filter(l => {
      if (/^\s*```/.test(l)) { fence = !fence; return true; }
      const n = norm(l);
      if (fence || n.length < 24) return true;
      if (seen.has(n)) { changed = true; return false; }
      seen.add(n); return true;
    });
    if (changed) { fs.copyFileSync(file, file + '.bak'); fs.writeFileSync(file, kept.join('\n')); fixed++; console.log(green('fixed ') + rel(file) + dim('  (backup: .bak)')); }
  }
  console.log(`--fix: ${fixed} file(s) changed. Stale paths/contradictions need a human — memrot never deletes those.`);
  process.exit(0);
}

// ---------- report ----------
const order = { error: 0, warn: 1, info: 2 };
findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || order[a.level] - order[b.level]);
const counts = { error: 0, warn: 0, info: 0 };
findings.forEach(f => counts[f.level]++);

if (opt.json) {
  console.log(JSON.stringify({ files: files.size, tokens: totalTokens, counts, findings: findings.map(f => ({ ...f, file: rel(f.file) })) }, null, 2));
} else {
  let cur = '';
  for (const f of findings) {
    if (f.level === 'info' && !opt.all) continue;
    if (f.file !== cur) { cur = f.file; console.log('\n' + bold(rel(cur))); }
    const tag = f.level === 'error' ? red('error') : f.level === 'warn' ? yellow('warn ') : dim('info ');
    console.log(`  ${dim(String(f.line).padStart(4))}  ${tag}  ${f.msg}  ${dim(f.rule)}`);
  }
  console.log(`\n${files.size} files, ≈${totalTokens} tokens · ` +
    `${counts.error ? red(counts.error + ' errors') : '0 errors'}, ${counts.warn ? yellow(counts.warn + ' warnings') : '0 warnings'}, ${counts.info} notes` +
    (findings.length ? '' : ' ' + green('✓ clean')));
}
process.exit(counts.error ? 1 : 0);
