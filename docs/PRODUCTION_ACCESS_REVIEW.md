# Production Access Review

Complete before the pilot and whenever personnel or provider access changes. One person should not hold every recovery path. Never record credentials or recovery codes here.

| System | Account/role | Named person | Business need | MFA/key protection | Last used | Keep/remove | Reviewer | Evidence |
|---|---|---|---|---|---|---|---|---|
| Hostinger owner/billing |  |  |  |  |  |  |  |  |
| Hostinger VPS administrator |  |  |  |  |  |  |  |  |
| SSH administrator key |  |  |  |  |  |  |  |  |
| DNS registrar/provider |  |  |  |  |  |  |  |  |
| Private source repository |  |  |  |  |  |  |  |  |
| Protected deployment branch |  |  |  |  |  |  |  |  |
| Independent backup provider |  |  |  |  |  |  |  |  |
| Backup-key escrow custodian A |  |  |  |  |  |  |  |  |
| Backup-key escrow custodian B |  |  |  |  |  |  |  |  |
| Alert/uptime provider |  |  |  |  |  |  |  |  |
| Email provider and DNS sender records |  |  |  |  |  |  |  |  |
| Production portal ADMIN |  |  |  |  |  |  |  |  |

## Required checks

- [ ] Every retained account has one named human owner and current business need.
- [ ] Shared interactive administrator accounts are eliminated or have a dated exception.
- [ ] MFA is enabled wherever supported; SSH uses individual keys and password authentication is disabled.
- [ ] Repository deployment access is read-only except where release duties require more.
- [ ] Backup credentials cannot administer the VPS, and VPS compromise does not grant backup-provider ownership.
- [ ] Two authorized custodians can recover the backup key under the approved process.
- [ ] Former staff, obsolete keys/tokens, test accounts, and unused provider integrations are removed.
- [ ] The portal retains at least two active administrator recovery paths without allowing self-suspension or last-admin removal.
- [ ] Evidence contains identifiers and status only—no secrets, reset links, or private client data.

| Approval | Name | UTC date | Result | Follow-up issue IDs |
|---|---|---|---|---|
| Business owner |  |  | Pass / Fail |  |
| Technical owner |  |  | Pass / Fail |  |

