# Dependency security

Living record of dependency security reviews, advisory applicability and monitoring. Each review is bound to the main
commit it started from. Release and helper identities are unchanged by dependency maintenance until a release is
separately assigned.

## 2026-11-22 review

Starting main: `a4f25384d9ca63c4b6460a6d48de617095dc358c` (R85, helper 2026.11.16.86, build 86). All main checks had
passed.

The previous audit's evidence file (`DEPENDENCY-SECURITY-AUDIT-2026-11-22.json`) was not available in the review
environment, so every version and advisory below was rechecked from primary sources:
- **npm registry:** package metadata and `npm audit`;
- **PyPI JSON:** package metadata, including the advisories PyPI records against each exact version;
- **Node.js:** the release index and its signed checksums;
- **Git tags:** CPython, OpenSSL and `actions/python-versions`, read directly.

python.org, openssl-library.org and api.osv.dev were not reachable from the review environment, which is a network
policy limit. Findings that depend on them are marked as such.

### Batch 1: Node and pip installation tooling

| Component | Before | After | Reason |
| --- | --- | --- | --- |
| Node (CI `setup-node`) | 24.19.0 | 24.22.3 | Newest Node 24 (Krypton LTS) release, published 2026-11-10 and marked as a security release in the official index. 24.22.1 was also a security release. |
| pip (development and CI installs) | 26.2.2, from the CPython 3.14.10 bundle | 26.3 (`requirements-bootstrap.txt`, both PyPI SHA-256 hashes) | pip 26.2.2 vendors urllib3 2.7.0, which is affected by CVE-2026-97687, CVE-2026-97688 and CVE-2026-97689 (GHSA-8988-9cw3-xx77, GHSA-gh4c-6fx4-qh6g, GHSA-vxq7-64xx-v4gw; all fixed in 2.8.0). The vendored versions were read from the downloaded, hash-verified wheels: pip 26.3 vendors urllib3 2.8.0. |

How the changes are made:
- **pip is upgraded as a whole.** pip itself is upgraded; urllib3 is never installed standalone to replace pip's vendored
  copy.
- **Order in CI:** every CI job installs `requirements-bootstrap.txt` with `--require-hashes` and asserts pip 26.3 before
  it installs `requirements-dev.txt`. `tests/unit/audit_development_workflow.py` enforces this, the single exact Node pin,
  and the bootstrap's pip-only content.
- **Bootstrap exposure:** the bootstrap download itself is made with the runner's existing pip. The hash check, not the
  older pip's network code, guarantees which bytes are installed.

Applicability:
- **CI and developer installs** download from PyPI, so pip's urllib3 network code is reachable. The advisories cover
  HTTPS-proxy TLS settings and streaming decompression or chunk decoding. Hashes protect package integrity, but not
  memory or proxy-TLS behaviour, so the upgrade applies here.
- **City PCs** run `helper/install_runtime.py` with the PC's own `python -m pip`. For the official CPython 3.14.10 that is
  the bundled pip 26.2.2 (`Lib/ensurepip/_bundled/pip-26.2.2-py3-none-any.whl` at the `v3.14.10` tag). It runs with
  `--no-index --only-binary=:all: --require-hashes --find-links <local wheels>`, so it makes no HTTP request and
  urllib3's network code is not reached.
- **The installer is unchanged.** It keeps offline, binary-only, hash-checked installation and never updates itself
  online at startup.
- **Windows CI check:** the offline parser check now runs in a fresh `python -m venv`, seeded by CPython's own
  `ensurepip`, so CI keeps exercising the pip City PCs actually use rather than the bootstrapped tooling pip.

Not counted as exposure:
- pip's partial setuptools vendoring (`pip/_vendor/pkg_resources` only) and its pure-Python MessagePack copy. Advisories
  against other setuptools or msgpack code paths are not evidence that this code is reachable.

Verification:
- **Node 24.22.3:** the Linux x64 tarball matched `SHASUMS256.txt`, whose detached signature verified ("Good signature")
  against the Node release keys from `nodejs/release-keys`.
- **pip 26.3:** installed from `requirements-bootstrap.txt` with `--require-hashes`, then the hash-checked
  `requirements-dev.txt` installed under it, and `npm ci` succeeded on Node 24.22.3.

### Batch 2: browser automation and compatible development tools

