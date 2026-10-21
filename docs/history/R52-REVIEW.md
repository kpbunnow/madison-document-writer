# R52 implementation review

Release **2026-10-18 R52**, built from the verified R51 source. Helper 2026.10.18.53 (helperBuild 53); authoring 11, case schema 5, summary 6, backup 2 unchanged.

## Decision: no release signing (option 3)

The R50 release signing key was lost, and no owner could reliably keep a key for future releases. R52 removes signing and keeps everything else:

- **Kept:** the exact file-set, size and SHA-256 checks against `runtime-manifest.json`; symlink refusal; downgrade protection (helperBuild and helper version); the share launcher's hand-off to the installed launcher; operational-folder exclusions; staged installation with rollback.
- **Removed:** Ed25519 signature verification, `runtime-manifest.sig`, `helper/release_trust.py` (public key), the vendored `pure25519` library, `tools/sign_release.py`, `requirements-signing.txt`, and the packager's `--key` option.
- **New control:** deliberate tampering is guarded by deployment-folder NTFS permissions (release owner write, inspectors read), recorded in the acceptance record. The manifest catches mistakes, partial copies and damaged files; it cannot stop someone who can rewrite both files and manifest, and `audit_r52_manifest.py` documents that boundary explicitly.

## Other corrections

- `audit_r50_documents.js` compared stored HTML containing date-input `min`/`max` values computed from today, so it failed on every day after its baseline. Those two attributes are normalized; all other bytes, including field values, still match exactly.
- The install guide drops the stale R50 "Startup correction" section, merges two duplicate trust sections into one accurate section, uses the stable manual file name, and adds the retirement step for signing-era installations. The build fills `{{RELEASE_NUMBER}}`, so the guide needs no per-release edits.
- The manual (Markdown, HTML, Word, PDF) and developer docs describe the manifest model.
- Shared `tools/deploy_manifest.py` writes the manifest for both the packager and the tests.

## Tests

Removed: the RFC 8032 signature vectors, key rotation and key-location tests. Converted to the manifest model: `audit_r50_updates.py`, `audit_r51_updates.py`, `audit_r51_bootstrap.py`, `audit_r50_connections.py`. Added: `audit_r52_manifest.py`. The full gate and the Chromium audit run before packaging.
