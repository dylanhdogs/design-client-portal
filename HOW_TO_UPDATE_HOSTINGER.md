# How to Update the Signature Exteriors Portal on Hostinger

This guide is for the current production installation:

- Public application: `https://app.srv1633240.hstgr.cloud`
- VPS address: `177.7.53.185`
- VPS user: `root`
- Server application directory: `/docker/webapp`
- Active Compose file: `/docker/webapp/docker-compose.yml`
- Production data: `/docker/webapp/persistent`
- Docker service: `backend`

The application uses immutable Docker releases. Never edit the running container, production database, or files inside an old release directory.

## 1. Before Every Update

Use a new release ID. A timestamp is easiest:

```text
YYYYMMDD-HHMM
```

Example: `20260905-1430`.

Before continuing:

- Confirm the application works locally.
- Confirm no one is performing an important production update at the same time.
- Read `DEPLOYMENT_STATUS.md` to identify the current release.
- Do not put passwords, tokens, private keys, or production environment files in the release archive.
- Do not copy the local SQLite database or local uploads to production.

## 2. Verify the Application Locally

Open PowerShell in:

```text
C:\Users\dyslu\Documents\design-client-portal-main\design-client-portal-main
```

Run:

```powershell
Set-Location "C:\Users\dyslu\Documents\design-client-portal-main\design-client-portal-main"
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run build
```

Do not deploy if any command reports a failed test, TypeScript error, or failed build.

## 3. Set Up Your Hostinger SSH Key Once

If you already have a working private key for this VPS, skip to Section 4.

Create a dedicated key in PowerShell:

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\signature-portal-hostinger" -C "signature-portal-owner"
```

Use a strong passphrase and store it in your password manager. The private key is:

```text
C:\Users\YOUR-NAME\.ssh\signature-portal-hostinger
```

Never upload, email, or share the private key. Display the public key:

```powershell
Get-Content "$env:USERPROFILE\.ssh\signature-portal-hostinger.pub"
```

In Hostinger:

1. Open **VPS**.
2. Select `srv1633240.hstgr.cloud`.
3. Open **Settings → SSH keys**.
4. Select **Add SSH key**.
5. Paste only the `.pub` content and save.

Test access:

```powershell
ssh -i "$env:USERPROFILE\.ssh\signature-portal-hostinger" root@177.7.53.185
```

At the server prompt, run:

```bash
docker ps --filter name=webapp-backend-1
exit
```

Stop if the container is not shown as healthy.

## 4. Create a Clean Release Package

From the project root in PowerShell, replace the example release ID with your new ID:

```powershell
$releaseId = "20260905-1430"
$archive = "portal-release-$releaseId.tgz"
tar --exclude="./backend/node_modules" --exclude="./frontend/node_modules" --exclude="./backend/dist" --exclude="./frontend/dist" --exclude="./backend/dev.db" --exclude="./backend/uploads" --exclude="./.git" --exclude="./.deploy-transfer" -czf $archive .
Get-FileHash -Algorithm SHA256 $archive
```

Record the displayed SHA-256 value. The archive should contain source code, package lockfiles, Prisma migrations, and deployment files—but not databases, uploads, dependencies, secrets, or build output.

## 5. Upload the Release

```powershell
scp -i "$env:USERPROFILE\.ssh\signature-portal-hostinger" $archive root@177.7.53.185:/tmp/$archive
```

Connect to the VPS:

```powershell
ssh -i "$env:USERPROFILE\.ssh\signature-portal-hostinger" root@177.7.53.185
```

The remaining commands run inside the Hostinger VPS.

## 6. Define and Verify the Release

Set the same values used on your computer:

```bash
RELEASE_ID="20260905-1430"
ARCHIVE="portal-release-${RELEASE_ID}.tgz"
APP_ROOT="/docker/webapp"
```

Verify the uploaded hash:

```bash
sha256sum "/tmp/${ARCHIVE}"
```

The value must match the PowerShell SHA-256 value. Stop if it does not.

Confirm the release directory does not already exist:

```bash
test ! -e "${APP_ROOT}/releases/${RELEASE_ID}" && echo "Release ID is available"
```

If that message does not appear, choose a new release ID. Do not overwrite an existing release.

## 7. Create a Production Backup

Check the current container:

```bash
docker ps --filter name=webapp-backend-1 --format '{{.Image}} {{.Status}}'
```

Create an encrypted application backup:

```bash
docker exec webapp-backend-1 npm run backup:create
```

Continue only if the output contains `backup_complete`. Record the `backupPath` displayed by the command.

## 8. Prepare the New Release

```bash
mkdir "${APP_ROOT}/releases/${RELEASE_ID}"
tar -xzf "/tmp/${ARCHIVE}" -C "${APP_ROOT}/releases/${RELEASE_ID}"
test -f "${APP_ROOT}/releases/${RELEASE_ID}/backend/package-lock.json"
test -f "${APP_ROOT}/releases/${RELEASE_ID}/frontend/package-lock.json"
test -f "${APP_ROOT}/releases/${RELEASE_ID}/deployment/hostinger/Dockerfile.traefik"
```

If any `test` command reports an error, stop and remove only the incomplete new release directory after verifying its exact path.

Save the current Compose file:

```bash
cd "${APP_ROOT}"
cp docker-compose.yml "docker-compose.pre-${RELEASE_ID}.yml"
```

Create the next Compose file:

```bash
sed -e "s#context: ./releases/[^[:space:]]*#context: ./releases/${RELEASE_ID}#" -e "s#image: signature-portal:[^[:space:]]*#image: signature-portal:${RELEASE_ID}#" docker-compose.yml > "docker-compose.${RELEASE_ID}.yml"
grep -E 'context:|image:' "docker-compose.${RELEASE_ID}.yml"
```

The output must show only your new release directory and image tag.

## 9. Build Beside the Live Application

```bash
docker compose -f "docker-compose.${RELEASE_ID}.yml" build backend
```

The old container continues serving the application during this build. Do not switch releases if the build fails.

## 10. Switch to the New Release

```bash
cp "docker-compose.${RELEASE_ID}.yml" docker-compose.yml
docker compose up -d --wait --wait-timeout 120 backend
```

Container startup automatically runs production preflight, pending Prisma migrations, and the workflow backfill before starting the server.

Check the result:

```bash
docker ps --filter name=webapp-backend-1 --format '{{.Image}} {{.Status}}'
docker logs --tail 100 webapp-backend-1
```

Look for:

- Your new `signature-portal:<release-id>` image.
- Container status `healthy`.
- `deployment_preflight_passed`.
- `All migrations have been successfully applied` or `No pending migrations`.
- `server_started`.

## 11. Verify the Public Application

```bash
curl -fsS https://app.srv1633240.hstgr.cloud/api/health/live
echo
curl -fsS https://app.srv1633240.hstgr.cloud/api/health/ready
echo
```

Expected results contain:

```text
"status":"ok"
"status":"ready"
```

Then test in a private/incognito browser window:

1. Open `https://app.srv1633240.hstgr.cloud/login`.
2. Sign in with a designated test account.
3. Open Inquiries, Clients, and one project.
4. Test the feature included in the update.
5. Sign out and confirm the login page returns.

