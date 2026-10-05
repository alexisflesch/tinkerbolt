import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('ESLint ignores', () => {
  it('ignores author scratch files while still checking production source', async () => {
    const eslint = new ESLint();

    await expect(eslint.isPathIgnored('tmp/check-levels.ts')).resolves.toBe(true);
    await expect(eslint.isPathIgnored('src/domain/level-document.ts')).resolves.toBe(false);
  });
});
