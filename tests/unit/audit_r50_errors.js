const assert = require("assert/strict");
require("../fixtures/bundle_test.cjs")(
  "\nlet calls=0,writes=0,messages=[];const cyclic={};cyclic.self=cyclic;\nca" +
    "seNumberAllowed=()=>true;kase=()=>({id:'one'});caseFileName=()=> 'safe.j" +
    "son';caseFile=()=>++calls===2?cyclic:{schema:5};toast=text=>messages.pus" +
    "h(text);WriterState.CASEDIR={helper:true};mergeSharedFile=async()=>0;wri" +
    "teToFolder=async()=>{writes++;return {ok:false}};queuePending=async()=>{" +
    "};render=()=>{};\nassert.equal(await saveCaseFile('one'),false);assert.eq" +
    "ual(writes,0);assert.ok(messages.some(x=>x.includes('The case could not " +
    "be exported')));\ncalls=1;messages=[];assert.equal(await saveCaseFile('on" +
    "e'),false);assert.equal(writes,0);assert.ok(messages.some(x=>x.includes(" +
    "'The case could not be exported')));console.log('PASS serialization fail" +
    "ure never writes empty or stale case bytes');",
);