Do not create test records inside a real client's project.

## 12. Create the Post-Update Backup

After verification:

```bash
docker exec webapp-backend-1 npm run backup:create
rm -f "/tmp/${ARCHIVE}"
exit
```

Keep the release directory, image, saved Compose file, and encrypted backups. Remove only the temporary uploaded archive.

Update the local `DEPLOYMENT_STATUS.md` with:

- Date and release ID.
- Verification results.
- Pre-update and post-update backup paths.
- Database migration applied, if any.
- Previous release retained for rollback.

## 13. Fast Rollback

Use this only when the previous application version is compatible with any database migration that just ran.

Connect to the VPS, set the failed release ID, and restore its saved Compose file:

```bash
RELEASE_ID="20260905-1430"
cd /docker/webapp
cp "docker-compose.pre-${RELEASE_ID}.yml" docker-compose.yml
docker compose up -d --wait --wait-timeout 120 backend
docker ps --filter name=webapp-backend-1 --format '{{.Image}} {{.Status}}'
curl -fsS https://app.srv1633240.hstgr.cloud/api/health/ready
```

If the update included a destructive or incompatible database migration, do not guess. Stop writes and restore the matching encrypted backup into a separately verified recovery location using the operations runbook.

## 14. Stop Conditions

Stop the update and do not improvise if:

- Local tests or builds fail.
- Upload and local SHA-256 values differ.
- The backup does not report `backup_complete`.
- The new image does not build.
- The container does not become healthy within 120 seconds.
- Public readiness does not return success.
- Migrations report an error.
- Existing data, uploads, authentication, or client boundaries appear incorrect.

Keep the failed release and logs for diagnosis. Do not run `docker system prune`, delete `/docker/webapp/persistent`, replace `production.env`, or manually edit the production database.

## 15. Recommended Improvement

The current manual process is safe when followed carefully, but the next operational improvement should be a reviewed local deployment script that automates packaging, checksum verification, backup, immutable build, cutover, health checks, and rollback while still requiring an operator confirmation before production cutover.

