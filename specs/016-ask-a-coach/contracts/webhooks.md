# Contract: Outbound Webhooks

FR-031. Every registered, active `webhook_subscriptions` row subscribed to a given event type
receives a signed POST when that event occurs.

## Events

| Event | Fires when | Payload includes |
|---|---|---|
| `submission.created` | A submission reaches `status = 'ready'` (not on `processing` — a host app should only be told about a submission it can actually act on) | `conversationId`, `submissionId`, `studentId`/`externalUserId`, `type`, `createdAt` |
| `reply.created` | A coach or student reply reaches `status = 'ready'` | `conversationId`, `replyId`, `authorType`, `authorStaffId` (if coach), `type`, `durationSeconds` (coach video/audio only, else `null`), `createdAt` |
| `conversation.closed` | A conversation's `status` transitions to `'closed'` | `conversationId`, `closedAt` |

## Signing

Each subscription has its own `signing_secret` (data-model.md). Every delivery includes an
`X-Webhook-Signature` header: HMAC-SHA256 of the raw request body using that secret, matching
the pattern this monorepo already uses for verifying *inbound* Stripe/Mux webhooks, applied here
in reverse for *outbound* ones — the receiving host app is expected to verify it the same way
this app verifies Stripe's signature in `apps/academy-platform`.

## Retry

A `webhook_deliveries` row is created per event per subscription (data-model.md). On a non-2xx
response or timeout, `attempt_count` increments and `next_retry_at` is set using exponential
backoff (exact schedule — e.g. 1m/5m/30m/2h/12h — is an implementation detail for
`/speckit-tasks`). After a final failed attempt, `status` becomes `'failed'` and stays there —
visible via the delivery log, not silently dropped (FR-031's "delivery log").

## Inbound: Mux → this app

Separate from the outbound contract above — `apps/ask-a-coach/src/app/api/webhooks/mux/route.ts`
receives Mux's own signed webhooks (`video.asset.ready`, `video.asset.errored`), verified using
Mux's webhook-signing-secret mechanism (`@mux/mux-node`'s built-in verifier), and is what
actually sets `submissions.status`/`replies.status` to `'ready'`/`'failed'` and populates
`duration_seconds` — the trigger for the `submission.created`/`reply.created` outbound events
above, not a webhook a host app subscribes to directly.
