const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const deepFreeze = <T>(value: T): T => {
  if (!isObjectLike(value)) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const next = record[key];
    if (isObjectLike(next) && !Object.isFrozen(next)) {
      deepFreeze(next);
    }
  }

  return Object.freeze(value);
};
