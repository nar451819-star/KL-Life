
'use strict';
const KEY='kl_official_v2';
const OLD_KEY='kl_official_v1';
let db=loadData();
let currentMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let selectedDate=startDay(new Date());
let active='home-view';
let modalCtx=null;
const $=id=>document.getElementById(id);

function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2)}
function defaults(){return{
 schemaVersion:2,
 profile:{name:'朱立坤',birthday:'11-15'},
 events:[],
 notes:{},
 studyGoals:[{id:uid(),title:'2027年发表一篇论文',deadline:'2027-12-31',stages:[
   {id:uid(),title:'文献综述',tasks:[]},{id:uid(),title:'数据与实证',tasks:[]},{id:uid(),title:'写作与投稿',tasks:[]}
 ]}],
 lifeGoals:[],
 savings:{base:0,confirmations:[]}
}}
function loadData(){
 try{
   const raw=localStorage.getItem(KEY);
   if(raw)return migrate(JSON.parse(raw));
   const old=localStorage.getItem(OLD_KEY);
   if(old){const d=migrate(JSON.parse(old));localStorage.setItem(KEY,JSON.stringify(d));return d}
 }catch(e){console.error(e)}
 return defaults()
}
function migrate(d){
 const b=defaults();
 const x={...b,...d,profile:{...b.profile,...(d.profile||{})},notes:d.notes||{},events:Array.isArray(d.events)?d.events:[],studyGoals:Array.isArray(d.studyGoals)&&d.studyGoals.length?d.studyGoals:b.studyGoals,lifeGoals:Array.isArray(d.lifeGoals)?d.lifeGoals:(Array.isArray(d.dreams)?d.dreams.map(z=>({id:z.id||uid(),title:z.title,targetAmount:z.targetAmount||0,savedAmount:z.savedAmount||0,type:'money'})):[]),savings:{...b.savings,...(d.savings||{})}};
 x.events=x.events.map(e=>({...e,startTime:e.startTime||e.time||'10:00',endTime:e.endTime||e.time||'11:00',time:e.time||e.startTime||'10:00'}));
 return x
}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function startDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function dkey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function mkey(d){return dkey(d).slice(0,7)}
function parseDate(k){const[a,b,c]=k.split('-').map(Number);return new Date(a,b-1,c)}
function yen(n){return'¥'+Math.round(Number(n||0)).toLocaleString('ja-JP')}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function minutes(t){const[h,m]=t.split(':').map(Number);return h*60+m}
function durationText(min){return `${Math.floor(min/60)}小时${min%60?min%60+'分钟':''}`}
function show(v){document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===v));active=v;render()}
function render(){if(active==='home-view')renderHome();if(active==='work-view')renderWork();if(active==='finance-view')renderFinance();if(active==='study-view')renderStudy();if(active==='life-view')renderLife();if(active==='day-view')renderDay();if(active==='settings-view')renderSettings()}
function monthEvents(){return db.events.filter(e=>e.date.startsWith(mkey(currentMonth)))}
function dayEvents(k=dkey(selectedDate)){return db.events.filter(e=>e.date===k)}
function sum(a,k){return a.reduce((s,x)=>s+Number(x[k]||0),0)}
function workSummary(events){
 const work=events.filter(e=>e.type==='work');
 const sales=sum(work,'amount'),designated=work.filter(e=>e.designated).length;
 const byDay={};work.forEach(e=>(byDay[e.date]??=[]).push(e));
 let transport=0,totalSpan=0,totalActual=0,transportDays=0;
 Object.values(byDay).forEach(list=>{
   const starts=list.map(e=>minutes(e.startTime||e.time));
   const ends=list.map(e=>minutes(e.endTime||e.time));
   const span=Math.max(...ends)-Math.min(...starts);
   const actual=list.reduce((s,e)=>s+Math.max(0,minutes(e.endTime)-minutes(e.startTime)),0);
   totalSpan+=span;totalActual+=actual;
   if(span>=480){transport+=418;transportDays++}
 });
 return{work,sales,designated,transport,transportDays,totalSpan,totalActual,wage:sales/2+designated*550+transport,avg:work.length?sales/work.length:0}
}
function monthSummary(){
 const ev=monthEvents(),w=workSummary(ev),sch=sum(ev.filter(e=>e.type==='scholarship'),'amount'),exp=sum(ev.filter(e=>e.type==='expense'),'amount');
 return{...w,sch,exp,totalIncome:w.wage+sch,balance:w.wage+sch-exp,regular:(w.wage+sch)*.3,dream:(w.wage+sch)*.1}
}
function allTasks(){return db.studyGoals.flatMap(g=>g.stages.flatMap(s=>s.tasks.map(t=>({...t,stageId:s.id,stageTitle:s.title}))))}
function todayText(){
 const k=dkey(new Date());
 if(db.notes[k])return db.notes[k];
 const ev=db.events.filter(e=>e.date===k),w=workSummary(ev),study=allTasks().filter(t=>t.completedAt?.startsWith(k)).length,exp=ev.filter(e=>e.type==='expense').length,dream=sum(ev.filter(e=>e.type==='dream'),'amount');
 let parts=[];
 if(w.work.length)parts.push(`完成了${w.work.length}位客人的工作，营业额${yen(w.sales)}`);
 if(study)parts.push(`完成了${study}项学习任务`);
 if(exp)parts.push(`记录了${exp}笔支出`);
 if(dream)parts.push(`为梦想存入${yen(dream)}`);
 return parts.length?parts.join('，')+'。':'今天还没有留下记录。'
}
function metric(label,value,cls=''){return`<div class="metric ${cls}"><div class="label">${label}</div><div class="value">${value}</div></div>`}
function row(label,value){return`<div class="data-row"><span>${label}</span><strong>${value}</strong></div>`}

