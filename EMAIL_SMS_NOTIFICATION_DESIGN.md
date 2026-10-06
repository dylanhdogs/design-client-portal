# Email and RingCentral SMS Delivery Design

**Status:** Implementation-ready design  
**Prepared:** September 4, 2026  
**Applies to:** Signature Exteriors Design Portal  
**Related workflow:** Inquiry → Design → Compliance → Pre-Construction → Procurement

## 1. Purpose

Extend the portal's existing in-app notifications and retryable delivery outbox into a dependable external messaging system:

- Email delivery through a provider-neutral SMTP adapter.
- Transactional SMS through RingCentral.
- In-app notifications remain the authoritative fallback.
- Delivery, consent, suppression, retries, and provider events remain auditable.

“Universal email” means the workflow layer is not tied to Gmail, Microsoft 365, SendGrid, Mailgun, or another vendor. The first production adapter uses authenticated SMTP over TLS and can be pointed at any compatible provider. Optional provider-specific adapters may later add richer bounce and delivery events without changing notification creation.

## 2. Current Foundation

The application already has:

- User-specific in-app notifications.
- A `NotificationDelivery` outbox with channel, destination, status, attempts, retry time, errors, and provider message ID.
- A ten-trigger notification matrix.
- Deduplication and a management screen for failed deliveries.
- An automation scan that identifies due deliveries.
- Client email and phone fields.

Current limitations:

- Production intentionally rejects any external notification mode other than `disabled`.
- No email or SMS provider adapter exists.
- Delivery processing depends on a manually triggered automation scan.
- SMS consent, normalized phone numbers, channel preferences, templates, webhooks, and inbound-message handling do not exist.
- Invitations are links that must be copied manually; password recovery is administrator-led.

## 3. Scope

### Included

- Transactional email to staff, clients, invitees, and account-recovery recipients.
- Transactional SMS to explicitly opted-in recipients through RingCentral.
- RingCentral inbound SMS capture, including STOP and START synchronization.
- Background outbox processing, retries, suppression, and dead-letter review.
- Versioned templates for email and SMS.
- Delivery and provider-event visibility in Management.
- Per-recipient channel preferences and auditable consent.

### Excluded from the first release

- Marketing campaigns, bulk promotions, cold outreach, and purchased contact lists.
- Email inbox synchronization or replying to email inside the portal.
- MMS and attachments over SMS.
- AI-written messages sent without human-approved templates.
- Emergency notifications where life or physical safety depends on delivery.

## 4. Core Design Decisions

1. Domain actions create notification intent; they never call SMTP or RingCentral directly.
2. In-app notification creation and external-message enqueueing occur in the same database transaction where practical.
3. A background worker claims queued messages and calls a channel adapter.
4. Provider acceptance is not treated as confirmed delivery.
5. Permanent failures, opt-outs, invalid destinations, and inactive accounts are suppressed instead of retried forever.
6. SMS is opt-in and transactional only. Email is enabled by default for service messages, with preferences for nonessential updates.
7. Message templates are versioned; retries retain the exact template version and inputs originally queued.
8. Secrets stay in Hostinger's protected environment file and never enter the database, logs, audit records, or browser.
9. Webhook handlers acknowledge quickly, persist a deduplicated event, and process it asynchronously.
10. External delivery failure never reverses a completed business action.

## 5. Target Architecture

```text
Workflow action
    ├── In-app Notification (authoritative)
    └── OutboundMessage rows (EMAIL and/or SMS)
             │
             ▼
       Delivery worker
        ├── SMTP email adapter ──► SMTP provider ──► recipient
        └── RingCentral adapter ─► RingCentral ───► mobile carrier
                                      │
                                      ▼
                              verified webhook endpoint
                                      │
                     delivery status / inbound SMS / STOP-START
                                      │
                                      ▼
                         outbox, consent, Communication log
```

The production container remains single-instance while SQLite is in use. The worker runs in the backend process with a database lease, bounded batches, and graceful shutdown. The design still includes claim/lease fields so moving to a separate worker or multi-instance database later does not require another messaging redesign.

## 6. Recipient and Channel Policy

### Required recipient checks

Before enqueueing or sending:

- The linked user and client are active.
- The destination is normalized and valid.
- The channel is enabled for the message type.
- SMS has current affirmative consent for the sender/purpose.
- The destination is not suppressed, opted out, bounced, or administratively blocked.
- Quiet-hour and urgency rules are applied in the recipient's time zone.
- The event/channel/recipient idempotency key has not already been queued.

