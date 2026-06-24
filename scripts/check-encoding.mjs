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
const MOJIBAKE_CHAR_RE = /[闁鐎鎾濞閻鈧顑顤绋锛妫婵缁閸鐟濠瀹宕骞妤顒]/g;

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
  console.error('疑似编码损坏文件：');
  for (const item of failed) {
    console.error(`- ${item.file} (replacement=${item.replacementCount}, mojibake=${item.mojibakeCount})`);
  }
  process.exit(1);
}

console.log(`Encoding check passed for ${files.length} text files.`);
