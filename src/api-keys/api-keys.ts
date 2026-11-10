import { createHash, randomBytes } from 'node:crypto';

// API keys for the versioned public API. Only a SHA-256 hash is stored; the raw key is shown
// once at creation. Two services share the same key table, so each one prefixes its keys to
// make their origin visible at a glance.

export interface StoredApiKey {
  id: string;
  hashedKey: string;
  isReadOnly: boolean;
  revokedAt: string | null;
}

export interface ApiKeyStore {
  findByHash(hashedKey: string): Promise<StoredApiKey | null>;
  touch(id: string): Promise<void>;
}

export interface VerifiedApiKey {
  id: string;
  isReadOnly: boolean;
}

export class ApiAuthError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiAuthError';
  }
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function generateApiKey(prefix: string): { rawKey: string; hashedKey: string } {
  const rawKey = `${prefix}${randomBytes(24).toString('hex')}`;
  return { rawKey, hashedKey: hashApiKey(rawKey) };
}

export async function verifyApiKeyFromRequest(
  store: ApiKeyStore,
  request: Request,
): Promise<VerifiedApiKey> {
  const header = request.headers.get('authorization');
  const rawKey = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!rawKey) throw new ApiAuthError(401, 'Missing bearer token');

  const key = await store.findByHash(hashApiKey(rawKey));
  if (!key || key.revokedAt) throw new ApiAuthError(401, 'Invalid or revoked API key');

  await store.touch(key.id);
  return { id: key.id, isReadOnly: key.isReadOnly };
}

// A read-only key gets 403 on any write endpoint.
export function assertWritable(key: VerifiedApiKey): void {
  if (key.isReadOnly) throw new ApiAuthError(403, 'This API key is read-only');
}
