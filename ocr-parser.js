/* Local extraction only. Ambiguous information is left for review. */
(function(root){
  const tidy=text=>String(text||'').normalize('NFKC').replace(/\s+/g,' ').replace(/([\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g,'$1').trim();
  const labelText=text=>tidy(text).replace(/[臺]/g,'台').replace(/場/g,'场').replace(/館/g,'馆').replace(/體/g,'体').replace(/樂/g,'乐').replace(/會/g,'会').replace(/點/g,'点').replace(/時/g,'时').replace(/間/g,'间');
  const eventWords=/演唱会|音乐节|见面会|签售会|巡回|演奏会|音乐会|CONCERT|TOUR/i;
  const venueWords=/体育馆|体育场|体育中心|演艺中心|文化中心|剧院|音乐厅|奥体|会展中心|会议中心|大剧场|Live\s*House|Arena|Stadium|Hall|公园/i;
  const junk=/订单号|订单编号|付款|支付|下单|创建时间|开票|开售|退款|退票|须知|指南|客服|配送|收货|票价|票档|座位|数量|合计|查看场馆/;
  function datesFrom(text){
    const lines=String(text).normalize('NFKC').split(/\r?\n/).map(labelText).map(l=>l.replace(/(\d)\s+(?=[年月日号./-])/g,'$1').replace(/([年月./-])\s+(?=\d)/g,'$1'));
    const years=[...new Set([...String(text).matchAll(/\b(20\d{2})\b/g)].map(m=>+m[1]))];
    let year=years.length===1?years[0]:null;
    const found=[];
    lines.forEach((line,i)=>{
      if(junk.test(line))return;
      const localYear=line.match(/(20\d{2})[年./-]/);const y=localYear?+localYear[1]:year;
      const re=/(?:(20\d{2})[年./-]\s*)?(\d{1,2})[月./-]\s*(\d{1,2})(?:日|号)?/g;
      for(const m of line.matchAll(re)){
        const yy=m[1]?+m[1]:y,mm=+m[2],dd=+m[3];
        const add=d=>{if(mm<1||mm>12||d<1||d>31)return;const test=new Date(Date.UTC(yy||2000,mm-1,d));if(test.getUTCMonth()!==mm-1)return;const date=yy?`${yy}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';found.push({date,month:mm,day:d,label:date||`${mm}月${d}日（年份待确认）`,line:i});};
        add(dd);
        const tail=line.slice(m.index+m[0].length);
        const list=tail.match(/^((?:\s*[、,，&和及]\s*\d{1,2}(?:日|号)?(?![\d月./]))+)/);
        if(list)for(const n of list[1].matchAll(/\d{1,2}/g))add(+n[0]);
        const range=tail.match(/^\s*[-—~至]\s*(\d{1,2})(?:日|号)?(?!\d)/);
        if(range&&+range[1]>dd&&+range[1]-dd<=7)for(let d=dd+1;d<=+range[1];d++)add(d);
      }
    });
    return [...new Map(found.map(d=>[d.label,d])).values()];
  }
  function extract(text,{hint='',kind='auto',artists=[],cities=[]}={}){
    const rawLines=String(text).split(/\r?\n/).map(tidy).filter(Boolean);
    const lines=rawLines.map(labelText);const warnings=[];
    const cityHits=value=>cities.filter(c=>{const names=[c.name,c.name.replace(/特别行政区$|市$/,'')];return names.some(n=>n.length>=2&&labelText(value).includes(n));});
    const mentioned=cityHits(lines.join(' '));const requested=cityHits(hint);
    let city=requested.length===1?requested[0].name:mentioned.length===1?mentioned[0].name:'';
    if(requested.length===1&&!mentioned.some(c=>c.name===city))warnings.push('说明中的城市未在图片文字中找到，请核对。');
    if(mentioned.length>1&&!city)warnings.push('图片包含多个城市，请选择站点并重新整理，或手动核对日期与场馆。');
    let scoped=lines;
    if(mentioned.length>1&&city){
      const target=cities.find(c=>c.name===city);const indices=lines.map((line,i)=>cityHits(line).some(c=>c.name===target.name)&&!venueWords.test(line)?i:-1).filter(i=>i>=0);
      if(indices.length===1){let start=indices[0],end=start+1;while(end<lines.length&&!cityHits(lines[end]).some(c=>c.name!==city))end++;scoped=lines.slice(start,end);}
      warnings.push('多站海报已尝试按站点分段；请对照原图核对，尤其是多列排版。');
    }
    const mode=kind==='auto'?(/订单|票档|支付|下单/.test(text)?'order':'poster'):kind;
    let dateText=scoped.join('\n');
    if(mode==='order'){
      const specific=scoped.flatMap((l,i)=>/演出时间|演出日期|活动时间|场次/.test(l)?[l,scoped[i+1]||'']:[]);
      if(datesFrom(specific.join('\n')).length)dateText=specific.join('\n');
    }
    // A missing year is never replaced with the current year.
    const commonYears=[...new Set([...lines.filter(l=>!junk.test(l)).join(' ').matchAll(/\b20\d{2}\b/g)].map(m=>m[0]))];
    if(!/20\d{2}/.test(dateText)&&commonYears.length===1)dateText=commonYears[0]+'\n'+dateText;
    let dates=datesFrom(dateText);let selected=dates.length===1&&dates[0].date?[dates[0].date]:[];
    const h=labelText(hint),dayHint=[...h.matchAll(/(?:参加|选|看)?\s*(\d{1,2})(?:日|号)/g)].map(m=>+m[1]);
    const fullHints=datesFrom(h);const monthHint=h.match(/(\d{1,2})月/);
    if(dayHint.length||fullHints.length){
      const candidates=dates.filter(d=>fullHints.length?fullHints.some(v=>v.month===d.month&&v.day===d.day&&(!v.date||v.date===d.date)):dayHint.includes(d.day)&&(!monthHint||+monthHint[1]===d.month));
      selected=candidates.filter(d=>d.date).map(d=>d.date);
      if(!candidates.length)warnings.push('补充说明的日期与图片不匹配，请手动确认，未自动选择日期。');
      if(candidates.length>1&&!/都|全部|两天|均|、|和/.test(h)){selected=[];warnings.push('补充说明仍对应多个场次，请选择具体日期。');}
    }else if(/两天都|全部场次|每天都/.test(h))selected=dates.filter(d=>d.date).map(d=>d.date);
    if(dates.some(d=>!d.date))warnings.push('图片日期缺少年份，请填写完整日期。');
    if(!dates.length)warnings.push('未找到可靠的演出日期，请手动填写。');
    const titleIndex=lines.findIndex(l=>eventWords.test(l)&&!junk.test(l));let title='';
    if(titleIndex>=0){
      const parts=[rawLines[titleIndex].replace(/^(活动名称|演出名称|项目名称)\s*[:：]?\s*/,'')];
      const prev=lines[titleIndex-1]||'',next=lines[titleIndex+1]||'';
      if(prev&&prev.length<=60&&!junk.test(prev)&&!venueWords.test(prev)&&!/[月日年]|\d{1,2}[:：]/.test(prev)&&artists.some(a=>prev.includes(a)))parts.unshift(rawLines[titleIndex-1]);
      if(next&&next.length<=60&&!junk.test(next)&&!venueWords.test(next)&&!datesFrom(next).length&&!/场次|时间|地点|地址|票|¥|￥/.test(next)&&(/站$|巡回|演唱会|「|」|《|》/.test(next)))parts.push(rawLines[titleIndex+1]);
      title=tidy(parts.join(' '));
    }
    const venueCandidates=[];
    scoped.forEach((l,i)=>{
      if(junk.test(l))return;
      const label=/^(?:演出场馆|演出地点|活动地点|举办地点|场馆|地点)\s*[:：]?\s*/;
      if(label.test(l)){const v=l.replace(label,'')||scoped[i+1]||'';if(v&&!junk.test(v)&&!datesFrom(v).length)venueCandidates.push(v);}
      else if(venueWords.test(l)&&!eventWords.test(l)&&!/^地址/.test(l))venueCandidates.push(l);
    });
    const correctedVenues=venueCandidates.map(v=>tidy(v.replace(/\s*(查看地图|导航|详情).*$/,'')).replace(/体育[包棺]$/,'体育馆'));
    if(correctedVenues.some((v,i)=>v!==tidy(venueCandidates[i].replace(/\s*(查看地图|导航|详情).*$/,''))))warnings.push('场馆末尾疑似错字已按“体育馆”整理，请对照原图核对。');
    const venues=[...new Set(correctedVenues)].filter(v=>v.length>=2&&v.length<=80);
    if(venues.length!==1)warnings.push(venues.length?'发现多个场馆候选，请核对选择。':'未找到可靠场馆，请对照原图填写。');
    if(!title)warnings.push('未找到完整活动名称，请手动填写。');
    return {title,city,dates,selected,venues,venue:venues.length===1?venues[0]:'',type:(labelText(title).match(/音乐节|见面会|签售会|演唱会/)||[])[0]||'演唱会',artists:artists.filter(a=>lines.join('').includes(a)||hint.includes(a)),warnings,kind:mode};
  }
  root.FuyueOCR={extract,tidy,datesFrom};
  if(typeof module!=='undefined')module.exports=root.FuyueOCR;
})(typeof globalThis==='undefined'?window:globalThis);
