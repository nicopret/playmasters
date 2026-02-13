import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.join(__dirname, '..');
const FORBIDDEN_PATTERNS = [/fetch\(/, /axios\./, /XMLHttpRequest/, /\/api\//];

const collectTsFiles = (dir: string): string[] => {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }
    if (
      entry.isFile() &&
      fullPath.endsWith('.ts') &&
      !fullPath.endsWith('.spec.ts')
    ) {
      files.push(fullPath);
    }
  }
  return files;
};

describe('gameplay systems config access', () => {
  it('does not fetch runtime config from network inside game package', () => {
    const files = collectTsFiles(SRC_ROOT);
    const offenders: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(content))) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
