# Hostinger Deployment Decision Register

Complete and approve this register before purchasing infrastructure or introducing real client data. Recommended defaults are starting points, not recorded approvals.

| Decision | Recommended pilot default | Final decision | Owner | Approval date | Evidence/location |
|---|---|---|---|---|---|
| Hosting model | One Hostinger VPS; one application process | Pending | Business owner | Pending | Pending |
| Operating system | Current supported Ubuntu LTS, minimal image | Pending | Technical owner | Pending | Pending |
| Runtime | Node.js 22 LTS, exact patch matched to release evidence | Node.js 22 LTS | Technical owner | 2026-09-02 | Phase 1 implementation record |
| Reverse proxy/process | Nginx and `systemd` using supplied templates | Pending | Technical owner | Pending | Pending |
| Production domain | `portal.<approved-domain>` | Pending | Business owner | Pending | Pending |
| Staging domain | `staging-portal.<approved-domain>` | Pending | Business owner | Pending | Pending |
| Pilot notification mode | In-app only until a provider and sender domain are verified | Pending | Business owner | Pending | Pending |
| Production data | Clean start; migrate only separately reviewed records | Pending | Business owner | Pending | Pending |
| Session control | HttpOnly secure cookie plus CSRF protection | Implemented; approval pending | Business/technical owners | Pending | Security review |
| Administrator protection | MFA; if unavailable, a dated pilot exception, unique password, and daily login-alert review | Pending | Business owner | Pending | Pending |
| Upload protection | PDF/image/text only for pilot; Office/ZIP blocked until malware scanning is approved | Implemented; approval pending | Business/technical owners | Pending | Security review |
| Hostinger backup | Enable daily VPS backup if available | Pending | Technical owner | Pending | hPanel evidence |
| Independent backup | Write-consistent encrypted app backup and off-server mirror at least every 12 hours | Pending | Technical owner | Pending | Restore evidence |
| Backup retention | 30-day retention unless legal/contractual review specifies otherwise | Pending | Business/technical owners | Pending | Pending |
| Recovery objective | RPO ≤24 hours; RTO ≤4 hours for pilot | Pending | Business/technical owners | Pending | Restore rehearsal |
| Pilot capacity | ≤5 active projects and ≤10 simultaneous users | Pending | Business owner | Pending | Acceptance record |
| Storage budget | Set from current upload inventory plus 3× growth margin; alert before 1 GiB free | Pending | Technical owner | Pending | Capacity worksheet |
| Server region/data location | Closest approved region consistent with client, contract, and privacy requirements | Pending | Business owner | Pending | Pending |
| Privacy notice/incident contact | Publish approved notice and named contact before pilot | Pending | Business owner | Pending | Privacy template |
| Monitoring recipient | Named primary and backup recipients for uptime, TLS, disk, process, and backup alerts | Pending | Business owner | Pending | Alert test |
| Maintenance window | Weekly low-use window with advance notice to pilot users | Pending | Application owner | Pending | Pending |
| Consistent-backup windows | Twice daily, initially 02:00 and 14:00 server time; approve brief write downtime and adjust to actual low-use periods | Pending | Business/application owners | Pending | Timer and acceptance evidence |
| Provider-account custody | MFA on Hostinger, registrar/DNS, repository, backup, and email accounts; primary plus backup recovery custodian | Pending | Business/technical owners | Pending | Access review and recovery test |
| Renewal and billing continuity | Auto-renew where approved; monitored payment method, expiry dates, and primary/backup billing contacts | Pending | Business owner | Pending | hPanel/registrar evidence without payment details |
| DNS cutover and reversal | Preserve the current zone; record authoritative provider, old/new targets, TTL, propagation window, rollback trigger, and decision owner | Pending | Technical owner | DNS cutover worksheet |
| Supported client baseline | Current Chrome, Edge, Firefox, and Safari on supported desktop/mobile operating systems, narrowed only by written pilot decision | Pending | Business/application owners | Hosted acceptance matrix |
| Operational evidence retention | Owner-accessible restricted evidence index retained for the approved contractual/legal period | Pending | Business owner | Evidence index and retention policy |
| Client-data requests | Named process for access/export, correction, and deletion; active legal holds override deletion | Pending | Business owner | Fictional request rehearsal |

## Approval rule

A decision is complete only when the final value, owner, date, and evidence location are filled in. Passwords, API keys, reset links, invitation links, and backup encryption keys must never be entered in this file.

## Platform-specific validation

- Hostinger supports Node.js deployments on VPS and other current hosting products, but this portal uses the VPS path because it requires explicit control of SQLite persistence, service supervision, and backups.
- Hostinger's managed VPS firewall can restrict public traffic; the deployment still keeps a host-level firewall and exposes only SSH, HTTP, and HTTPS.
- Hostinger provides VPS backups and snapshots, but restoration overwrites server state and direct backup download is not supported. The independent encrypted application backup remains mandatory because it gives the project a separately controlled, file-level recovery path.

Revalidate Hostinger documentation and current plan limits at purchase time:

- [Node.js hosting options at Hostinger](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/)
- [Managed VPS firewall](https://www.hostinger.com/support/8172641-how-to-use-a-managed-vps-firewall-at-hostinger/)
- [VPS backups and restoration](https://www.hostinger.com/support/1583232-how-to-back-up-or-restore-a-vps-at-hostinger/)
- [DNS record management and DNS-history restoration](https://support.hostinger.com/en/articles/1583249-how-to-manage-dns-records-at-hostinger)
- [Hostinger billing, expiry, and auto-renewal controls](https://www.hostinger.com/support/4469042-how-to-use-the-billing-section-in-hostinger/)
