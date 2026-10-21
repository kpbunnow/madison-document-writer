/* With DW_PROJECTION_CAPTURE=<file>, code appended after a bundle records every summarize()
   input and output, for audit_case_projection.py. Empty otherwise, so suites run unchanged. */
module.exports = process.env.DW_PROJECTION_CAPTURE
  ? "\n;{const __real=summarize,__seen=[];summarize=function(f){const s=__real(f);" +
    "__seen.push({file:JSON.parse(JSON.stringify(f)),summary:JSON.parse(JSON.stringify(s))});return s;};" +
    "process.on('exit',()=>require('fs').writeFileSync(process.env.DW_PROJECTION_CAPTURE,JSON.stringify(__seen)));}\n"
  : "";
