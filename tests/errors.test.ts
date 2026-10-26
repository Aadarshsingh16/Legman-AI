import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  DEFAULT_SEVERITIES,
  makeError,
  isAppError,
  AppError,
} from '../src/core/errors';

describe('Error Foundation (core/errors.ts)', () => {
  it('DEFAULT_SEVERITIES contains mappings for all ErrorCode variants', () => {
    const codes: ErrorCode[] = [
      'PORT_NOT_FOUND',
      'DIRECTION_MISMATCH',
      'SELF_LOOP',
      'TYPE_MISMATCH',
      'DUPLICATE_EDGE',
      'CAPACITY_EXCEEDED',
      'CYCLE',
      'INVALID_JSON',
      'INVALID_SHAPE',
      'UNSUPPORTED_VERSION',
      'DUPLICATE_ID',
      'MISSING_REF',
      'BAD_DIRECTION',
      'BAD_PORT_TYPE',
      'ILLEGAL_EDGE',
      'NON_FINITE',
      'COMMAND_FAILED',
      'RENDER_FAILED',
      'CLIPBOARD_FAILED',
      'DOWNLOAD_FAILED',
    ];

    for (const code of codes) {
      expect(DEFAULT_SEVERITIES[code]).toBeDefined();
      expect(['error', 'warning', 'info']).toContain(DEFAULT_SEVERITIES[code]);
    }
  });

  it('makeError defaults severity using DEFAULT_SEVERITIES', () => {
    const err = makeError('PORT_NOT_FOUND', 'Port does not exist');
    expect(err.code).toBe('PORT_NOT_FOUND');
    expect(err.severity).toBe('warning');
    expect(err.message).toBe('Port does not exist');
    expect(err.path).toBeUndefined();
    expect(err.context).toBeUndefined();
  });

  it('makeError allows custom severity and extra path/context', () => {
    const err = makeError('ILLEGAL_EDGE', 'Connection failed', {
      severity: 'error',
      path: 'edges[0]',
      context: { cause: 'CYCLE' },
    });
    expect(err.code).toBe('ILLEGAL_EDGE');
    expect(err.severity).toBe('error');
    expect(err.message).toBe('Connection failed');
    expect(err.path).toBe('edges[0]');
    expect(err.context).toEqual({ cause: 'CYCLE' });
  });

  it('isAppError correctly validates objects against AppError interface', () => {
    const valid: AppError = {
      code: 'COMMAND_FAILED',
      severity: 'error',
      message: 'Command execution failed',
    };
    expect(isAppError(valid)).toBe(true);

    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError(123)).toBe(false);
    expect(isAppError({})).toBe(false);
    expect(isAppError({ code: 'COMMAND_FAILED', message: 'Missing severity' })).toBe(false);
    expect(isAppError({ code: 'COMMAND_FAILED', severity: 'error' })).toBe(false);
  });
});
