const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core');
const i18n = require('../src/i18n');
const event = (id,date,start,end) => ({id,date,start,end});
const data = () => ({id:'demo',version:1,start:'2026-01-05',end:'2026-01-19',days:14,hourlyRate:100,events:[]});
test('totals merge overlapping intervals per day and include both period boundaries', () => {
 assert.equal(core.total([event('a','2026-01-05',600,720),event('b','2026-01-05',660,780),event('c','2026-01-19',600,660),event('d','2026-01-20',0,1440)],'2026-01-05','2026-01-19'),240);
});
test('legacy currency defaults to RUB without changing the rate',()=>{
 const d=data(); d.hourlyRate=1500; d.events=[event('a',d.start,600,630)];
 assert.equal(core.currency(d),'RUB');assert.equal(core.rate(d),1500);
 assert.equal(core.values(d,'ru').Cost,core.money(750,'RUB','ru'));
 assert.equal(core.values(d,'en').Time,'0.5 h');
});
test('currency formatting respects minor units and language',()=>{
 assert.equal(core.money(12.34,'USD','en'),'$12.34');
 assert.equal(core.money(12.6,'JPY','en'),'¥13');
 assert.match(core.money(12.34,'EUR','ru'),/12,34/);
});
test('currency changes denomination without converting the stored amount',()=>{
 const d={...data(),currency:'USD',events:[event('a','2026-01-05',600,615)]};
 assert.equal(core.values(d,'en').Cost,'$25'); d.currency='EUR';
 assert.equal(core.values(d,'en').Cost,'€25'); assert.equal(d.hourlyRate,100);
});
test('language auto follows Russian, unsupported languages fall back to English',()=>{
 assert.equal(i18n.resolveLanguage('auto','ru-RU'),'ru');
 assert.equal(i18n.resolveLanguage('en','ru'),'en');
 assert.equal(i18n.resolveLanguage('auto','fr'),'en');
 assert.deepEqual(Object.keys(i18n.dictionaries.en).sort(),Object.keys(i18n.dictionaries.ru).sort());
});
test('validation rejects impossible dates, duplicate IDs, bad rate and malformed currency',()=>{
 assert.equal(core.dateOK('2026-02-30'),false);
 for (const patch of [{hourlyRate:-1},{currency:'bad'},{events:[event('a','2026-01-05',600,600)]},{events:[event('a','2026-01-05',0,60),event('a','2026-01-05',60,120)]}]) assert.throws(()=>core.validate({...data(),...patch}));
});
test('locating and replacing inline data preserves surrounding Markdown and CRLF',()=>{
 const d=data(); const before='# Demo\r\nTotal: {.Cost}\r\n```worklogger\r\n';const after='```\r\nFooter\r\n';
 const text=before+JSON.stringify(d)+'\r\n'+after;const found=core.locate(text,'demo');
 assert.deepEqual(found.data,d);
 const updated=text.slice(0,found.start)+JSON.stringify({...d,currency:'EUR'})+'\r\n'+text.slice(found.end);
 assert.ok(updated.startsWith(before)); assert.ok(updated.endsWith(after));
 assert.equal(core.locate(updated).data.currency,'EUR');
});
test('nested examples are ignored, duplicate and missing blocks fail safely',()=>{
 const block='```worklogger\n'+JSON.stringify(data())+'\n```\n';
 assert.deepEqual(core.locate('````markdown\n'+block+'````\n'+block).data,data());
 assert.throws(()=>core.locate(block+block));assert.throws(()=>core.locate('plain text'));
 assert.throws(()=>core.locate('```worklogger\n{broken}\n```'));
});
test('documented examples are valid and total three hours',()=>{
 const fs=require('node:fs');
 for(const name of ['README.md','README.ru.md']){
  const text=fs.readFileSync(name,'utf8');
  const json=text.match(/```worklogger\n([\s\S]*?)\n```/)[1];
  const d=core.validate(JSON.parse(json));assert.equal(core.total(d.events,d.start,d.end),180);
 }
});
