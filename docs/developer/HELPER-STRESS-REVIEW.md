# Local helper stress review — 2026-11-23

The local helper writes the shared case records, so this review fed every helper route malformed, oversized and
hostile input. Everything ran on synthetic data, against a helper started from main at
`0fa242053cfc8ee1d740e46cd27f430c03f778ab` with its own temporary case folder.

## What was run

- **Random hostile requests (5,568).** Every GET and POST route received:
  - bodies that are not JSON, truncated JSON, duplicate keys and deep nesting;
  - wrong JSON types at the top level and in each field;
  - oversized bodies, a `Content-Length` larger or smaller than the body, and a missing token or content type;
  - traversal, device, reserved and very long file names, and control and non-ASCII characters.
- **Mutation replay (2,100–2,800 per run).**
  - Real requests were recorded from a browser session that drives the production pages, covering case save,
    summary, PDF save, artifact status and draft backup.
  - Each body was mutated one field at a time: deleted, retyped, emptied, oversized or replaced with a hostile value.
  - Every accepted save was read back and checked for integrity and strict JSON.
- **Containment checks.** After each run, the helper was still answering, and no file had been written outside its
  own folders.

## Findings fixed

| Finding | Effect | Fix |
| --- | --- | --- |
| A save whose document snapshot had `items`, `cits`, `frozen`, `frozen.case` or `frozen.inspector` of the wrong JSON type, or a non-object `reinspection`, reached validators that call object methods on it. | For an issued document, the browser was shown the generic "could not confirm" message. For an ordinary saved document, the damaged snapshot was **written to the shared case file**, where later validators and browsers would fail on it. | Incoming saves are refused with "A document in this case has a damaged structure" before anything is written. Stored records are still read, so older files remain reviewable. |
| A summary whose `case` was not an object raised an internal error. | Generic "could not confirm" message. | Refused as "Expected a case summary". |
| An artifact status request whose `filename` was not text raised an internal error. | Generic "could not confirm" message. | Refused as an invalid artifact status identity. |
| A summary for a case file that is no longer in a connected folder said "Check that the shared case folder is connected". | It sent staff to check a working connection. | It now says the case's saved file is no longer in the shared case folder and to reopen the case. |

`tests/unit/audit_helper_input_shapes.py` holds these cases permanently. It fails on main before this change (26
cases) and passes after it.

## Held as designed

- **No crash or unexpected server error.** No route returned 500, apart from `/email`, which needs Outlook and
  correctly reports that it is not available on Linux. The helper stayed up throughout.
- **No escape from the helper's folders.**
  - Hostile PDF names were cleaned into the PDF folder.
  - Traversal, absolute, device, reserved and very long names wrote nothing outside the helper's folders.
- **Accepted saves were sound.** Every save the helper accepted verified, and read back as strict JSON.
- **Short bodies wait, then time out.** A body shorter than its declared `Content-Length` holds that one connection
  until the 60-second socket timeout.
- **Oversized bodies are refused early.** The helper closes the connection, which the sender sees as a broken pipe.
- **Requests from outside are refused.** Every POST route refused a missing or wrong token, a foreign host or origin,
  and a cross-site request with 403. Static path probes did not serve the helper's source or session file.

The fuzzers are not part of the gate. The permanent test above is.