| Component | Before | After | Reason |
| --- | --- | --- | --- |
| Playwright | 1.64.1 | 1.65.1 | Newest release. Its pinned Chromium moves with it. |
| Chromium (Playwright download) | 156.0.8078.4 (revision 1248) | 159.0.8154.6 (revision 1255) | Moves with Playwright; the CI browser cache key still derives from the installed Playwright version and the lockfile hash. |
| axe-core | 4.14.0 | 4.14.1 | Compatible patch release. |
| ESLint | 10.14.0 | 10.15.0 | Compatible minor release. |
| fast-check | 4.10.2 | 4.11.0 | Compatible minor release. |
| jsdom | 31.0.0 | 31.0.1 | Compatible patch release; its Node engine range includes Node 24.22.3. |
| Prettier | 3.9.10 | 3.10.1 | Compatible minor release; every maintained file is unchanged by it. |
| minimatch (through ESLint) | 11.0.1, forced by an `overrides` entry | 11.0.9, chosen by ESLint's own range | ESLint 10.15.0 and `@eslint/config-array` 0.23.6 now require `^11.0.5`. The development-only override, which forced a version below that range, is removed so the owning packages select it. |
| Hypothesis | 6.170.14 | 6.170.17 | Compatible patch release. |
| PyYAML | 6.0.3 | 6.0.4 | Compatible patch release. |
| Ruff | 0.17.3 | 0.17.6 | Compatible patch release. |
| coverage | 7.17.3 | 7.17.4 | Compatible patch release (analysis manifest). |

Unchanged:
- **mando 0.7.1:** stays below 0.8 because Radon 6.0.1 requires `mando>=0.6,<0.8`.
- **esbuild, globals, TypeScript and rrweb-cssom:** already the newest releases.
- **Other transitive packages:** follow their owning packages through the lockfile.

Advisories: `npm audit` reports no vulnerabilities, and PyPI records no advisory for any new or retained pinned version.
Python hashes are PyPI's published SHA-256 digests for every file of each release, sorted as before.

Compatibility finding:
- **Change:** Playwright 1.65 refuses to type into an inert element.
- **Effect:** One browser scenario typed a new case number into the Workspace page while the earlier import review was
  still open over it as a modal. A user cannot do that.
- **Fix:** The scenario now closes the review with Exit first, as `findInspections` already did before searching. All
  of the scenario's assertions are unchanged.

### Batch 3: Python runtime qualification

Result: Python stays at **3.14.10**, because there is no patched 3.14 release to qualify yet.

| Item | Finding (2026-11-22) |
| --- | --- |
| Newest CPython 3.14 | `v3.14.10` (2026-10-25). There is no `v3.14.11` tag, and the newest `actions/python-versions` build is 3.14.10. A scheduled release is not treated as available. |
| CVE-2026-119170 | A FIPS-only regression in 3.14.10. `Modules/_hashopenssl.c` stored the digest fetched for `usedforsecurity=True` (with the `-fips` property) and the one for `usedforsecurity=False` in each other's cache slots. Its NEWS entry says "This issue only affects Python 3.14.10". The fix (commit `7d9da92`, gh-160923, 2026-11-06) is on the 3.14 branch but in no release. |
| OpenSSL bundled with Windows CPython | 3.5.9 (`python/cpython-bin-deps` tag `openssl-bin-3.5.9`), the newest 3.5 release. The amd64 bundle contains `libcrypto-3.dll` and `libssl-3.dll` but no FIPS provider module. |
| Parser wheels | python-crfsuite 0.9.12 publishes `cp314-win_amd64`. A 3.14 maintenance release keeps the same ABI tag, so the vendored wheels would not need to change. |

What could be verified locally:
- **Same digests either way:** the bug changes which OpenSSL provider computes a digest, not its value. SHA-256 output from 3.14.10 is the standard value; the test vector `abc` gives `ba7816bf…`.
- **The local interpreter is not in FIPS mode:** `_hashlib.get_fips_mode()` returns 0 for CPython 3.14.10 with OpenSSL 3.5.9 on Linux.
- **Only SHA-256 with the default flag:** the helper uses `hashlib.sha256` with the default `usedforsecurity=True` and `hmac.compare_digest`. It uses no `usedforsecurity=False`, MD5 or SHA-1. Integrity hashes and canonicalization results are therefore unaffected on any PC.
- **Exposure needs FIPS mode:** on a FIPS-mode PC, 3.14.10 could compute those SHA-256 values through the non-FIPS provider, which is a compliance issue rather than a wrong value. Library code that asks for `usedforsecurity=False` could be refused.
- **What FIPS mode needs on Windows:** the official build ships no FIPS provider. OpenSSL FIPS mode in this Python therefore requires an installed OpenSSL FIPS module plus `OPENSSL_CONF`/`OPENSSL_MODULES` configuration that enables it. The Windows "Use FIPS compliant algorithms" policy does not switch Python's bundled OpenSSL into FIPS mode.

