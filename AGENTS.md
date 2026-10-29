# Development instructions

The current `main` is the authoritative baseline. R60–R62 and consolidation phases 1–7 are merged; development keeps the current identity until a release is separately assigned. Read
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
Keep local operational data outside the checkout. Merge only within explicit owner
authorization; guarded automation must enforce the development standard and cannot
bypass protection.

Before submitting a development PR, run targeted local checks for the changed
behavior and record their actual results. A local full gate is optional; GitHub's
Full gate and PR format must pass on the exact current head of the PR merged into main.
Approved, related review PRs may use one integration PR under
`docs/developer/INTEGRATION-BATCHES.md`; constituent PRs do not need repeated full gates
after each main advance. Include current main and review the full combined scope.
The automatic post-merge main gate may continue asynchronously; report it as pending and investigate
failures when reported, fixing forward through a new PR. See DEVELOPMENT-STANDARD.md.

Run the existing full gate before proposing a release. Keep measured browser runs
serial. Packaging requires current passing evidence for the exact source and runtime;
use the existing packaging script and manifest verifier. Do not package a failed
gate, invent signing keys, alter trusted connections, or claim City/native acceptance
from automated tests. Generated outputs and release packages belong outside source
or in the existing ignored build directories.

Use [the development and release standard](docs/developer/DEVELOPMENT-STANDARD.md) and the repository PR template for new work. Preserve independently versioned formats and stable stored/installed names.
