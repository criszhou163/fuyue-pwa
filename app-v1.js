const initialData = {
  version: 1,
  artists: ['周笔畅', '容祖儿', '陈奕迅'],
  events: [
    {id:1,artists:['周笔畅'],title:'巡回演唱会 · 示例',type:'演唱会',date:'2026-08-16',city:'上海',venue:'示例体育馆',status:'attended',notes:'',media:[]},
    {id:2,artists:['容祖儿'],title:'巡回演唱会 · 示例',type:'演唱会',date:'2026-07-12',city:'杭州',venue:'示例奥体中心',status:'attended',notes:'',media:[]},
    {id:3,artists:['陈奕迅'],title:'巡回演唱会 · 示例',type:'演唱会',date:'2026-06-21',city:'南京',venue:'示例体育中心',status:'attended',notes:'',media:[]},
    {id:4,artists:['周笔畅'],title:'秋日音乐节 · 示例',type:'音乐节',date:'2026-10-18',city:'杭州',venue:'示例音乐公园',status:'pending',notes:'',media:[]}
  ],
  settings:{shade:60,background:null}
};

let data, page='home', selected=null, mediaDraft=[], db, saveTimer;
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const attended=()=>data.events.filter(event=>event.status==='attended');
const cityCount=events=>new Set(events.map(event=>event.city.trim().replace(/市$/,''))).size;
const colors=['#72609688','#567c7966','#99596e77','#715b4988'];

