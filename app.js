/* =========================================
   STUDYWEEK — REFATORAÇÃO COMPLETA v2.0
   [MELHORIA 1-13] Melhorias de UX/UI implementadas
   Dashboard + Agenda com Grade de Horários
   ========================================= */

const DAYS_SHORT = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const STORAGE_KEY = 'studyweek_sessions';
const NOTIFICATIONS_ENABLED_KEY = 'studyweek_notifications_enabled'; // [MELHORIA 13]
const TIME_START = 7;     // início da grade (07:00)
const TIME_END = 23;      // fim da grade (23:00)
const SLOT_HEIGHT = 60;   // altura de cada slot de 1 hora em px

// [MELHORIA 3] Paleta de 12 cores para o color picker
const COLORS_PALETTE = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', 
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
  '#64748B', '#0EA5E9', '#F43F5E', '#A3E635'
];

// ——— STATE ———
let sessions = [];           // { id, day, subject, start, end, color, notes, done }
let currentWeekOffset = 0;   // 0 = this week, -1 = previous, +1 = next
let selectedDay = null;
let selectedColor = COLORS_PALETTE[0];
let editingId = null;
let currentDate = new Date();  // Data base para cálculos de semana
let toastQueue = [];          // [MELHORIA 5] Fila de toasts para stacking
let notificationsEnabled = false; // [MELHORIA 13]
let currentTheme = 'dark';

// ——— DOM REFS ———
// Header
const btnPrevWeek = document.getElementById('btnPrevWeek');
const btnNextWeek = document.getElementById('btnNextWeek');
const weekRangeEl = document.getElementById('weekRange');
const btnNewSession = document.getElementById('btnNewSession');
const btnThemeToggle = document.getElementById('btnThemeToggle');
const btnExport = document.getElementById('btnExport');
const exportMenu = document.getElementById('exportMenu'); // [MELHORIA 12]

// Dashboard
const dashboard = document.getElementById('dashboard');
const progressPct = document.getElementById('progressPct');
const ringFill = document.getElementById('ringFill');
const statDone = document.getElementById('statDone');
const statTotal = document.getElementById('statTotal');
const statHours = document.getElementById('statHours');
const statSubjects = document.getElementById('statSubjects');
const subjectsList = document.getElementById('subjectsList');
const daySummary = document.getElementById('daySummary');
const nextSession = document.getElementById('nextSession');

// Agenda
const daysHeader = document.getElementById('daysHeader');
const timeLabels = document.getElementById('timeLabels');
const timeGrid = document.getElementById('timeGrid');

// [MELHORIA 4] Drawer (antigas "modal")
const drawerOverlay = document.getElementById('modalOverlay');
const sessionForm = document.getElementById('sessionForm');
const dayPicker = document.getElementById('dayPicker');
const inputSubject = document.getElementById('inputSubject');
const inputStart = document.getElementById('inputStart');
const inputEnd = document.getElementById('inputEnd');
const colorPicker = document.getElementById('colorPicker');
const inputNotes = document.getElementById('inputNotes');
const btnSave = document.getElementById('btnSave');
const btnDelete = document.getElementById('btnDelete');
const btnCancel = document.getElementById('btnCancel');
const btnCloseDraw = document.getElementById('btnCloseDraw'); // [MELHORIA 4]

// Toast
const toast = document.getElementById('toast');

// ——— INIT ———
function init() {
  loadData();
  applyTheme(loadTheme());
  checkNotificationsPermission(); // [MELHORIA 13]
  bindEvents();
  renderAll();
}

