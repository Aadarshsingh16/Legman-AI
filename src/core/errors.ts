export type ErrorCode =
  // connection (canConnect)
  | 'PORT_NOT_FOUND'
  | 'DIRECTION_MISMATCH'
  | 'SELF_LOOP'
  | 'TYPE_MISMATCH'
  | 'DUPLICATE_EDGE'
  | 'CAPACITY_EXCEEDED'
  | 'CYCLE'
  // schema / import
  | 'INVALID_JSON'
  | 'INVALID_SHAPE'
  | 'UNSUPPORTED_VERSION'
  | 'DUPLICATE_ID'
  | 'MISSING_REF'
  | 'BAD_DIRECTION'
  | 'BAD_PORT_TYPE'
  | 'ILLEGAL_EDGE'
  | 'NON_FINITE'
  // runtime
  | 'COMMAND_FAILED'
  | 'RENDER_FAILED'
  | 'CLIPBOARD_FAILED'
  | 'DOWNLOAD_FAILED';

export type Severity = 'error' | 'warning' | 'info';

export interface AppError {
  code: ErrorCode;
  severity: Severity;
  message: string;
  path?: string; // e.g. "edges[3].target.portId" (schema errors)
  context?: Record<string, unknown>;
}

export interface Issue {
  id: string; // stable: `${ruleId}:${target.kind}:${target.id ?? 'graph'}:${target.portId ?? ''}`
  ruleId: string;
  severity: Severity;
  message: string;
  target: { kind: 'node' | 'edge' | 'graph'; id?: string; portId?: string };
}

export const DEFAULT_SEVERITIES: Record<ErrorCode, Severity> = {
  // connection
  PORT_NOT_FOUND: 'warning',
  DIRECTION_MISMATCH: 'warning',
  SELF_LOOP: 'warning',
  TYPE_MISMATCH: 'warning',
  DUPLICATE_EDGE: 'warning',
  CAPACITY_EXCEEDED: 'warning',
  CYCLE: 'warning',

  // schema / import
  INVALID_JSON: 'error',
  INVALID_SHAPE: 'error',
  UNSUPPORTED_VERSION: 'error',
  DUPLICATE_ID: 'error',
  MISSING_REF: 'error',
  BAD_DIRECTION: 'error',
  BAD_PORT_TYPE: 'error',
  ILLEGAL_EDGE: 'error',
  NON_FINITE: 'error',

  // runtime
  COMMAND_FAILED: 'error',
  RENDER_FAILED: 'error',
  CLIPBOARD_FAILED: 'warning',
  DOWNLOAD_FAILED: 'warning',
};

export function makeError(
  code: ErrorCode,
  message: string,
  extra?: {
    severity?: Severity;
    path?: string;
    context?: Record<string, unknown>;
  }
): AppError {
  return {
    code,
    severity: extra?.severity ?? DEFAULT_SEVERITIES[code] ?? 'error',
    message,
    ...(extra?.path !== undefined ? { path: extra.path } : {}),
    ...(extra?.context !== undefined ? { context: extra.context } : {}),
  };
}

export function isAppError(x: unknown): x is AppError {
  if (typeof x !== 'object' || x === null) return false;
  const candidate = x as Record<string, unknown>;
  return (
    typeof candidate['code'] === 'string' &&
    typeof candidate['severity'] === 'string' &&
    typeof candidate['message'] === 'string'
  );
}
