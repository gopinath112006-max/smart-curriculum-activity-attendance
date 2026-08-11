/**
 * Smart Curriculum & Attendance Portal — App Logic
 * Restored: routing, live check-in, exports, dark mode, charts.
 * Enhanced: WebGL 3D bindings (window.Scene3D), hover FX, count-up stats.
 */

(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var Scene3D = window.Scene3D || null;

  // ---------- Accounts (seeded once, stored locally) ----------
  var DEFAULT_ACCOUNTS = [
    { id: 't1', role: 'teacher', name: 'Dr. Sarah Chen', email: 'dr.sarah.chen@smartedu.edu', password: 'Atten@2026' },
    { id: 's1', role: 'student', name: 'Alex Rivera', email: 'alex.rivera@student.edu', password: 'Learn@2026' },
    { id: 'a1', role: 'admin', name: 'System Administrator', email: 'admin@smartedu.edu', password: 'Admin@2026' }
  ];
  function loadAccounts() {
    try {
      var raw = localStorage.getItem('smartedu-accounts');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return DEFAULT_ACCOUNTS.slice();
  }
  function persistAccounts() {
    try { localStorage.setItem('smartedu-accounts', JSON.stringify(state.accounts)); } catch (e) { /* ignore */ }
  }
  function loadScans() {
    try { return JSON.parse(localStorage.getItem('smartedu-scans') || '[]'); } catch (e) { return []; }
  }

  // ---------- State ----------
  var state = {
    role: null,          // 'teacher' | 'student' | 'admin'
    currentView: null,
    loggedIn: false,
    user: null,          // resolved account object
    accounts: loadAccounts(),
    checkinCount: 34,
    qrSeconds: 30,
    charts: {},
    sessionActive: true,
    scans: loadScans()      // student-side scan log (persisted)
  };

  // ---------- DOM refs ----------
  var viewLanding = $('#view-landing');
  var appShell = $('#app-shell');
  var mainContent = $('#mainContent');
  var sidebarNav = $('#sidebarNav');
  var sidebar = $('#sidebar');
  var sidebarOverlay = $('#sidebarOverlay');
  var mobileTitle = $('#mobileTitle');

  // ---------- Navigation configs ----------
  var navConfigs = {
    teacher: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'classes', label: 'Class Management', icon: '📁' },
      { id: 'attendance', label: 'Attendance Generator', icon: '📱' },
      { id: 'history', label: 'History & Reports', icon: '📋' }
    ],
    student: [
      { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
      { id: 'scan', label: 'Scan QR Code', icon: '📷' },
      { id: 'planner', label: 'Free Period Planner', icon: '🗓️' }
    ],
    admin: [
      { id: 'dashboard', label: 'Analytics Overview', icon: '📈' }
    ]
  };

  var viewTemplates = {
    teacher: {
      login: 'tpl-teacher-login',
      dashboard: 'tpl-teacher-dashboard',
      classes: 'tpl-teacher-classes',
      attendance: 'tpl-teacher-attendance',
      history: 'tpl-teacher-history'
    },
    student: {
      login: 'tpl-student-login',
      dashboard: 'tpl-student-dashboard',
      scan: 'tpl-student-scan',
      planner: 'tpl-student-planner'
    },
    admin: {
      login: 'tpl-admin-login',
      dashboard: 'tpl-admin-dashboard'
    }
  };

  // ---------- Toast helper ----------
  function showToast(message, type) {
    type = type || 'success';
    var toast = $('#globalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'globalToast';
      toast.className = 'toast hidden';
      document.body.appendChild(toast);
    }
    toast.className = 'toast ' + type;
    toast.innerHTML = '<span class="toast-icon">' + (type === 'success' ? '✓' : 'ℹ') + '</span> ' + message;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toast.classList.add('hidden'); }, 3200);
  }

  // ---------- Text escaping (for user-supplied values) ----------
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // ---------- Theme (persistent, cyberpunk dark default) ----------
  function applyTheme(forceDark) {
    var isDark = forceDark !== undefined ? forceDark : localStorage.getItem('smartedu-theme') !== 'light';
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('smartedu-theme', isDark ? 'dark' : 'light');
  }
  applyTheme();

  function initThemeToggles() {
    $$('.theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var isDark = document.body.classList.toggle('dark');
        localStorage.setItem('smartedu-theme', isDark ? 'dark' : 'light');
        showToast(isDark ? 'Dark mode enabled' : 'Light mode enabled', 'info');
      });
    });
  }

  // ---------- Portal entry ----------
  function enterPortal(role) {
    state.role = role;
    state.loggedIn = false;
    state.currentView = 'login';

    viewLanding.classList.remove('active');
    viewLanding.classList.add('hidden');
    appShell.classList.remove('hidden');

    if (Scene3D) Scene3D.setActive(false);

    window.scrollTo(0, 0);
    renderSidebar();
    showView(state.currentView);
    closeSidebar();
  }

  // ---------- Session persistence ----------
  function saveSession() {
    try {
      sessionStorage.setItem('smartedu-session', JSON.stringify({
        role: state.role,
        user: state.user
      }));
    } catch (e) { /* ignore */ }
  }
  function restoreSession() {
    try {
      return JSON.parse(sessionStorage.getItem('smartedu-session') || 'null');
    } catch (e) { return null; }
  }
  function clearSession() {
    try { sessionStorage.removeItem('smartedu-session'); } catch (e) { /* ignore */ }
  }

  // ---------- Login error UI ----------
  function showLoginError(role, message) {
    var el = $('#' + role + 'LoginError');
    var card = el ? el.closest('.login-card') : null;
    if (el) {
      el.textContent = message;
      el.classList.remove('hidden');
    }
    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
  }
  function hideLoginError(role) {
    var el = $('#' + role + 'LoginError');
    if (el) el.classList.add('hidden');
  }

  function logout() {
    state.role = null;
    state.loggedIn = false;
    state.currentView = null;
    state.user = null;
    clearSession();
    destroyCharts();

    if (Scene3D) Scene3D.setActive(true);

    appShell.classList.add('hidden');
    viewLanding.classList.remove('hidden');
    viewLanding.classList.add('active');
    mainContent.innerHTML = '';
    sidebarNav.innerHTML = '';
    window.scrollTo(0, 0);
  }

  // ---------- Sidebar ----------
  function renderSidebar() {
    var items = navConfigs[state.role] || [];
    sidebarNav.innerHTML = items.map(function (item) {
      return '<button class="nav-item ' + (state.currentView === item.id ? 'active' : '') + '" data-view="' + item.id + '">' +
        '<span class="nav-icon">' + item.icon + '</span>' +
        '<span>' + item.label + '</span>' +
        '</button>';
    }).join('');

    if (!state.loggedIn) {
      sidebarNav.innerHTML = '<div class="nav-lock">Please sign in to access modules</div>';
    }

    $$('.nav-item', sidebarNav).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!state.loggedIn) return;
        showView(btn.dataset.view);
        closeSidebar();
      });
    });

    var titles = { teacher: 'Teacher Portal', student: 'Student Portal', admin: 'Admin Dashboard' };
    if (mobileTitle) mobileTitle.textContent = titles[state.role] || 'SmartEdu';

    var userBox = $('#sidebarUser');
    if (userBox) {
      if (state.loggedIn && state.user) {
        userBox.classList.remove('hidden');
        userBox.innerHTML = '<span class="avatar">' + state.user.name.charAt(0) + '</span>' +
          '<div class="sidebar-user-meta"><strong>' + state.user.name + '</strong>' +
          '<span>' + (state.user.email || '') + '</span></div>';
      } else {
        userBox.classList.add('hidden');
      }
    }
  }

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('open');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
  }

  // ---------- View rendering ----------
  function showView(viewId) {
    if (viewId !== 'login' && !state.loggedIn) {
      viewId = 'login';
    }

    state.currentView = viewId;
    destroyCharts();
    if (viewId !== 'scan') stopCameraScan();

    var tplId = viewTemplates[state.role] && viewTemplates[state.role][viewId];
    if (!tplId) {
      mainContent.innerHTML = '<p class="muted">View not found.</p>';
      return;
    }

    var tpl = document.getElementById(tplId);
    if (!tpl) {
      mainContent.innerHTML = '<p class="muted">Template missing.</p>';
      return;
    }

    mainContent.innerHTML = '';
    mainContent.appendChild(tpl.content.cloneNode(true));
    renderSidebar();
    initViewLogic(viewId);
  }

  function initViewLogic(viewId) {
    if (viewId === 'login') {
      var form = $('#' + state.role + 'LoginForm');
      var emailField = $('#' + state.role + 'LoginEmail');
      var passField = $('#' + state.role + 'LoginPassword');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var email = emailField ? emailField.value.trim().toLowerCase() : '';
          var pass = passField ? passField.value : '';
          var account = state.accounts.filter(function (a) {
            return a.role === state.role && a.email.toLowerCase() === email;
          })[0];

          if (!account) {
            showLoginError(state.role, 'No account found for "' + email + '" in this portal.');
            return;
          }
          if (account.password !== pass) {
            showLoginError(state.role, 'Incorrect password. Please try again.');
            if (passField) {
              passField.select();
              passField.focus();
            }
            return;
          }

          state.loggedIn = true;
          state.user = account;
          saveSession();
          hideLoginError(state.role);
          showToast('Welcome back, ' + account.name.split(' ')[0] + '!');
          showView('dashboard');
        });
      }
    }

    if (viewId === 'dashboard' && state.role === 'teacher') {
      initTeacherMiniChart();
    }

    if (viewId === 'classes') {
      var btn = $('#btnCreateClass');
      var modal = $('#createClassModal');
      var cancel = $('#cancelCreateClass');
      var form2 = $('#createClassForm');
      var editingRow = null;

      function openCreateModal() {
        editingRow = null;
        form2.reset();
        var t = $('#createClassModalTitle');
        var save = $('#saveClassBtn');
        if (t) t.textContent = 'Create New Class';
        if (save) save.textContent = 'Create';
        modal.classList.remove('hidden');
        $('#newClassCode').focus();
      }
      function openEditModal(row) {
        editingRow = row;
        $('#newClassCode').value = row.cells[0].textContent.trim();
        $('#newClassTitle').value = row.cells[1].textContent.trim();
        $('#newClassSchedule').value = row.cells[2].textContent.trim();
        var t = $('#createClassModalTitle');
        var save = $('#saveClassBtn');
        if (t) t.textContent = 'Edit Class';
        if (save) save.textContent = 'Save Changes';
        modal.classList.remove('hidden');
        $('#newClassTitle').focus();
      }

      if (btn && modal) {
        btn.addEventListener('click', openCreateModal);
        if (cancel) cancel.addEventListener('click', function () { modal.classList.add('hidden'); });

        if (form2) form2.addEventListener('submit', function (e) {
          e.preventDefault();
          var code = $('#newClassCode').value.trim();
          var title = $('#newClassTitle').value.trim();
          var sched = $('#newClassSchedule').value.trim();
          if (!code || !title) {
            showToast('Course code and title are required', 'info');
            return;
          }
          code = code.toUpperCase();
          var tbody = $('#classesTable tbody');

          if (editingRow) {
            editingRow.cells[0].textContent = code;
            editingRow.cells[1].textContent = title;
            editingRow.cells[2].textContent = sched || 'TBD';
            modal.classList.add('hidden');
            form2.reset();
            editingRow = null;
            showToast('Class ' + code + ' updated');
            return;
          }

          if (tbody) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + escapeHtml(code) + '</td>' +
              '<td>' + escapeHtml(title) + '</td>' +
              '<td>' + escapeHtml(sched || 'TBD') + '</td>' +
              '<td>0</td>' +
              '<td><span class="badge success">Active</span></td>' +
              '<td><button class="btn-sm btn-edit">Edit</button> <button class="btn-sm btn-delete">Delete</button></td>';
            tbody.prepend(tr);
          }
          modal.classList.add('hidden');
          form2.reset();
          showToast('Class ' + code + ' created successfully');
        });

        var classesBody = $('#classesTable tbody');
        if (classesBody) classesBody.addEventListener('click', function (ev) {
          var target = ev.target.closest('button');
          if (!target) return;
          var row = target.closest('tr');
          if (!row) return;
          if (target.classList.contains('btn-edit')) {
            openEditModal(row);
          } else if (target.classList.contains('btn-delete')) {
            row.remove();
            showToast('Class removed');
          } else if (target.classList.contains('btn-view')) {
            showToast(row.cells[1].textContent + ' · ' + row.cells[0].textContent, 'info');
          }
        });
      }
    }

    if (viewId === 'attendance') {
      startQRCountdown();
      startCheckinSimulation();
      renderQR();
      var refresh = $('#refreshQR');
      if (refresh) refresh.addEventListener('click', function () {
        state.qrSeconds = 30;
        updateQRCountdown();
        renderQR();
        showToast('QR code refreshed — new code generated');
      });
      var endBtn = $('#btnEndSession');
      if (endBtn) endBtn.addEventListener('click', function () {
        state.sessionActive = false;
        clearInterval(checkinInterval);
        showToast('Session ended. Attendance locked.');
        endBtn.disabled = true;
        endBtn.textContent = 'Session Ended';
      });
    }

    if (viewId === 'history') {
      initSortableTable();
      var search = $('#historySearch');
      if (search) search.addEventListener('input', function (e) {
        var q = e.target.value.toLowerCase();
        $$('#historyTable tbody tr').forEach(function (row) {
          row.style.display = row.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none';
        });
      });
      var csv = $('#btnExportHistoryCSV');
      if (csv) csv.addEventListener('click', function () { exportAttendanceCSV('teacher'); });
      var pdf = $('#btnExportHistoryPDF');
      if (pdf) pdf.addEventListener('click', function () { exportAttendancePDF('teacher'); });
    }

    if (viewId === 'scan') {
      renderScanHistory();
      var resBox = $('#scanResult');
      if (resBox) {
        resBox.className = 'scan-result empty';
        resBox.innerHTML = '<p class="muted">No scan performed yet. Use the camera, upload an image, or simulate a scan.</p>';
      }
      var camBtn = $('#btnUseCamera');
      if (camBtn) camBtn.addEventListener('click', startCameraScan);
      var upload = $('#btnUploadQR');
      if (upload) upload.addEventListener('click', function () { $('#qrFileInput').click(); });
      var file = $('#qrFileInput');
      if (file) file.addEventListener('change', function (e) {
        var imgFile = e.target.files && e.target.files[0];
        if (imgFile) decodeImageFile(imgFile);
        file.value = '';
      });
      var sim = $('#btnSimulateScan');
      if (sim) sim.addEventListener('click', function () {
        processQrPayload(makeSessionPayload());
      });
      stopCameraScan();
    }

    if (viewId === 'planner') {
      renderFreePeriodTimeline();
      $$('.activity-item .btn-sm').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.added) return;
          btn.dataset.added = '1';
          btn.textContent = 'Added ✓';
          btn.classList.add('added');
          showToast('Activity added to your planner');
        });
      });
    }

    if (viewId === 'dashboard' && state.role === 'admin') {
      initAdminCharts();
      renderStudentAttendance();
      var attSearch = $('#studentAttSearch');
      if (attSearch) attSearch.addEventListener('input', function (e) {
        renderStudentAttendance(e.target.value);
      });
      var pdf2 = $('#btnExportPDF');
      if (pdf2) pdf2.addEventListener('click', function () { exportAttendancePDF('admin'); });
      var xls = $('#btnExportExcel');
      if (xls) xls.addEventListener('click', function () { exportAttendanceCSV('admin'); });
    }

    // attach burst FX to cards in the newly rendered view
    attachBurstFX();
  }

  // ---------- Export: CSV (Excel-compatible) ----------
  function exportAttendanceCSV(scope) {
    var csv = '';
    var filename = '';

    if (scope === 'admin') {
      filename = 'SmartEdu_Institution_Attendance_Report.csv';
      csv = [
        'Department,Classes,Avg Attendance %,Students,Status',
        'Computer Science,28,91.2,612,Healthy',
        'Electrical Eng.,22,88.7,489,Healthy',
        'Business Admin,19,84.1,534,Watch',
        'Mechanical Eng.,24,90.5,401,Healthy',
        '',
        'Class Code,Attendance %',
        'CS-301,87.5',
        'CS-210,92.3',
        'CS-450,91.7',
        'EE-220,88.1',
        'BA-101,79.4',
        'ME-310,90.5',
        '',
        'Date,Overall Attendance %',
        'Mon,86',
        'Tue,88',
        'Wed,87',
        'Thu,91',
        'Fri,89',
        'Sat,82',
        'Sun,89.4',
        '',
        'Student,Class,Attendance %,Status',
      ].concat(studentAttendanceData.map(function (s) {
        return s.name + ',' + s.cls + ',' + s.pct + ',' + (s.pct >= 90 ? 'Healthy' : s.pct >= 80 ? 'Watch' : 'At Risk');
      })).join('\n');
    } else {
      filename = 'SmartEdu_Class_Attendance_History.csv';
      csv = [
        'Date,Class,Present,Absent,Rate %',
        '2026-08-10,CS-301,42,6,87.5',
        '2026-08-09,CS-210,48,4,92.3',
        '2026-08-08,CS-301,39,9,81.3',
        '2026-08-07,CS-450,33,3,91.7',
        '2026-08-06,CS-210,45,7,86.5',
        '2026-08-05,CS-301,44,4,91.7'
      ].join('\n');
    }

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Excel/CSV report downloaded');
  }

  // ---------- Export: PDF (print-ready report window) ----------
  function exportAttendancePDF(scope) {
    var isAdmin = scope === 'admin';
    var title = isAdmin
      ? 'Institution Attendance Report — SmartEdu'
      : 'Class Attendance History Report — SmartEdu';

    var content = isAdmin
      ? '<h2>Institution Overview</h2>' +
        '<p>Generated: ' + new Date().toLocaleString() + '</p>' +
        '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin:16px 0;">' +
        '<tr style="background:#1E3A8A;color:#fff;"><th>Department</th><th>Classes</th><th>Avg %</th><th>Students</th><th>Status</th></tr>' +
        '<tr><td>Computer Science</td><td>28</td><td>91.2%</td><td>612</td><td>Healthy</td></tr>' +
        '<tr><td>Electrical Eng.</td><td>22</td><td>88.7%</td><td>489</td><td>Healthy</td></tr>' +
        '<tr><td>Business Admin</td><td>19</td><td>84.1%</td><td>534</td><td>Watch</td></tr>' +
        '<tr><td>Mechanical Eng.</td><td>24</td><td>90.5%</td><td>401</td><td>Healthy</td></tr>' +
        '</table>' +
        '<h3>Class-wise Summary</h3>' +
        '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">' +
        '<tr style="background:#1E3A8A;color:#fff;"><th>Class</th><th>Attendance %</th></tr>' +
        '<tr><td>CS-301</td><td>87.5%</td></tr>' +
        '<tr><td>CS-210</td><td>92.3%</td></tr>' +
        '<tr><td>CS-450</td><td>91.7%</td></tr>' +
        '<tr><td>EE-220</td><td>88.1%</td></tr>' +
        '<tr><td>BA-101</td><td>79.4%</td></tr>' +
        '<tr><td>ME-310</td><td>90.5%</td></tr>' +
        '</table>'
      : '<h2>Teacher Attendance History</h2>' +
        '<p>Generated: ' + new Date().toLocaleString() + ' · Instructor: Dr. Sarah Chen</p>' +
        '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin:16px 0;">' +
        '<tr style="background:#1E3A8A;color:#fff;"><th>Date</th><th>Class</th><th>Present</th><th>Absent</th><th>Rate</th></tr>' +
        '<tr><td>Aug 10, 2026</td><td>CS-301</td><td>42</td><td>6</td><td>87.5%</td></tr>' +
        '<tr><td>Aug 9, 2026</td><td>CS-210</td><td>48</td><td>4</td><td>92.3%</td></tr>' +
        '<tr><td>Aug 8, 2026</td><td>CS-301</td><td>39</td><td>9</td><td>81.3%</td></tr>' +
        '<tr><td>Aug 7, 2026</td><td>CS-450</td><td>33</td><td>3</td><td>91.7%</td></tr>' +
        '<tr><td>Aug 6, 2026</td><td>CS-210</td><td>45</td><td>7</td><td>86.5%</td></tr>' +
        '<tr><td>Aug 5, 2026</td><td>CS-301</td><td>44</td><td>4</td><td>91.7%</td></tr>' +
        '</table>';

    var win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { showToast('Popup blocked — allow popups to export', 'info'); return; }
    win.document.write(
      '<!DOCTYPE html><html><head><title>' + title + '</title>' +
      '<style>body{font-family:system-ui,sans-serif;padding:32px;color:#0F172A}h1{color:#1E3A8A;margin-bottom:4px}h2,h3{color:#1E3A8A}.meta{color:#64748B;margin-bottom:24px}table{font-size:14px}tr:nth-child(even){background:#F8FAFC}@media print{body{padding:0}.no-print{display:none}}</style>' +
      '</head><body><h1>📚 SmartEdu</h1><p class="meta">' + title + '</p>' + content +
      '<p class="no-print" style="margin-top:32px;">' +
      '<button onclick="window.print()" style="padding:10px 20px;background:#1E3A8A;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Print / Save as PDF</button> ' +
      '<button onclick="window.close()" style="padding:10px 20px;margin-left:8px;border:1px solid #CBD5E1;border-radius:8px;cursor:pointer;">Close</button>' +
      '</p></body></html>'
    );
    win.document.close();
    showToast('PDF report opened — use Print → Save as PDF');
  }

  // ---------- QR countdown ----------
  var qrInterval = null;
  function startQRCountdown() {
    clearInterval(qrInterval);
    state.qrSeconds = 30;
    updateQRCountdown();
    qrInterval = setInterval(function () {
      if (!state.sessionActive) return;
      state.qrSeconds--;
      if (state.qrSeconds <= 0) {
        state.qrSeconds = 30;
        renderQR();
      }
      updateQRCountdown();
    }, 1000);
  }
  function updateQRCountdown() {
    var el = $('#qrCountdown');
    if (el) el.textContent = state.qrSeconds;
  }

  // ---------- Dynamic QR rendering (scannable, rotates per session) ----------
  function renderQR() {
    var canvas = $('#qrCanvas');
    if (!canvas) return;

    var token = Math.random().toString(36).slice(2, 8).toUpperCase();
    var payload = 'SMARTEDU|CS-301|SESSION-' + (state.sessionActive ? 'LIVE' : 'ENDED') + '|' + token + '|' + Date.now().toString(36);

    var cells = 0;
    var isDark = null;

    if (typeof qrcode !== 'undefined') {
      var qr = qrcode(0, 'M');
      qr.addData(payload);
      qr.make();
      cells = qr.getModuleCount();
      isDark = function (r, c) { return qr.isDark(r, c); };
    } else {
      // Fallback: QR-style pseudo matrix if the library is unavailable
      var pseudo = makeFallbackMatrix(payload);
      cells = pseudo.cells;
      isDark = pseudo.isDark;
    }

    var pad = 4; // quiet zone in modules
    var total = cells + pad * 2;
    var size = 200; // CSS px
    var dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    var m = size / total;
    ctx.fillStyle = '#0F172A';
    for (var row = 0; row < cells; row++) {
      for (var col = 0; col < cells; col++) {
        if (isDark(row, col)) {
          ctx.fillRect((col + pad) * m, (row + pad) * m, m + 0.4, m + 0.4);
        }
      }
    }

    state.qrPayload = payload;
  }

  // Deterministic PRNG so each rotation produces a distinct, stable pattern
  function makeFallbackMatrix(seedText) {
    var seed = 0;
    for (var i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
    var rand = function () {
      seed = (seed + 0x6D2B79F5) >>> 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    var cells = 29;
    var dark = [];
    for (var r = 0; r < cells; r++) {
      dark[r] = [];
      for (var c = 0; c < cells; c++) dark[r][c] = rand() > 0.46;
    }

    var clearFinder = function (fr, fc) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          if (fr + r < 0 || fr + r >= cells || fc + c < 0 || fc + c >= cells) continue;
          dark[fr + r][fc + c] = false;
        }
      }
      for (var rr = 0; rr < 7; rr++) {
        for (var cc = 0; cc < 7; cc++) {
          dark[fr + rr][fc + cc] = (rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr > 1 && rr < 5 && cc > 1 && cc < 5));
        }
      }
    };
    clearFinder(0, 0);
    clearFinder(0, cells - 7);
    clearFinder(cells - 7, 0);

    for (var t = 0; t < cells; t++) {
      dark[6][t] = (t % 2 === 0);
      dark[t][6] = (t % 2 === 0);
    }

    return {
      cells: cells,
      isDark: function (r, c) { return !!dark[r][c]; }
    };
  }

  // ---------- QR scanning (student) ----------
  var classMeta = {
    'CS-301': { name: 'CS-301 Data Structures', room: 'Room 204' },
    'CS-210': { name: 'CS-210 Algorithms', room: 'Lab B' },
    'CS-450': { name: 'CS-450 Machine Learning', room: 'Hall A' },
    'EE-220': { name: 'EE-220 Circuit Analysis', room: 'Lab E' },
    'BA-101': { name: 'BA-101 Business Analytics', room: 'Room 110' },
    'ME-310': { name: 'ME-310 Mechanics', room: 'Hall C' }
  };

  function makeSessionPayload() {
    return 'SMARTEDU|CS-301|SESSION-LIVE|' + Math.random().toString(36).slice(2, 8).toUpperCase() + '|' + Date.now().toString(36);
  }

  function renderScanHistory() {
    var list = $('#scanHistory');
    if (!list || !state.scans.length) return;
    list.innerHTML = state.scans.map(function (s) {
      var day = new Date(s.ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
      return '<li><span class="dot success"></span><div><strong>' + s.name + '</strong>' +
        '<span>' + day + ' · ' + s.time + ' · Present</span></div></li>';
    }).join('');
  }

  function showScanResult(ok, title, room, time) {
    var box = $('#scanResult');
    if (!box) return;
    if (ok) {
      box.className = 'scan-result ok';
      box.innerHTML = '<div class="scan-result-head"><span class="dot success"></span><strong>' + title + '</strong></div>' +
        '<p class="small">' + (room || '') + (time ? ' · ' + time : '') + ' · Status: Present</p>';
    } else {
      box.className = 'scan-result bad';
      box.innerHTML = '<div class="scan-result-head"><span class="dot danger"></span><strong>Scan failed</strong></div>' +
        '<p class="small">' + title + '</p>';
    }
  }

  function processQrPayload(payload) {
    var parts = String(payload || '').split('|');
    if (parts.length < 5 || parts[0] !== 'SMARTEDU' || parts[2] !== 'SESSION-LIVE') {
      showScanResult(false, 'Invalid QR code — not a SmartEdu attendance code.');
      return;
    }
    var ts = parseInt(parts[4], 36);
    if (!ts || Date.now() - ts > 5 * 60 * 1000) {
      showScanResult(false, 'Expired QR code — ask the teacher to refresh it.');
      return;
    }
    var code = parts[1];
    var meta = classMeta[code] || { name: code, room: 'Campus' };
    var scan = {
      code: code,
      name: meta.name,
      room: meta.room,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ts: Date.now()
    };
    state.scans.unshift(scan);
    try { localStorage.setItem('smartedu-scans', JSON.stringify(state.scans.slice(0, 20))); } catch (e) { /* ignore */ }
    renderScanHistory();
    showScanResult(true, meta.name, meta.room, scan.time);
    showToast('Attendance marked for ' + meta.name + ' ✓');
  }

  function decodeImageFile(file) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var w = img.naturalWidth || 1;
      var h = img.naturalHeight || 1;
      var max = 640;
      if (w > max || h > max) {
        var k = Math.min(max / w, max / h);
        w = Math.round(w * k);
        h = Math.round(h * k);
      }
      var cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      var res = (typeof jsQR === 'function') ? jsQR(ctx.getImageData(0, 0, w, h).data, w, h) : null;
      if (res && res.data) {
        processQrPayload(res.data);
      } else {
        showScanResult(false, 'QR code could not be read — use a clearer, well-lit image.');
        showToast('Could not read QR from image', 'info');
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      showToast('Could not load the selected image', 'info');
    };
    img.src = url;
  }

  // ---------- Camera scan (live) ----------
  var cameraStream = null;
  var cameraRaf = 0;
  var scanPending = false;
  var scanCanvas = null;
  var scanCtx = null;

  function startCameraScan() {
    var video = $('#scanCam');
    var inner = $('#cameraFrameInner');
    if (!video || cameraStream) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Camera is not supported in this browser', 'info');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function (stream) {
        cameraStream = stream;
        video.srcObject = stream;
        video.classList.remove('hidden');
        if (inner) inner.classList.add('hidden');
        video.play();
        scanCanvas = document.createElement('canvas');
        scanCtx = scanCanvas.getContext('2d');
        scanPending = true;
        cameraRaf = requestAnimationFrame(scanFrame);
        showToast('Camera active — point at the QR code', 'info');
      })
      .catch(function () {
        showToast('Camera unavailable — use Upload or Simulate instead', 'info');
      });
  }

  function scanFrame() {
    if (!scanPending) return;
    var video = $('#scanCam');
    if (!video || video.readyState < 2) {
      cameraRaf = requestAnimationFrame(scanFrame);
      return;
    }
    if (scanCanvas.width !== video.videoWidth || scanCanvas.height !== video.videoHeight) {
      scanCanvas.width = video.videoWidth;
      scanCanvas.height = video.videoHeight;
    }
    scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
    var res = (typeof jsQR === 'function') ? jsQR(scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height).data, scanCanvas.width, scanCanvas.height) : null;
    if (res && res.data) {
      stopCameraScan(true);
      processQrPayload(res.data);
      return;
    }
    cameraRaf = requestAnimationFrame(scanFrame);
  }

  function stopCameraScan(resetUi) {
    scanPending = false;
    cancelAnimationFrame(cameraRaf);
    cameraRaf = 0;
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) { t.stop(); });
      cameraStream = null;
    }
    if (resetUi) {
      var video = $('#scanCam');
      var inner = $('#cameraFrameInner');
      if (video) {
        video.pause();
        video.classList.add('hidden');
      }
      if (inner) inner.classList.remove('hidden');
    }
  }

  // ---------- Live check-in simulation ----------
  var checkinInterval = null;
  var mockNames = [
    'Sofia Mendes', 'Raj Gupta', 'Elena Volkov', 'Carlos Rivera',
    'Yuki Tanaka', 'Amara Diallo', 'Noah Kim', 'Fatima Al-Hassan'
  ];
  function startCheckinSimulation() {
    clearInterval(checkinInterval);
    state.sessionActive = true;
    checkinInterval = setInterval(function () {
      if (state.currentView !== 'attendance' || !state.sessionActive) {
        clearInterval(checkinInterval);
        return;
      }
      if (state.checkinCount >= 48) return;
      state.checkinCount++;
      var countEl = $('#checkinCount');
      var prog = $('#checkinProgress');
      if (countEl) countEl.textContent = state.checkinCount;
      if (prog) prog.style.width = Math.round((state.checkinCount / 48) * 100) + '%';

      var list = $('#recentCheckins');
      if (list) {
        var name = mockNames[Math.floor(Math.random() * mockNames.length)];
        var li = document.createElement('li');
        li.innerHTML = '<span class="dot success"></span> ' + name + ' · just now';
        list.prepend(li);
        if (list.children.length > 6) list.lastElementChild.remove();
      }
    }, 4500);
  }

  // ---------- Sortable table ----------
  function initSortableTable() {
    var table = $('#historyTable');
    if (!table) return;
    var headers = $$('th[data-sort]', table);
    headers.forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.dataset.sort;
        var tbody = table.querySelector('tbody');
        var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
        var asc = th.dataset.dir !== 'asc';
        headers.forEach(function (h) { h.dataset.dir = ''; });
        th.dataset.dir = asc ? 'asc' : 'desc';

        rows.sort(function (a, b) {
          var va, vb;
          if (key === 'date') { va = a.cells[0].dataset.value; vb = b.cells[0].dataset.value; }
          else if (key === 'class') { va = a.cells[1].textContent; vb = b.cells[1].textContent; }
          else if (key === 'present') { va = +a.cells[2].textContent; vb = +b.cells[2].textContent; }
          else if (key === 'absent') { va = +a.cells[3].textContent; vb = +b.cells[3].textContent; }
          else if (key === 'rate') { va = parseFloat(a.cells[4].textContent); vb = parseFloat(b.cells[4].textContent); }
          if (va < vb) return asc ? -1 : 1;
          if (va > vb) return asc ? 1 : -1;
          return 0;
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    });
  }

  // ---------- Free period timeline ----------
  function renderFreePeriodTimeline() {
    var container = $('#freePeriodTimeline');
    if (!container) return;

    var slots = [
      { time: '09:00 – 10:30', title: 'CS-301 Data Structures', meta: 'Room 204 · Attended', type: 'done' },
      { time: '10:30 – 11:00', title: 'Free Period Detected', meta: 'Suggested: Review notes or short break', type: 'free' },
      { time: '11:00 – 12:30', title: 'CS-210 Algorithms', meta: 'Lab B · In progress', type: 'class' },
      { time: '12:30 – 14:00', title: 'Free Period Detected', meta: 'Suggested: Practice problems · Group study', type: 'free' },
      { time: '14:00 – 15:30', title: 'CS-450 Machine Learning', meta: 'Hall A · Upcoming', type: 'class' },
      { time: '15:30 – 17:00', title: 'Free Period Detected', meta: 'Suggested: ML assignment draft', type: 'free' }
    ];

    container.innerHTML = slots.map(function (s) {
      return '<div class="tl-item ' + s.type + '">' +
        '<div class="tl-time">' + s.time + '</div>' +
        '<div class="tl-title">' + s.title + '</div>' +
        '<div class="tl-meta">' + s.meta + '</div>' +
        '</div>';
    }).join('');
  }

  // ---------- Student attendance percentage (admin analytics) ----------
  var studentAttendanceData = [
    { name: 'Aisha Patel', cls: 'CS-301', pct: 96 },
    { name: 'Marcus Lee', cls: 'CS-301', pct: 92 },
    { name: 'Priya Sharma', cls: 'CS-301', pct: 87 },
    { name: 'James Okonkwo', cls: 'CS-301', pct: 79 },
    { name: 'Sofia Mendes', cls: 'CS-210', pct: 94 },
    { name: 'Raj Gupta', cls: 'CS-210', pct: 90 },
    { name: 'Elena Volkov', cls: 'CS-210', pct: 85 },
    { name: 'Yuki Tanaka', cls: 'CS-450', pct: 88 },
    { name: 'Amara Diallo', cls: 'CS-450', pct: 76 },
    { name: 'Alex Rivera', cls: 'CS-301', pct: 92 }
  ];

  function renderStudentAttendance(filter) {
    var tbody = $('#studentAttendanceTable tbody');
    if (!tbody) return;
    var q = (filter || '').trim().toLowerCase();
    var rows = studentAttendanceData.filter(function (s) {
      return !q || s.name.toLowerCase().indexOf(q) > -1 || s.cls.toLowerCase().indexOf(q) > -1;
    }).map(function (s) {
      var cls = s.pct >= 90 ? 'high' : s.pct >= 80 ? 'mid' : 'low';
      var badge = s.pct >= 90 ? 'success' : s.pct >= 80 ? 'warn' : 'danger';
      var status = s.pct >= 90 ? 'Healthy' : s.pct >= 80 ? 'Watch' : 'At Risk';
      return '<tr>' +
        '<td>' + escapeHtml(s.name) + '</td>' +
        '<td>' + escapeHtml(s.cls) + '</td>' +
        '<td><span class="rate ' + cls + '">' + s.pct + '%</span></td>' +
        '<td><span class="badge ' + badge + '">' + status + '</span></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="4" class="muted center">No matching students</td></tr>';
    tbody.innerHTML = rows;
  }

  // ---------- Chart colors ----------
  var chartColors = {
    primary: '#38bdf8',
    green: '#34d399',
    grid: 'rgba(148,163,184,0.08)',
    ticks: '#94a3b8'
  };

  function destroyCharts() {
    Object.keys(state.charts).forEach(function (k) {
      if (state.charts[k]) state.charts[k].destroy();
    });
    state.charts = {};
  }

  function initTeacherMiniChart() {
    var canvas = $('#teacherMiniChart');
    if (!canvas || typeof Chart === 'undefined') return;

    state.charts.teacherMini = new Chart(canvas, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Attendance %',
          data: [88, 91, 85, 93, 89, 78, 87],
          borderColor: chartColors.primary,
          backgroundColor: 'rgba(56,189,248,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: chartColors.primary
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            min: 70, max: 100,
            ticks: { callback: function (v) { return v + '%'; }, color: chartColors.ticks },
            grid: { color: chartColors.grid }
          },
          x: { ticks: { color: chartColors.ticks }, grid: { display: false } }
        }
      }
    });
  }

  function initAdminCharts() {
    if (typeof Chart === 'undefined') return;
    var lineCanvas = $('#adminLineChart');
    var barCanvas = $('#adminBarChart');

    if (lineCanvas) {
      state.charts.adminLine = new Chart(lineCanvas, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            {
              label: 'Overall %',
              data: [86, 88, 87, 91, 89, 82, 89.4],
              borderColor: chartColors.primary,
              backgroundColor: 'rgba(56,189,248,0.12)',
              fill: true,
              tension: 0.35
            },
            {
              label: 'CS Dept %',
              data: [90, 92, 89, 94, 91, 85, 91.2],
              borderColor: chartColors.green,
              backgroundColor: 'transparent',
              tension: 0.35,
              borderDash: [5, 5]
            }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: chartColors.ticks }, position: 'bottom' } },
          scales: {
            y: {
              min: 75, max: 100,
              ticks: { callback: function (v) { return v + '%'; }, color: chartColors.ticks },
              grid: { color: chartColors.grid }
            },
            x: { ticks: { color: chartColors.ticks }, grid: { display: false } }
          }
        }
      });
    }

    if (barCanvas) {
      state.charts.adminBar = new Chart(barCanvas, {
        type: 'bar',
        data: {
          labels: ['CS-301', 'CS-210', 'CS-450', 'EE-220', 'BA-101', 'ME-310'],
          datasets: [{
            label: 'Attendance %',
            data: [87.5, 92.3, 91.7, 88.1, 79.4, 90.5],
            backgroundColor: ['#38bdf8', '#3b82f6', '#34d399', '#22d3ee', '#fbbf24', '#8b5cf6'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              min: 60, max: 100,
              ticks: { callback: function (v) { return v + '%'; }, color: chartColors.ticks },
              grid: { color: chartColors.grid }
            },
            x: { ticks: { color: chartColors.ticks }, grid: { display: false } }
          }
        }
      });
    }
  }

  // ---------- Particle burst FX (CSS ripple + WebGL burst) ----------
  function spawnRipple(card) {
    var ring = document.createElement('span');
    ring.className = 'ripple';
    card.appendChild(ring);
    setTimeout(function () { ring.remove(); }, 850);
  }

  function attachBurstFX() {
    $$('[data-burst="true"]').forEach(function (card) {
      if (card.dataset.fxBound) return;
      card.dataset.fxBound = '1';
      card.addEventListener('mouseenter', function () {
        var rect = card.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        if (Scene3D) Scene3D.burstAt(cx, cy, card.dataset.color || '#38bdf8');
        spawnRipple(card);
      });
    });
  }

  // ---------- Landing stat count-up ----------
  var fmtNum = function (n) {
    return n >= 1000 ? Math.round(n).toLocaleString('en-US') : (Math.round(n * 10) / 10).toString();
  };
  var statEls = $$('.stat-value[data-count]');
  if ('IntersectionObserver' in window) {
    var statIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        statIO.unobserve(en.target);
        var el = en.target;
        var target = parseFloat(el.dataset.count);
        var t0 = performance.now();
        (function tick(t) {
          var p = Math.min(1, (t - t0) / 1500);
          var v = target * (1 - Math.pow(1 - p, 3));
          el.textContent = fmtNum(v);
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: 0.5 });
    statEls.forEach(function (el) { statIO.observe(el); });
  } else {
    statEls.forEach(function (el) { el.textContent = fmtNum(parseFloat(el.dataset.count)); });
  }

  // ---------- Reveal on scroll ----------
  if ('IntersectionObserver' in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          revealIO.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal]').forEach(function (el) { revealIO.observe(el); });
  } else {
    $$('[data-reveal]').forEach(function (el) { el.classList.add('in'); });
  }

  // ---------- Scroll progress for WebGL engine ----------
  var updateScrollProgress = function () {
    if (!Scene3D) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    Scene3D.setScroll(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
  };
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress, { passive: true });
  updateScrollProgress();

  // ---------- Mouse parallax feed ----------
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) {
      if (!Scene3D) return;
      var nx = (e.clientX / window.innerWidth) * 2 - 1;
      var ny = (e.clientY / window.innerHeight) * 2 - 1;
      Scene3D.setMouse(nx, ny);
    }, { passive: true });
  }

  // ---------- Event wiring ----------
  function init() {
    initThemeToggles();

    var session = restoreSession();
    if (session && session.role && session.user) {
      state.role = session.role;
      state.user = session.user;
      state.loggedIn = true;
      state.currentView = 'dashboard';
      viewLanding.classList.remove('active');
      viewLanding.classList.add('hidden');
      appShell.classList.remove('hidden');
      if (Scene3D) Scene3D.setActive(false);
      window.scrollTo(0, 0);
      renderSidebar();
      showView('dashboard');
      closeSidebar();
    }

    $$('.portal-card, .admin-link').forEach(function (el) {
      el.addEventListener('click', function () {
        var portal = el.dataset.portal;
        if (portal) enterPortal(portal);
      });
    });

    attachBurstFX();

    var logoutBtn = $('#logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    var burger = $('#burgerBtn');
    if (burger) burger.addEventListener('click', openSidebar);
    var sidebarClose = $('#sidebarClose');
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