function renderHome(){
 const s=monthSummary(),tasks=allTasks(),done=tasks.filter(t=>t.completedAt).length,pct=tasks.length?Math.round(done/tasks.length*100):0,lifeSaved=db.lifeGoals.reduce((a,g)=>a+Number(g.savedAmount||0),0);
 const today=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
 $('home-view').innerHTML=`
 <div class="card today-card">
   <div class="today-date">${today}</div><div class="today-title">今天</div>
   <div class="today-copy">${esc(todayText())}</div>
   <button class="pill" style="margin-top:12px" data-action="edit-note">✏️ 写一句</button>
 </div>
 <div class="module-grid">
  <button class="module work" data-action="work"><div><div class="module-icon">💼</div><div class="module-name">工作</div></div><div class="module-summary">本月营业额 ${yen(s.sales)}<br>预计工资 ${yen(s.wage)}</div></button>
  <button class="module finance" data-action="finance"><div><div class="module-icon">💰</div><div class="module-name">财务</div></div><div class="module-summary">收入 ${yen(s.totalIncome)}<br>支出 ${yen(s.exp)}</div></button>
  <button class="module study" data-action="study"><div><div class="module-icon">📚</div><div class="module-name">学习</div></div><div class="module-summary">总体完成 ${pct}%<br>目标、阶段与今日任务</div></button>
  <button class="module life" data-action="life"><div><div class="module-icon">🌈</div><div class="module-name">Life</div></div><div class="module-summary">梦想储蓄 ${yen(lifeSaved)}<br>旅行与人生目标</div></button>
 </div>
 <div class="section-head"><div class="section-title">${currentMonth.getFullYear()}年${currentMonth.getMonth()+1}月</div><div><button class="icon-btn" data-action="prev-month">‹</button> <button class="icon-btn" data-action="next-month">›</button></div></div>
 <div class="calendar" id="calendar"></div>`;
 renderCalendar()
}
function renderCalendar(){
 const cal=$('calendar');if(!cal)return;
 let h=['日','一','二','三','四','五','六'].map(x=>`<div class="weekday">${x}</div>`).join('');
 const first=new Date(currentMonth.getFullYear(),currentMonth.getMonth(),1),start=new Date(first);start.setDate(first.getDate()-first.getDay());
 for(let i=0;i<42;i++){
  const d=new Date(start);d.setDate(start.getDate()+i);const k=dkey(d),ev=db.events.filter(e=>e.date===k),sales=sum(ev.filter(e=>e.type==='work'),'amount');
  const hasExpense=ev.some(e=>e.type==='expense'),hasStudy=ev.some(e=>e.type==='study')||allTasks().some(t=>t.completedAt?.startsWith(k)),hasLife=ev.some(e=>e.type==='dream');
  h+=`<button class="day-cell ${d.getMonth()!==currentMonth.getMonth()?'out':''} ${k===dkey(new Date())?'today':''}" data-action="open-day" data-date="${k}">
   <span class="day-number">${d.getDate()}</span><span class="day-sales">${sales?`💅${yen(sales)}`:''}</span><span class="day-dots">${hasExpense?'<span class="dot-blue">●</span>':''}${hasStudy?'<span class="dot-green">●</span>':''}${hasLife?'<span class="dot-yellow">●</span>':''}</span></button>`
 }cal.innerHTML=h
}

