/**
 * Validates a risk config and merges overrides safely (R32, R33). The rules live in
 * risk-config-rules.ts; each one returns plain-text problems.
 */
import { checkAll, isPlainObject } from './risk-config-rules.ts';
import type { RiskConfig, RiskConfigOverrides } from './types.ts';

interface ValidateOptions {
  /** Reason keys the factors can return; each needs wording in the config. */
  requiredReasonKeys?: string[];
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check a config. Returns a list of problems; an empty list means the config is valid.
 * @param {object} config
 * @param {{ requiredReasonKeys?: string[] }} [options] reason keys the factors can return
 */
export function validateConfig(config: unknown, options: ValidateOptions = {}): string[] {
  if (!isPlainObject(config)) {
    return ['config must be an object'];
  }
  return checkAll(config, options.requiredReasonKeys ?? []);
}

export class ConfigValidationError extends Error {
  problems: string[];

  constructor(problems: string[]) {
    super(`Invalid risk config:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigValidationError';
    this.problems = problems;
  }
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (UNSAFE_KEYS.has(key)) {
      continue;
    }
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      mergeInto(target[key], source[key]);
    } else {
      target[key] = structuredClone(source[key]);
    }
  }
}

/**
 * Copy a base config, apply overrides on top (objects merge, arrays and values replace),
 * then validate. The base is never changed.
 * @throws {ConfigValidationError} when the merged config breaks a rule
 */
export function mergeConfig(
  base: RiskConfig,
  overrides: RiskConfigOverrides = {},
  options: ValidateOptions = {},
): RiskConfig {
  const merged = structuredClone(base);
  if (isPlainObject(overrides)) {
    mergeInto(merged as unknown as Record<string, unknown>, overrides as Record<string, unknown>);
  }
  const problems = validateConfig(merged, options);
  if (problems.length > 0) {
    throw new ConfigValidationError(problems);
  }
  return merged;
}
