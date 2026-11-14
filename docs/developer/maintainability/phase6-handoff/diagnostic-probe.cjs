const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('../checkout/node_modules/esbuild');
const root = path.resolve(__dirname,'..');
const digest = v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
(async()=>{
 const built=await esbuild.build({stdin:{contents:`export {createHelperRequests} from './helper_requests.js';export {helperStop} from './helper_stopped.js';export {createSharedCaseStorage} from './shared_case_storage.js';export {createCaseSaveWorkflow} from './case_save_workflow.js';export {createPendingCaseSaves} from './pending_case_saves.js';export {verifyIntegrity,initRecordIntegrity} from './record_integrity.js';export {createAccelaImport} from './accela_import.js';export {WriterState} from './state.js';`,resolveDir:path.resolve('app/modules')},bundle:true,write:false,format:'cjs',define:{__TEST_BUILD__:'false'},plugins:[{name:'data',setup(b){b.onResolve({filter:/\/data\//},a=>({path:path.resolve('build/generated/modules/data',path.basename(a.path))}));}}]});
 const box={exports:{}}; new Function('module','exports',built.outputFiles[0].text)(box,box.exports);
 const api=box.exports,s=api.WriterState;
 const {good,bad}=JSON.parse(fs.readFileSync(root+'/runtime/proof-fixture.json','utf8'));
 const messages=[], effects=[], persisted=[];
 let fetchCalls=0, verifyCalls=0;
 // Session credential exists only in this mock and is never retained or printed.
 global.document={querySelector:()=>({content:crypto.randomUUID()})};
 global.fetch=async()=>{fetchCalls++;throw new TypeError('Synthetic transport unavailable');};
 const requests=api.createHelperRequests({recordIntegrity:{verify:async()=>{verifyCalls++;}}});
 const work={typed:'synthetic retained work',case:structuredClone(good.case)}; const workBefore=digest(work);
 await assert.rejects(requests.helperJSON('/cases/save',{file:good}),{name:'TypeError',message:'Synthetic transport unavailable'});
 assert.equal(digest(work),workBefore);assert.equal(fetchCalls,1);assert.equal(verifyCalls,0);
 const transport={class:'TypeError',message:'Synthetic transport unavailable',fetch_calls:fetchCalls,verification_calls:verifyCalls,retained_before:workBefore,retained_after:digest(work)};
 global.fetch=async()=>{fetchCalls++;return {status:403};};
 await assert.rejects(requests.helperJSON('/cases/save',{file:good}),/helper session changed or refused/);
 const atStop=fetchCalls;api.helperStop.stopped=true;
 await assert.rejects(requests.helperJSON('/cases/save',{file:good}),/Document Writer has stopped/);
 assert.equal(fetchCalls,atStop);api.helperStop.stopped=false;
 transport.session_403_distinct=true;transport.stopped_refused_before_fetch=true;
 const baseline=structuredClone(good);let current=structuredClone(good);
 Object.assign(s,{CASES:[current.case],DOCS:[],REINSP:[],EVENTS:[],PENDING:[],DIRTY:true,CASEDIR:{helper:true},DIRNAME:'Synthetic share',NEEDGRANT:false,SAVE_CHECKPOINTS:{},state:{acc:{source:{kind:'ssrs'}}},WORK:{entry:{},acc:null}});
 const localBefore=digest({cases:s.CASES,docs:s.DOCS,events:s.EVENTS,work:s.WORK});
 global.fetch=async()=>{fetchCalls++;throw new TypeError('Synthetic transport unavailable');};
 const committed=new Map();
 const storage=api.createSharedCaseStorage({recordIntegrity:{status:()=>({valid:true}),verify:async()=>{throw Error('not reached')}},COMMITTED:committed,helperJSON:requests.helperJSON,mergeCaseEvents:()=>effects.push('merge'),project:()=>effects.push('project')});
 let acknowledged=false;const written=[];
 const pending=api.createPendingCaseSaves({idbSet:async(k,v)=>{persisted.push([k,structuredClone(v)]);return true;},toast:m=>messages.push(m),loadCaseFile:()=>assert.fail('loaded local case again'),mergeSharedFile:async()=>0,caseFile:()=>current,writeToFolder:async(name,body)=>{written.push({name,body:JSON.parse(body)});return {ok:true,file:JSON.parse(body)};},rememberSaved:()=>{acknowledged=true;effects.push('rememberSaved')},writeSummary:async()=>effects.push('summary'),saveDrafts:async()=>true,render:()=>effects.push('render')});
 const saves=api.createCaseSaveWorkflow({caseNumberAllowed:()=>true,caseFile:()=>current,toast:m=>messages.push(m),mergeSharedFile:async()=>0,writeToFolder:storage.writeToFolder,queuePending:pending.queuePending,render:()=>effects.push('render'),rememberSaved:()=>assert.fail('false successful save'),writeSummary:()=>assert.fail('false summary'),saveDrafts:()=>assert.fail('false draft confirmation'),idbSet:()=>assert.fail('false clear')});
 assert.equal(await saves.saveCaseFile(current.case.id),false);
 assert.equal(s.PENDING.length,1);assert.equal(persisted.length,1);assert.equal(s.DIRTY,true);assert.equal(s.LASTWRITE.ok,false);assert.equal(committed.size,0);assert.equal(acknowledged,false);
 assert.equal(digest({cases:s.CASES,docs:s.DOCS,events:s.EVENTS,work:s.WORK}),localBefore);
 const held=structuredClone(s.PENDING[0]); const heldBefore=digest(held.body);assert.equal(held.body,JSON.stringify(baseline,null,2));
 const pendingReceipt={public_save_result:false,last_write_ok:s.LASTWRITE.ok,held_count:s.PENDING.length,persisted_held_count:persisted[0][1].length,dirty_retained:s.DIRTY,committed_count:committed.size,retained_before:localBefore,retained_after:digest({cases:s.CASES,docs:s.DOCS,events:s.EVENTS,work:s.WORK}),held_body_sha256:heldBefore};
 // Retry uses the real queue owner; only confirmed storage peer is simulated.
 current.case.owner='SYNTHETIC CURRENT OWNER';
 assert.equal(await pending.flushPending(),1);assert.equal(written.length,1);assert.equal(written[0].name,held.name);assert.equal(written[0].body.case.id,baseline.case.id);assert.equal(written[0].body.case.owner,'SYNTHETIC CURRENT OWNER');assert.equal(s.PENDING.length,0);assert.equal(acknowledged,true);
 pendingReceipt.retry={completed:1,held_after:0,retained_filename:true,retained_case_id:true,current_work_used:true,old_held_body_unchanged:heldBefore===digest(held.body),acknowledgment_peer:'mocked successful storage reply after real queue serialization'};
 // Concrete native-folder save refusal: schema-5 helper authority blocks before file handle access.
 let nativeOpens=0;s.CASEDIR={helper:false,getFileHandle:()=>{nativeOpens++;assert.fail('native write bypassed helper authority')}};s.PENDING=[];s.DIRTY=true;
 assert.equal(await saves.saveCaseFile(current.case.id),false);assert.equal(nativeOpens,0);assert.equal(s.PENDING.length,1);assert.match(s.LASTWRITE.why,/Schema 5 requires the local helper/);
 const trace={path:['case_save_workflow.saveCaseFile','caseFile serialization','mergeSharedFile boundary (mock no-op)','second caseFile serialization','shared_case_storage.writeToFolder','schema-5 native-folder refusal','pending_case_saves.queuePending','device idbSet boundary (mock acknowledged)'],public_result:false,native_file_handle_calls:nativeOpens,held_count:s.PENDING.length,last_write_ok:s.LASTWRITE.ok,message:s.LASTWRITE.why,no_summary_or_checkpoint:true};
 // Actual import guard refuses an unconfirmed live SSRS selection before accept/mutation.
 const importBefore=digest({cases:s.CASES,docs:s.DOCS,events:s.EVENTS,work:s.WORK,acc:s.state.acc});
 const importer=api.createAccelaImport({toast:m=>messages.push(m)});
 assert.equal(importer.acceptAccela(),null);
 assert.equal(digest({cases:s.CASES,docs:s.DOCS,events:s.EVENTS,work:s.WORK,acc:s.state.acc}),importBefore);
 assert.equal(messages.at(-1),'Check the shared record before confirming this lookup.');
 const importTrace={owner:'accela_import.acceptAccela',source_kind:'ssrs',public_result:null,guard:'private LOOKUP_READY lacks current selection',retained_before:importBefore,retained_after:digest({cases:s.CASES,docs:s.DOCS,events:s.EVENTS,work:s.WORK,acc:s.state.acc}),acceptance_and_save_effects:0};
 // Independently verify Python-generated proofs in real browser owner and demonstrate write gate.
 assert.equal((await api.verifyIntegrity(good)).valid,true);const beforeGood=digest(good);
 const invalid=await api.verifyIntegrity(bad);assert.equal(invalid.valid,false);assert.equal(invalid.eventId,'genesis');assert.equal(digest(good),beforeGood);
 const integrity=api.initRecordIntegrity({kase:()=>current.case});await integrity.verify(bad);let proofWriteCalls=0;
 const gated=api.createSharedCaseStorage({recordIntegrity:integrity,helperJSON:async()=>{proofWriteCalls++;assert.fail('invalid proof wrote')},COMMITTED:new Map()});
 s.CASEDIR={helper:true};const refusal=await gated.writeToFolder('synthetic.json',JSON.stringify(good));assert.equal(refusal.ok,false);assert.equal(proofWriteCalls,0);
 const proof={owner:'record_integrity.verifyIntegrity -> initRecordIntegrity.status -> shared_case_storage.writeToFolder',valid_original:true,altered_proof_event:invalid.eventId,valid_altered:false,original_before:beforeGood,original_after:digest(good),public_write_result:refusal,helper_calls:proofWriteCalls};
 const receipts={scenario:'actual-browser-owner-refusals',transport,pending:pendingReceipt,save_trace:trace,import_trace:importTrace,proof,mocked_boundaries:['document session lookup','fetch rejection/403','device idbSet','shared merge no-op','retry storage acknowledgment'],native_acceptance_claimed:false};
 fs.writeFileSync(root+'/evidence/diagnostic-receipt.json',JSON.stringify(receipts,null,2)+'\n');console.log(JSON.stringify(receipts));
})().catch(e=>{console.error(e);process.exitCode=1});
