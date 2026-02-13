import { validateResolvedGameConfigV1 } from '../guards/validate-resolved-v1';
import { resolvedConfigExample } from './resolved-config.example';

describe('resolvedConfigExample', () => {
  it('conforms to ResolvedGameConfigV1 runtime guard checks', () => {
    const result = validateResolvedGameConfigV1(resolvedConfigExample);
    if (!result.ok) {
      throw new Error(result.errors.map((error) => error.message).join('\n'));
    }
    expect(result.ok).toBe(true);
  });

  it('includes stable hash metadata fields', () => {
    expect(resolvedConfigExample.configHash).toMatch(/^[a-f0-9]{64}$/);
    expect(resolvedConfigExample.versionHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