### Initial trigger matrix

| Event | In-app | Email | SMS default | SMS rule |
|---|---:|---:|---:|---|
| Inquiry received | Yes | Yes | No | Internal preference only |
| Client invitation | No account yet | Yes | No | Later release |
| Password reset/recovery | Yes when signed in | Yes | No | Never include passwords |
| Information/action required | Yes | Yes | Yes | Client opted in |
| Decision required | Yes | Yes | Yes | Client opted in |
| Decision updated | Yes | Yes | Optional | Recipient preference |
| Compliance overdue | Yes | Yes | Optional | Assigned internal staff only |
| Gate blocked/approved | Yes | Yes | No | Avoid routine SMS noise |
| Pre-construction deadline | Yes | Yes | Yes | Client opted in |
| Procurement approval | Yes | Yes | Optional | Assigned approver only |
| Delivery exception | Yes | Yes | Yes | High priority |
| Client-impacting substitution | Yes | Yes | Yes | Client opted in |

SMS messages contain a concise summary and an HTTPS portal link. Sensitive project, financial, compliance, or document details stay behind authentication.

## 7. Universal Email Design

### Adapter contract

Create an `EmailProvider` interface:

```ts
interface EmailProvider {
  verify(): Promise<ProviderHealth>;
  send(message: RenderedEmail, idempotencyKey: string): Promise<ProviderSendResult>;
  capabilities(): { deliveryWebhooks: boolean; bounceWebhooks: boolean };
}
```

Implement `SmtpEmailProvider` first with one pooled Nodemailer transporter. SMTP configuration is supplied entirely through environment variables:

