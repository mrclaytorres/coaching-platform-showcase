import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiAuthError,
  assertWritable,
  generateApiKey,
  verifyApiKeyFromRequest,
  type ApiKeyStore,
  type StoredApiKey,
} from '../src/api-keys/api-keys.ts';

function storeWith(keys: StoredApiKey[]): ApiKeyStore {
  return {
    async findByHash(hashedKey) {
      return keys.find((k) => k.hashedKey === hashedKey) ?? null;
    },
    async touch() {},
  };
}

const request = (token?: string) =>
  new Request('https://example.test/api/v1/bookings', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

test('valid key verifies; only the hash is stored', async () => {
  const { rawKey, hashedKey } = generateApiKey('demo_');
  assert.notEqual(rawKey, hashedKey);
  const store = storeWith([{ id: 'k1', hashedKey, isReadOnly: false, revokedAt: null }]);
  assert.deepEqual(await verifyApiKeyFromRequest(store, request(rawKey)), { id: 'k1', isReadOnly: false });
});

test('missing, unknown, and revoked keys are 401', async () => {
  const { rawKey, hashedKey } = generateApiKey('demo_');
  const store = storeWith([{ id: 'k1', hashedKey, isReadOnly: false, revokedAt: '2026-01-01T00:00:00Z' }]);
  for (const token of [undefined, 'demo_unknown', rawKey]) {
    await assert.rejects(verifyApiKeyFromRequest(store, request(token)), (e: ApiAuthError) => e.status === 401);
  }
});

test('read-only keys are rejected on writes with 403', () => {
  assert.throws(() => assertWritable({ id: 'k1', isReadOnly: true }), (e: ApiAuthError) => e.status === 403);
});
