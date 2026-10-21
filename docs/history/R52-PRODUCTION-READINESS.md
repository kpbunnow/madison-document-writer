# R52 production readiness

R52 is ready to package without a signing key: `python3 tools/verify_release.py`, then `python3 tools/package_release.py --output <folder outside source>`. Publish the deploy ZIP SHA-256 through a separate channel.

Before any pilot: IT sets and records deployment-folder permissions (P52), retires R50/R51 test installs (M52), and completes the carried-forward items in R52-ACCEPTANCE-RECORD.md. Legal decisions L1-L5, the mandatory-appearance hold, City environment, native printing, accessibility and staff acceptance remain OPEN. No live rollout has been performed.
