
'use strict';

const STORAGE_KEY = 'kl_official_v1';
const SCHEMA_VERSION = 1;

const state = loadState();
let currentMonth = startOfMonth(new Date());
let selectedDate = startOfDay(new Date());
let activeView = 'month-view';
let modalContext = null;

const $ = (id) => document.getElementById(id);

function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { name: '朱立坤', birthday: '11-15' },
    events: [],
    studyGoals: [{
      id: cryptoId(),
      title: '2027年发表一篇论文',
      deadline: '2027-12-31',
      stages: [
        { id: cryptoId(), title: '文献综述', tasks: [] },
        { id: cryptoId(), title: '数据与实证', tasks: [] },
        { id: cryptoId(), title: '写作与投稿', tasks: [] }
      ]
    }],
    dreams: [],
    notes: {},
    savings: {
      baseRegularSavings: 0,
      confirmations: []
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch (error) {
    console.error(error);
    return defaultState();
  }
}

function migrate(data) {
  const base = defaultState();
  return {
    ...base,
    ...data,
    schemaVersion: SCHEMA_VERSION,
    profile: { ...base.profile, ...(data.profile || {}) },
    savings: { ...base.savings, ...(data.savings || {}) },
    events: Array.isArray(data.events) ? data.events : [],
    studyGoals: Array.isArray(data.studyGoals) && data.studyGoals.length ? data.studyGoals : base.studyGoals,
    dreams: Array.isArray(data.dreams) ? data.dreams : [],
    notes: data.notes || {}
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderActive();
}

function cryptoId() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthKey(date) {
  return dateKey(date).slice(0, 7);
}

function parseDate(key) {
  const [y,m,d] = key.split('-').map(Number);
  return new Date(y,m-1,d);
}

function yen(value) {
  return `¥${Math.round(Number(value || 0)).toLocaleString('ja-JP')}`;
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  activeView = id;
  $('fab').classList.toggle('hidden', id !== 'day-view');
  renderActive();
}

function renderActive() {
  if (activeView === 'month-view') renderMonth();
  if (activeView === 'day-view') renderDay();
  if (activeView === 'study-view') renderStudy();
  if (activeView === 'dream-view') renderDreams();
  if (activeView === 'report-view') renderReport();
  if (activeView === 'settings-view') renderSettings();
}

function monthEvents(date=currentMonth) {
  const key = monthKey(date);
  return state.events.filter(e => e.date.startsWith(key));
}

function calculateMonth(date=currentMonth) {
  const events = monthEvents(date);
  const work = events.filter(e => e.type === 'work');
  const sales = sum(work, 'amount');
  const designated = work.filter(e => e.designated).length;
  const attendanceDays = new Set(work.map(e => e.date)).size;
  const nailShare = sales / 2;
  const designatedFee = designated * 550;
  const transitFee = attendanceDays * 418;
  const nailIncome = nailShare + designatedFee + transitFee;
  const scholarship = sum(events.filter(e => e.type === 'scholarship'), 'amount');
  const expenses = sum(events.filter(e => e.type === 'expense'), 'amount');
  const dreamEvents = sum(events.filter(e => e.type === 'dream'), 'amount');
  const totalIncome = nailIncome + scholarship;
  const designationRate = work.length ? designated / work.length : 0;
  const avgTicket = work.length ? sales / work.length : 0;
  return {
    events, work, sales, designated, attendanceDays, nailShare,
    designatedFee, transitFee, nailIncome, scholarship, expenses,
    dreamEvents, totalIncome, designationRate, avgTicket,
    regularSuggestion: totalIncome * .30,
    dreamSuggestion: totalIncome * .10,
    balance: totalIncome - expenses
  };
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function currentMessage(summary) {
  const today = new Date();
  const key = dateKey(today);
  const todayEvents = state.events.filter(e => e.date === key);
  const completedToday = allTasks().filter(t => t.completedAt?.startsWith(key)).length;
  const dreamToday = sum(todayEvents.filter(e => e.type === 'dream'), 'amount');
  if (completedToday) return `今天完成了 ${completedToday} 个学习任务。`;
  if (dreamToday) return `今天为愿望存入了 ${yen(dreamToday)}。`;
  if (todayEvents.length >= 5) return '今天很充实。';
  if (todayEvents.length) return `今天已经留下 ${todayEvents.length} 条记录。`;
  return '今天还没有留下记录。';
}

function birthdayVisible() {
  const today = new Date();
  return `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}` === state.profile.birthday;
}

function renderMonth() {
  const s = calculateMonth();
  const monthLabel = new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long'}).format(currentMonth);
  const confirmed = state.savings.confirmations.find(c => c.monthKey === monthKey(currentMonth));
  const birthday = birthdayVisible() ? `
    <div class="card birthday-card">
      <h2>🎂 生日快乐，${escapeHtml(state.profile.name)}。</h2>
      <div class="small">这一年，你接待了 ${yearWorkCount()} 位客人，完成了 ${yearTaskCount()} 个学习任务。</div>
    </div>` : '';

  $('month-view').innerHTML = `
    ${birthday}
    <div class="month-message">${escapeHtml(currentMessage(s))}</div>
    <div class="metric-grid">
      ${metricCard('💅 美甲收入', yen(s.nailIncome), 'work')}
      ${metricCard('🎓 奖学金', yen(s.scholarship), 'study')}
      ${metricCard('💰 合计', yen(s.totalIncome), '')}
    </div>
    <div class="card dream savings-card">
      ${dataRow('本月应储蓄 30%', yen(s.regularSuggestion))}
      ${dataRow('愿望储蓄 10%', yen(s.dreamSuggestion))}
      ${dataRow('本月支出', yen(s.expenses))}
      ${dataRow('本月结余', yen(s.balance))}
      <button class="primary-button" data-action="confirm-savings" ${confirmed?'disabled':''}>
        ${confirmed ? '本月储蓄已确认' : '确认本月实际存入'}
      </button>
    </div>
    <div class="month-nav">
      <button class="icon-button" data-action="prev-month">‹</button>
      <div class="month-title">${monthLabel}</div>
      <button class="icon-button" data-action="next-month">›</button>
    </div>
    <div class="calendar" id="calendar-grid"></div>
  `;
  renderCalendar();
}

function metricCard(label,value,type) {
  return `<div class="card ${type}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div></div>`;
}

function dataRow(label,value) {
  return `<div class="data-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderCalendar() {
  const grid = $('calendar-grid');
  if (!grid) return;
  const weekdays = ['日','一','二','三','四','五','六'];
  let html = weekdays.map(w => `<div class="weekday">${w}</div>`).join('');
  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  for (let i=0;i<42;i++) {
    const day = new Date(start);
    day.setDate(start.getDate()+i);
    const key = dateKey(day);
    const events = state.events.filter(e => e.date === key);
    const work = events.filter(e => e.type === 'work').length;
    const study = events.filter(e => e.type === 'study').length + allTasks().filter(t => t.completedAt?.startsWith(key)).length;
    const expense = sum(events.filter(e => e.type === 'expense'), 'amount');
    const dream = sum(events.filter(e => e.type === 'dream'), 'amount');
    const classes = ['day-cell'];
    if (day.getMonth() !== currentMonth.getMonth()) classes.push('outside');
    if (key === dateKey(new Date())) classes.push('today');
    html += `
      <button class="${classes.join(' ')}" data-action="open-day" data-date="${key}">
        <span class="day-number">${day.getDate()}</span>
        <span class="day-badges">
          ${work ? `💅 ${work}<br>` : ''}
          ${study ? `📚 ${study}<br>` : ''}
          ${expense ? `💰 ${Math.round(expense)}<br>` : ''}
          ${dream ? `🌈 ${Math.round(dream)}` : ''}
        </span>
      </button>`;
  }
  grid.innerHTML = html;
}

function renderDay() {
  const key = dateKey(selectedDate);
  const events = state.events.filter(e => e.date === key).sort((a,b) => a.time.localeCompare(b.time));
  const plans = allTasks().filter(t => t.plannedDate === key && !t.completedAt);
  const work = events.filter(e => e.type === 'work');
  const expense = sum(events.filter(e => e.type === 'expense'), 'amount');
  const dream = sum(events.filter(e => e.type === 'dream'), 'amount');
  const note = state.notes[key] || '';
  const dayLabel = new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(selectedDate);

  $('day-view').innerHTML = `
    <button class="back-button" data-action="home">‹ 返回月份</button>
    <div class="page-header">
      <div>
        <div class="page-title">${dayLabel}</div>
        <div class="page-subtitle">${key}</div>
      </div>
    </div>
    ${plans.length ? `
      <div class="card study plan-card">
        <h3>今天的学习计划</h3>
        ${plans.map(t => `
          <label class="plan-item">
            <input type="checkbox" data-action="complete-task" data-task="${t.id}">
            <span>${escapeHtml(t.title)}<br><small class="muted">${escapeHtml(t.stageTitle)}</small></span>
          </label>`).join('')}
      </div>` : ''}
    <div class="summary-grid">
      ${metricCard('💅 客人数', `${work.length} 人`, 'work')}
      ${metricCard('💰 当日支出', yen(expense), 'finance')}
      ${metricCard('🌈 愿望转入', yen(dream), 'dream')}
      ${metricCard('📚 完成任务', `${allTasks().filter(t => t.completedAt?.startsWith(key)).length} 项`, 'study')}
    </div>
    <div class="timeline">
      ${events.length ? events.map(eventTemplate).join('') : `<div class="empty-state">今天还没有留下记录。</div>`}
    </div>
    <div class="card" style="margin-top:14px">
      <div class="metric-label">今日一句</div>
      <div style="margin-top:8px">${note ? escapeHtml(note) : '今天还没有留下记录。'}</div>
      <button class="pill-button" data-action="edit-day-note" style="margin-top:12px">编辑</button>
    </div>
  `;
}

function eventTemplate(event) {
  const meta = [
    event.designated ? '指名' : '',
    event.category || '',
    event.note || '',
    event.amount ? yen(event.amount) : ''
  ].filter(Boolean).join(' · ');
  return `
    <div class="timeline-item">
      <div class="timeline-time">${escapeHtml(event.time)}</div>
      <div class="timeline-icon">${eventEmoji(event.type)}</div>
      <div class="timeline-card">
        <div class="timeline-title">${escapeHtml(event.title)}</div>
        ${meta ? `<div class="timeline-meta">${escapeHtml(meta)}</div>` : ''}
        <div class="timeline-actions">
          <button class="text-button" data-action="edit-event" data-id="${event.id}">编辑</button>
          <button class="text-button" data-action="delete-event" data-id="${event.id}">删除</button>
        </div>
      </div>
    </div>`;
}

function eventEmoji(type) {
  return ({work:'💅',study:'📚',expense:'💰',scholarship:'🎓',dream:'🌈'})[type] || '•';
}

function renderStudy() {
  const goal = state.studyGoals[0];
  const tasks = allTasks();
  const done = tasks.filter(t => t.completedAt).length;
  const progress = tasks.length ? done/tasks.length : 0;
  $('study-view').innerHTML = `
    <button class="back-button" data-action="home">‹ 返回月份</button>
    <div class="page-header">
      <div><div class="page-title">学习计划</div><div class="page-subtitle">计划负责方向，记录负责进度。</div></div>
      <button class="pill-button" data-action="add-stage">＋ 阶段</button>
    </div>
    <div class="card study">
      <div class="metric-label">长期目标</div>
      <div class="metric-value">${escapeHtml(goal.title)}</div>
      <div class="small muted" style="margin-top:6px">截止：${goal.deadline}</div>
      <div class="progress"><div class="progress-bar" style="width:${Math.round(progress*100)}%"></div></div>
      <div class="small">${Math.round(progress*100)}% 完成</div>
    </div>
    <div class="list" style="margin-top:14px">
      ${goal.stages.map(stage => stageTemplate(stage)).join('')}
    </div>`;
}

function stageTemplate(stage) {
  const done = stage.tasks.filter(t => t.completedAt).length;
  const pct = stage.tasks.length ? Math.round(done/stage.tasks.length*100) : 0;
  return `
    <div class="list-card">
      <div class="data-row"><strong>${escapeHtml(stage.title)}</strong><span class="small muted">${pct}%</span></div>
      <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      ${stage.tasks.map(t => `
        <div class="data-row">
          <span>${t.completedAt?'✅':'⬜'} ${escapeHtml(t.title)}<br><small class="muted">${t.plannedDate || '未安排日期'}</small></span>
          <span>
            <button class="text-button" data-action="toggle-task" data-task="${t.id}">${t.completedAt?'撤销':'完成'}</button>
            <button class="text-button" data-action="delete-task" data-task="${t.id}">删除</button>
          </span>
        </div>`).join('')}
      <button class="pill-button" data-action="add-task" data-stage="${stage.id}">＋ 添加任务</button>
    </div>`;
}

function renderDreams() {
  $('dream-view').innerHTML = `
    <button class="back-button" data-action="home">‹ 返回月份</button>
    <div class="page-header">
      <div><div class="page-title">愿望</div><div class="page-subtitle">每月收入的 10%，可以分配给真正想做的事。</div></div>
      <button class="pill-button" data-action="add-dream">＋ 愿望</button>
    </div>
    <div class="list">
      ${state.dreams.length ? state.dreams.map(dreamTemplate).join('') : `<div class="empty-state">还没有愿望。</div>`}
    </div>`;
}

function dreamTemplate(dream) {
  const pct = dream.targetAmount ? Math.min(100, Math.round(dream.savedAmount/dream.targetAmount*100)) : 0;
  return `
    <div class="list-card" style="background:var(--gold-soft)">
      <div class="data-row"><strong>${escapeHtml(dream.title)}</strong><span>${pct}%</span></div>
      <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      ${dataRow('已存', yen(dream.savedAmount))}
      ${dataRow('目标', yen(dream.targetAmount))}
      ${dataRow('还差', yen(Math.max(dream.targetAmount-dream.savedAmount,0)))}
      <div class="pill-row">
        <button class="pill-button" data-action="deposit-dream" data-dream="${dream.id}">＋ 转入</button>
        <button class="pill-button" data-action="delete-dream" data-dream="${dream.id}">删除</button>
      </div>
    </div>`;
}

function renderReport() {
  const s = calculateMonth();
  $('report-view').innerHTML = `
    <button class="back-button" data-action="home">‹ 返回月份</button>
    <div class="page-header"><div><div class="page-title">${currentMonth.getFullYear()}年${currentMonth.getMonth()+1}月回顾</div><div class="page-subtitle">自动汇总真实记录。</div></div></div>
    <div class="card report-section">
      <h3>💅 工作</h3>
      ${dataRow('营业额', yen(s.sales))}
      ${dataRow('客人数', `${s.work.length} 人`)}
      ${dataRow('指名人数', `${s.designated} 人`)}
      ${dataRow('指名率', `${Math.round(s.designationRate*100)}%`)}
      ${dataRow('平均客单价', yen(s.avgTicket))}
      ${dataRow('美甲分成', yen(s.nailShare))}
      ${dataRow('指名费', yen(s.designatedFee))}
      ${dataRow('交通费', yen(s.transitFee))}
      ${dataRow('最终工资', yen(s.nailIncome))}
    </div>
    <div class="card report-section">
      <h3>📚 学习</h3>
      ${dataRow('完成任务', `${monthCompletedTasks().length} 项`)}
      ${dataRow('学习天数', `${new Set(monthCompletedTasks().map(t=>t.completedAt.slice(0,10))).size} 天`)}
    </div>
    <div class="card report-section">
      <h3>💰 收支</h3>
      ${dataRow('美甲收入', yen(s.nailIncome))}
      ${dataRow('奖学金', yen(s.scholarship))}
      ${dataRow('总收入', yen(s.totalIncome))}
      ${dataRow('总支出', yen(s.expenses))}
      ${dataRow('本月结余', yen(s.balance))}
      ${dataRow('应储蓄 30%', yen(s.regularSuggestion))}
      ${dataRow('愿望储蓄 10%', yen(s.dreamSuggestion))}
    </div>`;
}

function renderSettings() {
  const totalRegular = state.savings.baseRegularSavings + state.savings.confirmations.reduce((s,c)=>s+Number(c.regularAmount||0),0);
  $('settings-view').innerHTML = `
    <button class="back-button" data-action="home">‹ 返回月份</button>
    <div class="page-header"><div><div class="page-title">设置与数据</div><div class="page-subtitle">数据默认保存在当前设备浏览器。</div></div></div>
    <div class="card">
      ${dataRow('姓名', escapeHtml(state.profile.name))}
      ${dataRow('生日', `每年 ${state.profile.birthday.replace('-','月')}日`)}
      ${dataRow('累计普通储蓄', yen(totalRegular))}
      <button class="primary-button" data-action="edit-base-savings">设置已有储蓄起点</button>
      <button class="secondary-button" data-action="export-data">导出备份</button>
      <button class="secondary-button" data-action="import-data">导入备份</button>
      <button class="danger-button" data-action="reset-data">清空全部数据</button>
      <p class="install-note">部署到 HTTPS 网址后，可在 iPhone Safari 中选择“分享 → 添加到主屏幕”，以独立 App 形式打开。</p>
    </div>`;
}

function allTasks() {
  return state.studyGoals.flatMap(goal =>
    goal.stages.flatMap(stage =>
      stage.tasks.map(task => ({...task, goalId:goal.id, stageId:stage.id, stageTitle:stage.title}))
    )
  );
}

function findTask(id) {
  for (const goal of state.studyGoals) {
    for (const stage of goal.stages) {
      const task = stage.tasks.find(t => t.id === id);
      if (task) return {goal,stage,task};
    }
  }
  return null;
}

function monthCompletedTasks() {
  const key = monthKey(currentMonth);
  return allTasks().filter(t => t.completedAt?.startsWith(key));
}

function yearWorkCount() {
  const y = new Date().getFullYear().toString();
  return state.events.filter(e => e.type==='work' && e.date.startsWith(y)).length;
}

function yearTaskCount() {
  const y = new Date().getFullYear().toString();
  return allTasks().filter(t => t.completedAt?.startsWith(y)).length;
}

function openMenu() {
  showModal('KL', `
    <button class="sheet-option" data-action="study">📚 学习计划</button>
    <button class="sheet-option" data-action="dreams">🌈 愿望</button>
    <button class="sheet-option" data-action="report">📊 月度回顾</button>
    <button class="sheet-option" data-action="settings">⚙️ 设置与数据</button>
  `);
}

function showModal(title, content) {
  $('modal-title').textContent = title;
  $('modal-content').innerHTML = content;
  $('modal').classList.add('show');
}

function closeModal() {
  $('modal').classList.remove('show');
  modalContext = null;
}

function openAddSheet() {
  $('sheet').classList.add('show');
}

function closeSheet() {
  $('sheet').classList.remove('show');
}

function openEventModal(type, existing=null) {
  closeSheet();
  modalContext = {kind:'event',type,id:existing?.id || null};
  const labels = {
    work:'工作记录',study:'学习记录',expense:'日支出',
    scholarship:'奖学金收入',dream:'愿望储蓄'
  };
  const expenseCategories = ['吃饭','交通','房租水电网','购物','学习','医疗','娱乐','其他'];
  showModal(existing?'编辑记录':`新增${labels[type]}`, `
    <div class="field"><label>内容</label><input id="event-title" value="${escapeAttr(existing?.title || defaultEventTitle(type))}"></div>
    ${type !== 'study' ? `<div class="field"><label>金额（日元）</label><input id="event-amount" type="number" inputmode="decimal" value="${existing?.amount || ''}"></div>` : ''}
    ${type === 'expense' ? `<div class="field"><label>分类</label><select id="event-category">${expenseCategories.map(c=>`<option ${existing?.category===c?'selected':''}>${c}</option>`).join('')}</select></div>` : ''}
    ${type === 'work' ? `<div class="field"><label>是否指名</label><select id="event-designated"><option value="false">否</option><option value="true" ${existing?.designated?'selected':''}>是</option></select></div>` : ''}
    ${type === 'dream' ? `<div class="field"><label>对应愿望</label><select id="event-dream">${state.dreams.map(d=>`<option value="${d.id}" ${existing?.dreamId===d.id?'selected':''}>${escapeHtml(d.title)}</option>`).join('')}</select></div>` : ''}
    <div class="field"><label>时间</label><input id="event-time" type="time" value="${existing?.time || new Date().toTimeString().slice(0,5)}"></div>
    <div class="field"><label>备注</label><input id="event-note" value="${escapeAttr(existing?.note || '')}"></div>
    <button class="primary-button" data-action="save-event">保存</button>
  `);
}

function defaultEventTitle(type) {
  return ({work:'美甲',study:'学习',expense:'支出',scholarship:'奖学金',dream:'愿望储蓄'})[type];
}

function saveEventFromModal() {
  const {type,id} = modalContext;
  const title = $('event-title').value.trim();
  if (!title) return alert('请输入内容');
  const amount = Number($('event-amount')?.value || 0);
  if (type !== 'study' && amount <= 0) return alert('请输入金额');
  if (type === 'dream' && !state.dreams.length) return alert('请先建立愿望');

  const existing = id ? state.events.find(e => e.id === id) : null;
  const event = {
    id: id || cryptoId(),
    date: existing?.date || dateKey(selectedDate),
    time: $('event-time').value || '12:00',
    type,
    title,
    amount,
    category: $('event-category')?.value || '',
    designated: $('event-designated')?.value === 'true',
    dreamId: $('event-dream')?.value || '',
    note: $('event-note').value.trim()
  };

  if (existing) Object.assign(existing,event); else state.events.push(event);
  if (type === 'dream') syncDreamBalances();
  closeModal();
  persist();
}

function syncDreamBalances() {
  state.dreams.forEach(d => d.savedAmount = 0);
  state.events.filter(e => e.type==='dream').forEach(e => {
    const dream = state.dreams.find(d => d.id===e.dreamId);
    if (dream) dream.savedAmount += Number(e.amount||0);
  });
  state.savings.confirmations.forEach(c => {
    if (c.dreamId) {
      const dream = state.dreams.find(d => d.id===c.dreamId);
      if (dream) dream.savedAmount += Number(c.dreamAmount||0);
    }
  });
}

function editDayNote() {
  closeSheet();
  const key = dateKey(selectedDate);
  modalContext = {kind:'note'};
  showModal('今日一句', `
    <div class="field"><label>今天值得记住什么？</label><textarea id="day-note">${escapeHtml(state.notes[key] || '')}</textarea></div>
    <button class="primary-button" data-action="save-day-note">保存</button>
  `);
}

function saveDayNote() {
  state.notes[dateKey(selectedDate)] = $('day-note').value.trim();
  closeModal();
  persist();
}

function addStage() {
  modalContext = {kind:'stage'};
  showModal('新增阶段', `
    <div class="field"><label>阶段名称</label><input id="stage-title" placeholder="例如：文献综述"></div>
    <button class="primary-button" data-action="save-stage">保存</button>
  `);
}

function saveStage() {
  const title = $('stage-title').value.trim();
  if (!title) return alert('请输入阶段名称');
  state.studyGoals[0].stages.push({id:cryptoId(),title,tasks:[]});
  closeModal(); persist();
}

function addTask(stageId) {
  modalContext = {kind:'task',stageId};
  showModal('新增任务', `
    <div class="field"><label>任务名称</label><input id="task-title" placeholder="例如：阅读10篇文献"></div>
    <div class="field"><label>计划日期</label><input id="task-date" type="date" value="${dateKey(new Date())}"></div>
    <button class="primary-button" data-action="save-task">保存</button>
  `);
}

function saveTask() {
  const title = $('task-title').value.trim();
  const plannedDate = $('task-date').value;
  if (!title) return alert('请输入任务名称');
  const stage = state.studyGoals[0].stages.find(s => s.id===modalContext.stageId);
  stage.tasks.push({id:cryptoId(),title,plannedDate,completedAt:null});
  closeModal(); persist();
}

function toggleTask(id, complete=true, completionDate=null) {
  const found = findTask(id);
  if (!found) return;
  found.task.completedAt = complete ? `${completionDate || dateKey(new Date())}T${new Date().toTimeString().slice(0,8)}` : null;
  persist();
}

function addDream() {
  modalContext = {kind:'dream'};
  showModal('新增愿望', `
    <div class="field"><label>愿望名称</label><input id="dream-title" placeholder="例如：京都大阪旅行"></div>
    <div class="field"><label>目标金额</label><input id="dream-target" type="number" inputmode="decimal"></div>
    <button class="primary-button" data-action="save-dream">保存</button>
  `);
}

function saveDream() {
  const title = $('dream-title').value.trim();
  const targetAmount = Number($('dream-target').value || 0);
  if (!title || targetAmount<=0) return alert('请输入愿望名称和目标金额');
  state.dreams.push({id:cryptoId(),title,targetAmount,savedAmount:0});
  closeModal(); persist();
}

function depositDream(id) {
  selectedDate = startOfDay(new Date());
  const dream = state.dreams.find(d=>d.id===id);
  openEventModal('dream');
  setTimeout(()=>{
    if ($('event-title')) $('event-title').value = dream.title;
    if ($('event-dream')) $('event-dream').value = id;
  });
}

function confirmSavings() {
  const s = calculateMonth();
  const key = monthKey(currentMonth);
  if (state.savings.confirmations.some(c=>c.monthKey===key)) return;
  if (!state.dreams.length && s.dreamSuggestion>0) return alert('请先建立至少一个愿望');
  modalContext = {kind:'savings',summary:s,monthKey:key};
  showModal('确认本月储蓄', `
    ${dataRow('普通储蓄 30%', yen(s.regularSuggestion))}
    ${dataRow('愿望储蓄 10%', yen(s.dreamSuggestion))}
    ${state.dreams.length ? `<div class="field"><label>愿望储蓄分配到</label><select id="savings-dream">${state.dreams.map(d=>`<option value="${d.id}">${escapeHtml(d.title)}</option>`).join('')}</select></div>` : ''}
    <button class="primary-button" data-action="save-savings-confirmation">确认存入</button>
  `);
}

function saveSavingsConfirmation() {
  const {summary,monthKey:key} = modalContext;
  state.savings.confirmations.push({
    monthKey:key,
    regularAmount:summary.regularSuggestion,
    dreamAmount:summary.dreamSuggestion,
    dreamId:$('savings-dream')?.value || ''
  });
  syncDreamBalances();
  closeModal(); persist();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url;a.download=`KL_Backup_${dateKey(new Date())}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = migrate(JSON.parse(reader.result));
      Object.keys(state).forEach(k=>delete state[k]);
      Object.assign(state,imported);
      syncDreamBalances();
      persist();
      alert('导入成功');
    } catch {
      alert('备份文件格式不正确');
    }
  };
  reader.readAsText(file);
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(value='') { return escapeHtml(value); }

document.addEventListener('click', event => {
  const actionEl = event.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action==='home') showView('month-view');
    if (action==='open-menu') openMenu();
    if (action==='prev-month') { currentMonth = new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1); renderMonth(); }
    if (action==='next-month') { currentMonth = new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1); renderMonth(); }
    if (action==='open-day') { selectedDate=parseDate(actionEl.dataset.date); showView('day-view'); }
    if (action==='open-add-sheet') openAddSheet();
    if (action==='close-sheet') closeSheet();
    if (action==='close-modal') closeModal();
    if (action==='edit-day-note') editDayNote();
    if (action==='save-day-note') saveDayNote();
    if (action==='save-event') saveEventFromModal();
    if (action==='study') { closeModal(); showView('study-view'); }
    if (action==='dreams') { closeModal(); showView('dream-view'); }
    if (action==='report') { closeModal(); showView('report-view'); }
    if (action==='settings') { closeModal(); showView('settings-view'); }
    if (action==='add-stage') addStage();
    if (action==='save-stage') saveStage();
    if (action==='add-task') addTask(actionEl.dataset.stage);
    if (action==='save-task') saveTask();
    if (action==='toggle-task') toggleTask(actionEl.dataset.task, !findTask(actionEl.dataset.task).task.completedAt);
    if (action==='complete-task') toggleTask(actionEl.dataset.task,true,dateKey(selectedDate));
    if (action==='delete-task') {
      const found=findTask(actionEl.dataset.task);
      if(found&&confirm('确定删除这个任务吗？')){found.stage.tasks=found.stage.tasks.filter(t=>t.id!==actionEl.dataset.task);persist();}
    }
    if (action==='add-dream') addDream();
    if (action==='save-dream') saveDream();
    if (action==='deposit-dream') depositDream(actionEl.dataset.dream);
    if (action==='delete-dream') {
      if(confirm('确定删除这个愿望吗？')){state.dreams=state.dreams.filter(d=>d.id!==actionEl.dataset.dream);state.events=state.events.filter(e=>e.dreamId!==actionEl.dataset.dream);persist();}
    }
    if (action==='confirm-savings') confirmSavings();
    if (action==='save-savings-confirmation') saveSavingsConfirmation();
    if (action==='edit-event') {
      const existing=state.events.find(e=>e.id===actionEl.dataset.id);
      if(existing) openEventModal(existing.type,existing);
    }
    if (action==='delete-event') {
      if(confirm('确定删除这条记录吗？')){state.events=state.events.filter(e=>e.id!==actionEl.dataset.id);syncDreamBalances();persist();}
    }
    if (action==='export-data') exportData();
    if (action==='import-data') $('import-file').click();
    if (action==='edit-base-savings') {
      const value=Number(prompt('请输入当前已有普通储蓄',state.savings.baseRegularSavings)||0);
      if(value>=0){state.savings.baseRegularSavings=value;persist();}
    }
    if (action==='reset-data') {
      if(confirm('确定清空全部数据吗？此操作不可撤销。')){localStorage.removeItem(STORAGE_KEY);location.reload();}
    }
  }

  const typeEl = event.target.closest('[data-event-type]');
  if (typeEl) openEventModal(typeEl.dataset.eventType);
});

$('sheet').addEventListener('click', e => { if(e.target===$('sheet')) closeSheet(); });
$('modal').addEventListener('click', e => { if(e.target===$('modal')) closeModal(); });
$('import-file').addEventListener('change', e => { if(e.target.files[0]) importData(e.target.files[0]); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
showView('month-view');
