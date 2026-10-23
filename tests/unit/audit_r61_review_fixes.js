/* PR 33 review corrections (Writer): switching an administrative extension's family keeps each family's authoring
   version (no silent adoption of the simplified Best Interest format), the packet check compares the document's own
   frozen copy labels, and a refused retry filing explains itself. Synthetic only. */
globalThis.MADISON_TEST_DATA = true;
require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  const control = (key, value) => {
    const el = document.createElement('select');
    el.dataset.special = key;
    const option = document.createElement('option'); option.value = value; el.append(option); el.value = value;
    newDocuments.editEvent({ target: el, type: 'change' });
  };
  const adminDraft = (authoringVersion, special) => {
    newDoc('k1', 'notice');
    const d = doc(WriterState.state.docId);
    Object.assign(d, { type: 'bestInterestExtension', authoringVersion, special: clone(special),
      items: [{ id: 'a', no: '1', text: 'Repair wall.', sections: ['27.05(2)(c)'], due: addDays(stamp, 30) }] });
    return d;
  };

  // An older (authoring 13) Best Interest draft keeps its review/signer model through a family switch and back.
  const older = adminDraft(13, { reason: 'Contractor plan.', noSafety: true, signerName: 'S', signerTitle: 'Supervisor', originalDues: { 1: addDays(stamp, 30) } });
  control('administrativeType', 'vacancyExtension');
  assert.equal(older.type, 'vacancyExtension');
  assert.equal(older.authoringVersion, 13, 'Vacancy keeps the draft\\'s version');
  control('administrativeType', 'bestInterestExtension');
  assert.equal(older.authoringVersion, 13, 'returning to Best Interest never adopts the simplified format silently');
  assert.equal(older.special.signerName, 'S', 'its signer data is still the active model');

  // An authoring-12 draft is not upgraded by a switch.
  const twelve = adminDraft(12, { originalDues: { 1: addDays(stamp, 30) } });
  control('administrativeType', 'vacancyExtension');
  assert.equal(twelve.authoringVersion, 12);
  control('administrativeType', 'bestInterestExtension');
  assert.equal(twelve.authoringVersion, 12);

  // A draft created in the R61 format keeps the R61 defaults: 15 for Best Interest, the dated Vacancy model otherwise.
  const current = adminDraft(15, { reason: 'Contractor plan.', noSafety: true, originalDues: { 1: addDays(stamp, 30) } });
  control('administrativeType', 'vacancyExtension');
  assert.equal(current.authoringVersion, DATED_EXTENSIONS);
  control('administrativeType', 'bestInterestExtension');
  assert.equal(current.authoringVersion, 15);

  // The packet check compares the frozen copy labels the faces are rendered from, not today's global labels.
  WriterState.DOCS = []; newDoc('k1', 'notice');
  const citation = doc(WriterState.state.docId);
  citation.type = 'citation';
  citation.items = [{ id: 'charge', no: '1', text: 'Repair wall.', sections: ['27.05(2)(c)'], cite: true }];
  citation.cits = { charge: { num: 'B90000000001', ord: '27.05(2)(c)', issued: stamp, courtDate: addDays(stamp, 21), courtTime: '08:30', depositMode: 'schedule' } };
  applyDeposit(citation, 'charge', '27.05(2)(c)');
  const relabelled = globalCourtCopies().map((copy) => ({ ...copy, label: copy.label + ' (issued wording)' }));
  citation.frozen = { ...freezeSources(citation), courtCopies: relabelled };
  assert.equal((printJob(citation).html.match(/class="cit /g) || []).length, 4, 'a complete packet with its own frozen labels prints');
  citation.frozen = { ...freezeSources(citation), courtCopies: relabelled.slice(0, 3) };
  assert.throws(() => printJob(citation), /packet is incomplete/);
  citation.draft = false;
  assert.throws(() => printJob(citation), /issued record is unchanged/, 'after issuance the message does not claim a retained draft');

  // A refused retry filing shows its reason and leaves the button usable.
  citation.status = 'Final'; citation.filedAt = ''; WriterState.state.screen = 'write'; WriterState.state.docId = citation.id;
  const button = document.createElement('button'); button.id = 'btn-retryfiling'; document.body.append(button);
  let shown = '';
  toast = (message) => { shown = String(message); };
  button.click();
  assert.match(shown, /packet is incomplete/);
  console.log('PASS R61 review corrections: family switch keeps authoring, packet check uses frozen labels, refused filing explains itself');
`);