function renderWork(){
 const ev=monthEvents(),s=workSummary(ev),today=workSummary(db.events.filter(e=>e.date===dkey(new Date())));
 $('work-view').innerHTML=`
 <button class="back" data-action="home">‹ 返回首页</button><div class="section-head"><div><div class="page-title">工作</div><div class="subtitle">只记录开始、结束、金额和指名。</div></div><button class="pill" data-action="add-work">＋ 客人</button></div>
 <div class="metric-grid">${metric('今日营业额',yen(today.sales),'pink')}${metric('今日预计工资',yen(today.wage),'pink')}${metric('今日客数',today.work.length+' 人')}${metric('今日交通费',yen(today.transport),'blue')}</div>
 <div class="card" style="margin-top:13px">${row('本月营业额',yen(s.sales))}${row('本月预计工资',yen(s.wage))}${row('总客数',s.work.length+' 人')}${row('指名人数',s.designated+' 人')}${row('平均客单价',yen(s.avg))}${row('交通费',`${yen(s.transport)}（${s.transportDays}天）`)}${row('出勤跨度',durationText(s.totalSpan))}${row('实际工作时间',durationText(s.totalActual))}</div>
 <div class="section-head"><div class="section-title">本月记录</div></div><div class="list">${s.work.length?[...s.work].sort((a,b)=>(b.date+b.startTime).localeCompare(a.date+a.startTime)).map(workCard).join(''):'<div class="empty">还没有工作记录。</div>'}</div>`
}
function workCard(e){return`<div class="list-card work-entry"><div><div class="entry-title">${e.date} · ${e.startTime}–${e.endTime}</div><div class="entry-meta">${yen(e.amount)}${e.designated?' · 指名':''}</div><div class="actions"><button class="text-btn" data-action="edit-work" data-id="${e.id}">编辑</button><button class="text-btn" data-action="delete-event" data-id="${e.id}">删除</button></div></div><strong>${yen(e.amount)}</strong></div>`}

function renderFinance(){
 const s=monthSummary(),expenses=monthEvents().filter(e=>e.type==='expense'),groups={};expenses.forEach(e=>groups[e.category||'其他']=(groups[e.category||'其他']||0)+Number(e.amount||0));
 $('finance-view').innerHTML=`
 <button class="back" data-action="home">‹ 返回首页</button><div class="section-head"><div><div class="page-title">财务</div><div class="subtitle">收入、支出、储蓄和梦想基金。</div></div><button class="pill" data-action="add-expense">＋ 支出</button></div>
 <div class="metric-grid">${metric('本月收入',yen(s.totalIncome),'blue')}${metric('本月支出',yen(s.exp),'blue')}${metric('本月结余',yen(s.balance))}${metric('梦想储蓄10%',yen(s.dream),'yellow')}</div>
 <div class="card" style="margin-top:13px">${row('美甲工资',yen(s.wage))}${row('奖学金',yen(s.sch))}${row('普通储蓄建议30%',yen(s.regular))}${row('累计普通储蓄',yen(db.savings.base+db.savings.confirmations.reduce((a,c)=>a+Number(c.regularAmount||0),0)))}</div>
 <div class="section-head"><div class="section-title">支出分类</div></div><div class="card">${Object.keys(groups).length?Object.entries(groups).sort((a,b)=>b[1]-a[1]).map(([k,v])=>row(esc(k),yen(v))).join(''):'<div class="empty">本月还没有支出。</div>'}</div>
 <button class="primary" data-action="add-scholarship">记录奖学金</button>`
}

