# R58 desktop launch and safe exit

Development baseline: main `ab40a1e` (R57 as packaged). Developed on `develop/desktop-launch`,
kpbunnow/madison-document-writer#29. Identity: 2026-10-22 R58, helper 2026.10.22.59,
helperBuild 59, authorized by the requester. Authoring 13, case schema 5, summary 6, workspace
backup 2, approved language, print stylesheet, frozen fixtures, court copies, report calculations
and operational storage paths are unchanged. The design, process model and Windows checklist are
in DESKTOP-LAUNCH.md.

## Changes

1. Icon. Original artwork (navy building merging into a white document, teal checkmark); it does
   not imply City branding approval. Source app/assets/document-writer-icon.svg; tools/build_icon.py
   rasterizes it with the pinned Chromium into a PNG-compressed 16/32/48/256 px ICO and `--check`
   reproduces the bytes. The helper serves it as /favicon.ico (public static route; no template or
   CSP change).
2. Console-free start. The desktop shortcut runs the installation's verified pythonw.exe with
   `-B "<local>\launch.py"`, the local working directory and the icon; existing desktop shortcuts are
   migrated in place. The launcher applies approved updates through the unchanged verified_update and
   install_release path, restarts itself after a changed verified release, starts the helper detached
   and hidden (or reuses a compatible running helper), waits for /dw-status and opens Writer in a
   Chrome or Edge `--app` window in the existing profile, falling back to the default browser.
   Every helper subprocess states its creation flags. Start Document Writer.bat remains the IT
   diagnostic launcher.
3. Feedback and diagnostics. Windows dialogs name a next step and the log location; a rotating
   logs\launcher.log records launch and update outcomes without tokens, session URLs or case content;
   `--open-logs` opens the folder; a starting indicator appears when startup is slow.
4. Exit Document Writer. Tools & settings → Saved work & connection. Drafts are saved first; active
   publication, PDF filing or failed device saving refuse exit; queued shared saves, PDF transfers,
   unconfirmed publications and an unknown outbox status are listed (never as saved) and need
   acknowledgment. The authenticated POST /helper/shutdown (POST_ROUTES guards) refuses with reasons
   while the helper runs another request, holds a lock, anchors integrity records or installs an
   update; otherwise it answers and stops serving. Open Writer and Reports windows of the same helper
   instance show that Document Writer has stopped; a stopped Writer releases its workspace lock.
   Closing a window does not stop the helper; nothing kills other processes.

## Review corrections

Corrective review of PR #29 (`6993b51`): restart the installed launcher after a changed verified
release; validate required-file metadata inside the repair-dialog boundary; register integrity
anchoring as active work for its whole operation; make exit preparation cancellable and re-review
new work; disclose an unknown outbox status; scope stop notifications to the helper instance;
release a stopped Writer's workspace lock and Reports handoff. The R58 identity commit corrected the
deploy guide: after upgrading from R57 or earlier the first start runs the previously installed
launcher (command window), and the shortcut is migrated at the following start.

## Upgrade notes

A PC running an R57 or earlier helper sees a different version and shows the older-helper dialog;
that helper stops when its command window is closed or the inspector signs out. The first start
after upgrading runs the old launcher, which installs R58 and opens Writer with a command window;
the R58 launcher migrates the desktop shortcut at the next start.

## Acceptance

Automated tests ran on Linux with simulated Windows calls and real helper processes. Native Windows
items L58-1 to L58-9 in ACCEPTANCE-RECORD.md remain OPEN, together with the existing City, legal and
mandatory-appearance items. A concurrent double-click during an update and a proxy that does not
bypass loopback also need native observation. Packaging produces a verified package; it is not a
live rollout.