// ——— STORAGE ———
function loadData() {
  try {
    sessions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { sessions = []; }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function loadTheme() {
  const saved = localStorage.getItem('studyweek_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  if (btnThemeToggle) {
    btnThemeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    btnThemeToggle.setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
    btnThemeToggle.title = theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro';
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#111723' : '#f4f7fb');
  localStorage.setItem('studyweek_theme', theme);
}

// ——— WEEK CALCULATIONS ———
function getWeekDates() {
  const date = new Date(currentDate);
  date.setDate(currentDate.getDate() + currentWeekOffset * 7);
  
  const day = date.getDay(); // 0 = Sun
  const diffMon = (day === 0) ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffMon);
  
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }
  return weekDates;
}

function formatWeekRange() {
  const dates = getWeekDates();
  const mon = dates[0];
  const sun = dates[6];
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function updateWeekRange() {
  weekRangeEl.textContent = formatWeekRange();
}

// ——— SESSION FILTERS BY WEEK ———
function getSessionsForWeek() {
  const dates = getWeekDates();
  const dateStrings = dates.map(d => d.toDateString());
  
  return sessions.filter(s => {
    // Sessões armazenam apenas o "day" (0-6) relativamente
    // Precisamos correlacionar com a semana atual
    const sessionDate = new Date(dates[s.day]);
    return dateStrings.includes(sessionDate.toDateString());
  });
}

function getSessionsForDay(dayIndex) {
  const dates = getWeekDates();
  const dayDate = dates[dayIndex];
  return sessions.filter(s => {
    // Verificar se a sessão pertence a este dia e semana
    if (s.day !== dayIndex) return false;
    const sessionDate = new Date(dates[s.day]);
    return sessionDate.toDateString() === dayDate.toDateString();
  }).sort((a, b) => a.start.localeCompare(b.start));
}

// ——— RENDER ALL ———
function renderAll() {
  updateWeekRange();
  renderTimeGrid();
  renderDashboard();
}

// ——— RENDER TIME GRID ———
function renderTimeGrid() {
  // Header com dias
  renderDaysHeader();
  
  // Rótulos de horas
  renderTimeLabels();
  
  // Grid com slots e sessões
  renderGridSlots();
}

function renderDaysHeader() {
  daysHeader.innerHTML = '';
  const dates = getWeekDates();
  const today = new Date();
  
  dates.forEach((date, idx) => {
    const isToday = date.toDateString() === today.toDateString();
    const cell = document.createElement('div');
    cell.className = 'day-header-cell' + (isToday ? ' today' : '');
    cell.innerHTML = `
      <div class="day-header-name">${DAYS_SHORT[idx]}</div>
      <div class="day-header-date">${date.getDate()}</div>
    `;
    daysHeader.appendChild(cell);
  });
}

function renderTimeLabels() {
  timeLabels.innerHTML = '';
  for (let h = TIME_START; h < TIME_END; h++) {
    const label = document.createElement('div');
    label.className = 'time-label';
    label.textContent = `${String(h).padStart(2, '0')}:00`;
    timeLabels.appendChild(label);
  }
}

function renderGridSlots() {
  timeGrid.innerHTML = '';
  
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const dayCol = document.createElement('div');
    dayCol.className = 'day-column-grid';
    
    // Criar slots de hora
    for (let h = TIME_START; h < TIME_END; h++) {
      const slot = document.createElement('div');
      slot.className = 'time-slot';
      dayCol.appendChild(slot);
    }
    
    timeGrid.appendChild(dayCol);
  }
  
  // Renderizar blocos de sessão
  renderSessionBlocks();
}

function renderSessionBlocks() {
  const weekSessions = getSessionsForWeek();
  
  weekSessions.forEach(s => {
    const [startH, startM] = s.start.split(':').map(Number);
    const [endH, endM] = s.end.split(':').map(Number);
    
    const dayCol = timeGrid.children[s.day];
    if (!dayCol) return;
    
    // Calcular posição e altura do bloco
    const topPercent = ((startH - TIME_START + startM / 60) / (TIME_END - TIME_START)) * 100;
    const durationH = (endH - startH) + (endM - startM) / 60;
    const heightPercent = (durationH / (TIME_END - TIME_START)) * 100;
    
    const block = document.createElement('div');
    block.className = 'session-block' + (s.done ? ' done' : '');
    block.style.top = `${topPercent}%`;
    block.style.height = `${heightPercent}%`;
    block.style.background = hexToRgba(s.color, 0.2);
    block.style.borderLeftColor = s.color;
    block.style.color = s.color;
    block.dataset.id = s.id;
    
    block.innerHTML = `
      <div class="session-block-time">${s.start}–${s.end}</div>
      <div class="session-block-subject">${escHtml(s.subject)}</div>
      ${s.notes ? `<div class="session-block-notes">${escHtml(s.notes)}</div>` : ''}
      <button class="session-block-check" data-id="${s.id}" title="Marcar como concluída">${s.done ? '✓' : ''}</button>
    `;
    
    // Eventos
    block.addEventListener('click', (e) => {
      if (e.target.closest('.session-block-check')) return;
      openEditModal(s.id);
    });
    
    block.querySelector('.session-block-check').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDone(s.id);
    });
    
    dayCol.appendChild(block);
  });
}