function renderStudy(){
 const g=db.studyGoals[0],tasks=allTasks(),done=tasks.filter(t=>t.completedAt).length,p=tasks.length?Math.round(done/tasks.length*100):0;
 $('study-view').innerHTML=`<button class="back" data-action="home">‹ 返回首页</button><div class="section-head"><div><div class="page-title">学习</div><div class="subtitle">目标 → 阶段 → 今日任务</div></div><button class="pill" data-action="add-stage">＋ 阶段</button></div>
 <div class="card study"><div class="label">长期目标</div><div class="value">${esc(g.title)}</div><div class="progress"><div class="bar" style="width:${p}%"></div></div><div class="subtitle">${p}% 完成 · 截止 ${g.deadline}</div></div>
 <div class="list" style="margin-top:13px">${g.stages.map(stageCard).join('')}</div>`
}
function stageCard(s){const p=s.tasks.length?Math.round(s.tasks.filter(t=>t.completedAt).length/s.tasks.length*100):0;return`<div class="list-card"><div class="data-row"><strong>${esc(s.title)}</strong><span>${p}%</span></div><div class="progress"><div class="bar" style="width:${p}%"></div></div>${s.tasks.map(t=>`<div class="task"><span>${t.completedAt?'✅':'⬜'} ${esc(t.title)}<br><small class="subtitle">${t.plannedDate||'未安排日期'}</small></span><span><button class="text-btn" data-action="toggle-task" data-id="${t.id}">${t.completedAt?'撤销':'完成'}</button> <button class="text-btn" data-action="delete-task" data-id="${t.id}">删除</button></span></div>`).join('')}<button class="pill" style="margin-top:10px" data-action="add-task" data-stage="${s.id}">＋ 任务</button></div>`}

function renderLife(){
 $('life-view').innerHTML=`<button class="back" data-action="home">‹ 返回首页</button><div class="section-head"><div><div class="page-title">Life</div><div class="subtitle">旅行、人生目标与梦想储蓄。</div></div><button class="pill" data-action="add-life-goal">＋ 目标</button></div>
 <div class="list">${db.lifeGoals.length?db.lifeGoals.map(lifeCard).join(''):'<div class="empty">还没有 Life 目标。</div>'}</div>`
}
function lifeCard(g){const p=g.targetAmount?Math.min(100,Math.round(g.savedAmount/g.targetAmount*100)):0;return`<div class="list-card" style="background:var(--yellowSoft)"><div class="data-row"><strong>${esc(g.title)}</strong><span>${p}%</span></div><div class="progress"><div class="bar" style="width:${p}%"></div></div>${row('已存',yen(g.savedAmount))}${row('目标',yen(g.targetAmount))}<button class="pill" data-action="deposit-life" data-id="${g.id}">＋ 转入</button> <button class="pill" data-action="delete-life" data-id="${g.id}">删除</button></div>`}

function renderDay(){
 const k=dkey(selectedDate),ev=dayEvents(k),w=workSummary(ev),note=db.notes[k]||'',label=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(selectedDate);
 $('day-view').innerHTML=`<button class="back" data-action="home">‹ 返回首页</button><div class="section-head"><div><div class="page-title">${label}</div><div class="subtitle">${k}</div></div><button class="pill" data-action="edit-note">✏️ 今日一句</button></div>
 ${w.work.length?`<div class="card work">${row('营业额',yen(w.sales))}${row('客数',w.work.length+' 人')}${row('指名',w.designated+' 人')}${row('出勤跨度',durationText(w.totalSpan))}${row('交通费',yen(w.transport))}${row('预计工资',yen(w.wage))}</div>`:''}
 <div class="list" style="margin-top:13px">${ev.length?ev.sort((a,b)=>(a.startTime||a.time).localeCompare(b.startTime||b.time)).map(dayEventCard).join(''):'<div class="empty">这一天还没有记录。</div>'}</div>
 <div class="card" style="margin-top:13px"><div class="label">今日一句</div><div class="today-copy">${note?esc(note):'这一天没有留下文字。'}</div></div>`
}
function dayEventCard(e){if(e.type==='work')return workCard(e);return`<div class="list-card"><div class="entry-title">${({expense:'🧾',scholarship:'🎓',study:'📚',dream:'🌈'})[e.type]||'•'} ${esc(e.title)}</div><div class="entry-meta">${e.time||e.startTime}${e.category?' · '+esc(e.category):''}${e.amount?' · '+yen(e.amount):''}</div><div class="actions"><button class="text-btn" data-action="delete-event" data-id="${e.id}">删除</button></div></div>`}

