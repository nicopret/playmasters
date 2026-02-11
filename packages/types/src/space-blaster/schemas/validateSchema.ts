import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';

export type ValidationIssue = {
  severity: 'error' | 'warning';
  stage: 'schema' | 'structural' | 'cross-reference' | 'resolution' | 'assets';
  domain: string;
  sourceId?: string;
  path: string;
  message: string;
};

const ajv: Ajv = new Ajv2020({
  strict: false,
  allErrors: true,
});

const schemaCache = new Map<string, ValidateFunction>();

function formatPath(instancePath: string) {
  return instancePath.startsWith('/')
    ? instancePath.slice(1).replace(/\//g, '.')
    : instancePath;
}

function toIssues(domain: string, errors: ErrorObject[]): ValidationIssue[] {
  return errors.map((err) => ({
    severity: 'error',
    stage: 'schema',
    domain,
    path: formatPath(err.instancePath),
    message: err.message ?? 'Invalid value',
  }));
}

export function validateSchema<T>(
  domain: string,
  schema: object,
  payload: T,
): { valid: boolean; issues: ValidationIssue[] } {
  let validator = schemaCache.get(domain);
  if (!validator) {
    validator = ajv.compile(schema);
    schemaCache.set(domain, validator);
  }

  const valid = validator(payload) as boolean;
  if (valid) {
    return { valid: true, issues: [] };
  }

  return {
    valid: false,
    issues: toIssues(domain, validator.errors ?? []),
  };
}