function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open('fuyue-db',1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function dbGet(key){return new Promise((resolve,reject)=>{const request=db.transaction('kv').objectStore('kv').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function dbPut(key,value){return new Promise((resolve,reject)=>{const request=db.transaction('kv','readwrite').objectStore('kv').put(value,key);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});}
function normalizeData(value){
  if(!value||!Array.isArray(value.artists)||!Array.isArray(value.events))return structuredClone(initialData);
  value.version=1;value.settings={shade:60,background:null,...value.settings};
  value.artists=[...new Set(value.artists.map(String).filter(Boolean))];
  value.events=value.events.map(event=>({type:'演唱会',notes:'',media:[],...event,id:Number(event.id)||Date.now(),artists:Array.isArray(event.artists)?event.artists:[]}));
  return value;
}
async function loadData(){
  try{db=await openDatabase();const stored=await dbGet('appData');if(stored)return normalizeData(stored);}catch(error){console.warn('IndexedDB unavailable',error);}
  try{const legacy=JSON.parse(localStorage.getItem('fu-yue-v1'));if(legacy)return normalizeData(legacy);}catch{}
  return structuredClone(initialData);
}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{try{if(db)await dbPut('appData',data);const light={...data,events:data.events.map(e=>({...e,media:[]})),settings:{...data.settings,background:null}};localStorage.setItem('fu-yue-v1',JSON.stringify(light));}catch(error){console.error(error);alert('保存失败，可能是设备存储空间不足。请先导出备份。');}},120);}
function applySettings(){const settings=data.settings||{};document.documentElement.style.setProperty('--shade',(settings.shade??60)/100);document.documentElement.style.setProperty('--bg',settings.background?`url("${settings.background}")`:'none');$('#shade').value=settings.shade??60;}

function statusLabel(status){return {attended:'已到场',pending:'待赴约',cancelled:'未计入次数'}[status]||status;}
function rows(events){
  if(!events.length)return '<div class="empty">下一次见面，从这里开始记录。</div>';
  return '<div class="rows">'+[...events].sort((a,b)=>b.date.localeCompare(a.date)).map(event=>{
    const media=(event.media||[]).slice(0,4).map((item,index)=>`<button class="media-thumb" data-media-src="${esc(item.dataUrl)}" aria-label="查看${item.kind==='ticket'?'票根':'现场照片'}"><img src="${esc(item.dataUrl)}" alt=""></button>`).join('');
    return `<article class="event"><div class="date">${esc(event.date.slice(0,7))}<strong>${esc(event.date.slice(8))}</strong></div><div class="event-main"><div class="event-title-line"><h3>${esc(event.title)}</h3><span class="event-type">${esc(event.type||'演唱会')}</span></div><p>${esc(event.artists.join(' / '))} · ${esc(event.city)} · ${esc(event.venue)}</p>${event.notes?`<p class="memory">${esc(event.notes)}</p>`:''}${media?`<div class="media-grid compact">${media}${event.media.length>4?`<span class="more-media">+${event.media.length-4}</span>`:''}</div>`:''}</div><div class="event-actions"><span class="tag ${event.status==='pending'?'pending':''}">${statusLabel(event.status)}</span>${event.status==='pending'?`<button class="text-action" data-attend="${event.id}">确认到场</button>`:''}<button class="text-action" data-edit-event="${event.id}">编辑</button></div></article>`;
  }).join('')+'</div>';
}

function render(){
  const all=attended();document.querySelectorAll('.nav button').forEach(button=>button.classList.toggle('active',button.dataset.page===page));let output='';
  if(selected!==null){const artist=data.artists[selected];const events=all.filter(event=>event.artists.includes(artist));output=`<div class="intro"><div><button class="back" id="back">← 返回我的奔赴</button><div class="eyebrow">OUR LIVE MOMENTS</div><h1>${esc(artist)}</h1><p class="muted">我们已在现场见过 ${events.length} 次，走过 ${cityCount(events)} 座城市。</p></div><button class="primary" data-add>＋ 记录奔赴</button></div>${rows(data.events.filter(event=>event.artists.includes(artist)))}`;}
  else if(page==='home'){output=`<section class="intro"><div><div class="eyebrow">EVERY TIME, FOR YOU.</div><h1>喜欢，就去现场见。</h1><p class="muted">把每一次奔赴，留在这里。</p></div><button class="primary" data-add>＋ 记录一次奔赴</button></section><div class="stats"><div class="stat"><strong>${all.length}<span>场已赴现场</span></strong></div><div class="stat"><strong>${data.artists.length}<span>位喜欢的艺人</span></strong></div><div class="stat"><strong>${cityCount(all)}<span>座奔赴的城市</span></strong></div></div><div class="section-head"><h2>为你而来</h2><button class="muted" id="addArtist">管理艺人 ↗</button></div><div class="artists">${data.artists.map((artist,index)=>{const events=all.filter(event=>event.artists.includes(artist));return `<button class="artist" data-artist="${index}" style="--glow:${colors[index%colors.length]}"><span class="number">${events.length}<small>次见面</small></span><h3>${esc(artist)}</h3><p>${cityCount(events)} 座城市 · 每一次都值得</p><footer><span>查看我们的现场记录</span><span>↗</span></footer></button>`}).join('')}</div><div class="section-head"><h2>最近的现场</h2><button class="muted" data-all>全部记录 ↗</button></div>${rows(all.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3))}`;}
  else if(page==='records'){output=`<section class="intro"><div><div class="eyebrow">THE MOMENTS WE KEEP</div><h1>每一次，都记得。</h1><p class="muted">已经见过的，和正在期待的。</p></div><button class="primary" data-add>＋ 记录奔赴</button></section>${rows(data.events)}`;}
  else{const cities=[...new Set(all.map(event=>event.city))];output=`<section class="intro"><div><div class="eyebrow">MILES FOR A MEETING</div><h1>走过的路，都有回响。</h1><p class="muted">${all.length} 场现场 · ${all.reduce((sum,event)=>sum+event.artists.length,0)} 次艺人见面 · ${cities.length} 座城市</p></div></section><div class="section-head"><h2>城市足迹</h2></div>${footprintMap(all)}<div class="section-head"><h2>与他们的见面</h2></div>${data.artists.map(artist=>`<div class="city"><span>${esc(artist)}</span><span class="tag">${all.filter(event=>event.artists.includes(artist)).length} 次</span></div>`).join('')}`;}
  $('#main').innerHTML=output;
}

function renderDraftMedia(){const holder=$('#mediaDraft');holder.innerHTML=mediaDraft.map(item=>`<figure class="media-item"><img src="${esc(item.dataUrl)}" alt="${item.kind==='ticket'?'票根':'现场照片'}"><button type="button" data-remove-media="${item.id}" aria-label="移除图片">×</button><select data-media-kind="${item.id}" aria-label="图片类型"><option value="photo" ${item.kind==='photo'?'selected':''}>照片</option><option value="ticket" ${item.kind==='ticket'?'selected':''}>票根</option></select></figure>`).join('');}
function fillArtistChecks(chosen=[]){$('#checks').innerHTML=data.artists.map((artist,index)=>`<label class="check"><input type="checkbox" name="artist" value="${index}" ${chosen.includes(artist)?'checked':''}>${esc(artist)}</label>`).join('');}
function openRecord(id=null){
  const event=id===null?null:data.events.find(item=>item.id===Number(id));$('#recordForm').reset();$('#recordId').value=event?.id||'';$('#recordHeading').textContent=event?'编辑现场记录':'记下一次奔赴';$('#formError').textContent='';$('#ocrStatus').textContent='';$('#deleteFromForm').classList.toggle('hidden',!event);mediaDraft=structuredClone(event?.media||[]);fillArtistChecks(event?.artists||(selected!==null?[data.artists[selected]]:[]));
  if(event){$('#title').value=event.title;$('#eventType').value=event.type||'演唱会';$('#date').value=event.date;$('#city').value=event.city;$('#venue').value=event.venue;$('#status').value=event.status;$('#notes').value=event.notes||'';}
  renderDraftMedia();$('#record').showModal();
}
async function fileToCompressedDataURL(file,max=1600,quality=.82){
  if(!file.type.startsWith('image/'))throw new Error('请选择图片文件');
  const source=URL.createObjectURL(file);try{const image=new Image();image.src=source;await image.decode();const ratio=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',quality);}finally{URL.revokeObjectURL(source);}
}
async function addMediaFiles(files,kind='photo'){for(const file of files){if(mediaDraft.length>=9)break;try{mediaDraft.push({id:crypto.randomUUID?.()||String(Date.now()+Math.random()),name:file.name,kind,dataUrl:await fileToCompressedDataURL(file)});}catch(error){alert(error.message);}}renderDraftMedia();}

function renderArtistManager(){const holder=$('#artistManageList');holder.innerHTML=data.artists.map((artist,index)=>`<div class="manage-row"><span>${esc(artist)}</span><div><button class="text-action" data-rename-artist="${index}">重命名</button><button class="text-action danger" data-delete-artist="${index}">删除</button></div></div>`).join('');}
function deleteEvent(id){const event=data.events.find(item=>item.id===Number(id));if(!event||!confirm(`确定删除“${event.title}”吗？此操作无法撤销。`))return;data.events=data.events.filter(item=>item.id!==event.id);save();$('#record').close();render();}

function parseOCR(text){
  const clean=text.replace(/\s+/g,' ').trim();const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const dateMatch=clean.match(/(20\d{2})[年.\-/]\s*(\d{1,2})[月.\-/]\s*(\d{1,2})日?/);const date=dateMatch?`${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`:'';
  const city=Object.keys(cityCoordinates).find(name=>clean.includes(name)||clean.includes(name+'市'))||'';
  const venue=lines.find(line=>/(体育馆|体育场|体育中心|演艺中心|文化中心|剧院|音乐厅|奥体|场馆)/.test(line))||'';
  const title=lines.find(line=>/(演唱会|音乐节|见面会|签售会|巡回)/.test(line))||'';
  const type=(title.match(/音乐节|见面会|签售会|演唱会/)||[])[0]||'演唱会';
  return {date,city,venue,title,type,artists:data.artists.filter(artist=>clean.includes(artist))};
}
async function loadTesseract(){if(window.Tesseract)return;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('识别组件加载失败，请检查网络'));document.head.append(script);});}
async function runOCR(){
  const file=$('#ocrFile').files[0];if(!file)return $('#ocrStatus').textContent='请先选择订单截图。';const button=$('#runOcr');button.disabled=true;
  try{$('#ocrStatus').textContent='正在加载识别组件…';await loadTesseract();const worker=await Tesseract.createWorker(['chi_sim','eng'],1,{logger:message=>{if(message.status==='recognizing text')$('#ocrStatus').textContent=`正在识别… ${Math.round(message.progress*100)}%`;}});const result=await worker.recognize(file);await worker.terminate();const found=parseOCR(result.data.text);if(found.title)$('#title').value=found.title;if(found.date)$('#date').value=found.date;if(found.city)$('#city').value=found.city;if(found.venue)$('#venue').value=found.venue;if(found.type)$('#eventType').value=found.type;found.artists.forEach(artist=>{const index=data.artists.indexOf(artist);const checkbox=document.querySelector(`#checks input[value="${index}"]`);if(checkbox)checkbox.checked=true;});await addMediaFiles([file],'ticket');$('#ocrStatus').textContent='识别完成。请核对活动、日期、城市和场馆后再保存。';}catch(error){console.error(error);$('#ocrStatus').textContent=`识别失败：${error.message}。你仍可手动填写。`;}finally{button.disabled=false;}
}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.page){page=button.dataset.page;selected=null;render();}
  if(button.hasAttribute('data-add'))openRecord();if(button.dataset.close)$('#'+button.dataset.close).close();
  if(button.dataset.artist!==undefined){selected=Number(button.dataset.artist);render();}
  if(button.id==='back'){selected=null;render();}if(button.hasAttribute('data-all')){page='records';selected=null;render();}
  if(button.id==='addArtist'){renderArtistManager();$('#artistDialog').showModal();}
  if(button.dataset.editEvent)openRecord(button.dataset.editEvent);if(button.dataset.deleteEvent)deleteEvent(button.dataset.deleteEvent);
  if(button.dataset.attend){const item=data.events.find(entry=>entry.id===Number(button.dataset.attend));if(item){if(item.date>new Date().toLocaleDateString('sv-SE'))return alert('活动日期尚未到达。');item.status='attended';save();render();}}
  if(button.dataset.removeMedia){mediaDraft=mediaDraft.filter(item=>item.id!==button.dataset.removeMedia);renderDraftMedia();}
  if(button.dataset.mediaSrc){$('#mediaPreview').src=button.dataset.mediaSrc;$('#mediaDialog').showModal();}
  if(button.dataset.renameArtist!==undefined){const index=Number(button.dataset.renameArtist),old=data.artists[index],name=prompt('新的艺人名称',old)?.trim();if(!name||name===old)return;if(data.artists.includes(name))return alert('这个名称已存在。');data.artists[index]=name;data.events.forEach(item=>item.artists=item.artists.map(artist=>artist===old?name:artist));save();renderArtistManager();render();}
  if(button.dataset.deleteArtist!==undefined){const index=Number(button.dataset.deleteArtist),name=data.artists[index];if(data.events.some(item=>item.artists.includes(name)))return alert('这位艺人仍有关联的现场记录，请先编辑或删除相关记录。');if(confirm(`确定移除“${name}”吗？`)){data.artists.splice(index,1);save();renderArtistManager();render();}}
});
document.addEventListener('change',event=>{if(event.target.dataset.mediaKind){const item=mediaDraft.find(entry=>entry.id===event.target.dataset.mediaKind);if(item)item.kind=event.target.value;}});

