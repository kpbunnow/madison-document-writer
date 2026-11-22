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