function renderSettings(){
 const total=db.savings.base+db.savings.confirmations.reduce((a,c)=>a+Number(c.regularAmount||0),0);
 $('settings-view').innerHTML=`<button class="back" data-action="home">‹ 返回首页</button><div class="page-title">设置与数据</div><div class="card" style="margin-top:13px">${row('姓名',db.profile.name)}${row('生日','11月15日')}${row('累计普通储蓄',yen(total))}<button class="primary" data-action="set-base">设置已有储蓄起点</button><button class="secondary" data-action="export">导出备份</button><button class="secondary" data-action="import">导入备份</button><button class="danger" data-action="reset">清空全部数据</button></div>`
}

function modal(title,body){$('modal-title').textContent=title;$('modal-body').innerHTML=body;$('overlay').classList.add('show')}
function closeModal(){$('overlay').classList.remove('show');modalCtx=null}
function editNote(){const k=dkey(selectedDate);modal('今日一句',`<div class="field"><label>今天发生了什么？</label><textarea id="note-input">${esc(db.notes[k]||'')}</textarea></div><button class="primary" data-action="save-note">保存</button>`)}
function workModal(existing=null){modalCtx={kind:'work',id:existing?.id||null};modal(existing?'编辑工作记录':'新增客人',`<div class="field"><label>开始时间</label><input id="start-time" type="time" value="${existing?.startTime||new Date().toTimeString().slice(0,5)}"></div><div class="field"><label>结束时间</label><input id="end-time" type="time" value="${existing?.endTime||new Date(Date.now()+60*60*1000).toTimeString().slice(0,5)}"></div><div class="field"><label>金额</label><input id="amount" type="number" inputmode="decimal" value="${existing?.amount||''}"></div><div class="field"><label>是否指名</label><select id="designated"><option value="false">否</option><option value="true" ${existing?.designated?'selected':''}>是</option></select></div><button class="primary" data-action="save-work">保存</button>`)}
function moneyModal(type,title){modalCtx={kind:type};const cats=['吃饭','交通','房租水电网','购物','学习','医疗','娱乐','其他'];modal(title,`<div class="field"><label>内容</label><input id="money-title" value="${type==='expense'?'支出':'奖学金'}"></div><div class="field"><label>金额</label><input id="money-amount" type="number"></div>${type==='expense'?`<div class="field"><label>分类</label><select id="money-category">${cats.map(x=>`<option>${x}</option>`).join('')}</select></div>`:''}<button class="primary" data-action="save-money">保存</button>`)}
function addStage(){modal('新增阶段',`<div class="field"><label>阶段名称</label><input id="stage-title"></div><button class="primary" data-action="save-stage">保存</button>`)}
function addTask(stage){modalCtx={kind:'task',stage};modal('新增任务',`<div class="field"><label>任务名称</label><input id="task-title"></div><div class="field"><label>计划日期</label><input id="task-date" type="date" value="${dkey(new Date())}"></div><button class="primary" data-action="save-task">保存</button>`)}
function addLifeGoal(){modal('新增 Life 目标',`<div class="field"><label>名称</label><input id="life-title"></div><div class="field"><label>目标金额</label><input id="life-target" type="number"></div><button class="primary" data-action="save-life">保存</button>`)}
function depositLife(id){modalCtx={kind:'deposit',id};modal('转入梦想储蓄',`<div class="field"><label>金额</label><input id="deposit-amount" type="number"></div><button class="primary" data-action="save-deposit">确认</button>`)}

