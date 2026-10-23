/* Local extraction only. Ambiguous information is left for review. */
(function(root){
  const tidy=text=>String(text||'').normalize('NFKC').replace(/\s+/g,' ').replace(/([\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g,'$1').trim();
  const labelText=text=>tidy(text).replace(/[臺]/g,'台').replace(/場/g,'场').replace(/館/g,'馆').replace(/體/g,'体').replace(/樂/g,'乐').replace(/會/g,'会').replace(/點/g,'点').replace(/時/g,'时').replace(/間/g,'间');
  const eventWords=/演唱会|音乐节|见面会|签售会|巡回|演奏会|音乐会|CONCERT|TOUR/i;
  const venueWords=/体育馆|体育场|主场馆|体育中心|演艺中心|文化中心|剧院|音乐厅|奥体|会展中心|会议中心|大剧场|Live\s*House|Arena|Stadium|Hall|公园/i;
  const artistAliases={'容祖儿':['JOEY YUNG','容祖兒'],'陈奕迅':['EASON CHAN','陳奕迅'],'周笔畅':['BIBI ZHOU','周筆暢']};
  // Venue aliases describe a venue, never a particular show or its dates.
  // Source: https://www.kaitaksportspark.com.hk/venues-spaces/4
  const knownVenues=[{name:'启德主场馆',city:'香港特别行政区',aliases:[/\bKAI[\s"'“”‘’]*TAK[\s"'“”‘’]*STADIUM\b/i,/[启啟]德主[场場][馆館]/]}];
  const junk=/订单号|订单编号|付款|支付|下单|创建时间|开票|开售|退款|退票|须知|指南|客服|配送|收货|票价|票档|座位|数量|合计|查看场馆/;
  const price=/HK\s*\$|RMB|CNY|USD|[¥￥$]|票价|票档/i;
  function dateLine(line){
    if(junk.test(line))return '';
    // Retain an earlier date on a mixed date/price line, but never parse prices.
    const at=line.search(price);return at<0?line:line.slice(0,at);
  }
  function suspiciousTitle(title){
    if(/[\uFFFD\u0000-\u001f|\\]|[\^_=]{2,}/.test(title)||title.length>80)return true;
    const pairs={'(':')','[':']','{':'}','《':'》','「':'」','『':'』','【':'】'},stack=[];
    for(const c of title){if(pairs[c])stack.push(pairs[c]);else if(Object.values(pairs).includes(c)&&stack.pop()!==c)return true;}
    return stack.length>0;
  }
  const dateLines=text=>String(text).normalize('NFKC').split(/\r?\n/).map(labelText).map(dateLine).map(l=>l.replace(/(\d)\s+(?=[年月日号./-])/g,'$1').replace(/([年月./-])\s+(?=\d)/g,'$1'));
  const rangePattern=()=>/(?<![\d./-])(?:(20\d{2})[年./-])?(\d{1,2})[月./-](\d{1,2})(?:日|号)?\s*[-—~～至到]\s*(?:(20\d{2})[年./-])?(?:(\d{1,2})[月./-])?(\d{1,2})(?:日|号)?(?![\d./])/g;
  function rangesFrom(text){
    const lines=dateLines(text),years=[...new Set([...lines.join('\n').matchAll(/\b(20\d{2})\b/g)].map(m=>+m[1]))],ranges=[];
    const iso=(y,m,d)=>{const t=new Date(Date.UTC(y||2000,m-1,d));return m>=1&&m<=12&&d>=1&&t.getUTCMonth()===m-1?(y?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:`${m}月${d}日（年份待确认）`):'';};
    for(const line of lines)for(const m of line.matchAll(rangePattern())){
      const y=m[1]?+m[1]:years.length===1?years[0]:null,ey=m[4]?+m[4]:y;
      const start=iso(y,+m[2],+m[3]),end=iso(ey,m[5]?+m[5]:+m[2],+m[6]);
      if(start&&end&&(!y||!ey||start<=end))ranges.push({start,end,label:`${start} 至 ${end}`});
    }
    return [...new Map(ranges.map(r=>[r.label,r])).values()];
  }
  function datesFrom(text){
    let lines=dateLines(text);
    const years=[...new Set([...lines.join('\n').matchAll(/\b(20\d{2})\b/g)].map(m=>+m[1]))];
    let year=years.length===1?years[0]:null;
    // A date interval is not evidence that a show runs every day, or at either
    // endpoint. Keep it separate from individually listed performance dates.
    lines=lines.map(l=>l.replace(rangePattern(),' '));
    const found=[];
    const months='JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ');
    const monthPattern='JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?';
    const english=lines.filter(l=>!junk.test(l)).join('\n');
    const addEnglish=(month,days,yy)=>{for(const part of days.split(/\s*[,、&.]\s*|\s+AND\s+|\s+/i)){const d=+part.replace(/(?:ST|ND|RD|TH)$/i,'');const m=months.indexOf(month.slice(0,3).toUpperCase())+1;const check=new Date(Date.UTC(yy||2000,m-1,d));if(d<1||d>31||check.getUTCMonth()!==m-1)continue;const date=yy?`${yy}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';found.push({date,month:m,day:d,label:date||`${m}月${d}日（年份待确认）`,line:0});}};
    const dayList='\\d{1,2}(?:ST|ND|RD|TH)?(?!\\d)(?:(?:\\s*(?:[,、&.]|AND)\\s*|\\s+)\\d{1,2}(?:ST|ND|RD|TH)?(?!\\d))*';
    const brokenYear=m=>!m[3]&&/^\s*[,，]?\s*20[\d/\\?]/.test(english.slice(m.index+m[0].length));
    for(const m of english.matchAll(new RegExp(`(?<![\\d.])(${dayList})\\s*(${monthPattern})(?=\\s|20\\d{2}|$)(?:\\s*[,，]?\\s*(20\\d{2}))?`,'gi')))if(!brokenYear(m))addEnglish(m[2],m[1],m[3]?+m[3]:year);
    for(const m of english.matchAll(new RegExp(`\\b(${monthPattern})\\s+(${dayList})(?:\\s*[,，]?\\s*(20\\d{2}))?`,'gi')))if(!brokenYear(m))addEnglish(m[1],m[2],m[3]?+m[3]:year);
    lines.forEach((line,i)=>{
      if(junk.test(line))return;
      const localYear=line.match(/(20\d{2})[年./-]/);const y=localYear?+localYear[1]:year;
      const re=/(?<![\d./-])(?:(20\d{2})[年./-]\s*)?(\d{1,2})[月./-]\s*(\d{1,2})(?!\d)(?:日|号)?(?![./]\d)/g;
      for(const m of line.matchAll(re)){
        // Dots inside an English day list are separators, not a second month/day.
        if(new RegExp(`\\b(?:${monthPattern})\\b`,'i').test(line))continue;
        const yy=m[1]?+m[1]:y,mm=+m[2],dd=+m[3];
        const add=d=>{if(mm<1||mm>12||d<1||d>31)return;const test=new Date(Date.UTC(yy||2000,mm-1,d));if(test.getUTCMonth()!==mm-1)return;const date=yy?`${yy}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';found.push({date,month:mm,day:d,label:date||`${mm}月${d}日（年份待确认）`,line:i});};
        add(dd);
        const tail=line.slice(m.index+m[0].length);
        const list=tail.match(/^((?:\s*[、,，&和及]\s*\d{1,2}(?:日|号)?(?![\d月./]))+)/);
        if(list)for(const n of list[1].matchAll(/\d{1,2}/g))add(+n[0]);
      }
    });
    return [...new Map(found.map(d=>[d.label,d])).values()];
  }
  function extract(text,{hint='',kind='auto',artists=[],cities=[]}={}){
    const rawLines=String(text).split(/\r?\n/).map(tidy).filter(Boolean);
    const lines=rawLines.map(labelText);const warnings=[];
    const matchedVenues=knownVenues.filter(v=>v.aliases.some(re=>re.test(lines.join('\n'))));
    const artistFound=artists.filter(a=>lines.join('').includes(a)||hint.includes(a)||(artistAliases[a]||[]).some(alias=>rawLines.join(' ').toUpperCase().includes(alias)));
    const cityHits=value=>cities.filter(c=>{const names=[c.name,c.name.replace(/特别行政区$|市$/,'')];return names.some(n=>n.length>=2&&labelText(value).includes(n));});
    const mentioned=cityHits(lines.join(' '));const requested=cityHits(hint);
    let city=requested.length===1?requested[0].name:mentioned.length===1?mentioned[0].name:'';
    if(!city&&mentioned.length===0&&matchedVenues.length===1&&cities.some(c=>c.name===matchedVenues[0].city)){city=matchedVenues[0].city;warnings.push('城市由已知场馆所在地补全，请核对。');}
    if(requested.length===1&&!mentioned.some(c=>c.name===city))warnings.push('说明中的城市未在图片文字中找到，请核对。');
    if(mentioned.length>1&&!city)warnings.push('图片包含多个城市，请选择站点并重新整理，或手动核对日期与场馆。');
    let scoped=lines;
    if(mentioned.length>1&&city){
      const target=cities.find(c=>c.name===city);const indices=lines.map((line,i)=>cityHits(line).some(c=>c.name===target.name)&&!venueWords.test(line)?i:-1).filter(i=>i>=0);
      if(indices.length===1){let start=indices[0],end=start+1;while(end<lines.length&&!cityHits(lines[end]).some(c=>c.name!==city))end++;scoped=lines.slice(start,end);}
      warnings.push('多站海报已尝试按站点分段；请对照原图核对，尤其是多列排版。');
    }
    const mode=kind==='auto'?(/订单|票档|支付|下单|退票规则|立即购买|入场保障|选座购买/.test(text)?'order':'poster'):kind;
    let dateText=scoped.join('\n');
    if(mode==='order'){
      const specific=scoped.flatMap((l,i)=>/演出时间|演出日期|活动时间|场次/.test(l)?[l,scoped[i+1]||'']:[]);
      if(datesFrom(specific.join('\n')).length)dateText=specific.join('\n');
    }
    // A missing year is never replaced with the current year.
    const commonYears=[...new Set([...lines.map(dateLine).join(' ').matchAll(/\b20\d{2}\b/g)].map(m=>m[0]))];
    if(!/20\d{2}/.test(dateText)&&commonYears.length===1)dateText=commonYears[0]+'\n'+dateText;
    const ranges=rangesFrom(dateText);
    if(ranges.length)warnings.push(`页面日期范围：${ranges.map(r=>r.label).join('；')}。范围不代表每天都有演出，请按独立场次或票面确认。`);
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
    let titleIndex=lines.findIndex(l=>/演唱会|音乐节|见面会|签售会|音乐会/.test(l)&&!junk.test(l));if(titleIndex<0)titleIndex=lines.findIndex(l=>eventWords.test(l)&&!junk.test(l));let title='';
    if(titleIndex>=0){
      const parts=[rawLines[titleIndex].replace(/^(活动名称|演出名称|项目名称)\s*[:：]?\s*/,'')];
      const prev=lines[titleIndex-1]||'',next=lines[titleIndex+1]||'';
      if(prev&&prev.length<=60&&!junk.test(prev)&&!venueWords.test(prev)&&!/[月日年]|\d{1,2}[:：]/.test(prev)&&artists.some(a=>prev.includes(a)))parts.unshift(rawLines[titleIndex-1]);
      if(next&&next.length<=60&&!junk.test(next)&&!venueWords.test(next)&&!datesFrom(next).length&&!/场次|时间|地点|地址|票|¥|￥/.test(next)&&(/站$|巡回|演唱会|「|」|《|》/.test(next)))parts.push(rawLines[titleIndex+1]);
      title=tidy(parts.join(' '));
    }
    const tourIndex=lines.findIndex(l=>/^(?:TOUR|CONCERT)$/i.test(l));
    let theme='';if(tourIndex>0&&/^[A-Z][A-Z0-9 '\-]{1,35}$/.test(rawLines[tourIndex-1])&&!venueWords.test(lines[tourIndex-1])&&!artistFound.some(a=>(artistAliases[a]||[]).includes(rawLines[tourIndex-1])))theme=rawLines[tourIndex-1]+' '+rawLines[tourIndex];
    if(!theme){const themeLine=rawLines.find(l=>/^[A-Z][A-Z0-9 '\-]{1,35}\s+(TOUR|CONCERT)$/i.test(l)&&!venueWords.test(l));if(themeLine)theme=themeLine;}
    if(!theme){const index=rawLines.findIndex(l=>/^TOUR\s+/i.test(l));const prev=rawLines[index-1]||'';if(index>0&&/^[A-Z][A-Z0-9 '\-]{1,35}$/.test(prev)&&!venueWords.test(prev))theme=prev+' TOUR';}
    if(theme&&!title.toUpperCase().includes(theme.toUpperCase()))title=tidy(theme+' '+title);
    if(title&&artistFound.length===1&&!labelText(title).includes(labelText(artistFound[0])))title=tidy(artistFound[0]+' '+title);
    if(suspiciousTitle(title)){title='';warnings.push('活动名称含异常字符或不成对的括号，未自动填写；请对照原图填写，可展开查看识别文字。');}
    const venueCandidates=[];
    scoped.forEach((l,i)=>{
      if(junk.test(l))return;
      const label=/^(?:演出场馆|演出地点|活动地点|举办地点|场馆|地点)\s*[:：]?\s*/;
      if(label.test(l)){const v=l.replace(label,'')||scoped[i+1]||'';if(v&&!junk.test(v)&&!datesFrom(v).length)venueCandidates.push(v);}
      else if(venueWords.test(l)&&!eventWords.test(l)&&!/^地址/.test(l))venueCandidates.push(l);
    });
    const correctedVenues=venueCandidates.map(v=>{const clean=tidy(v.replace(/\s*(查看地图|导航|详情).*$/,'')).replace(/体育[包棺]$/,'体育馆');return knownVenues.find(venue=>venue.aliases.some(re=>re.test(clean)))?.name||clean;});
    if(venueCandidates.some(v=>/体育[包棺]$/.test(tidy(v))))warnings.push('场馆末尾疑似错字已按“体育馆”整理，请对照原图核对。');
    const venues=[...new Set(correctedVenues)].filter(v=>v.length>=2&&v.length<=80);
    if(venues.length!==1)warnings.push(venues.length?'发现多个场馆候选，请核对选择。':'未找到可靠场馆，请对照原图填写。');
    if(!title)warnings.push('未找到完整活动名称，请手动填写。');
    return {title,city,dates,ranges,selected,venues,venue:venues.length===1?venues[0]:'',type:(labelText(title).match(/音乐节|见面会|签售会|演唱会/)||[])[0]||'演唱会',artists:artistFound,warnings,kind:mode};
  }
  function extractPasses(passes,options={}){
    const active=passes.filter(p=>tidy(p.text));
    const results=active.map(p=>extract(p.text,options));
    const primary=active.filter(p=>!p.fields);
    const merged=extract(primary.map(p=>p.text).join('\n'),options);
    const cityIn=(text,name)=>[name,name.replace(/特别行政区$|市$/,'')].some(n=>n.length>=2&&labelText(text).includes(labelText(n)));
    const multipleCities=(options.cities||[]).filter(c=>active.some(p=>cityIn(p.text,c.name))).length>1;
    // A crop without a station label cannot assign its dates to the chosen city
    // on a multi-station poster. Keep the raw text available for manual review.
    if(multipleCities&&merged.city)results.forEach((r,i)=>{if(!cityIn(active[i].text,merged.city)){r.dates=[];r.selected=[];}});
    // Parse each crop independently. Adjacent fragments from different OCR passes
    // must not become a new title or date merely because they were concatenated.
    const titles=[...new Set(results.filter((r,i)=>!active[i].fields||active[i].fields.includes('title')).map(r=>r.title).filter(Boolean))];
    const key=s=>{
      let value=labelText(s).toUpperCase();
      // TOUR / CONCERT and a repeated bilingual artist label are compatible
      // with the Chinese event type; they are not different tour names.
      for(const [artist,aliases] of Object.entries(artistAliases))if(value.includes(artist))for(const alias of aliases)value=value.replaceAll(alias,'');
      return value.replace(/\bTOUR\b|\bCONCERT\b/g,'演唱会').replace(/[\s\p{P}]/gu,'');
    };
    const fullest=titles.filter(t=>titles.every(other=>key(t).includes(key(other))));
    merged.title=fullest.sort((a,b)=>Number(/演唱会|音乐节|见面会|签售会|音乐会/.test(b))-Number(/演唱会|音乐节|见面会|签售会|音乐会/.test(a))||b.length-a.length)[0]||'';
    // Reconstruct a large English theme only when the image geometry places
    // its own high-confidence text band directly above a TOUR/CONCERT band.
    // Plain concatenated strings without spatial evidence cannot do this.
    const themeBands=active.filter(p=>p.band&&p.region&&p.confidence>=75&&/^[A-Z][A-Z0-9 '\-]{1,35}$/.test(tidy(p.text))&&!venueWords.test(p.text)&&!eventWords.test(p.text)&&!Object.values(artistAliases).flat().includes(tidy(p.text)));
    const themes=[...new Set(themeBands.flatMap(p=>active.filter(q=>q.band&&q.region&&q.confidence>=75&&/^(TOUR|CONCERT)(?:\s|$)/.test(tidy(q.text))&&q.region.top>=p.region.top+p.region.height-.01&&q.region.top-(p.region.top+p.region.height)<.06).map(q=>tidy(p.text)+' '+tidy(q.text).match(/^(TOUR|CONCERT)/)[0])))];
    if(merged.title&&themes.length===1&&!merged.title.toUpperCase().includes(themes[0].split(' ')[0]))merged.title=tidy(themes[0]+' '+merged.title);
    merged.type=(labelText(merged.title).match(/音乐节|见面会|签售会|演唱会/)||[])[0]||'演唱会';
    merged.titleCandidates=titles;
    merged.warnings=merged.warnings.filter(w=>!w.includes('活动名称')&&!w.includes('补充说明')&&!w.includes('演出日期')&&!w.includes('缺少年份')&&!w.includes('页面日期范围'));
    if(!merged.title)merged.warnings.push(titles.length?'活动名称有不同读法，未自动填写。请对照原图填写或选择候选。':'未找到可靠活动名称，疑似乱码未自动填写，请对照原图补充。');
    const byDate=new Map();
    results.forEach((r,i)=>r.dates.forEach(d=>{const source=`第${i+1}轮·${active[i].pass||'文字识别'}`;const old=byDate.get(d.label);if(old)old.sources.push(source);else byDate.set(d.label,{...d,sources:[source]});}));
    merged.dates=[...byDate.values()].filter(d=>d.date||![...byDate.values()].some(other=>other.date&&other.month===d.month&&other.day===d.day));
    merged.ranges=[...new Map(results.flatMap(r=>r.ranges).map(r=>[r.label,r])).values()];
    if(merged.ranges.length)merged.warnings.push(`页面日期范围：${merged.ranges.map(r=>r.label).join('；')}。范围不代表每天都有演出，请按独立场次或票面确认。`);
    const signatures=new Set(results.map(r=>r.dates.filter(d=>d.date).map(d=>d.date).sort().join(',')).filter(Boolean));
    merged.dateConflict=signatures.size>1;
    merged.selected=merged.dateConflict?[]:[...new Set(results.flatMap(r=>r.selected))];
    if(!options.hint&&merged.dates.length>1)merged.selected=[];
    if(multipleCities&&!merged.city)merged.selected=[];
    if(merged.dateConflict)merged.warnings.push('不同识别轮次的日期不一致：已保留候选并取消自动勾选。补充说明也不会替代核对，请对照原图选择或修改。');
    else if(options.hint&&merged.dates.length&&!merged.selected.length)merged.warnings.push('补充说明未能确定唯一场次，请核对候选日期。');
    if(!merged.dates.length)merged.warnings.push('未找到可靠的演出日期，请手动填写。');
    if(merged.dates.some(d=>!d.date))merged.warnings.push('图片日期缺少年份，请填写完整日期。');
    return merged;
  }
  root.FuyueOCR={extract,extractPasses,tidy,datesFrom,rangesFrom};
  if(typeof module!=='undefined')module.exports=root.FuyueOCR;
})(typeof globalThis==='undefined'?window:globalThis);
