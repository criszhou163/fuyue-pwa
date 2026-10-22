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
console.log(`${count} OCR extraction checks passed`);