$('#background').onclick=()=>{$('#settings').showModal();};
$('#bgFile').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{data.settings.background=await fileToCompressedDataURL(file,2000,.82);applySettings();save();}catch(error){alert(error.message);}};
$('#shade').oninput=event=>{data.settings.shade=Number(event.target.value);applySettings();save();};
$('#resetBg').onclick=()=>{data.settings.background=null;data.settings.shade=60;$('#bgFile').value='';applySettings();save();};
$('#mediaFiles').onchange=event=>addMediaFiles([...event.target.files]);$('#runOcr').onclick=runOCR;
$('#deleteFromForm').onclick=()=>deleteEvent($('#recordId').value);

$('#recordForm').onsubmit=event=>{event.preventDefault();const id=Number($('#recordId').value)||Date.now();const artists=[...document.querySelectorAll('#checks input:checked')].map(input=>data.artists[Number(input.value)]);if(!artists.length)return $('#formError').textContent='请至少选择一位艺人。';const item={id,artists,title:$('#title').value.trim(),type:$('#eventType').value,date:$('#date').value,city:$('#city').value.trim(),venue:$('#venue').value.trim(),status:$('#status').value,notes:$('#notes').value.trim(),media:mediaDraft};if(!item.title||!item.date||!item.city||!item.venue)return $('#formError').textContent='请完整填写活动、日期、城市和场馆。';if(item.status==='attended'&&item.date>new Date().toLocaleDateString('sv-SE'))return $('#formError').textContent='未来的活动请保存为待赴约。';if(data.events.some(existing=>existing.id!==id&&existing.date===item.date&&existing.title===item.title&&existing.venue===item.venue))return $('#formError').textContent='已有相同活动、日期和场馆的记录。';const index=data.events.findIndex(existing=>existing.id===id);if(index>=0)data.events[index]=item;else data.events.push(item);save();$('#record').close();render();};
$('#artistForm').onsubmit=event=>{event.preventDefault();const name=$('#artistName').value.trim();if(!name)return;if(data.artists.includes(name))return alert('这位艺人已经在列表中。');data.artists.push(name);save();event.target.reset();renderArtistManager();render();};

$('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(data)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`赴约备份-${new Date().toLocaleDateString('sv-SE')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
$('#importData').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const incoming=normalizeData(JSON.parse(await file.text()));if(!confirm(`将用备份中的 ${incoming.events.length} 条记录替换当前数据，确定继续吗？`))return;data=incoming;await dbPut('appData',data);applySettings();render();$('#settings').close();}catch(error){alert('无法导入：备份文件格式不正确。');}finally{event.target.value='';}};

(async()=>{data=await loadData();applySettings();render();})();
