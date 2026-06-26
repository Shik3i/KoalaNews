import { NextResponse } from 'next/server';

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function asTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function asOptionalTrimmedString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return asTrimmedString(value, maxLength);
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function asBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : fallback;
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function isSafeSameOriginRequest(request: Request): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return true;

  const host = request.headers.get('host');
  if (!host) return false;

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get('referer');
  if (!referer) return false;

  try {
    return new URL(referer).host === host;
  } catch {
    return false;
  }
}
