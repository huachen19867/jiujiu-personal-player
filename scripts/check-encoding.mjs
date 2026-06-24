import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.cmd',
  '.css',
  '.gradle',
  '.html',
  '.java',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.properties',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const TEXT_BASENAMES = new Set(['README', 'LICENSE']);
const MOJIBAKE_CHAR_RE =
  /[\u95c1\u940e\u93be\u6fde\u95bb\u9227\u9851\u9864\u7ecb\u951b\u59ab\u5a75\u7f01\u95b8\u941f\u6fe0\u7039\u5b95\u9a9e\u59a4\u9852]/g;

function isTextFile(filePath) {
  const base = path.basename(filePath);
  return TEXT_BASENAMES.has(base) || TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(isTextFile);

const failed = [];

for (const file of files) {
  const bytes = readFileSync(file);
  if (bytes.includes(0)) {
    continue;
  }

  const text = bytes.toString('utf8');
  const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
  const mojibakeCount = (text.match(MOJIBAKE_CHAR_RE) ?? []).length;
  const mojibakeRatio = text.length ? mojibakeCount / text.length : 0;

  if (replacementCount > 0 || (mojibakeCount >= 8 && mojibakeRatio > 0.003)) {
    failed.push({ file, replacementCount, mojibakeCount });
  }
}

if (failed.length) {
  console.error('Potential mojibake files:');
  for (const item of failed) {
    console.error(`- ${item.file} (replacement=${item.replacementCount}, mojibake=${item.mojibakeCount})`);
  }
  process.exit(1);
}

console.log(`Encoding check passed for ${files.length} text files.`);
