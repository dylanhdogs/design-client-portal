# Supported Client Acceptance Matrix

Use hosted staging with fictional data. This document defines what the pilot supports; it is not a promise that every historical browser or device will work. Record exact browser and operating-system versions at test time.

## Approved pilot baseline

| Client combination | Supported? | Reason or exception owner | Approval date |
|---|---|---|---|
| Current Chrome on supported Windows | Pending |  |  |
| Current Edge on supported Windows | Pending |  |  |
| Current Safari on supported macOS | Pending |  |  |
| Current Safari on supported iOS/iPadOS | Pending |  |  |
| Current Chrome on supported Android | Pending |  |  |
| Current Firefox on supported desktop OS | Pending |  |  |

The business and application owners may approve a narrower pilot baseline only when every selected participant is confirmed to use a tested combination and an unsupported-browser message/support path is documented.

## Critical task matrix

For every supported combination, test the applicable role tasks. Use Pass, Fail, or Not Applicable and link defects to the issue register.

| Browser/device/version | Login/session expiry | ADMIN access | STAFF lifecycle | CLIENT portal | Upload/download | Approval/duplicate guard | 200% zoom/mobile reflow | Result/issues |
|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |

## Required behaviors

- [ ] Login, logout, session expiry, recovery guidance, and CSRF-protected changes behave consistently.
- [ ] ADMIN can manage access without exposing secrets or bypassing last-administrator protection.
- [ ] STAFF can complete Inquiry → Design → Compliance → Pre-Construction → Procurement without database editing.
- [ ] CLIENT can see only the correct client-visible project information and cannot open another client's URL.
- [ ] Allowed files upload, preview/download, and soft-delete correctly; invalid and oversized files fail clearly.
- [ ] Back/forward navigation, refresh, direct links, validation errors, loading states, and empty states do not lose authoritative work.
- [ ] Double-click/repeated activation does not create duplicate approvals, transitions, or purchase actions.
- [ ] Touch, keyboard, focus, zoom, and reflow checks align with `ACCESSIBILITY_ACCEPTANCE_CHECKLIST.md`.
- [ ] Dates, currency, file names, tables, dialogs, and long content remain understandable at the tested viewport.

## Failure policy

- A Severity 0 or Severity 1 failure on a supported combination blocks the hosted acceptance gate.
- A combination may be removed from the pilot baseline only with a named owner, dated decision, user communication, and safe alternative.
- Lower-severity exceptions require an issue ID, workaround, owner, and target date.

| Approval | Name | UTC date | Result | Evidence/index location |
|---|---|---|---|---|
| Business owner |  |  | Pass / Fail |  |
| Application owner |  |  | Pass / Fail |  |
| Technical owner |  |  | Pass / Fail |  |

