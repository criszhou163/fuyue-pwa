/* Local image recognition and explicit review. */
let ocrGeneration=0,ocrPreviewURL='',ocrFound=null,ocrBatchDates=[],ocrImageWarnings=[];
function resetOCR(){cancelOCR();ocrImageWarnings=[];ocrBatchDates=[];ocrFound=null;$('#ocrFile').value='';$('#ocrHint').value='';$('#ocrAttach').checked=false;$('#ocrEmptyOnly').checked=true;$('#ocrReview').hidden=true;$('#ocrPreview').hidden=true;$('#ocrStatus').textContent='';$('#batchNotice').textContent='';$('#runOcr').disabled=false;if(ocrPreviewURL)URL.revokeObjectURL(ocrPreviewURL);}
function reviewOCR(){
  ocrFound=FuyueOCR.extract($('#ocrText').value,{hint:$('#ocrHint').value,kind:$('#ocrKind').value,artists:data.artists,cities:chinaCityRecords});
  const f=ocrFound;f.warnings=[...ocrImageWarnings,...f.warnings];$('#ocrTitle').value=f.title;$('#ocrCity').value=f.city;$('#ocrVenue').value=f.venue;$('#ocrVenues').innerHTML=f.venues.map(v=>`<option value="${esc(v)}">`).join('');
  $('#ocrDates').innerHTML=f.dates.map((d,i)=>`<label class="ocr-date"><input type="checkbox" data-ocr-date="${i}" ${f.selected.includes(d.date)&&d.date?'checked':''}><span>${esc(d.label)}</span><input type="date" aria-label="确认完整日期" value="${d.date}"></label>`).join('')||'<p class="note">未找到日期，可在下方手动补充。</p>';
  $('#ocrManualDate').value='';$('#ocrWarnings').textContent=f.warnings.join(' ');$('#ocrReview').hidden=false;
}
let activeOCRWorker=null;
function cancelOCR(){ocrGeneration++;if(activeOCRWorker){activeOCRWorker.terminate().catch(()=>{});activeOCRWorker=null;}$('#runOcr').disabled=false;$('#ocrCancel').hidden=true;}
async function runOCR(){
  const file=$('#ocrFile').files[0];if(!file)return $('#ocrStatus').textContent='请先选择订单截图或海报。';cancelOCR();const generation=ocrGeneration;$('#runOcr').disabled=true;$('#ocrCancel').hidden=false;$('#ocrReview').hidden=true;
  try{
    $('#ocrStatus').textContent='准备识别，首次加载模型需要联网…';
    const result=await FuyueImageOCR.recognize(file,{language:$('#ocrLanguage').value,kind:$('#ocrKind').value,enhance:$('#ocrEnhance').checked,cities:chinaCityRecords,cancelled:()=>generation!==ocrGeneration,onWorker:w=>{if(generation===ocrGeneration)activeOCRWorker=w;},onProgress:message=>{if(generation===ocrGeneration)$('#ocrStatus').textContent=message;}});
    if(generation!==ocrGeneration)return;ocrImageWarnings=result.warnings||[];$('#ocrText').value=result.text;reviewOCR();$('#ocrStatus').textContent='识别完成。已合并分区识别结果，请对照原图核对标题、日期与场馆。';
  }catch(error){if(generation===ocrGeneration)$('#ocrStatus').textContent='识别失败：'+error.message+'。仍可手动填写。';}
  finally{if(generation===ocrGeneration){$('#runOcr').disabled=false;$('#ocrCancel').hidden=true;}}
}
function initOCR(){
  $('#runOcr').onclick=runOCR;$('#ocrCancel').onclick=()=>{cancelOCR();$('#ocrStatus').textContent='已取消识别。';};
  $('#ocrFile').onchange=()=>{cancelOCR();ocrImageWarnings=[];$('#runOcr').disabled=false;$('#ocrReview').hidden=true;if(ocrPreviewURL)URL.revokeObjectURL(ocrPreviewURL);const file=$('#ocrFile').files[0];$('#ocrPreview').hidden=!file;if(file){ocrPreviewURL=URL.createObjectURL(file);$('#ocrPreview').src=ocrPreviewURL;}$('#ocrStatus').textContent='';};
  $('#reparseOcr').onclick=reviewOCR;
  $('#applyOcr').onclick=async()=>{
    const dates=[...new Set([...document.querySelectorAll('#ocrDates .ocr-date')].filter(row=>row.querySelector('[type=checkbox]').checked).map(row=>row.querySelector('[type=date]').value).concat($('#ocrManualDate').value||[]))];
    if(dates.some(d=>!d))return $('#ocrWarnings').textContent='请为选中的场次补全日期和年份。';
    if($('#recordId').value&&dates.length>1)return $('#ocrWarnings').textContent='编辑已有记录时请选择一个日期；多场次请新增记录。';
    const emptyOnly=$('#ocrEmptyOnly').checked,blankRecord=!$('#recordId').value&&!$('#title').value;const put=(id,value)=>{if(value&&(!emptyOnly||!$(id).value))$(id).value=value;};
    put('#title',FuyueOCR.tidy($('#ocrTitle').value));put('#city',$('#ocrCity').value.trim());put('#venue',FuyueOCR.tidy($('#ocrVenue').value));syncCityPicker($('#city').value);
    ocrBatchDates=[];if(dates.length&&(!emptyOnly||!$('#date').value)){dates.sort();$('#date').value=dates[0];ocrBatchDates=dates;}
    if(!emptyOnly||blankRecord)$('#eventType').value=ocrFound.type;if(!emptyOnly||!document.querySelector('#checks input:checked'))ocrFound.artists.forEach(a=>{const input=document.querySelector(`#checks input[value="${data.artists.indexOf(a)}"]`);if(input)input.checked=true;});
    $('#batchNotice').textContent=ocrBatchDates.length>1?`保存时将分别创建 ${ocrBatchDates.length} 条记录：${ocrBatchDates.join('、')}。修改活动日期将取消批量创建。`:'';
    // Images are added synchronously to the draft after a guarded asynchronous conversion.
    const file=$('#ocrFile').files[0],generation=ocrGeneration;$('#applyOcr').disabled=true;
    try{if($('#ocrAttach').checked&&file){const url=await fileToCompressedDataURL(file);if(generation!==ocrGeneration)return;const draftBytes=mediaDraft.reduce((n,m)=>n+dataUrlBytes(m.dataUrl),0);if(mediaDraft.length<9&&!mediaDraft.some(m=>m.dataUrl===url)&&ensureCapacity(dataUrlBytes(url)+draftBytes)){mediaDraft.push({id:crypto.randomUUID(),name:file.name,kind:ocrFound.kind==='order'?'ticket':'photo',dataUrl:url});renderDraftMedia();}}if(generation===ocrGeneration){$('#ocrReview').hidden=true;$('#ocrStatus').textContent='已填入表单，请检查并保存。';}}
    catch(error){$('#ocrStatus').textContent=`信息已填入，图片未添加：${error.message}`;}finally{$('#applyOcr').disabled=false;}
  };
  $('#date').addEventListener('input',()=>{ocrBatchDates=[];$('#batchNotice').textContent='';});$('#record').addEventListener('close',cancelOCR);
}
initOCR();
