/* With DW_PROJECTION_CAPTURE=<file>, code appended after a bundle records every summarize() input and output, for
   audit_case_projection.py. Empty otherwise, so suites run unchanged.

   Consolidation Phase 2 (T2): the capture is an envelope bound to its run (DW_PROJECTION_RUN), suite
   (DW_PROJECTION_SUITE), source (DW_PROJECTION_SOURCE) and the suite's exit status, published atomically (written to
   a temporary file, then renamed) when the process exits. The projection check refuses any other capture. */
module.exports = process.env.DW_PROJECTION_CAPTURE
  ? "\n;{const __real=summarize,__seen=[];summarize=function(f){const s=__real(f);" +
    "__seen.push({file:JSON.parse(JSON.stringify(f)),summary:JSON.parse(JSON.stringify(s))});return s;};" +
    "process.on('exit',(code)=>{const fs=require('fs'),target=process.env.DW_PROJECTION_CAPTURE,temp=target+'.'+process.pid+'.tmp';" +
    "fs.writeFileSync(temp,JSON.stringify({format:'madison-projection-capture',version:1," +
    "run:process.env.DW_PROJECTION_RUN||'',suite:process.env.DW_PROJECTION_SUITE||'',source:process.env.DW_PROJECTION_SOURCE||''," +
    "passed:code===0&&!process.exitCode,summaries:__seen}));fs.renameSync(temp,target);});}\n"
  : "";