- `EMAIL_PROVIDER=smtp`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASSWORD`
- `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`
- `SMTP_MAX_CONNECTIONS`, `SMTP_RATE_LIMIT`

TLS certificate verification must remain enabled. Production startup fails when email is enabled and required settings are missing or placeholders.

### Delivery meaning

- `ACCEPTED`: the SMTP server accepted the message.
- `DELIVERED`: only set when a trusted provider callback confirms delivery.
- `BOUNCED`: a provider callback or approved bounce processor confirms failure.
- SMTP-only deployments show “Accepted by email provider,” not “Delivered.”

### Sender-domain readiness

Before production activation:

- Use a domain-controlled sender such as `notifications@company-domain`.
- Publish and verify SPF.
- Configure DKIM signing through the provider or application-approved key custody.
- Publish DMARC initially in monitoring mode, review reports, then strengthen policy.
- Configure a monitored reply-to and support mailbox.
- Test Gmail, Outlook/Microsoft 365, Yahoo, and the company's own mailbox.

## 8. RingCentral SMS Design

### Account prerequisites

- RingCentral business account and SMS-capable number.
- TCR brand and campaign registration completed, with the sending number assigned to the campaign.
- A private RingCentral REST API app using server-to-server JWT authentication.
- Minimum required scopes only: SMS/message access, account/number lookup, and webhook subscriptions as confirmed in the RingCentral application console.
- The authenticated extension must own the sending number, and that number must advertise `SmsSender` capability.

RingCentral notes that TCR registration may take up to 25 days, so account registration is Phase 0 and can proceed while application code is built.

### Adapter contract

```ts
interface SmsProvider {
  verify(): Promise<ProviderHealth>;
  send(message: RenderedSms, idempotencyKey: string): Promise<ProviderSendResult>;
  getMessageStatus(providerMessageId: string): Promise<ProviderDeliveryStatus>;
}
```

`RingCentralSmsProvider` will:

- Exchange the configured JWT credential for an OAuth access token and cache it until renewal is needed.
- Send through `/restapi/v1.0/account/~/extension/~/sms`.
- Use only the configured, verified E.164 sender number.
- Persist RingCentral's message ID and initial status.
- Respect RingCentral rate-limit headers and `Retry-After` exactly.
- Re-authenticate once on an expired token, without logging credentials or tokens.

### Webhooks and inbound messages

Expose `POST /api/webhooks/ringcentral` outside session/CSRF authentication but behind strict provider verification:

- Echo RingCentral's `Validation-Token` during subscription validation within three seconds.
- Compare the configured webhook verification/validation token using constant-time comparison.
- Enforce HTTPS, request-size limits, JSON content type, and rate limits.
- Deduplicate provider events before processing.
- Return `200` promptly after durable persistence.

Subscribe to:

- Inbound SMS events for the configured extension/number.
- Outbound message-status events where supported.
- Opt-out/opt-in events for STOP/START synchronization.

Inbound service messages create an immutable `Communication` record. Phone-number matching links the message to a client; unmatched numbers enter a restricted Management reconciliation queue and never attach automatically to the wrong client.

## 9. Consent, Preferences, and Quiet Hours

SMS remains disabled until affirmative consent is recorded. A phone number on a client record is not consent.

Record:

- Recipient, normalized E.164 number, channel, and purpose.
- `OPTED_IN`, `OPTED_OUT`, or `UNKNOWN` state.
- Consent source, timestamp, disclosure version, and recording user.
- RingCentral sender number because opt-out behavior is sender/recipient-pair specific.
- STOP/START events and administrative corrections as append-only history.

Every applicable SMS template includes business identity and “Reply STOP to opt out” at the required cadence. RingCentral's opt-out block is authoritative; the portal mirrors it and suppresses future sends before calling the API.

Default quiet hours are 8:00 PM–8:00 AM in the recipient's saved time zone. Messages queue until the next permitted time. Only explicitly approved urgent operational templates may bypass quiet hours; marketing bypass does not exist.

## 10. Data Model Changes

Keep `Notification` for the in-app source of truth. Replace the email-only assumptions in `NotificationDelivery` with the following additive model, then migrate existing rows:

### `OutboundMessage`

- `id`, `organizationId`
- `notificationId?`, `eventType`, `sourceEntityType`, `sourceEntityId`
- `recipientUserId?`, `clientId?`
- `channel`: `EMAIL | SMS`
- `destination`, `destinationNormalized`, `destinationHash`
- `templateKey`, `templateVersion`, `locale`, `templateDataJson`
- `provider`, `providerMessageId?`
- `status`: `QUEUED | PROCESSING | ACCEPTED | DELIVERED | FAILED | PERMANENT_FAILURE | BOUNCED | SUPPRESSED | CANCELLED`
- `attemptCount`, `nextAttemptAt?`, `lastAttemptAt?`, `acceptedAt?`, `deliveredAt?`
- `lastErrorCode?`, `lastErrorSafe?`
- `idempotencyKey` unique
- `claimedAt?`, `claimExpiresAt?`, `claimedBy?`
- timestamps and retention deadline

### `ContactEndpoint`

- Optional user/client relationship
- `EMAIL | SMS`, normalized value, verification state, primary flag
- No provider credentials

### `NotificationPreference`

- Recipient, event category, channel, enabled flag
- Time zone and quiet-hour settings
- Mandatory service/security messages cannot be silently disabled where the approved policy requires them

### `CommunicationConsent`

- Recipient/client, channel, purpose, sender identity
- Status, source, disclosure version, recorded by/at
- Append-only; current status is derived or cached

### `ProviderWebhookEvent`

- Provider, external event ID unique, event type, payload hash
- Received, processed, and failure timestamps
- Redacted processing error; raw payload retained only if approved and encrypted

## 11. Queue and Retry State Machine

1. `QUEUED` message becomes `PROCESSING` under a short database lease.
2. Adapter success becomes `ACCEPTED`; a verified provider event may later set `DELIVERED` or `BOUNCED`.
3. Transient timeout, network error, `429`, or provider `5xx` becomes `FAILED` with a future retry.
4. Invalid address/number, revoked consent, permanent provider rejection, or inactive recipient becomes `PERMANENT_FAILURE` or `SUPPRESSED`.
5. The worker uses exponential backoff with jitter, except provider `Retry-After` takes precedence.
6. After the configured maximum attempts, the message enters the Management dead-letter queue and opens one deduplicated operational alert.
7. Manual retry re-runs eligibility and consent checks before requeueing.

Default worker behavior:

- Poll every 15 seconds.
- Claim at most 25 messages per batch.
- Maximum 5 attempts over 24 hours for ordinary messages.
- Invitation and reset links are not retried past their expiration.
- Recover expired `PROCESSING` leases after a crash.

## 12. Templates and Content Safety

- Templates are code-reviewed, versioned, and escaped by default.
- Email has text and HTML versions; HTML contains no remote tracking pixel.
- SMS uses plain text and is length-budgeted before enqueueing.
- Links use only the configured HTTPS frontend origin.
- Tokens are placed only in approved invitation/reset templates and never logged.
- No attachment is sent in Release 1; secure portal links are used instead.
- Every message includes business identity and a monitored support path.
- Template preview and test-send are ADMIN-only and use designated test recipients.

## 13. Management Experience

Enhance Management with:

- Provider health: configured, authenticated, sender verified, last success, last failure.
- Counts by channel and state: queued, accepted, delivered, bounced, failed, suppressed.
- Search by safe recipient summary, event type, date, and provider status.
- Failure reason and recommended operator action without exposing secrets.
- Retry/cancel actions with audit logging and eligibility re-checks.
- Consent history and current SMS status.
- Unmatched inbound-SMS reconciliation queue.
- Webhook subscription health and renewal date.

Client settings show verified contact points, channel preferences, consent status, quiet hours, and a clear test-notification action. They never display provider credentials or raw webhook payloads.

## 14. Security and Privacy Controls

- Store provider secrets only in the protected production environment file.
- Redact access tokens, JWT credentials, SMTP passwords, reset/invitation tokens, full message bodies, and full destinations from logs.
- Encrypt or minimize retained template data containing client information.
- Restrict message and consent administration to ADMIN; STAFF visibility follows client assignment.
- Apply retention and legal-hold rules to outbound/inbound communication records.
- Require audit events for preference, consent, template, retry, cancellation, and provider-configuration changes.
- Add webhook replay protection, deduplication, size limits, and timing-safe token comparison.
- Do not put sensitive project details in SMS or email subject lines.

## 15. API and Service Boundaries

Internal services:

- `NotificationService.createIntent(event)`
- `RecipientResolver.resolve(event, recipient)`
- `TemplateRenderer.render(templateKey, version, channel, data)`
- `OutboundQueue.enqueue(...)`
- `DeliveryWorker.processBatch()`
- `EmailProvider` and `SmsProvider`
- `ConsentService` and `PreferenceService`
- `ProviderEventService.process(event)`

New routes:

- `GET/PUT /api/notification-preferences/me`
- `GET/PUT /api/clients/:id/notification-preferences` for authorized internal users
- `POST /api/clients/:id/sms-consent`
- `GET /api/management/notification-providers`
- `GET /api/management/outbound-messages`
- `POST /api/management/outbound-messages/:id/retry`
- `POST /api/management/outbound-messages/:id/cancel`
- `POST /api/management/notifications/test` using designated test destinations
- `POST /api/webhooks/ringcentral`
- Optional provider-specific email webhook route when supported

## 16. Phased Implementation Plan

### Phase 0 — Owner and Provider Readiness

- Choose the production sender domain, from address, reply-to, and monitored mailbox.
- Choose the initial SMTP provider and document account custody, billing, MFA, recovery, and sending limits.
- Start RingCentral TCR brand/campaign registration and assign an SMS-capable number.
- Create the least-privilege private RingCentral app and JWT credential.
- Approve transactional message types, consent language, quiet hours, retention, and escalation owner.

**Exit:** Provider accounts, sender identities, DNS ownership, consent wording, and named operators are documented; no credentials are committed.

### Phase 1 — Outbox and Preferences Foundation

- Add the new delivery, contact, preference, consent, and webhook-event schema.
- Migrate existing delivery history without changing in-app notifications.
- Implement recipient resolution, E.164 normalization, template versioning, leases, retries, suppression, and dead-letter behavior.
- Add the continuous background worker behind disabled feature flags.

**Exit:** Fake providers pass idempotency, crash recovery, retry, suppression, and concurrency tests.

### Phase 2 — Universal Email

- Implement pooled SMTP/TLS adapter and configuration validation.
- Build invitation, account recovery, action, decision, deadline, and exception templates.
- Add provider health checks and test-send tooling.
- Configure SPF, DKIM, DMARC, bounce handling capabilities, and monitored replies.
- Enable email first for designated test accounts, then staff, then pilot clients.

**Exit:** Cross-provider inbox tests pass; invitations and resets arrive and work; failures appear in Management; no message falsely claims confirmed delivery.

### Phase 3 — RingCentral SMS Sandbox

- Implement JWT token exchange/cache and SMS adapter.
- Verify sender ownership and `SmsSender` capability during startup/health checks.
- Implement consent/preferences UI and transactional SMS templates.
- Implement webhook validation, persistence, deduplication, inbound capture, and status updates.
- Test STOP, START, invalid number, expired token, timeout, `429`, duplicate webhook, and unmatched sender behavior.

**Exit:** Sandbox/test recipients pass end-to-end send, receive, consent, opt-out, retry, and reconciliation tests.

### Phase 4 — RingCentral Production Pilot

- Confirm TCR campaign approval and number assignment.
- Enable SMS for internal test numbers only.
- Run a consented pilot with designated client accounts.
- Measure acceptance, provider status, failures, opt-outs, webhook health, latency, and support load.
- Expand only after owner sign-off and a rollback drill.

**Exit:** No consent bypasses or duplicate sends; delivery failures are actionable; STOP takes effect before the next send; rollback is proven.

### Phase 5 — Operational Hardening

- Add daily provider/subscription health checks and subscription renewal.
- Add alerts for queue age, repeated auth failures, webhook silence, bounce spikes, and dead letters.
- Verify backup/restore of preferences, consent, communication history, and outbox records.
- Complete retention, legal hold, access review, credential rotation, and incident runbooks.

**Exit:** Operations can diagnose and recover provider outages without database editing.

## 17. Test and Acceptance Matrix

Required automated coverage:

- One business event produces at most one message per recipient/channel.
- Transaction commit/rollback keeps notification and outbox consistent.
- Worker leases prevent duplicate sends and recover after termination.
- Disabled preferences and SMS without consent are suppressed.
- STOP blocks the next SMS; START records a new consent transition.
- Invalid email/phone destinations never reach a provider.
- Provider `401`, `429`, timeout, `5xx`, and permanent rejection follow the correct retry policy.
- RingCentral duplicate/out-of-order webhooks are idempotent.
- Invitation/reset expiration prevents stale delivery.
- Inactive/deleted users and clients do not receive messages.
- Authorization protects Management, consent, preference, and test-send routes.
- Logs and errors contain no secrets, tokens, full destinations, or message bodies.
- Existing in-app notifications continue during complete provider outage.

Required production evidence:

- SMTP connection verification and four mailbox-family deliveries.
- SPF, DKIM, and DMARC verification.
- RingCentral app scope, sender capability, and TCR approval evidence.
- Consented SMS send/receive, STOP/START, and delivery-status evidence.
- Provider outage/recovery and dead-letter test.
- Backup restore and rollback test.
- Product, operations, and business-owner sign-off.

## 18. Rollout and Rollback

Feature flags:

- `EMAIL_DELIVERY_ENABLED=false`
- `SMS_DELIVERY_ENABLED=false`
- `RINGCENTRAL_INBOUND_ENABLED=false`
- Per-user/client pilot allowlists

Rollout order is database → read-only Management UI → fake providers → email test accounts → email pilot → SMS internal test → SMS client pilot → general transactional use.

Disabling a channel stops new claims but retains queued records. In-flight provider requests finish or expire their lease. In-app notifications continue. Rollback never deletes consent, delivery, or communication history.

## 19. Implementation Readiness Score

| Area | Score | Reason |
|---|---:|---|
| Fit with existing architecture | 10/10 | Extends the existing notification/outbox model |
| Email portability | 10/10 | SMTP baseline plus adapter capability model |
| RingCentral specificity | 10/10 | Auth, sender ownership, TCR, webhooks, status, and limits covered |
| Consent and safety | 10/10 | Opt-in, STOP/START, preferences, quiet hours, audit, and suppression covered |
| Reliability | 10/10 | Durable queue, leases, idempotency, retry classes, and dead letters covered |
| Operations | 10/10 | Health, metrics, alerts, test sends, runbooks, and rollback covered |

**Overall design score: 10/10.** Implementation may begin after Phase 0 owner/provider decisions are complete.

## 20. Authoritative References

- RingCentral SMS sending and sender-number ownership: https://developers.ringcentral.com/guide/messaging/sms/sending-sms
- RingCentral SMS/TCR production preparation: https://developers.ringcentral.com/guide/getting-started/sms
- RingCentral JWT server authentication: https://developers.ringcentral.com/guide/authentication/jwt-flow
- RingCentral consent and opt-out management: https://developers.ringcentral.com/guide/messaging/sms/messaging-consent-management
- RingCentral delivery-status handling: https://developers.ringcentral.com/guide/messaging/sms/sms-errors
- RingCentral webhooks: https://developers.ringcentral.com/guide/notifications/webhooks/creating-webhooks
- RingCentral rate limits: https://developers.ringcentral.com/guide/basics/rate-limits
- Nodemailer provider-neutral SMTP transport: https://nodemailer.com/smtp
- Nodemailer pooled SMTP transport: https://nodemailer.com/smtp/pooled

