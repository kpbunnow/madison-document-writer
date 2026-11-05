# Windows interruption and recovery tests

The Windows recovery workflow runs on actual GitHub-hosted Windows Server 2022 executors, using pinned Node/Playwright and Python 3.14.10. The project requires Python 3.14 or later; the earlier 3.12 matrix entry is retired with that support contract. Each Windows version must pass all thirteen filesystem/process and seven browser scenarios, and artifacts include the Python version to prevent collisions. It uses only synthetic cases, disposable local profiles and a temporary loopback SMB share granted to the current runner account. It does not connect to City servers or change City acceptance decisions. It does not package or deploy a release.

## Run and evidence

The workflow runs for changes to runtime source, build/policy/dependency inputs, its harness and shared fixture inputs, on PRs and main; it can also be dispatched manually. This includes low-level workspace database/startup owners and new runtime modules without maintaining a fragile list of individual filenames. Its checkout uses the exact source head and preserves source bytes. The ordinary required Full gate and PR format remain unchanged. A delivery affecting these scenarios also needs Windows recovery to pass on its exact head before merging.

After frozen dependency installation and a production build, run:

```powershell
python tests/windows/interruption_recovery.py --require-windows --output build/windows-recovery/filesystem.json
node tests/windows/browser_recovery.cjs --require-windows
```

The runner account must be able to create and remove an isolated SMB share and start the Server service. An unavailable platform, SMB capability or failed scenario fails explicitly; none silently skips. Cleanup terminates only owned child processes and removes the owned temporary share. No staff or production records are needed.

The artifact contains individual filesystem and browser results plus `combined.json`. Combined passing evidence requires every named scenario, actual Windows executors, clean identified source, unchanged source/runtime fingerprints, matching commit, workflow run and attempt, and passing browser and filesystem results. These receipts supplement the full gate; they are not packaging evidence or native City approval. A partial/failed artifact is diagnostic only.

For local harness development, `--portable` runs supported process and browser scenarios on the current OS. It omits Windows handle/SMB scenarios, explicitly labels its output as not Windows evidence, and cannot produce the passing native combined receipt.

## Cases

The filesystem harness stops child processes at barriers around real production operations, then forcibly terminates them. This bypasses Python exception/finally cleanup, rather than representing a process crash by throwing an exception.

| Boundary | Required outcome |
| --- | --- |
| Migration after durable intent, after case replacement, after registry replacement | Token-bound administrator lock recovery and retry preserve the planned genesis, exact issued history, UTF-8 wording and unique event IDs; no pending intent remains |
| First publication of a new protected record after durable intent | The empty baseline resumes safely with the same planned genesis and exact issuance identities |
| Existing case before and after atomic replacement | A pre-replacement crash retains prior bytes; a lost-acknowledgement retry never duplicates or alters issuance |
| Install after journal, first/middle file replacement, and committed journal removal | Fresh-process recovery restores the complete previous install before commit, or retains the complete new install after commit; private state survives and recovery is idempotent |
| Native NTFS handle denies delete sharing | Replacement refuses without damaging the prior case; closing the actual handle permits a valid retry |
| Real live process versus stopped orphan and stale inspection token | Live owners remain protected, stale tokens refuse, real elapsed age is enforced, and only a stopped local owner is released with an administrator audit note |
| Remove temporary SMB share before publication; restore same share | No false save acknowledgement, original backing bytes retained, owned orphan recovered through the real operator API, exact retained request safely retried |

The browser harness uses the real production page, actual authenticated helper, real persistent Chromium profiles and native process termination. It checks:

1. Acknowledged drafts, unfinished record notes, import entry, walkthrough context and held saves survive browser termination.
2. An open, uncommitted IndexedDB transaction rolls back after Chromium is terminated.
3. Terminating both browser and helper preserves unfinished work and requires explicit confirmation before clearing it.
4. A real IndexedDB abort preserves prior durable bytes, refuses acknowledgement and permits a successful retry.
5. A failed required startup read blocks editing/saving; a subsequent process restart restores retained work.
6. Reconnecting a held save to the real helper clears the queue only after confirmation and preserves issued history exactly.
7. A downloaded workspace backup restores into a fresh profile and remains restored after another forced browser termination.

City SQL lookup is disabled at the browser boundary, other external browser requests are blocked, and no Outlook/printing acceptance is inferred. The helper's private bootstrap and native Windows file permissions are exercised without writing tokens into artifacts.

## Limits

Forced process death is not a physical power-loss or storage-controller durability test. A loopback SMB share is not the City's SMB server, domain policy, VPN or two-PC acceptance environment. Hardware reset, City connectivity, staff decisions, native Outlook and print acceptance remain with their existing owners. Existing acceptance items are not automatically closed by these hosted Windows results.
