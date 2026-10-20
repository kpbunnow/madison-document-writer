const assert = require("assert/strict");
require("../fixtures/bundle_test.cjs")(
  "\nWriterState.CATALOG_FROM_CACHE=true;WriterState.CATALOG_VERIFIED=true;W" +
    "riterState.CATALOG_EVENTS=[];WriterState.CATALOG_ERROR='';WriterState.CA" +
    "TALOG_AT='synthetic cached date';WriterState.state={languageMode:'browse" +
    "',libCl:-1};render=()=>{};helperJSON=async()=>({events:[]});global.local" +
    "Storage={setItem:()=>{}};\nassert.ok(screenLibrary().includes('Review sta" +
    "tus from cache · refreshing'));await refreshCatalog();assert.equal(Write" +
    "rState.CATALOG_FROM_CACHE,false);assert.equal(WriterState.CATALOG_VERIFI" +
    "ED,true);assert.ok(screenLibrary().includes('Review status last verified" +
    ":'));\nWriterState.CATALOG_FROM_CACHE=true;helperJSON=async()=>{throw Err" +
    "or('offline')};await refreshCatalog();assert.equal(WriterState.CATALOG_F" +
    "ROM_CACHE,true);assert.ok(screenLibrary().includes('Review status from c" +
    "ache · refresh unavailable'));console.log('PASS cached status, current c" +
    "onfirmation and outage caption');",
);