document.addEventListener('click',e=>{
 const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
 if(a==='home')show('home-view');if(a==='work')show('work-view');if(a==='finance')show('finance-view');if(a==='study')show('study-view');if(a==='life')show('life-view');if(a==='settings')show('settings-view');
 if(a==='prev-month'){currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);render()}
 if(a==='next-month'){currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);render()}
 if(a==='open-day'){selectedDate=parseDate(el.dataset.date);show('day-view')}
 if(a==='edit-note')editNote();if(a==='close-modal')closeModal();
 if(a==='save-note'){db.notes[dkey(selectedDate)]=$('note-input').value.trim();closeModal();save()}
 if(a==='add-work')workModal();if(a==='edit-work')workModal(db.events.find(x=>x.id===el.dataset.id));
 if(a==='save-work'){const st=$('start-time').value,en=$('end-time').value,amount=Number($('amount').value||0);if(!st||!en||amount<=0)return alert('请填写完整');if(minutes(en)<=minutes(st))return alert('结束时间必须晚于开始时间');const old=modalCtx.id?db.events.find(x=>x.id===modalCtx.id):null,obj={id:modalCtx.id||uid(),date:old?.date||dkey(selectedDate),type:'work',title:'美甲',startTime:st,endTime:en,time:st,amount,designated:$('designated').value==='true'};if(old)Object.assign(old,obj);else db.events.push(obj);closeModal();save()}
 if(a==='add-expense')moneyModal('expense','新增支出');if(a==='add-scholarship')moneyModal('scholarship','记录奖学金');
 if(a==='save-money'){const amount=Number($('money-amount').value||0);if(amount<=0)return alert('请输入金额');db.events.push({id:uid(),date:dkey(new Date()),time:new Date().toTimeString().slice(0,5),type:modalCtx.kind,title:$('money-title').value.trim(),amount,category:$('money-category')?.value||''});closeModal();save()}
 if(a==='delete-event'){if(confirm('确定删除吗？')){db.events=db.events.filter(x=>x.id!==el.dataset.id);save()}}
 if(a==='add-stage')addStage();if(a==='save-stage'){const t=$('stage-title').value.trim();if(t)db.studyGoals[0].stages.push({id:uid(),title:t,tasks:[]});closeModal();save()}
 if(a==='add-task')addTask(el.dataset.stage);if(a==='save-task'){const s=db.studyGoals[0].stages.find(x=>x.id===modalCtx.stage),t=$('task-title').value.trim();if(t)s.tasks.push({id:uid(),title:t,plannedDate:$('task-date').value,completedAt:null});closeModal();save()}
 if(a==='toggle-task'){const f=findTask(el.dataset.id);if(f){f.task.completedAt=f.task.completedAt?null:new Date().toISOString();save()}}
 if(a==='delete-task'){const f=findTask(el.dataset.id);if(f&&confirm('确定删除吗？')){f.stage.tasks=f.stage.tasks.filter(x=>x.id!==el.dataset.id);save()}}
 if(a==='add-life-goal')addLifeGoal();if(a==='save-life'){const title=$('life-title').value.trim(),target=Number($('life-target').value||0);if(title&&target>0)db.lifeGoals.push({id:uid(),title,targetAmount:target,savedAmount:0});closeModal();save()}
 if(a==='deposit-life')depositLife(el.dataset.id);if(a==='save-deposit'){const g=db.lifeGoals.find(x=>x.id===modalCtx.id),amt=Number($('deposit-amount').value||0);if(g&&amt>0){g.savedAmount+=amt;db.events.push({id:uid(),date:dkey(new Date()),time:new Date().toTimeString().slice(0,5),type:'dream',title:g.title,amount:amt,lifeGoalId:g.id})}closeModal();save()}
 if(a==='delete-life'){if(confirm('确定删除吗？')){db.lifeGoals=db.lifeGoals.filter(x=>x.id!==el.dataset.id);save()}}
 if(a==='set-base'){const v=Number(prompt('请输入已有普通储蓄',db.savings.base)||0);if(v>=0){db.savings.base=v;save()}}
 if(a==='export')exportData();if(a==='import')$('import-file').click();if(a==='reset'&&confirm('确定清空全部数据吗？')){localStorage.removeItem(KEY);location.reload()}
});
function findTask(id){for(const g of db.studyGoals)for(const stage of g.stages){const task=stage.tasks.find(t=>t.id===id);if(task)return{stage,task}}}
function exportData(){const b=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`KL_Backup_${dkey(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
$('import-file').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=migrate(JSON.parse(r.result));save();alert('导入成功')}catch{alert('文件格式不正确')}};r.readAsText(f)});
$('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))closeModal()});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
show('home-view');
