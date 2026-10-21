# Release and helper identity

version.json holds the current release, helper version, helperBuild and data-format versions; CHANGELOG.md records what each release changed.

The release label identifies a reviewed package such as R51. `helperBuild` is a separate monotonically increasing integer, independent of that label. The helper version has four numeric segments YYYY.MM.DD.helperBuild. The build validates that its last segment matches `helperBuild`. Run `python3 tools/sync_version.py` after updating version.json to synchronize npm identities; the build refuses drift.

Corrected R50 used helper 2026.10.17.51 with the legacy verification record. R51 uses helperBuild 52. When reading an R50 pin without helperBuild, the updater derives the prior counter from the final helper-version segment; both counter rollback and calendar-version rollback are refused. It writes the explicit counter in new pins. A legacy-format pin written by an R50 launcher while installing R51 is migrated the same way. A future date cannot disguise a lower build counter. Once the explicit scheme is pinned, a release lacking the counter is refused.

R52 removed release signing. Updates are checked against runtime-manifest.json (file sizes and SHA-256), and downgrade protection compares helperBuild and the helper version against the local verified-install.json pin. PCs that installed a signing-era release (R50 or R51) need a fresh first installation, because those launchers accept only signed releases.
