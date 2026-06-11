# Security Audit — LouvorJA supply chain incident (2026-06-11)

## Executive summary

On 2026-05-22 a malicious `postinstall` npm lifecycle script was injected into the upstream **louvorja/app** repository (commit `1ca69fb`, disguised as "chore: deps"). The script downloads a Linux/macOS binary from an attacker-controlled GitHub release, drops it to `/tmp/(dot)sshd`, makes it executable, and runs it in the background. The project owner's local clones at `C:\Users\paulo\Documents\development\church\mixhouse-integration\` were cloned at the infected commit, and `npm install` was subsequently run in the **v3** and **v4** copies — so the hook *executed* under `cmd.exe` on this Windows host.

**What is confirmed:**

- The malicious commit is real and verified locally in git history (HEAD `3cf860f` and its parent `1ca69fb` both still carry the `postinstall` in their committed `package.json`).
- `npm install` ran while the hook was present in two copies (v3 and v4), evidenced by the root-level `hasInstallScript: true` flag in their `package-lock.json` files and the existence of `node_modules`.
- Windows Defender independently flagged the payload as **Trojan:Linux/FakeHub.DD!MTB** (ThreatID `2147970060`) — 28 detections total, earliest 2026-06-03 against the v3 working-tree `package.json`.

**Current risk posture: LOW on this machine.** The payload is a Linux/macOS binary (ELF/Mach-O) and its drop/exec chain (`/tmp/(dot)sshd`, `chmod +x`) cannot meaningfully run under Windows `cmd.exe`. No dropped binary, no malicious process, no persistence (scheduled tasks / registry Run keys), and no WSL environment were found. The attacker's download URL is dead (HTTP 404), so even a successful chain would have fetched nothing. The residual issues are **remediation bookkeeping** (the script still lives in committed git history) and **credential hygiene** (a committed API token and a CI secret-handling pattern upstream).

---

## The known attack

**Mechanism.** A pure scripts-block injection into `package.json` — no new npm dependency was added, which is precisely why lockfile/dependency-tree diff scanners miss it. When any developer runs `npm install`, npm executes the `postinstall` hook, which on Linux/macOS:

1. `curl`s a binary asset named **gvfsd-network** from the attacker's GitHub release (silent, follow-redirects),
2. writes it to `/tmp/(dot)sshd`,
3. `chmod +x` the file,
4. launches it in the background.

**Defanged IOCs:**

| IOC | Defanged value |
|---|---|
| Attacker account | `parikhpreyash4` |
| Attacker repo | `parikhpreyash4/systemd-network-helper-aa5c751f` |
| Payload URL | `hxxps://github[.]com/parikhpreyash4/systemd-network-helper-aa5c751f/releases/latest/download/gvfsd-network` |
| Release asset | `gvfsd-network` |
| Drop path | `/tmp/(dot)sshd` |
| Defender signature | `Trojan:Linux/FakeHub.DD!MTB` (ThreatID `2147970060`) |
| Malicious commit | `1ca69fb` ("chore: deps", 2026-05-22) |

**Affected platforms.** Linux and macOS only. The dropped binary is ELF/Mach-O; the `/tmp` path and `chmod` chain are POSIX-specific.

**Why Windows hosts likely escaped the payload chain.** On Windows the hook runs under `cmd.exe`, but `/tmp/(dot)sshd` is not a valid Windows path, `chmod` does not exist, and an ELF/Mach-O binary is not executable on Windows. Even the download stage is now inert because the attacker repo returns HTTP 404 (asset deleted). Verified absent on this machine: any `*sshd*`/`*gvfsd*` file (`C:\tmp`, `%TEMP%`, `%USERPROFILE%`), any matching running process, any matching scheduled task, and WSL (not installed). The hook executed but the payload chain broke.

---

## Forensics

