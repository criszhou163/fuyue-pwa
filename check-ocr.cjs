const assert=require('node:assert/strict');const {extract,datesFrom}=require('./ocr-parser.js');
const options={artists:['周笔畅','容祖儿','陈奕迅'],cities:[{name:'杭州市'},{name:'嘉兴市'},{name:'澳门特别行政区'}]};
let count=0;function test(name,fn){fn();count++;console.log('PASS',name);}
test('订单优先演出时间、场馆标签下一行、合并标题',()=>{const f=extract('周笔畅\n2026巡回演唱会\n杭州站\n下单时间：2026-09-01\n演出时间：2026-10-29 19:30\n场馆\n杭州奥体中心体育馆',options);assert.equal(f.title,'周笔畅 2026巡回演唱会杭州站');assert.deepEqual(f.selected,['2026-10-29']);assert.equal(f.venue,'杭州奥体中心体育馆');assert.equal(f.city,'杭州市');});
test('海报双日按说明选29号',()=>{const f=extract('容祖儿演唱会\n杭州\n2026年10月28、29日\n场馆：杭州奥体中心体育馆',{...options,hint:'参加29号场'});assert.deepEqual(f.selected,['2026-10-29']);assert.equal(f.dates.length,2);});
test('无说明时不默认选择多场次',()=>assert.deepEqual(extract('演唱会\n2026年10月28、29日',options).selected,[]));
test('两天都参加选择两个日期',()=>assert.equal(extract('演唱会\n2026年10月28、29日',{...options,hint:'两天都参加'}).selected.length,2));
test('缺少年份不猜当前年',()=>{const f=extract('演唱会\n10月28、29日',{...options,hint:'参加29号场'});assert.deepEqual(f.selected,[]);assert(f.warnings.some(w=>w.includes('年份')));});
test('说明与图片冲突不填日期',()=>{const f=extract('演唱会\n2026年10月28、29日',{...options,hint:'参加30号场'});assert.deepEqual(f.selected,[]);assert(f.warnings.some(w=>w.includes('不匹配')));});
test('多个场馆留空且提供候选',()=>{const f=extract('演唱会\n杭州奥体中心体育馆\n嘉兴体育馆',options);assert.equal(f.venue,'');assert.equal(f.venues.length,2);});
test('多站按城市分段',()=>{const f=extract('陈奕迅演唱会2026\n杭州站\n10月28日\n杭州奥体中心体育馆\n嘉兴站\n11月29日\n嘉兴体育馆',{...options,hint:'嘉兴站'});assert.equal(f.city,'嘉兴市');assert.equal(f.venue,'嘉兴体育馆');assert.deepEqual(f.selected,['2026-11-29']);});
test('繁体场馆标签可识别',()=>assert.equal(extract('演唱會\n場館：澳門體育館',options).venue,'澳門体育馆'));
test('非法日期被排除',()=>assert.equal(datesFrom('2026年2月30日').length,0));
test('跨月并列日期不生成虚假日期',()=>assert.deepEqual(datesFrom('2026年10月28、11月29日').map(d=>d.date),['2026-10-28','2026-11-29']));
test('OCR日期字符间空格',()=>assert.deepEqual(datesFrom('2026 年 10 月 28、29 日').map(d=>d.date),['2026-10-28','2026-10-29']));
test('场馆高确定性后缀纠错附核对提示',()=>{const f=extract('演唱会\n场馆 : 杭州 奥 体 中 心 体 育 包',options);assert.equal(f.venue,'杭州奥体中心体育馆');assert(f.warnings.some(w=>w.includes('错字')));});
test('日期去重及短范围',()=>assert.equal(datesFrom('2026年10月28-30日\n2026年10月29日').length,3));
test('海报英文月份与三个非连续日期',()=>assert.deepEqual(datesFrom('18,22,23 JAN 2027 7:30PM').map(d=>d.date),['2027-01-18','2027-01-22','2027-01-23']));
test('英文全称月份、跨行年份',()=>assert.deepEqual(datesFrom('18, 22 & 23\nJanuary\n2027').map(d=>d.date),['2027-01-18','2027-01-22','2027-01-23']));
test('英文月份在前且缺年时不猜测',()=>{const d=datesFrom('JAN 18 & 22');assert.equal(d.length,2);assert(d.every(v=>!v.date));});
test('实际海报文案完整提取，备注选22号',()=>{const f=extract('AURA\nTOUR\nJOEY YUNG\n容祖儿演唱会\nKAI TAK STADIUM 啟德主場館\n18,22,23 JAN 2027 7:30PM\nHK$1680 /1280 /980 /680',{...options,cities:[...options.cities,{name:'香港特别行政区'}],hint:'参加22号场'});assert(f.title.includes('AURA TOUR'));assert(f.title.includes('容祖儿演唱会'));assert.deepEqual(f.artists,['容祖儿']);assert.deepEqual(f.selected,['2027-01-22']);assert.equal(f.city,'香港特别行政区');assert.equal(f.venue,'启德主场馆');assert.equal(f.dates.length,3);});
test('不能从未知场馆猜城市',()=>assert.equal(extract('SOMEWHERE STADIUM\n18 JAN 2027',options).city,''));
test('啟德體藝館不匹配为主场馆',()=>assert.equal(extract('啟德體藝館\n18 JAN 2027',{...options,cities:[{name:'香港特别行政区'}]}).city,''));
test('原图真实OCR输出的空格和点号日期分隔',()=>assert.deepEqual(datesFrom('18 22.23 JAN 2027').map(d=>d.date),['2027-01-18','2027-01-22','2027-01-23']));
test('原图真实OCR输出的分散标题与英文场馆',()=>{const f=extract('AURA\nTOUR JOEY YUNG\n容祖儿演唱会\nKAI TAK STADIUM 局德主场馆\n18 22.23 JAN 2027',{...options,cities:[{name:'香港特别行政区'}],hint:'参加22号场'});assert.equal(f.title,'AURA TOUR 容祖儿演唱会');assert.equal(f.venue,'启德主场馆');assert.deepEqual(f.selected,['2027-01-22']);});
console.log(`${count} OCR extraction checks passed`);

