import { getStudents, getHistory, getWhatsAppStatus, submitBulkAttendance, getAttendanceReport } from '../api.js';
import { showToast } from '../components/toast.js';
import { renderPageSpinner, setButtonLoading } from '../components/spinner.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const initials = (name) =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusBadge = (status) => {
  if (!status) return `<span class="status-badge pending">🕐 Pending</span>`;
  if (status === 'present') return `<span class="status-badge present">✅ Present</span>`;
  return `<span class="status-badge absent">❌ Absent</span>`;
};

const navbarHTML = (teacher, waStatus) => {
  const waClass = waStatus?.isReady ? 'connected' : waStatus?.hasClient ? 'pending' : 'disconnected';
  const waLabel = waStatus?.isReady ? 'WA Connected' : waStatus?.hasClient ? 'WA Scan QR' : 'WA Offline';
  const avt     = initials(teacher.name);
  const isAdmin = teacher.role === 'admin';

  return `
    <nav class="navbar">
      <div class="navbar-brand">
        <span class="brand-icon">🏫</span>
        <span class="brand-name">EduTrack</span>
      </div>
      <div class="navbar-right">
        <div class="wa-badge ${waClass}" id="wa-status-badge" title="${waStatus?.statusMessage || ''}">
          <span class="wa-dot"></span>
          <span>${waLabel}</span>
        </div>
        ${isAdmin ? '<button class="btn-admin-panel" id="admin-panel-btn">👑 Admin Panel</button>' : ''}
        <button class="btn-manage-students" id="manage-students-btn">👨‍🎓 Manage Students</button>
        <div class="teacher-pill">
          <div class="teacher-avatar">${avt}</div>
          <div class="teacher-info">
            <div class="teacher-name">${teacher.name}</div>
            <div class="teacher-role">${isAdmin ? '👑 Admin' : 'Staff'}</div>
          </div>
        </div>
        <button class="btn-logout" id="logout-btn">Logout</button>
      </div>
    </nav>
  `;
};

// ─── Class Filter ─────────────────────────────────────────────────────────────
const classFilterHTML = (grades, selectedGrade) => {
  const options = grades.map(g => {
    const selected = g === selectedGrade ? 'selected' : '';
    return `<option value="${g}" ${selected}>${g}</option>`;
  }).join('');

  return `
    <div class="class-filter-bar">
      <div class="filter-label">
        <span class="filter-icon">📚</span>
        <span>Select Class:</span>
      </div>
      <select id="class-filter" class="class-filter-select">
        <option value="">— Choose a class —</option>
        ${options}
      </select>
      <div class="filter-summary" id="filter-summary"></div>
    </div>
  `;
};

// ─── Bulk Attendance Row per Student ──────────────────────────────────────────
const bulkStudentRow = (student, index) => {
  const avt = initials(student.name);
  const isMarked = !!student.today_status;
  const defaultStatus = student.today_status || 'present'; // Default to present
  const waSentIcon = student.today_whatsapp_sent ? '📱✅' : '';

  return `
    <div class="bulk-student-row" data-student-id="${student.id}" data-index="${index}" style="animation-delay:${index * 0.03}s">
      <div class="bulk-student-info">
        <div class="bulk-avatar">${avt}</div>
        <div class="bulk-name-wrap">
          <span class="bulk-name">${student.name}</span>
          <span class="bulk-phone">📱 +${student.parent_whatsapp}</span>
        </div>
      </div>
      <div class="bulk-status-toggle" data-student-id="${student.id}">
        <button type="button" class="bulk-toggle present ${defaultStatus === 'present' ? 'active' : ''}" data-val="present">
          ✅ Present
        </button>
        <button type="button" class="bulk-toggle absent ${defaultStatus === 'absent' ? 'active' : ''}" data-val="absent">
          ❌ Absent
        </button>
      </div>
      <div class="bulk-row-status">
        ${isMarked ? `<span class="bulk-already-marked">Updated</span>` : ''}
        <span class="bulk-wa-icon">${waSentIcon}</span>
      </div>
    </div>
  `;
};

