// Review-state regression: exercise the actual UI handlers with a minimal DOM.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const fields=new Map();
const $=id=>{if(!fields.has(id))fields.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,checked:false,files:[],addEventListener(){}});return fields.get(id);};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const passes=[{text:'La车]AURA 容祖儿演唱会-香港站\n1 JUL 2027',pass:'整图',confidence:95},{text:'AURA TOUR 容祖儿演唱会\n18,22,23 JAN 2027',pass:'日期行',confidence:40}];
let imageResult={text:passes.map(p=>p.text).join('\n'),passes};
const context=vm.createContext({$,esc,FuyueOCR:require('./ocr-parser'),FuyueImageOCR:{recognize:async()=>imageResult},data:{artists:['容祖儿']},chinaCityRecords:[{name:'香港特别行政区'}],URL:{createObjectURL:()=>'',revokeObjectURL(){}},document:{querySelectorAll:()=>[],querySelector:()=>null},console});
vm.runInContext(fs.readFileSync('ocr-ui.js','utf8'),context);
async function main(){
  $('#ocrFile').files=[{name:'fixture.jpg'}];$('#ocrKind').value='poster';$('#ocrHint').value='参加18号场';
  await $('#runOcr').onclick();
  assert.equal($('#ocrTitle').value,'AURA TOUR 容祖儿演唱会');
  assert($('#ocrWarnings').textContent.includes('不一致'));
  assert(!$('#ocrDates').innerHTML.includes('checked'));
  assert($('#ocrDates').innerHTML.includes('第2轮·日期行'));
  // Changing a note alone must not silently discard image conflicts.
  $('#ocrHint').value='参加23号场';$('#reparseOcr').onclick();
  assert(!$('#ocrDates').innerHTML.includes('checked'));
  assert($('#ocrWarnings').textContent.includes('不一致'));
  // Explicitly correcting the raw text allows a fresh extraction.
  $('#ocrText').value='AURA TOUR 容祖儿演唱会\n18,22,23 JAN 2027';$('#reparseOcr').onclick();
  assert(!$('#ocrWarnings').textContent.includes('不一致'));
  assert.equal(($('#ocrDates').innerHTML.match(/checked/g)||[]).length,1);
  // A later import cannot inherit warnings/candidates from an earlier image.
  $('#ocrFile').files=[{name:'another.jpg'}];$('#ocrFile').onchange();
  imageResult={text:'容祖儿演唱会\n29 OCT 2026',passes:[{text:'容祖儿演唱会\n29 OCT 2026',pass:'整图'}]};
  $('#ocrHint').value='';await $('#runOcr').onclick();
  assert.equal($('#ocrTitle').value,'容祖儿演唱会');
  assert(!$('#ocrDates').innerHTML.includes('2027'));
  assert.equal(($('#ocrDates').innerHTML.match(/checked/g)||[]).length,1);
  console.log('PASS review: conflicting candidates, note changes, manual correction, next import');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
