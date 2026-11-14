const assert = require('node:assert/strict');
const { compile } = require('../checkout/tests/fixtures/equivalence_harness.cjs');
(async () => {
 const api = await compile('export {loadWorkflowPreferences} from "./workflow_preferences.js";');
 const source = JSON.stringify({ reminders: { dismissed: ['earlier', 'same', 3, 'same', 'later', 'earlier'] }});
 const result = api.loadWorkflowPreferences(() => source);
 assert.deepEqual(result.reminders.dismissed, ['same','later','earlier']);
 const unique = Array.from({length:205},(_,n)=>'synthetic-'+n);
 assert.deepEqual(api.loadWorkflowPreferences(()=>JSON.stringify({reminders:{dismissed:unique}})).reminders.dismissed,unique.slice(-200));
 result.reminders.dismissed.push('local-edit');
 assert.deepEqual(api.loadWorkflowPreferences(()=>source).reminders.dismissed,['same','later','earlier']);
 assert.deepEqual(api.loadWorkflowPreferences(()=>{throw Error('synthetic storage refusal')}),{reminders:{enabled:false,days:7,plans:{},dismissed:[]}});
 console.log('PASS actual optional-preference owner: last-occurrence deduplication, 200 bound, fresh state and denied-storage fallback');
})().catch(e=>{ console.error(e);process.exitCode=1 });
