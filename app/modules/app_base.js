/* Writer base helpers: constants and small functions that read only shared modules and state boundaries.
   Every service area may use them directly; they never call back into a service owner. */
import { workspaceState as workspace } from "./workspace_state.js";
import { rnd12 } from "./record_ids.js";
import { addDays } from "./calendar.js";
import { recordDay } from "../assets/shared.js";

/* Ids have to be unique across machines, not only within this session:
   two inspectors working the same case offline both allocate ids and the
   files are merged by union, so a plain counter collides. The counter is
   kept as a readable prefix; the random tail is what makes it unique. */
export const uid = (p) => p + ++workspace.seq + "-" + rnd12();

// a due date is never today or earlier
export const MINDUE = () => addDays(recordDay(today), 1);

/* ---------- storage ----------
   Served from localhost the browser gives us two things a file:// page cannot
   have: the File System Access API, so the case folder on the share is written
   in place, and IndexedDB, so drafts survive a closed laptop without ever
   touching the share. Drafts are working papers; only issued documents belong
   in the shared record. */
export const FS_OK = typeof window !== "undefined" && !!window.showDirectoryPicker;
export const CASEDIR_EXPECT = "Case JSON Files"; /* the division's folder for case records */
export const IDB_OK = typeof indexedDB !== "undefined" && !!indexedDB;

export const storageMode = () => (workspace.CASEDIR ? (workspace.NEEDGRANT ? "folder-locked" : "folder") : FS_OK ? "folder-not-linked" : "download");

export const COMMITTED = new Map();