// ─── History Table ────────────────────────────────────────────────────────────
const historyTableHTML = (records) => {
  if (!records.length) {
    return `
      <div class="table-wrap">
        <table><tbody>
          <tr class="empty-row"><td colspan="7">📭 No attendance records yet. Start marking attendance above!</td></tr>
        </tbody></table>
      </div>
    `;
  }

  const rows = records.map((r) => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td><strong>${r.student_name}</strong></td>
      <td>${r.student_grade}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.class_taken}">${r.class_taken}</td>
      <td style="font-size:.8rem">${r.whatsapp_sent ? '📱 Sent' : '⚠️ Not sent'}</td>
      <td style="font-size:.8rem;color:var(--text-2)">${r.teacher_name || '—'}</td>
    </tr>
  `).join('');

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Student</th>
            <th>Grade</th>
            <th>Status</th>
            <th>Class Taken</th>
            <th>WhatsApp</th>
            <th>Marked By</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

// ─── WhatsApp QR Modal HTML ──────────────────────────────────────────────────
const qrModalHTML = (qrCode = null) => {
  const qrImage = qrCode 
    ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}" alt="Scan this QR code with WhatsApp" style="display:block; margin:0 auto; width:220px; height:220px; border-radius: 8px; border: 4px solid var(--accent-1);" />`
    : `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:220px; color:var(--text-2);">
        <span class="spinner-sm" style="margin-bottom:15px; border-top-color:var(--accent-1);"></span>
        <span>Initializing WhatsApp...</span>
        <span style="font-size:0.8rem; margin-top:5px;">Please wait a moment.</span>
      </div>
    `;

  return `
    <div class="sm-modal-overlay visible" id="qr-modal-overlay" style="display: flex; align-items: center; justify-content: center; z-index: 10000;">
      <div class="sm-modal sm-modal-sm" style="max-width: 400px; width: 90%; border-radius: 16px; background: var(--bg-2); border: 1px solid var(--border); box-shadow: 0 20px 40px rgba(0,0,0,0.5); overflow: hidden; animation: sm-modal-in 0.3s ease;">
        <div class="sm-modal-header" style="padding: 18px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
          <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-1); display: flex; align-items: center; gap: 8px;">
            <span>📱</span> Connect WhatsApp
          </h3>
          <button class="sm-modal-close" id="qr-modal-close-btn" style="background: none; border: none; font-size: 1.5rem; color: var(--text-2); cursor: pointer; padding: 0; line-height: 1; transition: color 0.2s;">&times;</button>
        </div>
        <div class="sm-modal-body" style="padding: 24px; color: var(--text-1); font-family: inherit;">
          <p style="margin: 0 0 20px 0; font-size: 0.95rem; line-height: 1.5; color: var(--text-2); text-align: center;">
            Scan this QR code with WhatsApp to connect your school account and enable instant notifications.
          </p>
          
          <div style="background: white; padding: 15px; border-radius: 12px; display: block; margin: 0 auto 20px auto; width: fit-content; box-shadow: 0 8px 16px rgba(0,0,0,0.2);">
            ${qrImage}
          </div>

          <div class="qr-instructions" style="background: var(--bg-1); padding: 16px; border-radius: 10px; border: 1px solid var(--border);">
            <h4 style="margin: 0 0 10px 0; font-size: 0.9rem; color: var(--text-1); font-weight: 600;">Instructions:</h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 0.85rem; color: var(--text-2); line-height: 1.6;">
              <li>Open <strong>WhatsApp</strong> on your mobile phone</li>
              <li>Tap <strong>Menu</strong> (Android) or <strong>Settings</strong> (iOS)</li>
              <li>Select <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong></li>
              <li>Point your phone camera to this screen to scan the QR code</li>
            </ol>
          </div>
        </div>
        <div class="sm-modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; background: var(--bg-1);">
          <button type="button" class="sm-btn-cancel" id="qr-modal-cancel-btn" style="padding: 8px 16px; border-radius: 8px; font-weight: 500; cursor: pointer; background: var(--bg-2); border: 1px solid var(--border); color: var(--text-1); transition: all 0.2s;">Close</button>
        </div>
      </div>
    </div>
  `;
};

