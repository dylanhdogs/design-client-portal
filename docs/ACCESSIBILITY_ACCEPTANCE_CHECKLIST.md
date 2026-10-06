# Accessibility Acceptance Checklist

Use this checklist on the hosted staging release before pilot approval. The target is WCAG 2.2 AA behavior on the critical workflow, not a claim of formal legal certification.

## Required Pages and Roles

Test at minimum:

- public login, forgot-password, and reset-password pages;
- ADMIN management dashboard and account recovery;
- STAFF client record, project command center, and each Inquiry → Design → Compliance → Pre-Construction → Procurement workspace;
- CLIENT project overview, document handling, decisions, and substitution authorization;
- common loading, empty, validation-error, permission-denied, blocked-gate, and success states.

## Automated Checks

- Run an accessibility scanner at desktop and mobile widths on every page above.
- Record the tool/version, URL, role, viewport, date, and exported result.
- Resolve every critical or serious finding before pilot; record an owner and due date for any lower-severity exception.
- Re-run after fixes and retain the clean result with release evidence.

## Keyboard and Focus Checks

- Complete each critical task using only Tab, Shift+Tab, Enter, Space, arrow keys, and Escape.
- Confirm visible focus is never lost or hidden behind sticky content.
- Confirm focus enters an opened dialog/drawer, remains logically contained, and returns to the trigger after close.
- Confirm skip/navigation order, menus, tables, file controls, and destructive confirmations are operable without a pointer.
- Confirm no action fires unexpectedly from focus alone and no keyboard trap exists.

## Screen Reader and Content Checks

- Run a smoke test with an available screen reader on Windows or the pilot user's actual platform.
- Confirm page title, one descriptive H1, landmark order, field labels, required state, errors, status changes, and button names are announced meaningfully.
- Confirm blockers and approvals make sense without color, icon shape, or visual position.
- Confirm tables expose meaningful headers and horizontally scrolling regions remain understandable.
- Confirm images that carry meaning have useful alternative text; decorative images are ignored.

## Visual and Input Checks

- Verify text at 200% zoom and reflow at 320 CSS pixels without loss of task functionality.
- Verify text/background and focus-indicator contrast with a measured tool.
- Verify controls have practical touch targets and do not depend on hover.
- Verify validation identifies the field, explains the correction, preserves entered values when safe, and provides an error summary for multi-field failures.
- Verify time limits/session expiry warn the user where practical and never silently submit partial authoritative work.

## Acceptance Evidence

| Field | Required evidence |
|---|---|
| Release/domain | Hosted staging release ID and HTTPS URL |
| Automated scan | Exported results for all required pages and states |
| Keyboard review | Tester, date, browser, passed tasks, and defects |
| Screen-reader review | Tester, assistive technology/version, passed tasks, and defects |
| Exceptions | Severity, affected role/task, safe workaround, owner, and target date |
| Approval | Business owner and technical owner names/dates |

The accessibility gate passes only when no critical or serious issue blocks a critical task, keyboard and screen-reader smoke tests pass, and every accepted lower-severity exception has an owner and target date.