// ——— RENDER DASHBOARD ———
function renderDashboard() {
  const weekSessions = getSessionsForWeek();
  const total = weekSessions.length;
  const done = weekSessions.filter(s => s.done).length;
  const hours = weekSessions.reduce((acc, s) => acc + minutesDiff(s.start, s.end), 0);
  const uniqueSubjects = [...new Set(weekSessions.map(s => s.subject.trim().toLowerCase()))].length;
  
  // Progresso
  statDone.textContent = done;
  statTotal.textContent = total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  progressPct.textContent = `${pct}%`;
  const circumference = 326.56;
  ringFill.style.strokeDashoffset = circumference - (circumference * pct / 100);
  
  // Stats
  statHours.textContent = formatHours(hours);
  statSubjects.textContent = uniqueSubjects;
  
  // Matérias
  renderSubjects(weekSessions);
  
  // Resumo por dia
  renderDaySummary(weekSessions);
  
  // Próxima sessão
  renderNextSession(weekSessions);
}

function renderSubjects(weekSessions) {
  const map = {};
  weekSessions.forEach(s => {
    const key = s.subject.trim();
    if (!map[key]) map[key] = { color: s.color, count: 0 };
    map[key].count++;
  });
  
  subjectsList.innerHTML = '';
  if (Object.keys(map).length === 0) {
    // [MELHORIA 1] Empty state acolhedor
    subjectsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <div class="empty-state-title">Nenhuma matéria ainda</div>
        <div class="empty-state-subtitle">Adicione sessões para ver as matérias aqui</div>
        <button class="empty-state-cta" onclick="document.getElementById('btnNewSession').click()">Adicionar sessão</button>
      </div>
    `;
  } else {
    Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([name, val]) => {
        const li = document.createElement('li');
        li.className = 'subject-item';
        li.innerHTML = `
          <span class="subject-dot" style="background:${val.color}"></span>
          <span class="subject-name">${escHtml(name)}</span>
          <span class="subject-count">${val.count}</span>
        `;
        subjectsList.appendChild(li);
      });
  }
}

function renderDaySummary(weekSessions) {
  daySummary.innerHTML = '';
  const dates = getWeekDates();
  
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const daySessions = weekSessions.filter(s => s.day === dayIdx);
    const dayHours = daySessions.reduce((acc, s) => acc + minutesDiff(s.start, s.end), 0);
    
    const chip = document.createElement('div');
    chip.className = 'day-chip';
    chip.innerHTML = `
      <div class="day-chip-name">${DAYS_SHORT[dayIdx]}</div>
      <div class="day-chip-count">${daySessions.length}</div>
      <div class="day-chip-hours">${formatHours(dayHours)}</div>
    `;
    daySummary.appendChild(chip);
  }
}

function renderNextSession(weekSessions) {
  const now = new Date();
  const upcomingSessions = weekSessions
    .filter(s => {
      const dates = getWeekDates();
      const dayDate = dates[s.day];
      if (dayDate.toDateString() < now.toDateString()) return false;
      if (dayDate.toDateString() === now.toDateString() && s.start <= now.toTimeString().slice(0, 5)) return false;
      return true;
    })
    .sort((a, b) => {
      const dates = getWeekDates();
      if (a.day !== b.day) return a.day - b.day;
      return a.start.localeCompare(b.start);
    });
  
  nextSession.innerHTML = '';
  if (upcomingSessions.length === 0) {
    // [MELHORIA 1] Empty state acolhedor
    nextSession.innerHTML = `
      <div class="empty-state" style="min-height: 120px;">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">Tudo em dia!</div>
        <div class="empty-state-subtitle">Nenhuma sessão planejada</div>
      </div>
    `;
  } else {
    const s = upcomingSessions[0];
    const dates = getWeekDates();
    const nextDate = document.createElement('div');
    nextDate.className = 'next-session-item';
    nextDate.innerHTML = `
      <div class="next-session-subject">${escHtml(s.subject)}</div>
      <div class="next-session-time">${s.start} – ${s.end}</div>
      <div class="next-session-day">${DAYS_SHORT[s.day]} (${dates[s.day].getDate()})</div>
    `;
    nextSession.appendChild(nextDate);
  }
}

// ——— DRAWER OPERATIONS [MELHORIA 4] ———
function openNewSessionModal() {
  editingId = null;
  sessionForm.reset();
  dayPicker.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
  colorPicker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  
  // [MELHORIA 3] Selecionar primeira cor da paleta
  selectedColor = COLORS_PALETTE[0];
  colorPicker.querySelector(`[data-color="${COLORS_PALETTE[0]}"]`).classList.add('selected');
  
  // Selecionar horários padrão
  inputStart.value = '08:00';
  inputEnd.value = '09:00';
  
  document.getElementById('modalTitle').textContent = 'Nova Sessão';
  btnDelete.style.display = 'none';
  drawerOverlay.classList.add('open');
}

function openEditModal(id) {
  const s = sessions.find(s => s.id === id);
  if (!s) return;
  editingId = id;
  
  selectedDay = s.day;
  selectedColor = s.color;
  
  // Preencher form
  dayPicker.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
  dayPicker.querySelector(`[data-day="${s.day}"]`).classList.add('selected');
  
  inputSubject.value = s.subject;
  inputStart.value = s.start;
  inputEnd.value = s.end;
  inputNotes.value = s.notes;
  
  colorPicker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  colorPicker.querySelector(`[data-color="${s.color}"]`).classList.add('selected');
  
  document.getElementById('modalTitle').textContent = 'Editar Sessão';
  btnDelete.style.display = 'inline-block';
  drawerOverlay.classList.add('open');
}

function closeModal() {
  drawerOverlay.classList.remove('open');
  editingId = null;
  selectedDay = null;
}

function saveSession() {
  const subject = inputSubject.value.trim();
  if (!subject) { showToast('⚠️ Insira o nome da matéria'); return; }
  if (selectedDay === null) { showToast('⚠️ Selecione um dia'); return; }
  const start = inputStart.value;
  const end = inputEnd.value;
  if (!start || !end) { showToast('⚠️ Defina os horários'); return; }
  if (start >= end) { showToast('⚠️ O fim deve ser depois do início'); return; }
  
  if (editingId) {
    // Editar
    const s = sessions.find(s => s.id === editingId);
    if (!s) return;
    s.subject = subject;
    s.day = selectedDay;
    s.start = start;
    s.end = end;
    s.color = selectedColor;
    s.notes = inputNotes.value.trim();
    showToast('✓ Sessão atualizada');
  } else {
    // Novo
    const newSession = {
      id: Date.now().toString(),
      day: selectedDay,
      subject,
      start,
      end,
      color: selectedColor,
      notes: inputNotes.value.trim(),
      done: false,
    };
    sessions.push(newSession);
    showToast(`✓ "${subject}" adicionado`);
    
    // [MELHORIA 13] Agendar notificação se habilitado
    if (notificationsEnabled) {
      scheduleSessionNotification(newSession);
    }
  }
  
  saveData();
  renderAll();
  closeModal();
}

function deleteCurrentSession() {
  if (!editingId) return;
  if (!confirm('Deseja excluir esta sessão?')) return;
  sessions = sessions.filter(s => s.id !== editingId);
  saveData();
  renderAll();
  closeModal();
  showToast('🗑 Sessão removida');
}

function toggleDone(id) {
  const s = sessions.find(s => s.id === id);
  if (!s) return;
  s.done = !s.done;
  saveData();
  renderAll();
  showToast(s.done ? '✓ Concluído!' : 'Reaberto');
}

// ——— BIND EVENTS ———
function bindEvents() {
  // Week navigation
  btnPrevWeek.addEventListener('click', () => {
    currentWeekOffset--;
    renderAll();
  });
  btnNextWeek.addEventListener('click', () => {
    currentWeekOffset++;
    renderAll();
  });
  
  // New session
  btnNewSession.addEventListener('click', openNewSessionModal);
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      showToast(nextTheme === 'dark' ? '🌙 Modo escuro ativado' : '🌤 Modo claro ativado');
    });
  }
  
  // [MELHORIA 12] Export menu
  btnExport.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('open');
  });
  
  document.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.export;
      exportMenu.classList.remove('open');
      if (type === 'pdf') exportPDF();
      else if (type === 'png') exportPNG();
      else if (type === 'text') exportTextPlan();
      else if (type === 'ical') exportICalendar();
    });
  });
  
  // Close export menu on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.export-menu-wrapper')) {
      exportMenu.classList.remove('open');
    }
  });
  
  // Day picker
  dayPicker.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dayPicker.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedDay = parseInt(btn.dataset.day);
    });
  });
  
  // [MELHORIA 3] Color picker com 12 cores
  colorPicker.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      colorPicker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
    });
  });
  
  // [MELHORIA 4] Drawer (antiga modal)
  sessionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSession();
  });
  btnDelete.addEventListener('click', deleteCurrentSession);
  btnCancel.addEventListener('click', closeModal);
  btnCloseDraw.addEventListener('click', closeModal);
  drawerOverlay.addEventListener('click', (e) => {
    if (e.target === drawerOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerOverlay.classList.contains('open')) closeModal();
  });
}


// ——— HELPERS ———
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function minutesDiff(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatHours(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ——— NOTIFICATIONS [MELHORIA 13] ———
function checkNotificationsPermission() {
  if (!('Notification' in window)) {
    console.log('Browser não suporta Notifications API');
    return;
  }
  
  if (Notification.permission === 'granted') {
    notificationsEnabled = true;
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
  } else if (Notification.permission === 'denied') {
    notificationsEnabled = false;
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
  } else {
    notificationsEnabled = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === 'true';
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Seu navegador não suporta notificações');
    return;
  }
  
  if (Notification.permission === 'granted') {
    notificationsEnabled = true;
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
    showToast('✓ Notificações ativadas');
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      notificationsEnabled = permission === 'granted';
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, notificationsEnabled ? 'true' : 'false');
      if (notificationsEnabled) {
        showToast('✓ Notificações ativadas');
      } else {
        showToast('Notificações bloqueadas');
      }
    });
  }
}

function scheduleSessionNotification(session) {
  // Agendar notificação 10 minutos antes da sessão
  const now = new Date();
  const dates = getWeekDates();
  const sessionDate = new Date(dates[session.day]);
  const [h, m] = session.start.split(':').map(Number);
  sessionDate.setHours(h, m, 0, 0);
  
  const notificationTime = new Date(sessionDate.getTime() - 10 * 60000);
  const delayMs = notificationTime.getTime() - now.getTime();
  
  if (delayMs > 0) {
    setTimeout(() => {
      if (notificationsEnabled && 'Notification' in window) {
        new Notification(`${session.subject} em 10 minutos!`, {
          body: `${session.start} – ${session.end}`,
          badge: '📚',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">📚</text></svg>',
        });
      }
    }, delayMs);
  }
}

// ——— EXPORTS [MELHORIA 12] ———
function exportPDF() {
  const weekStart = getWeekDates()[0];
  const weekEnd = getWeekDates()[6];
  const filename = `StudyWeek_${formatDate(weekStart)}_${formatDate(weekEnd)}.pdf`;
  
  const element = timeGrid;
  const opt = {
    margin: 10,
    filename: filename,
    image: { type: 'png', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' },
  };
  
  try {
    html2pdf().set(opt).from(element).save();
    showToast('✓ PDF exportado');
  } catch (err) {
    showToast('❌ Erro ao exportar PDF');
    console.error(err);
  }
}

function exportPNG() {
  const weekStart = getWeekDates()[0];
  const weekEnd = getWeekDates()[6];
  const filename = `StudyWeek_${formatDate(weekStart)}_${formatDate(weekEnd)}.png`;
  
  html2canvas(timeGrid, { scale: 2, backgroundColor: '#0d0d0f' })
    .then(canvas => {
      const link = document.createElement('a');
      link.href = canvas.toDataURL();
      link.download = filename;
      link.click();
      showToast('✓ PNG exportado');
    })
    .catch(err => {
      showToast('❌ Erro ao exportar PNG');
      console.error(err);
    });
}

function exportTextPlan() {
  const weekSessions = getSessionsForWeek().sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.start.localeCompare(b.start);
  });

  if (weekSessions.length === 0) {
    showToast('Nenhuma sessão para exportar');
    return;
  }

  const dates = getWeekDates();
  const lines = [
    'Plano Semanal — StudyWeek',
    `Período: ${formatDate(dates[0])} a ${formatDate(dates[6])}`,
    '',
    ...weekSessions.map(s => {
      const date = dates[s.day];
      return `${DAYS_SHORT[s.day]} ${date.getDate()}/${date.getMonth() + 1} — ${s.start} às ${s.end} | ${s.subject}${s.notes ? ` | ${s.notes}` : ''}`;
    }),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `StudyWeek_${formatDate(dates[0])}_${formatDate(dates[6])}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('✓ Plano semanal exportado');
}

function exportICalendar() {
  const weekSessions = getSessionsForWeek();
  if (weekSessions.length === 0) {
    showToast('Nenhuma sessão para exportar');
    return;
  }
  
  // Gerar iCalendar format
  const dates = getWeekDates();
  let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//StudyWeek//EN
CALSCALE:GREGORIAN
X-WR-CALNAME:Plano Semanal
X-WR-TIMEZONE:America/Sao_Paulo
`;
  
  weekSessions.forEach(s => {
    const sessionDate = new Date(dates[s.day]);
    const [startH, startM] = s.start.split(':').map(Number);
    const [endH, endM] = s.end.split(':').map(Number);
    
    sessionDate.setHours(startH, startM, 0, 0);
    const endDate = new Date(dates[s.day]);
    endDate.setHours(endH, endM, 0, 0);
    
    const dtstart = sessionDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtend = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    ical += `BEGIN:VEVENT
UID:${s.id}@studyweek
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${s.subject}
DESCRIPTION:${s.notes}
END:VEVENT
`;
  });
  
  ical += 'END:VCALENDAR';
  
  // Download .ics
  const blob = new Blob([ical], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `StudyWeek_${formatDate(dates[0])}.ics`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('✓ iCalendar exportado');
}

function formatDate(date) {
  return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
}

// ——— TOAST [MELHORIA 5] ———
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  
  // Trigger animation
  requestAnimationFrame(() => t.classList.add('show'));
  
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2500);
}

// ——— START ———
init();