// ─── Open WhatsApp QR Modal ──────────────────────────────────────────────────
const openWhatsAppQrModal = (navigate, initialQrCode) => {
  const container = document.getElementById('modal-container');
  if (!container) return;

  let currentQr = initialQrCode;
  container.innerHTML = qrModalHTML(currentQr);

  let pollingInterval = null;

  const closeModal = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    const overlay = document.getElementById('qr-modal-overlay');
    if (overlay) overlay.classList.remove('visible');
    container.innerHTML = '';
  };

  // Bind close buttons
  document.getElementById('qr-modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('qr-modal-cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('qr-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'qr-modal-overlay') closeModal();
  });

  // Polling for status updates
  pollingInterval = setInterval(async () => {
    try {
      const waStatus = await getWhatsAppStatus().catch(() => null);
      if (!waStatus) return;

      if (waStatus.isReady) {
        clearInterval(pollingInterval);
        closeModal();
        showToast('🎉 WhatsApp connected successfully!', 'success', 5000);
        renderDashboard(navigate);
      } else if (waStatus.qrCode !== currentQr) {
        currentQr = waStatus.qrCode;
        container.innerHTML = qrModalHTML(currentQr);
        
        // Re-bind events since innerHTML was reset
        document.getElementById('qr-modal-close-btn')?.addEventListener('click', closeModal);
        document.getElementById('qr-modal-cancel-btn')?.addEventListener('click', closeModal);
        document.getElementById('qr-modal-overlay')?.addEventListener('click', (e) => {
          if (e.target.id === 'qr-modal-overlay') closeModal();
        });
      }
    } catch (err) {
      console.error('Error polling WhatsApp status:', err);
    }
  }, 2500);

  // Esc key closes modal
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
};

// ─── State ────────────────────────────────────────────────────────────────────
let currentGradeFilter = '';