City IT checks that remain necessary (not verifiable here):
1. **Check FIPS mode on a City PC.** Run `python -c "import _hashlib; print(_hashlib.get_fips_mode())"` with the installed CPython 3.14.10. Also check whether `OPENSSL_CONF` or `OPENSSL_MODULES` is set system-wide or for staff accounts.
2. **If FIPS mode is required,** record it, and treat 3.14.10 as non-compliant for FIPS-validated hashing until 3.14.11 or later is released and qualified. Do not disable FIPS, swap OpenSSL DLLs or move to Python 3.15 to clear the advisory.
3. **When 3.14.11 is released,** qualify it like any runtime change:
   - pin `python-version` in CI;
   - rerun the exact-head gate, including the Windows offline parser installation;
   - record the release and its bundled OpenSSL;
   - confirm the installer still accepts the PC's CPython 3.14 x64.

   The scheduled advisory check reports a newer 3.14 maintenance release as a finding.

### actions/cache major upgrade (separate review)

| Component | Before | After | Reason |
| --- | --- | --- | --- |
| actions/cache | v5.1.0 `caa296126883cff596d87d8935842f9db880ef25` (comment `# v5`) | v6.1.0 `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | Newest release, verified against the `v6.1.0` tag. v6 is an ESM and toolkit migration with identical inputs, outputs and `node24` runtime; v6.1.0 also handles cache-write errors under a read-only token. The cache path and key are unchanged. A workflow audit now requires every action to be pinned to a full commit SHA with an exact-release comment. |

All other actions (checkout v7.0.1, setup-node v7.1.0, setup-python v7.1.0 and upload-artifact v7.0.2) were already the
newest releases.

### Batch 4: ongoing monitoring

Covered sources:

| Source | How it is monitored |
| --- | --- |
| Root `requirements-bootstrap.txt` and `requirements-dev.txt` | Dependabot pip (directory `/`), plus the weekly advisory check |
| `tools/analysis-requirements.txt` | Dependabot pip (directory `/tools`), plus the weekly advisory check. mando updates to 0.8 or later are ignored while Radon 6.0.1 requires `<0.8`. |
| `helper/requirements-runtime.txt` and its vendored Windows wheels | Dependabot pip (directory `/helper`) for security alerts and security update pull requests only. Routine version updates are off (limit 0), because a manifest bump without new vendored wheels would be incomplete. The weekly advisory check also covers it. |
| npm lockfile | Dependabot npm. Compatible development updates are grouped. The weekly `npm audit --package-lock-only` also covers it. |
| Vendored Leaflet (`app/assets/leaflet.js`, byte-identical to npm leaflet 1.9.4, the newest stable release) | The weekly check queries npm's advisory database for the version declared in the file |
| GitHub Actions | Dependabot github-actions, with minor and patch updates grouped. Workflow audits enforce full-SHA pins. |
| Node and CPython patch levels pinned in CI | The weekly check fails when a newer Node security release exists for the pinned major line, or a newer stable CPython maintenance release exists for the pinned minor series |

`.github/workflows/dependency-advisories.yml` runs `tools/check_dependency_advisories.py` and `npm audit`:
- **When it runs:** weekly, on demand, and after a dependency manifest changes on main. It does not run on pull requests and does not start the full gate, so it adds no redundant gate runs.
- **What it may do:** it is read-only. It never edits manifests, opens pull requests or suppresses a finding.
- **When it fails:** on any finding, and on any source it could not read. A source it could not read is reported as "NOT CHECKED", never as clean.
- **Dependabot alerts:** it reads them through the workflow token. When GitHub refuses that read, the run reports that the alerts were not read and that this "is not an empty alert list". An empty list is reported only when GitHub actually returns one. On 2026-11-22 the repository's own API returned an empty open-alert list. Dependabot security updates are enabled.
- **Grouping:** compatible updates are grouped monthly, so routine maintenance opens few pull requests. Each one still needs the exact-head full gate. Security updates are not grouped.

Limits that remain:
- **Components bundled inside pip and CPython:** PyPI advisories are recorded against a package's own name and version, not against copies bundled inside other packages. pip's vendored urllib3 (batch 1) was found by reading the wheel. It is not reported by this check, and the bootstrap pin needs review whenever pip publishes a release.
- **CPython and OpenSSL advisories:** these are reached through releases and the Python and OpenSSL security pages, which were not reachable from the review environment. The check reports newer releases; it does not read CPython or OpenSSL advisories directly.
