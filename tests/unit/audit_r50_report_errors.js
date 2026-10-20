const assert = require("assert/strict");
require("../fixtures/bundle_test.cjs")(
  "\nglobal.fetch=async()=>({status:502,ok:false,json:async()=>{throw new Sy" +
    "ntaxError('bad response')}});await assert.rejects(getJSON('/reporting/in" +
    "dex'),/502.*readable|readable.*502/);\nconst a={cells:['a']},b={cells:['b" +
    "']};let notice='';const old=String.prototype.localeCompare;String.protot" +
    "ype.localeCompare=function(){throw Error('forced comparator failure')};t" +
    "ry{assert.deepEqual(orderedRows({rows:[b,a]},{ci:0,dir:1},message=>notic" +
    "e=message).map(x=>x.row),[b,a]);}finally{String.prototype.localeCompare=" +
    "old}assert.ok(/default order/i.test(notice));console.log('PASS report pa" +
    "rse status and explicit default-order fallback');",
  "reports",
);
