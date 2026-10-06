# DNS Cutover and Reversal Worksheet

Complete this worksheet for staging and again for production. Store screenshots or exports in the restricted launch-evidence location. Never record passwords, API keys, recovery codes, or private client data here.

## Ownership and change window

| Field | Required value |
|---|---|
| Environment | Staging / Production |
| Application release ID |  |
| Authoritative DNS provider |  |
| Domain registrar |  |
| Primary change owner |  |
| Independent verifier |  |
| Business go/no-go owner |  |
| Planned UTC start/end |  |
| User notification required | Yes / No; location |
| Incident channel/contact |  |

## Preserve the current state

- [ ] Export the current DNS zone when supported, or capture every existing record and its TTL.
- [ ] Record the current application target and a known-good health check from an independent network.
- [ ] Confirm email-related MX, SPF, DKIM, and DMARC records will not be replaced by the portal change.
- [ ] Record the authoritative nameservers and where edits must actually be made.
- [ ] Confirm the old application remains available throughout the rollback window when applicable.

| Record | Host/name | Old value | New value | TTL before | TTL at cutover | Restore value verified |
|---|---|---|---|---:|---:|---|
| A/AAAA/CNAME |  |  |  |  |  |  |
| CAA, if changed |  |  |  |  |  |  |

## Preconditions

- [ ] The target release passed release verification and is the exact release deployed.
- [ ] HTTPS works against the target host and the certificate covers the intended name.
- [ ] Production readiness, backup, rollback point, alert receipt, and hosted role acceptance have passed.
- [ ] The old and new targets, expected response, and rollback command/path are understood by two people.
- [ ] TTL was reduced in advance when practical; otherwise the propagation allowance reflects the existing TTL.
- [ ] No unrelated DNS record will be edited.

## Timed cutover checks

Record UTC timestamps and evidence locations for each result.

| Check | Expected result | Result/time | Evidence |
|---|---|---|---|
| Authoritative lookup | New target returned |  |  |
| Independent resolver 1 | New target returned |  |  |
| Independent resolver 2 | New target returned |  |  |
| HTTP | Redirects to the exact HTTPS domain |  |  |
| TLS | Valid chain, hostname, and expiry |  |  |
| Liveness/readiness | Healthy without public dependency details |  |  |
| Login and sanitized smoke | Pass |  |  |
| External uptime monitor | Healthy |  |  |
| Existing email flow | Unaffected, if applicable |  |  |

## Reversal criteria

Reverse to the preserved value when any of these occurs and cannot be corrected inside the approved change window:

- TLS hostname or certificate validation fails;
- readiness remains unhealthy or repeated Severity 0/1 errors occur;
- authentication, cross-client isolation, uploads, or the critical workflow fails;
- the DNS record points to an unexpected address;
- monitoring cannot verify the public service from an independent network;
- the business go/no-go owner withdraws approval.

Reversal changes DNS only. It must not replace the current database with an older copy. Preserve the failed target, logs, database, uploads, and release evidence for investigation.

| Decision | UTC time | Decided by | Action/result | Evidence or issue ID |
|---|---|---|---|---|
| Go / Hold / Reverse |  |  |  |  |

## Closeout

- [ ] Verify propagation after at least the prior TTL or the provider's documented propagation allowance.
- [ ] Restore the normal TTL after stability is confirmed.
- [ ] Confirm monitoring and certificate-expiry checks use the final public name.
- [ ] Retain the old values, timestamps, screenshots/exports, smoke result, and decision record in the launch-evidence index.
- [ ] Business and technical owners sign the outcome.

