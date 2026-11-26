/**
 * Validates a risk config and merges overrides safely (R32, R33). The rules live in
 * risk-config-rules.js; each one returns plain-text problems.
 */
import { checkAll, isPlainObject } from './risk-config-rules.js';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check a config. Returns a list of problems; an empty list means the config is valid.
 * @param {object} config
 * @param {{ requiredReasonKeys?: string[] }} [options] reason keys the factors can return
 */
export function validateConfig(config, options = {}) {
  if (!isPlainObject(config)) {
    return ['config must be an object'];
  }
  return checkAll(config, options.requiredReasonKeys ?? []);
}

export class ConfigValidationError extends Error {
  constructor(problems) {
    super(`Invalid risk config:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigValidationError';
    this.problems = problems;
  }
}

function mergeInto(target, source) {
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
export function mergeConfig(base, overrides = {}, options = {}) {
  const merged = structuredClone(base);
  if (isPlainObject(overrides)) {
    mergeInto(merged, overrides);
  }
  const problems = validateConfig(merged, options);
  if (problems.length > 0) {
    throw new ConfigValidationError(problems);
  }
  return merged;
}