- **Insertion point.** The parent commit `2f6ce6d` ("Merge pull request #48", 2026-05-10) had **no** `postinstall` key — its scripts block held only the 13 legitimate keys (`version:*`, `serve`, `build`, `lint`, `dev`, `host`, `files`, `git:tag`). Twelve days later, commit `1ca69fb` (2026-05-22) freshly inserted the malicious `postinstall`. `git log -S 'gvfsd'` across full history returns **exactly one** introducing commit, confirming a single injection point.
- **Author / metadata anomaly.** `1ca69fb` was authored as **`Mayco Rolbuche` <85885740+maycorolbuche@users.noreply.github.com>**, whereas the maintainer's ordinary commits use **`maycorolbuche` <mayco_rolbuche@hotmail.com>**. The noreply identity is the maintainer's GitHub-web/token context (the benign PR #48 merge `2f6ce6d` uses the same identity), so this is **consistent with either** a web/token-based push by the maintainer **or** account/token compromise — it cannot distinguish the two. The malice is established by the payload, not the author string.
- **Lockfile-inconsistency clue.** The malicious commit touched **only** `package.json` (1 file, +2/−1) and did **not** modify `package-lock.json`. No dependency was smuggled in — it is a pure shell-command injection. Separately, the *local* `package-lock.json` carries `hasInstallScript: true` at the root package entry (`""`), even though the **working-tree** `package.json` currently has no `postinstall` (Defender stripped/quarantined the working-copy file). npm writes that root flag only when the root package had a lifecycle script at install time, so it is genuine forensic proof that `npm install` executed the hook here. The flag itself is inert (npm reads scripts from `package.json`, not the lockfile).
- **Branch labeling trap.** The local branch `fix/remove-malicious-postinstall` points at **exactly** the malicious commit SHA (`1ca69fb`) — it is a bookmark *at* the bad commit, not a remediation *past* it. No clean-up commit exists. `main` also points at `1ca69fb`; the checked-out `feat/liturgia` (`3cf860f`) carries the malicious line forward verbatim. The removal exists **only in the uncommitted working tree.**
- **Tags are clean.** `1ca69fb` is unreachable from any annotated tag; the most recent tag `v1.13.0` (2025-03-04) predates the attack by 14+ months. Tags `v1.6.0`–`v1.13.0` are clean.
- **CI exposure window.** `.github/workflows/deploy.yaml` runs `npm install` (without `--ignore-scripts`) on `ubuntu-latest`. Any CI run on the default branch after 2026-05-22 would have executed the payload on a Linux runner. A benign node-version bump (18→22) in commit `85ce6eed`, 2026-02-28, is the only other change to that file.

---

## Scan results

### Scanner: source-iocs (tracked source sweep)

Coverage: all git-tracked files (excluding `node_modules/`, `dist/`, `.git/`) — 3 `package.json` files, `package-lock.json`, `node/server.js`, `vite.config.js`, `babel.config.js`, the sole CI workflow, `.env`/`.env.production`, helper modules and Vue components; pattern sweeps for downloaders, `child_process`/`eval`/`atob`/`fromCharCode`, `/tmp`+`chmod`, persistence primitives, exfil beacons, raw IPs, large base64 blobs, dynamic `require()`, lifecycle hooks, committed binaries.

| ID | Location | Verdict | Notes |
|---|---|---|---|
| `known-postinstall` | `package-lock.json:10` | **True positive** (high) | Root `hasInstallScript: true`; working-tree `package.json` has no postinstall. Forensic evidence the hook ran. Action = lockfile rebuild. |
| `ci-token-in-git-credentials` | `deploy.yaml:23` | **False positive** (not malicious) | Standard (sloppy) GitHub Pages deploy pattern; writes `ACCESS_TOKEN` to `~/.git-credentials` before `npm install` on the runner. Real *exposure* concern upstream, not malicious code. |
| `ci-unpinned-third-party-actions` | `deploy.yaml:12-15` | **Low / not an IOC** | `actions/checkout@v3`, `actions/setup-node@v3` pinned by mutable tag. Hardening item. |
| `env-api-token-committed` | `.env`, `.env.production` | **Low / hygiene** | `VITE_API_TOKEN` committed in plaintext; only `.env.local`/`.env.*.local` are gitignored. Low-privilege read-only key for `api.louvorja[.]com.br`. Rotate. |

Verified clean: no downloaders, no `child_process`/`eval`/`atob`/`fromCharCode` chains, no `/tmp`+`chmod` primitives, no cron/systemd/schtasks/reg persistence, no exfil beacons, no raw-IP literals, no large base64 blobs, no dropper IOC strings in tracked tree, no lifecycle hooks in any of the 3 `package.json` files, no `.npmrc`/husky, no committed executables, `node/server.js` is a plain local file server with no outbound calls, all `fetch()` targets are legitimate, CI uses only first-party actions.

### Scanner: deps-lockfile (dependency & lockfile integrity)

Coverage: 25 direct/dev dependencies checked for typosquats; `package-lock.json` (9209 lines, v3) — all `resolved` URLs point exclusively to `registry.npmjs.org` (zero `git+`/`file:`/`http://`); all 5 `hasInstallScript` occurrences identified; actual `node_modules` install scripts inspected; `.npmrc`/`.yarnrc` absence confirmed; `node/` has no own dependencies; no suspicious binary filenames in tree.

| ID | Location | Verdict | Notes |
|---|---|---|---|
| `FIND-001` | `package-lock.json:10` | **True positive** (high) | Same IOC as `known-postinstall`. Stale root flag = forensic, inert. Rebuild lockfile. |
| `FIND-002` | git HEAD & prior commits | **True positive** (high) | Malicious `postinstall` persists in **committed** `package.json` at HEAD (`3cf860f`) and `1ca69fb` — working-tree-only removal is not remediation. |
| `FIND-003` | `package.json:25` (`dotenv ^17.3.1`) | **False positive** (low) | Confirmed legitimate `dotenv@17.3.1` — valid integrity, no install scripts, no deps. Not a typosquat. |

Verified clean: all 25 deps canonical; all resolved URLs on the npm registry; no registry overrides; the 5 install scripts that exist are all legitimate — `@parcel/watcher` (conditional native build), `core-js` (funding notice), `esbuild` (platform binary selector), `fsevents` (macOS-only, not executed on Windows), and the root entry (formerly malicious, now stale-flag only); no `sshd`/`gvfsd`/`systemd-network` binaries.

### Scanner: git-forensics (full history)

Coverage: all commits on `main`, `feat/liturgia`, `fix/remove-malicious-postinstall`; `-S 'gvfsd'` sweep; per-commit `--stat`; author audit; 12-month window over `package.json`/`.github/`/build configs; tag reachability.

| ID | Location | Verdict | Notes |
|---|---|---|---|
| `GH-001` | `package.json` @ `1ca69fb` | **True positive** (high) | Confirmed malicious injection; matches documented campaign payload. Single introducing commit. |
| `GH-002` | commit `1ca69fb` metadata | **False positive** (not by itself malicious) | Author-string differs but matches the maintainer's web/token identity (also on benign merge `2f6ce6d`); corroborating, not a unique fingerprint. |
| `GH-003` | branch `fix/remove-malicious-postinstall` | **True positive** (high) | Branch tip == malicious SHA; mislabeled, no remediation commit. Malicious line present in committed form on all reachable branches. |
| `GH-004` | `package-lock.json` (untouched by `1ca69fb`) | **True positive** (high) | Accurate technique characterization — pure scripts-block injection evades lockfile-diff tooling. |
| `GH-005` | `deploy.yaml` @ `85ce6eed` | **Low / context** | Benign node 18→22 bump; relevant only because the workflow runs `npm install` on a Linux runner. |
| `GH-006` | tags | **Low / clean** | `1ca69fb` unreachable from any tag; all tags predate the attack. |
| `GH-007` | parent `2f6ce6d`:`package.json` | **False positive** (clean baseline) | Parent had no postinstall — exonerating baseline that pinpoints `1ca69fb`. Use as the reference for the cleaned scripts block. |

Verified clean: every other `package.json`-touching commit is a benign version/dependency change; `deploy.yaml` has no injected exec steps; no second malicious commit; third-party contributor commits (santos-savio PR #48, vitoriocavalheiro03) touch only docs/Vue components.

### Scanner: threat-intel (remote, not re-verified offline)

Coverage: attacker account/repo/release endpoints, upstream `louvorja/app` HEAD blob and commit/issue history, public campaign reporting, payload-family research. The local audit made **no network calls** — these verdicts confirm the *local reference* to the IOCs, not the live remote state.

| ID | Subject | Verdict | Notes |
|---|---|---|---|
| `TI-001` | Attacker infra `parikhpreyash4/...aa5c751f` | **True IOC** (medium) | Reported HTTP 404 (suspended/deleted), empty repo list. Local payload references this exact repo/asset. 404 ⇒ download stage now inert. |
| `TI-002` | Upstream `louvorja/app` HEAD | **True IOC** (medium) | Reported postinstall STILL present upstream (`1ca69fb`, v1.27.0). Anyone running `npm install` against upstream HEAD on Linux/macOS re-triggers the hook (curl now fails). |
| `TI-003` | Campaign linkage (Socket.dev / THN) | **Context** (low confidence) | "700+ GitHub repos / 8 Packagist packages / 777 files." Un-reverified external claim; payload shape matches. Confirm sources before quoting figures. |
| `TI-004` | Payload `gvfsd-network` / family | **True payload IOC; family unconfirmed** (low) | Name impersonates GNOME `gvfsd`; drop path impersonates `sshd`. Possible Rotajakiro-family lineage stated as unconfirmed. No sample on this Windows host. |
| `TI-005` | Upstream issue tracker | **Not malicious** (low) | No security issue filed upstream; maintainer apparently unaware. Unrelated open issues #44 (XSS) / #45 (dynamic module load) out of scope. |
| `TI-006` | Attribution | **Not malicious / informational** (low) | No named threat actor; hex-suffix repo name is a weak heuristic. |
| `TI-007` | Victim scope / download count | **Indeterminate** (low) | Releases 404 — counts unavailable. louvorja/app is a niche app, limiting blast radius. |

---

## Local system check (this Windows machine)

Cross-copy status across all 6 LouvorJA/FreeShow copies:

| Copy | `node_modules` | Root `hasInstallScript` | Postinstall executed? |
|---|---|---|---|
| `v1\LouvorJA\app` | absent | n/a | **No** — install never ran |
| `v2\LouvorJA\app` | present | **absent** | **No** — installed before the malicious commit |
| `v3\LouvorJA\app` | present | **true** (line 2813) | **Yes** — ran under `cmd.exe`; Defender flagged its `package.json` on 2026-06-03 |
| `v4\LouvorJA` | present | **true** (line 10) | **Yes** — ran under `cmd.exe` |
| `v1\FreeShow` | present | legit `electron-builder` | unrelated to this attack |
| `v2\FreeShow` | present | legit `electron-builder` | unrelated to this attack |

**Artifacts found:** none malicious at rest. The only positive signals are the forensic `hasInstallScript: true` lockfile flags (v3, v4) and Defender's threat history.

**Confirmed absent / clean:**

- `C:\tmp` does not exist; no `*sshd*`/`*gvfsd*` in `%TEMP%` or `%USERPROFILE%`.
- No `sshd`/`gvfsd` process running; no scheduled task matching `sshd`/`gvfsd`/`network-helper`.
- Registry `Run`/`RunOnce` (HKCU + HKLM) — all entries legitimate (OneDrive, Firefox, Warp, Edge; SecurityHealth, Realtek, WavesSvc); RunOnce empty.
- WSL not installed — no Linux environment for the payload.
- All `.git/hooks` directories contain only `.sample` files across every copy.

**Windows Defender threat history:** 28 detections, all `Trojan:Linux/FakeHub.DD!MTB` (ThreatID `2147970060`). Earliest at-rest detections: `v3\LouvorJA\app\package.json` (4 hits, 2026-06-03). The 2026-06-11 detections are audit-session temp files. Defender's detection of the `package.json` content confirms the payload string was present in the working tree and explains why current working-copy `package.json` files appear stripped of the postinstall line (quarantine scrubbed them; lockfiles were not scrubbed).

**Bottom line for this host:** the hook executed in v3 and v4 but the Linux payload chain failed; nothing was dropped, nothing persisted, nothing is running.

---

## Threat intel

- **Attacker infrastructure is down.** `parikhpreyash4` and `systemd-network-helper-aa5c751f` return HTTP 404; the `gvfsd-network` asset is no longer downloadable. The download stage of the payload is therefore inert today. *(Remote claim; corroborated by the local payload referencing this exact infrastructure, not re-verified live in this offline audit.)*
- **Upstream is still infected.** As reported, `louvorja/app` HEAD (`1ca69fb`, version 1.27.0) still carries the `postinstall`. Fresh clones + `npm install` on Linux/macOS re-trigger the hook (the curl now fails on the dead URL, but the script remains). No security issue is filed upstream; the maintainer appears unaware.
- **Campaign scope (external, unconfirmed locally).** Public reporting attributed to Socket.dev (May 2026) and The Hacker News describes the same payload across "700+ GitHub repos," "777 flagged files," and "8 Packagist (Composer) packages" — exploiting PHP repos that ship a `package.json` for JS tooling. `louvorja/app` appears to be an additional, separately identified victim. These figures rest on third-party sources and should be independently confirmed before being quoted in a formal writeup.
- **Payload identity.** The binary `gvfsd-network` impersonates the GNOME VFS network daemon; the drop path impersonates the OpenSSH daemon (`sshd`). The naming convention resembles the Rotajakiro Linux backdoor family, but the specific family attribution is **unconfirmed** (the repo was removed before public sandbox analysis). No VirusTotal hash is publicly reported for this asset.
- **Attribution.** No named threat actor. The randomized hex-suffix repo name (`aa5c751f`) is consistent with automated supply-chain tooling, but a multi-repo pattern cannot be confirmed from the (now-empty) attacker account.

---

## Remediation done

- The `postinstall` has been removed from the **uncommitted working tree** of the affected copies (and Defender quarantine independently scrubbed the working-copy `package.json` content).
- A branch **`fix/remove-malicious-postinstall`** exists — but it is **mislabeled**: its tip is the malicious commit `1ca69fb` itself, with **no remediation commit**. The malicious `postinstall` therefore **still exists in committed git history** on `main` (`1ca69fb`) and on the checked-out `feat/liturgia` HEAD (`3cf860f`). **The remediation is not actually committed.**
- On this Windows host the payload never materialized: no dropped binary, no process, no persistence — confirmed by the system check above.

> Remediation is **incomplete**. The working-tree-only/quarantine removal does not protect anyone who checks out HEAD or performs a fresh clone — they re-acquire the malicious line. A real removal commit is required (see next steps).

---

## Recommended next steps

1. **Land a real remediation commit.** On `feat/liturgia` and `main`, remove the `postinstall` key from the committed `package.json`, using parent `2f6ce6d`'s 13-key scripts block as the clean reference. Then either delete or fast-forward the misleading `fix/remove-malicious-postinstall` branch past the cleanup. Verify with `git show <sha>:package.json` showing **zero** postinstall.
2. **Rebuild the lockfiles cleanly.** In v3 and v4, delete `node_modules` and `package-lock.json`, then reinstall from the cleaned `package.json` so the stale root `hasInstallScript: true` is cleared. Treat as bookkeeping — no payload persisted on Windows.
3. **`npm cache clean --force`** on this machine to purge any cached artifacts from the infected install runs.
4. **Rotate the committed `VITE_API_TOKEN`.** Both `.env` and `.env.production` are committed to git, so the token is public in the repo history. Rotate it at `api.louvorja[.]com.br`, add `.env`/`.env.production` to `.gitignore`, and purge from history (e.g., `git filter-repo`) if feasible. It is low-privilege/read-only, but treat any committed secret as compromised.
5. **Disclose to the upstream maintainer (`maycorolbuche`).** File a GitHub security advisory at `hxxps://github[.]com/louvorja/app/security/advisories/new` (or a plain issue if private reporting is disabled). Describe the malicious `postinstall`, identify commit `1ca69fb`, and note it was made via the web/token identity so the maintainer can determine whether their account/token was compromised. The fix upstream is to remove the `postinstall` and rotate any secrets that may have been exposed on Linux/macOS dev machines or CI.
6. **File a GitHub abuse report** at `hxxps://github[.]com/contact/report-abuse` — category "Malware or viruses" — referencing account `parikhpreyash4` and repo `systemd-network-helper-aa5c751f`. Even though already suspended, this creates a record.
7. **Advise CI hardening upstream.** `deploy.yaml` writes `ACCESS_TOKEN` to `~/.git-credentials` before running `npm install` on `ubuntu-latest`, so the malicious hook ran on the runner with the credential file on disk. If you ever triggered upstream CI, advise the maintainer to **rotate the `ACCESS_TOKEN`/`USERNAME`/`EMAIL` CI secrets**, switch to `GITHUB_TOKEN` / `actions/deploy-pages`, pass `--ignore-scripts` (or pin a clean commit), and pin actions by commit SHA.
8. **Per-copy actions:**
   - **v1 (`LouvorJA`):** no `node_modules`, hook never ran — no action beyond pulling the eventual clean commit.
   - **v2 (`LouvorJA`):** installed before the malicious commit (no root `hasInstallScript`) — no malware action; still update to a clean commit.
   - **v3 / v4 (`LouvorJA`):** apply steps 1–3 (commit removal, lockfile rebuild, cache clean).
   - **v1/v2 FreeShow:** unaffected — their `postinstall` is legitimate `electron-builder install-app-deps`.
9. **Warn any Linux/macOS users who installed.** Anyone who ran `npm install` against an infected commit on Linux/macOS must hunt for `/tmp/(dot)sshd`, look for a process masquerading as `sshd`/`gvfsd-network`, isolate the host, and rotate credentials. Add `parikhpreyash4/systemd-network-helper-aa5c751f` and asset `gvfsd-network` to IOC/blocklists.
10. **(Optional, out of scope) Upstream app vulns.** Open issues #44 (XSS in `node/server.js` URL reflection) and #45 (unsafe dynamic remote module loading) are separate hardening items unrelated to this incident.