// ─── Main render ──────────────────────────────────────────────────────────────
export const renderDashboard = async (navigate) => {
  const app     = document.getElementById('app');
  const teacher = JSON.parse(localStorage.getItem('teacher') || '{}');

  // Loading state
  app.innerHTML = `
    <div class="app-layout">
      ${navbarHTML(teacher, null)}
      <div class="main-content">${renderPageSpinner()}</div>
    </div>
  `;

  // Wire logout immediately
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('teacher');
    showToast('Logged out successfully.', 'info');
    navigate('login');
  });

  // Fetch data in parallel
  let students = [];
  let grades   = [];
  let history  = [];
  let waStatus = null;

  try {
    const gradeParam = currentGradeFilter || undefined;
    [{ students, grades }, { records: history }, waStatus] = await Promise.all([
      getStudents(gradeParam),
      getHistory(),
      getWhatsAppStatus().catch(() => null),
    ]);
  } catch (err) {
    if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
      localStorage.removeItem('token');
      navigate('login');
      return;
    }
    showToast('Failed to load data: ' + err.message, 'error');
  }

  // Show WhatsApp warning if not ready
  if (waStatus && !waStatus.isReady) {
    showToast('⚠️ WhatsApp is not connected. <a href="#" id="toast-qr-link" style="color:#7a6cff; text-decoration:underline; font-weight:bold;">Click here to scan the QR code</a>.', 'warning', 10000);
    setTimeout(() => {
      document.getElementById('toast-qr-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        openWhatsAppQrModal(navigate, waStatus.qrCode);
      });
    }, 100);
  }

  // Count stats
  const markedCount  = students.filter(s => s.today_status).length;
  const pendingCount = students.length - markedCount;
  const hasClassSelected = !!currentGradeFilter;

  // Build the bulk attendance section (only shown when a class is selected)
  const bulkSection = hasClassSelected && students.length > 0 ? `
    <div class="bulk-attendance-section">
      <div class="bulk-header">
        <div class="bulk-header-left">
          <h3>📋 Mark Attendance — ${currentGradeFilter}</h3>
          <p>${students.length} students · Enter subject & homework, then mark each student</p>
        </div>
        <div class="bulk-quick-actions">
          <button type="button" class="bulk-action-btn mark-all-present" id="mark-all-present">
            ✅ All Present
          </button>
          <button type="button" class="bulk-action-btn mark-all-absent" id="mark-all-absent">
            ❌ All Absent
          </button>
        </div>
      </div>

      <div class="bulk-form-fields">
        <div class="grid-2">
          <div class="form-group">
            <label for="bulk-class-taken">📚 Subject / Class Taken Today</label>
            <input
              id="bulk-class-taken"
              type="text"
              placeholder="e.g. Chapter 5 – Photosynthesis"
              maxlength="200"
              required
            />
          </div>
          <div class="form-group">
            <label for="bulk-homework">📝 Homework to Submit</label>
            <input
              id="bulk-homework"
              type="text"
              placeholder="e.g. Exercise 5.2, Q 1–10"
              maxlength="300"
              required
            />
          </div>
        </div>
      </div>

      <div class="bulk-students-list" id="bulk-students-list">
        ${students.map((s, i) => bulkStudentRow(s, i)).join('')}
      </div>

      <div class="bulk-submit-bar">
        <div class="bulk-submit-summary" id="bulk-submit-summary">
          <span class="summary-present">✅ <strong id="present-count">${students.length}</strong> Present</span>
          <span class="summary-absent">❌ <strong id="absent-count">0</strong> Absent</span>
        </div>
        <button class="btn-submit bulk-submit-btn" id="bulk-submit-btn" type="button">
          📤 Submit All & Send WhatsApp
        </button>
      </div>

      <div id="bulk-result" style="display:none;"></div>
    </div>
  ` : '';

  const noClassMessage = !hasClassSelected ? `
    <div class="select-class-prompt">
      <div class="prompt-icon">👆</div>
      <h3>Select a Class to Begin</h3>
      <p>Choose a class from the dropdown above to mark attendance for all students at once.</p>
    </div>
  ` : '';

  const noStudentsMessage = hasClassSelected && students.length === 0 ? `
    <div class="select-class-prompt">
      <div class="prompt-icon">📭</div>
      <h3>No Students Found</h3>
      <p>There are no students in <strong>${currentGradeFilter}</strong>.</p>
    </div>
  ` : '';

  // Render full dashboard
  app.innerHTML = `
    <div class="app-layout">
      ${navbarHTML(teacher, waStatus)}
      <div class="main-content">

        <div class="page-header">
          <div>
            <h2>Class Attendance</h2>
            <p>Select a class, mark attendance for all students, and send WhatsApp notifications in one click</p>
          </div>
          <div class="header-badges">
            ${hasClassSelected ? `
              <span class="student-count-badge">👨‍🎓 ${students.length} Student${students.length !== 1 ? 's' : ''}</span>
              <span class="student-count-badge marked">✅ ${markedCount} Marked</span>
              <span class="student-count-badge pending-badge">🕐 ${pendingCount} Pending</span>
            ` : ''}
          </div>
        </div>

        ${classFilterHTML(grades, currentGradeFilter)}

        ${noClassMessage}
        ${noStudentsMessage}
        ${bulkSection}

        <div class="section-title" style="margin-top:40px;">
          <span class="section-icon">📋</span>
          Recent Attendance History
        </div>
        ${historyTableHTML(history)}

        <div class="download-attendance-section">
          <div class="download-header">
            <div class="download-header-left">
              <span class="section-icon">📥</span>
              <div>
                <h3>Download Attendance Report</h3>
                <p>Select a date range to download the attendance sheet as PDF</p>
              </div>
            </div>
          </div>

          <div class="download-controls">
            <div class="download-dates">
              <div class="form-group">
                <label for="report-from">📅 From Date</label>
                <input id="report-from" type="date" class="date-input" />
              </div>
              <div class="form-group">
                <label for="report-to">📅 To Date</label>
                <input id="report-to" type="date" class="date-input" />
              </div>
            </div>

            <div class="download-presets">
              <button type="button" class="preset-btn" id="preset-this-week">📅 This Week</button>
              <button type="button" class="preset-btn" id="preset-last-week">📅 Last Week</button>
              <button type="button" class="preset-btn" id="preset-this-month">📅 This Month</button>
              <button type="button" class="preset-btn" id="preset-last-month">📅 Last Month</button>
            </div>

            <button class="btn-download-pdf" id="download-pdf-btn" type="button">
              📥 Download PDF
            </button>
          </div>
        </div>

      </div>
      <div id="modal-container"></div>
    </div>
  `;

  // ─── Wire events ────────────────────────────────────────────────────────────

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('teacher');
    showToast('Logged out successfully.', 'info');
    navigate('login');
  });

  // Manage Students
  document.getElementById('manage-students-btn')?.addEventListener('click', () => {
    navigate('students');
  });

  // Admin Panel (admin only)
  document.getElementById('admin-panel-btn')?.addEventListener('click', () => {
    navigate('admin');
  });

  // Class filter dropdown
  document.getElementById('class-filter')?.addEventListener('change', (e) => {
    currentGradeFilter = e.target.value;
    renderDashboard(navigate); // re-render with new filter
  });

  // WA badge click
  document.getElementById('wa-status-badge')?.addEventListener('click', () => {
    if (waStatus?.isReady) {
      showToast(waStatus?.statusMessage || 'WhatsApp is connected and running.', 'success');
    } else {
      openWhatsAppQrModal(navigate, waStatus?.qrCode);
    }
  });
  // ─── Bulk attendance wiring (only if class selected) ───────────────────────
  if (hasClassSelected && students.length > 0) {

    // Track statuses: default all to present
    const statuses = {};
    students.forEach(s => {
      statuses[s.id] = s.today_status || 'present';
    });

    const updateCounts = () => {
      const presentCount = Object.values(statuses).filter(s => s === 'present').length;
      const absentCount  = Object.values(statuses).filter(s => s === 'absent').length;
      const el1 = document.getElementById('present-count');
      const el2 = document.getElementById('absent-count');
      if (el1) el1.textContent = presentCount;
      if (el2) el2.textContent = absentCount;
    };

    // Per-student toggle click
    document.getElementById('bulk-students-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.bulk-toggle');
      if (!btn) return;
      const row = btn.closest('.bulk-status-toggle');
      const studentId = row.dataset.studentId;
      const val = btn.dataset.val;

      statuses[studentId] = val;

      // Update active state for this row
      row.querySelectorAll('.bulk-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      updateCounts();
    });

    // Mark all present
    document.getElementById('mark-all-present')?.addEventListener('click', () => {
      Object.keys(statuses).forEach(id => statuses[id] = 'present');
      document.querySelectorAll('.bulk-toggle.present').forEach(b => b.classList.add('active'));
      document.querySelectorAll('.bulk-toggle.absent').forEach(b => b.classList.remove('active'));
      updateCounts();
      showToast('All students marked as Present ✅', 'success', 2000);
    });

    // Mark all absent
    document.getElementById('mark-all-absent')?.addEventListener('click', () => {
      Object.keys(statuses).forEach(id => statuses[id] = 'absent');
      document.querySelectorAll('.bulk-toggle.absent').forEach(b => b.classList.add('active'));
      document.querySelectorAll('.bulk-toggle.present').forEach(b => b.classList.remove('active'));
      updateCounts();
      showToast('All students marked as Absent ❌', 'info', 2000);
    });

    // Submit bulk
    document.getElementById('bulk-submit-btn')?.addEventListener('click', async () => {
      const classTaken = document.getElementById('bulk-class-taken')?.value.trim();
      const homework   = document.getElementById('bulk-homework')?.value.trim();

      if (!classTaken || classTaken.length < 2) {
        showToast('Please enter the subject / class taken today.', 'warning');
        document.getElementById('bulk-class-taken')?.focus();
        return;
      }
      if (!homework || homework.length < 2) {
        showToast('Please enter homework details.', 'warning');
        document.getElementById('bulk-homework')?.focus();
        return;
      }

      const records = Object.entries(statuses).map(([student_id, status]) => ({
        student_id: parseInt(student_id),
        status,
      }));

      const submitBtn = document.getElementById('bulk-submit-btn');
      const restore   = setButtonLoading(submitBtn, 'Submitting & Sending WhatsApp...');
      const resultBox = document.getElementById('bulk-result');
      resultBox.style.display = 'none';

      try {
        const result = await submitBulkAttendance({
          records,
          class_taken: classTaken,
          homework,
        });

        const isFullSuccess = result.whatsapp_failed === 0;
        const resultClass   = isFullSuccess ? 'success' : 'warning';

        // Build per-student result rows
        const detailRows = result.results.map(r => `
          <div class="bulk-result-row ${r.whatsapp_sent ? 'sent' : 'failed'}">
            <span class="bulk-result-name">${r.student_name}</span>
            <span class="bulk-result-status">${r.status === 'present' ? '✅' : '❌'}</span>
            <span class="bulk-result-wa">${r.whatsapp_sent ? '📱 Sent' : '⚠️ Failed'}</span>
          </div>
        `).join('');

        resultBox.innerHTML = `
          <div class="submit-result ${resultClass}">
            <span class="result-icon">${isFullSuccess ? '🎉' : '⚠️'}</span>
            <div class="result-msg">
              <strong>${result.feedback}</strong>
              <div class="bulk-result-details">${detailRows}</div>
            </div>
          </div>
        `;
        resultBox.style.display = 'block';
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

        showToast(result.feedback, isFullSuccess ? 'success' : 'warning', 6000);

        // Refresh dashboard after 5 seconds
        setTimeout(() => renderDashboard(navigate), 5000);
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
        resultBox.innerHTML = `
          <div class="submit-result error">
            <span class="result-icon">❌</span>
            <div class="result-msg">
              <strong>Submission failed</strong>
              <span>${err.message}</span>
            </div>
          </div>
        `;
        resultBox.style.display = 'block';
      } finally {
        restore();
      }
    });
  }

  // ─── Download Attendance PDF ─────────────────────────────────────────────────

  // Set default date range to this week
  const setThisWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const fromEl = document.getElementById('report-from');
    const toEl   = document.getElementById('report-to');
    if (fromEl) fromEl.value = monday.toISOString().split('T')[0];
    if (toEl)   toEl.value   = now.toISOString().split('T')[0];
  };
  setThisWeek(); // default

  document.getElementById('preset-this-week')?.addEventListener('click', setThisWeek);

  document.getElementById('preset-last-week')?.addEventListener('click', () => {
    const now = new Date();
    const day = now.getDay();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    document.getElementById('report-from').value = lastMonday.toISOString().split('T')[0];
    document.getElementById('report-to').value   = lastSunday.toISOString().split('T')[0];
  });

  document.getElementById('preset-this-month')?.addEventListener('click', () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('report-from').value = firstDay.toISOString().split('T')[0];
    document.getElementById('report-to').value   = now.toISOString().split('T')[0];
  });

  document.getElementById('preset-last-month')?.addEventListener('click', () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth(), 0);
    document.getElementById('report-from').value = firstDay.toISOString().split('T')[0];
    document.getElementById('report-to').value   = lastDay.toISOString().split('T')[0];
  });

  document.getElementById('download-pdf-btn')?.addEventListener('click', async () => {
    const from = document.getElementById('report-from')?.value;
    const to   = document.getElementById('report-to')?.value;

    if (!from || !to) {
      showToast('Please select both From and To dates.', 'warning');
      return;
    }
    if (from > to) {
      showToast('From date must be before To date.', 'warning');
      return;
    }

    const btn = document.getElementById('download-pdf-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-sm"></span> Generating PDF...';
    btn.disabled = true;

    try {
      const data = await getAttendanceReport(from, to, currentGradeFilter || undefined);

      if (!data.report || data.report.length === 0) {
        showToast('No attendance data found for the selected date range.', 'warning');
        return;
      }

      generateAttendancePDF(data, from, to, teacher);
      showToast(`✅ PDF downloaded! ${data.total_students} students, ${data.working_days} working days.`, 'success');
    } catch (err) {
      showToast('Failed to generate report: ' + err.message, 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
};
// ─── PDF Generation ───────────────────────────────────────────────────────────
const generateAttendancePDF = (data, from, to, teacher) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('portrait', 'mm', 'a4');

  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header
  doc.setFillColor(7, 7, 26);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(122, 108, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('EduTrack', 14, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Attendance Report', 14, 28);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated by ${teacher.name || 'Staff'} on ${new Date().toLocaleDateString('en-IN')}`, 14, 35);

  // ── Date range info
  const fromFormatted = new Date(from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const toFormatted   = new Date(to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  doc.setTextColor(122, 108, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Period: ${fromFormatted}  —  ${toFormatted}`, pageWidth - 14, 18, { align: 'right' });

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Working Days: ${data.working_days}  |  Students: ${data.total_students}`, pageWidth - 14, 26, { align: 'right' });

  if (data.grade_filter && data.grade_filter !== 'All') {
    doc.text(`Class: ${data.grade_filter}`, pageWidth - 14, 33, { align: 'right' });
  }

  // ── Table
  const tableData = data.report.map(r => [
    r.sno,
    r.name,
    r.grade,
    r.working_days,
    r.present,
    `${r.percentage}%`,
  ]);

  doc.autoTable({
    startY: 48,
    head: [['S.No', 'Student Name', 'Class & Board', 'Working Days', 'Present', 'Percentage']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [122, 108, 255],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'left', cellWidth: 52 },
      2: { halign: 'center', cellWidth: 32 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 26 },
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    didParseCell: function(hookData) {
      // Color-code percentage column
      if (hookData.section === 'body' && hookData.column.index === 5) {
        const pct = parseInt(hookData.cell.raw);
        if (pct >= 90) {
          hookData.cell.styles.textColor = [22, 163, 74];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (pct >= 75) {
          hookData.cell.styles.textColor = [202, 138, 4];
          hookData.cell.styles.fontStyle = 'bold';
        } else {
          hookData.cell.styles.textColor = [220, 38, 38];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer on each page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`EduTrack Attendance Report  •  ${fromFormatted} to ${toFormatted}`, 14, pageH - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageH - 8, { align: 'right' });
  }

  // ── Download
  const gradeSlug = data.grade_filter && data.grade_filter !== 'All'
    ? `_${data.grade_filter.replace(/\s+/g, '-')}`
    : '';
  const filename = `EduTrack_Attendance${gradeSlug}_${from}_to_${to}.pdf`;
  doc.save(filename);
};

  // ── Tab switching
  document.getElementById('wa-tab-qr')?.addEventListener('click', () => {
    activeTab = 'qr';
    document.getElementById('wa-tab-qr').classList.add('active');
    document.getElementById('wa-tab-phone').classList.remove('active');
  });

  document.getElementById('wa-tab-phone')?.addEventListener('click', () => {
    activeTab = 'phone';
    document.getElementById('wa-tab-phone').classList.add('active');
    document.getElementById('wa-tab-qr').classList.remove('active');
  });
