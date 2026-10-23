/* R62 (owner, Development 3): authoring-16 referral, referral-update and compliance documents print every
   observation note under the violation (corrected items included), never in the Inspection History column; a
   referred case offers only Update for Case Referral and Compliance Letter. Earlier formats unchanged. Synthetic. */
globalThis.MADISON_TEST_DATA = true;
require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  const item = (done) => ({ id: done ? 'c' : 'o', no: done ? '2' : '1', text: 'Repair wall.', sections: ['27.05(2)(c)'], abate: false,
    done, doneOn: done ? '2026-03-14' : '', hist: [
      { on: '2026-03-07', oc: 'initial' },
      { on: '2026-03-09', oc: 'none', note: 'Observed <surface> & damage.' },
      ...(done ? [{ on: '2026-03-14', oc: 'corrected', note: 'Repair verified.' }] : [{ on: '2026-03-12', oc: 'progress', note: 'Contractor started.' }]),
    ] });
  for (const type of ['referral', 'referralUpdate', 'compliance']) {
    const items = type === 'compliance' ? [item(true)] : [item(false), item(true)];
    const d = { id: 'r62-' + type, caseId: 'k1', type, authoringVersion: 16, draft: true, items, cits: {}, inspDate: '2026-03-14' };
    const root = document.createElement('div');
    root.innerHTML = noticeHTML(d);
    for (const row of root.querySelectorAll('tr[data-row]')) {
      const it = items.find((x) => x.id === row.dataset.row);
      const notes = [...row.querySelectorAll('.corr [data-history-note]')];
      const expected = it.hist.filter((x) => x.note);
      assert.equal(notes.length, expected.length, type + ': every note under the violation');
      assert.deepEqual(notes.map((n) => n.lastChild.textContent), expected.map((x) => x.note), type + ': oldest first, text escaped');
      assert.ok(notes.every((n) => n.style.display === 'block'), type + ': notes print on corrected items too');
      assert.match(notes[0].querySelector('.it-note-h').textContent, new RegExp(fmtDate('2026-03-09')));
      assert.equal(row.querySelector('surface'), null);
      const history = row.querySelector('.visit-list');
      assert.ok(history, type + ': history column retained');
      assert.ok(!/Note:|Observed|Repair verified|Contractor started/.test(history.textContent), type + ': no note in the history column');
      assert.match(history.textContent, /Days Outstanding/);
    }
    // Authoring 15 keeps notes in the history column.
    root.innerHTML = noticeHTML({ ...clone(d), authoringVersion: 15 });
    assert.equal(root.querySelectorAll('[data-history-note]').length, 0);
    assert.match(root.querySelector('.visit-list').textContent, /Note: Observed <surface> & damage\\./);
  }

  // A referred case: only Update for Case Referral and Compliance Letter are offered and allowed.
  const source = { id: 'src', caseId: 'k1', type: 'notice', draft: false, status: 'Final', inspDate: addDays(stamp, -30),
    items: [{ id: 'a', no: '1', text: 'Repair wall.', sections: ['27.05(2)(c)'], due: addDays(stamp, -1) }] };
  const referral = { id: 'ref', caseId: 'k1', type: 'referral', draft: false, status: 'Final', fromDocId: 'src', inspDate: addDays(stamp, -7),
    authoringVersion: 15, items: clone(source.items), cits: {} };
  const visit = { id: 'v', caseId: 'k1', sourceDocId: 'ref', draft: true, date: stamp, time: '09:00', inspectorId: INSPECTORS[0].id,
    results: { a: { oc: 'none', on: stamp, note: '' } } };
  WriterState.DOCS = [referral, source]; WriterState.REINSP = [visit];
  const box = document.createElement('div');
  box.innerHTML = newDocuments.chooser(visit);
  const groups = [...box.querySelectorAll('[data-action-group]')].map((x) => x.dataset.actionGroup);
  assert.deepEqual(groups.sort(), ['compliance', 'enforcement'], 'only groups with an allowed document');
  for (const type of ['extension', 'bestInterestExtension', 'vacancyExtension', 'citation', 'noOccupancy', 'summaryAbatement', 'nonSummaryAbatement'])
    assert.match(newDocuments.eligibility(visit, type), /Only an Update for Case Referral or a Compliance Letter/, type);
  assert.equal(newDocuments.eligibility(visit, 'referralUpdate'), '');
  visit.followupIntent = '';
  visit.actionGroup = 'enforcement';
  box.innerHTML = newDocuments.chooser(visit);
  assert.deepEqual([...box.querySelectorAll('[data-action-type]')].map((x) => x.dataset.actionType), ['referralUpdate']);
  const toasts = []; toast = (m) => toasts.push(String(m));
  assert.equal(newDocuments.caseAction('k1', 'noOccupancy'), null);
  assert.match(toasts.at(-1), /Only an Update for Case Referral or a Compliance Letter/);
  assert.ok(!WriterState.DOCS.some((x) => x.type === 'noOccupancy'), 'no scoped order is created');
  WriterState.WORK.currentAction = { cid: 'k1', type: '', group: '' };
  const screen = document.createElement('div');
  screen.innerHTML = newDocuments.caseActionScreen();
  assert.equal(screen.querySelectorAll('[data-case-action-group],[data-case-action-type],[data-special="emergencyApproved"]').length, 0);
  assert.match(screen.textContent, /Only an Update for Case Referral or a Compliance Letter/);
  console.log('PASS R62 history notes under the violation on every item, and referred cases limited to Update for Case Referral or Compliance');
`);
