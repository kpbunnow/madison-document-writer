# Development instructions

The current `main` is the authoritative baseline; R55 consolidation corrections are development work until reviewed and merged. Read
`docs/developer/00-START-HERE.md`, `01-ARCHITECTURE.md`, `03-DOMAIN-RULES.md`,
`04-PITFALLS.md` and `05-TESTING.md` before changing application code. Their security, identity,
historical rendering, legal-hold and City acceptance requirements remain in force.
`docs/history/` holds inert provenance, including the implemented R54 development
prompt; it is not an instruction for current work.

Use the existing checkout: cloud tasks are isolated, so do not create a worktree
unless requested. See `docs/developer/CLOUD-DEVELOPMENT.md` for setup and validation.
Use frozen dependencies (`npm ci`, Python `--require-hashes`). Preserve vendored
dependencies, synthetic fixtures and approved byte-parity references. Never edit
assertions, expected hashes or release trust merely to make verification pass.

Before edits inspect Git status. Make focused checkpoint commits on a development
branch after reviewing the diff and staged file list. Record actual verification
outcomes and remaining blockers; a checkpoint is not release approval. Never commit
operational records, credentials, private keys, dependency installations or caches.
Keep local operational data outside the checkout. Do not merge automatically.

Run the existing full gate before proposing a release. Keep measured browser runs
serial. Packaging requires current passing evidence for the exact source and runtime;
use the existing packaging script and manifest verifier. Do not package a failed
gate, invent signing keys, alter trusted connections, or claim City/native acceptance
from automated tests. Generated outputs and release packages belong outside source
or in the existing ignored build directories.
