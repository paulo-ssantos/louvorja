# Security Advisory — malicious `postinstall` in `package.json`

> Supply chain incident in **louvorja/app**. This document accompanies the PR that removes the malicious script. All indicators below are defanged (`hxxps`, `[.]`, `(dot)`) so this file does not trip antivirus scanners.

## Summary

On **2026-05-22**, commit `1ca69fb` ("chore: deps") introduced a malicious `postinstall` npm lifecycle hook into `package.json`. From that commit onward, every `npm install` of this repository executes a script that, on Linux/macOS:

1. downloads a binary asset named **gvfsd-network** from an attacker-controlled GitHub release (silent curl, follow redirects),
2. writes it to `/tmp` as a hidden file named `(dot)sshd`,
3. marks it executable and launches it in the background.

Windows Defender identifies the payload as **Trojan:Linux/FakeHub.DD!MTB** (ThreatID `2147970060`). The attacker's GitHub account and release have since been taken down (HTTP 404), so the download stage is currently inert — but the hook still runs on every install and must be removed.

**This PR removes the malicious `postinstall`**, restoring the scripts block to the same 13 legitimate keys present in the clean parent commit `2f6ce6d`.

## Indicators of compromise

| IOC | Defanged value |
|---|---|
| Attacker account | `parikhpreyash4` |
| Attacker repo | `parikhpreyash4/systemd-network-helper-aa5c751f` |
| Payload URL | `hxxps://github[.]com/parikhpreyash4/systemd-network-helper-aa5c751f/releases/latest/download/gvfsd-network` |
| Release asset | `gvfsd-network` |
| Drop path | `/tmp/(dot)sshd` (hidden file) |
| AV signature | `Trojan:Linux/FakeHub.DD!MTB` (ThreatID `2147970060`) |
| Malicious commit | `1ca69fb` ("chore: deps", 2026-05-22) |

## How it entered

- The parent commit `2f6ce6d` (merge of PR #48, 2026-05-10) has **no** `postinstall`. Commit `1ca69fb` (2026-05-22) inserted it. A `git log -S` sweep over the full history finds exactly **one** introducing commit — a single injection point.
- The commit touched **only `package.json`** (+2/−1) and did **not** regenerate `package-lock.json`. No dependency was added — it is a pure scripts-block injection, which is precisely why lockfile- and dependency-diff tooling does not flag it.
- The commit was authored under the maintainer's GitHub **noreply/web-flow identity** rather than the e-mail used in ordinary local commits. This is consistent with either a web/token-based push by the maintainer or a **compromised account or personal access token** — the git metadata alone cannot distinguish the two. We recommend the maintainer review account security (sessions, tokens, OAuth apps) and enable/verify 2FA.
- All released tags (`v1.6.0`–`v1.13.0`) predate the attack and are clean. The malicious commit is reachable only from the development branch history.

## Impact

- **Linux/macOS:** anyone who ran `npm install` on an infected commit between 2026-05-22 and the takedown of the attacker's release may have executed the dropper. The binary impersonates the GNOME VFS daemon by name and the OpenSSH daemon by drop path.
- **CI:** `.github/workflows/deploy.yaml` runs `npm install` (without `--ignore-scripts`) on `ubuntu-latest`, after writing a deploy token to `~/.git-credentials`. Any CI run after 2026-05-22 executed the hook **on a Linux runner with that credential file on disk**. CI secrets used by this workflow should be considered exposed and rotated.
- **Windows:** the payload chain fails (`/tmp` does not exist, `chmod` is unavailable, and the binary is not a Windows executable). The hook runs but nothing is dropped.
- This appears to be part of a broader 2026 campaign reported publicly (same payload pattern injected across hundreds of repositories). The figures circulating in those reports have not been independently verified by us.

## Repository scan results

As part of this report the repository was swept for further compromise. **No other malicious code was found:**

- All three `package.json` files in the tree: no other lifecycle hooks.
- `package-lock.json` (lockfile v3): every `resolved` URL points to `registry.npmjs.org`; no `git+`/`http`/`file:` sources; all direct and dev dependencies are the canonical packages (no typosquats); the only packages with install scripts are the well-known legitimate ones (`esbuild`, `@parcel/watcher`, `core-js`, `fsevents`).
- No downloaders, `child_process`/`eval`/encoded-payload chains, persistence primitives, exfil endpoints, raw-IP URLs, committed binaries, git hooks, or `.npmrc` overrides anywhere in the tracked tree.
- `node/server.js` is a plain local file server with no outbound calls; all application `fetch()` targets are the project's own API.
- Full git history: every other commit touching `package.json` or CI config is a benign version/dependency change.

## Recommendations

**For the maintainer:**

1. Merge this PR (or remove the `postinstall` equivalently) and verify with `git show HEAD:package.json` that no `postinstall` remains.
2. Review GitHub account security: active sessions, personal access tokens, OAuth app grants; enable/verify 2FA. Determine whether `1ca69fb` was pushed by you.
3. Rotate the CI secrets used by `deploy.yaml` (deploy token, etc.). Consider switching to `GITHUB_TOKEN`/`actions/deploy-pages`, adding `--ignore-scripts` to CI installs, and pinning actions by commit SHA.
4. Rotate the `VITE_API_TOKEN` committed in `.env`/`.env.production` (any committed secret is public in git history) and add those files to `.gitignore`.
5. Publish a security advisory so existing users are warned (see "For users" below).
6. Report the attacker account `parikhpreyash4` and repo `systemd-network-helper-aa5c751f` via GitHub's abuse report (category: malware), to create a record even though the account is already down.

**For users of this repository:**

1. Update past the fix commit (or delete and re-clone), then delete `node_modules` and `package-lock.json` and reinstall, and run `npm cache clean --force`.
2. **If you ran `npm install` on Linux or macOS on a commit from 2026-05-22 onward:** check for a hidden `(dot)sshd` file in `/tmp`, look for a running process masquerading as `sshd` or `gvfsd-network`, and if found treat the host as compromised — isolate it and rotate credentials used on that machine.
3. Windows users: no payload could execute; updating and reinstalling dependencies is sufficient.
