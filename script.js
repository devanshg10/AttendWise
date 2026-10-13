/**
 * AttendWise — Smart Attendance & Bunk Calculator
 * Fully functional, client-side, zero-backend architecture.
 * Features:
 * - Real-time Bunk Calculation (mathematically validated)
 * - Safe bunk allowance & Required consecutive recovery count
 * - Subject CRUD & Manual Adjustments
 * - Live dynamic Chart.js integration
 * - localStorage persistence & Full JSON import/export
 * - Search, Filter, Sort, Theme Toggle, Activity Audit Log
 */

(function () {
  'use strict';

  // ==========================================
  // 1. STATE & CONSTANTS
  // ==========================================
  const STORAGE_KEYS = {
    SUBJECTS: 'attendwise_subjects_v1',
    SETTINGS: 'attendwise_settings_v1',
    ACTIVITY: 'attendwise_activity_v1',
    THEME: 'attendwise_theme_v1'
  };

  const DEFAULT_SETTINGS = {
    globalTarget: 75,
    riskThreshold: 5 // Warning if within 5% above target
  };

  const SAMPLE_SUBJECTS = [
    {
      id: 'sub-1',
      name: 'Data Structures & Algorithms',
      teacher: 'Prof. Alan Turing',
      attended: 26,
      total: 30,
      target: 75,
      createdAt: Date.now() - 86400000 * 15
    },
    {
      id: 'sub-2',
      name: 'Computer Networks',
      teacher: 'Dr. Vint Cerf',
      attended: 17,
      total: 24,
      target: 75,
      createdAt: Date.now() - 86400000 * 12
    },
    {
      id: 'sub-3',
      name: 'Database Management Systems',
      teacher: 'Prof. Edgar Codd',
      attended: 14,
      total: 20,
      target: 80,
      createdAt: Date.now() - 86400000 * 10
    },
    {
      id: 'sub-4',
      name: 'Operating Systems',
      teacher: 'Dr. Ken Thompson',
      attended: 11,
      total: 18,
      target: 75,
      createdAt: Date.now() - 86400000 * 8
    },
    {
      id: 'sub-5',
      name: 'Artificial Intelligence',
      teacher: 'Dr. Marvin Minsky',
      attended: 22,
      total: 25,
      target: 75,
      createdAt: Date.now() - 86400000 * 5
    }
  ];

  // App State
  let appState = {
    subjects: [],
    settings: { ...DEFAULT_SETTINGS },
    activities: [],
    currentTheme: 'light',
    activeView: 'dashboard',
    searchQuery: '',
    statusFilter: 'all',
    sortBy: 'name_asc',
    chartInstance: null
  };

  // ==========================================
  // 2. MATHEMATICAL CORE ENGINE
  // ==========================================
  /**
   * Calculates attendance percentages, permissible absences, and recovery requirements.
   *
   * @param {number} attended - Number of classes attended (A)
   * @param {number} total - Total classes conducted (T)
   * @param {number} targetPercent - Required target attendance % (e.g. 75)
   * @returns {Object} Comprehensive calculation result
   */
  function calculateBunkStats(attended, total, targetPercent) {
    const A = Math.max(0, parseInt(attended, 10) || 0);
    const T = Math.max(0, parseInt(total, 10) || 0);
    const P_target = Math.min(99.9, Math.max(1, parseFloat(targetPercent) || 75));
    const P = P_target / 100; // As decimal (0.75)

    // Current Percentage
    const currentPercentage = T === 0 ? 100.0 : (A / T) * 100;
    const roundedPercentage = Math.round(currentPercentage * 10) / 10;

    // Permissible Bunks:
    // How many additional missed classes can student afford while (A / (T + x)) >= P ?
    // A / (T + x) >= P  =>  T + x <= A / P  =>  x <= (A / P) - T
    // Formula: floor(A/P - T), nonnegative if current >= target
    let permissibleBunks = 0;
    if (T === 0) {
      permissibleBunks = 0;
    } else {
      const rawBunk = Math.floor((A / P) - T);
      permissibleBunks = Math.max(0, rawBunk);
    }

    // Required Consecutive Classes to reach target:
    // Smallest non-negative integer x such that (A + x) / (T + x) >= P
    // (A + x) >= P*(T + x) => A + x >= P*T + P*x => x*(1 - P) >= P*T - A
    // x >= (P*T - A) / (1 - P)
    // Formula: ceil((P*T - A) / (1 - P))
    let requiredClasses = 0;
    let isPossible = true;

    if (P >= 1) {
      // Reaching 100% is only possible if student hasn't missed any classes (A == T)
      if (A < T) {
        isPossible = false;
        requiredClasses = Infinity;
      } else {
        requiredClasses = 0;
      }
    } else if (T === 0 || currentPercentage >= P_target) {
      requiredClasses = 0;
    } else {
      const needed = Math.ceil(((P * T) - A) / (1 - P));
      requiredClasses = Math.max(0, needed);
    }

    // Status Determination: Safe, Warning (At Risk), Critical (Below Target)
    let status = 'safe';
    let statusText = 'Safe';
    const riskThreshold = appState.settings.riskThreshold || 5;

    if (T === 0) {
      status = 'safe';
      statusText = 'On Track';
    } else if (currentPercentage < P_target) {
      status = 'critical';
      statusText = 'Below Target';
    } else if (currentPercentage <= P_target + riskThreshold) {
      status = 'warning';
      statusText = 'At Risk';
    } else {
      status = 'safe';
      statusText = 'Safe';
    }

    // Human Explanation String
    let explanation = '';
    if (T === 0) {
      explanation = 'No classes held yet. You are fully on track.';
    } else if (currentPercentage >= P_target) {
      if (permissibleBunks > 0) {
        explanation = `You can safely miss the next ${permissibleBunks} class${permissibleBunks === 1 ? '' : 'es'} without dropping below ${P_target}%.`;
      } else {
        explanation = `You are exactly at the borderline. You cannot miss any upcoming classes.`;
      }
    } else {
      if (!isPossible) {
        explanation = `Mathematically impossible to achieve ${P_target}% attendance because classes were already missed.`;
      } else {
        explanation = `You must attend the next ${requiredClasses} consecutive class${requiredClasses === 1 ? '' : 'es'} to recover to ${P_target}%.`;
      }
    }

    return {
      attended: A,
      total: T,
      missed: Math.max(0, T - A),
      targetPercent: P_target,
      currentPercentage: roundedPercentage,
      permissibleBunks,
      requiredClasses,
      isPossible,
      status,
      statusText,
      explanation
    };
  }

  // ==========================================
  // 3. PERSISTENCE & STORAGE HELPERS
  // ==========================================
  function loadFromStorage() {
    try {
      const savedSubjects = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      if (savedSubjects) {
        appState.subjects = JSON.parse(savedSubjects);
      } else {
        // First launch: load sample subjects
        appState.subjects = [...SAMPLE_SUBJECTS];
        saveSubjects();
      }

      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        appState.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }

      const savedActivities = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
      if (savedActivities) {
        appState.activities = JSON.parse(savedActivities);
      } else {
        appState.activities = [
          {
            id: 'act-init',
            title: 'Welcome to AttendWise',
            desc: 'System initialized with demo subject records.',
            type: 'info',
            timestamp: Date.now()
          }
        ];
        saveActivities();
      }

      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (savedTheme) {
        appState.currentTheme = savedTheme;
      }
    } catch (e) {
      console.error('Storage parse error, resetting state:', e);
      appState.subjects = [...SAMPLE_SUBJECTS];
      appState.settings = { ...DEFAULT_SETTINGS };
      appState.activities = [];
    }
  }

  function saveSubjects() {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(appState.subjects));
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(appState.settings));
  }

  function saveActivities() {
    // Keep max 60 activities
    if (appState.activities.length > 60) {
      appState.activities = appState.activities.slice(0, 60);
    }
    localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(appState.activities));
  }

  function logActivity(title, desc, type = 'info') {
    const activity = {
      id: 'act-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title,
      desc,
      type,
      timestamp: Date.now()
    };
    appState.activities.unshift(activity);
    saveActivities();
  }

  // ==========================================
  // 4. UI NOTIFICATIONS & MODALS
  // ==========================================
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'check-circle';
    if (type === 'danger') iconName = 'alert-octagon';
    if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    refreshIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        toast.remove();
      }, 250);
    }, 3200);
  }

  let activeConfirmCallback = null;
  function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    activeConfirmCallback = onConfirm;
    modal.classList.add('open');
  }

  function hideConfirmModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('open');
    activeConfirmCallback = null;
  }

  // ==========================================
  // 5. SUBJECT CRUD & ACTIONS
  // ==========================================
  function addSubject(name, teacher, attended, total, target) {
    const newSubject = {
      id: 'sub-' + Date.now(),
      name: name.trim(),
      teacher: teacher.trim(),
      attended: parseInt(attended, 10),
      total: parseInt(total, 10),
      target: parseFloat(target),
      createdAt: Date.now()
    };
    appState.subjects.unshift(newSubject);
    saveSubjects();
    logActivity('Subject Added', `Created "${newSubject.name}" with initial attendance ${newSubject.attended}/${newSubject.total}`, 'info');
    showToast(`Added ${newSubject.name} successfully!`, 'success');
    renderAllViews();
  }

  function updateSubject(id, name, teacher, attended, total, target) {
    const idx = appState.subjects.findIndex(s => s.id === id);
    if (idx === -1) return;

    appState.subjects[idx] = {
      ...appState.subjects[idx],
      name: name.trim(),
      teacher: teacher.trim(),
      attended: parseInt(attended, 10),
      total: parseInt(total, 10),
      target: parseFloat(target)
    };
    saveSubjects();
    logActivity('Subject Updated', `Updated details for "${name}"`, 'info');
    showToast(`Updated ${name}!`, 'success');
    renderAllViews();
  }

  function deleteSubject(id) {
    const subject = appState.subjects.find(s => s.id === id);
    if (!subject) return;

    showConfirmModal(
      'Delete Subject',
      `Are you sure you want to delete "${subject.name}"? All associated attendance history will be permanently removed.`,
      () => {
        appState.subjects = appState.subjects.filter(s => s.id !== id);
        saveSubjects();
        logActivity('Subject Deleted', `Removed "${subject.name}" from tracker.`, 'warning');
        showToast(`Deleted ${subject.name}.`, 'danger');
        renderAllViews();
      }
    );
  }

  function markAttendance(subjectId, statusType) {
    const sub = appState.subjects.find(s => s.id === subjectId);
    if (!sub) return;

    if (statusType === 'attended') {
      sub.attended += 1;
      sub.total += 1;
      logActivity('Class Attended', `Marked attendance in ${sub.name} (${sub.attended}/${sub.total})`, 'attended');
      showToast(`Attended class recorded for ${sub.name}`, 'success');
    } else if (statusType === 'missed') {
      sub.total += 1;
      logActivity('Class Missed', `Marked absence in ${sub.name} (${sub.attended}/${sub.total})`, 'missed');
      showToast(`Absence recorded for ${sub.name}`, 'warning');
    }

    saveSubjects();
    renderAllViews();
  }

  function updateManualTotals(id, attended, total) {
    const sub = appState.subjects.find(s => s.id === id);
    if (!sub) return;

    const A = parseInt(attended, 10);
    const T = parseInt(total, 10);

    if (isNaN(A) || isNaN(T) || A < 0 || T < 0) {
      showToast('Please provide valid positive integers.', 'danger');
      return;
    }
    if (A > T) {
      showToast('Attended classes cannot exceed total classes.', 'danger');
      return;
    }

    const prevA = sub.attended;
    const prevT = sub.total;
    sub.attended = A;
    sub.total = T;

    saveSubjects();
    logActivity('Manual Adjustment', `Adjusted ${sub.name} from ${prevA}/${prevT} to ${A}/${T}`, 'info');
    showToast(`Attendance adjusted for ${sub.name}`, 'success');
    renderAllViews();
  }

  // ==========================================
  // 6. RENDER LOGIC
  // ==========================================
  function renderAllViews() {
    updateThemeUI();
    renderKPIs();
    renderChart();
    renderDashboardSubjectCards();
    renderBunkSummaryList();
    renderSubjectsManagementView();
    renderCalculatorMatrix();
    populateSimulatorDropdown();
    renderActivityTimeline();
    updateSidebarInfo();
    refreshIcons();
  }

  // Navigation Badge and quick profile in sidebar
  function updateSidebarInfo() {
    const countBadge = document.getElementById('navSubjectCount');
    if (countBadge) countBadge.textContent = appState.subjects.length;

    const targetVal = document.getElementById('sidebarTargetValue');
    if (targetVal) targetVal.textContent = `${appState.settings.globalTarget}%`;

    const slider = document.getElementById('globalTargetRange');
    if (slider) slider.value = appState.settings.globalTarget;

    // Sidebar status
    let totalAttended = 0;
    let totalHeld = 0;
    appState.subjects.forEach(s => {
      totalAttended += s.attended;
      totalHeld += s.total;
    });

    const overallPct = totalHeld === 0 ? 100 : (totalAttended / totalHeld) * 100;
    const statusTextEl = document.getElementById('sidebarOverallStatus');
    if (statusTextEl) {
      if (appState.subjects.length === 0) {
        statusTextEl.textContent = 'No Subjects';
      } else if (overallPct >= appState.settings.globalTarget) {
        statusTextEl.textContent = `${overallPct.toFixed(1)}% (Healthy)`;
      } else {
        statusTextEl.textContent = `${overallPct.toFixed(1)}% (Deficit)`;
      }
    }
  }

  // View A: Dashboard Overview KPIs
  function renderKPIs() {
    let totalAttended = 0;
    let totalClasses = 0;
    let countSafe = 0;
    let countWarning = 0;
    let countCritical = 0;

    appState.subjects.forEach(sub => {
      totalAttended += sub.attended;
      totalClasses += sub.total;
      const stats = calculateBunkStats(sub.attended, sub.total, sub.target || appState.settings.globalTarget);
      if (stats.status === 'safe') countSafe++;
      if (stats.status === 'warning') countWarning++;
      if (stats.status === 'critical') countCritical++;
    });

    const missedClasses = Math.max(0, totalClasses - totalAttended);
    const overallPct = totalClasses === 0 ? (appState.subjects.length > 0 ? 100 : 0) : (totalAttended / totalClasses) * 100;
    const roundedOverall = Math.round(overallPct * 10) / 10;

    // Overall attendance card
    const pctEl = document.getElementById('kpiOverallPercentage');
    const badgeEl = document.getElementById('kpiOverallBadge');
    const barEl = document.getElementById('kpiOverallBar');
    const footnoteEl = document.getElementById('kpiTargetFootnote');

    if (pctEl) pctEl.textContent = `${roundedOverall.toFixed(1)}%`;
    if (barEl) barEl.style.width = `${Math.min(100, roundedOverall)}%`;
    if (footnoteEl) footnoteEl.textContent = `Target: ${appState.settings.globalTarget}%`;

    if (badgeEl) {
      badgeEl.className = 'stat-badge';
      if (appState.subjects.length === 0) {
        badgeEl.textContent = 'No Data';
      } else if (roundedOverall >= appState.settings.globalTarget) {
        badgeEl.textContent = 'On Track';
        badgeEl.classList.add('safe');
      } else if (roundedOverall >= appState.settings.globalTarget - (appState.settings.riskThreshold || 5)) {
        badgeEl.textContent = 'At Risk';
        badgeEl.classList.add('warning');
      } else {
        badgeEl.textContent = 'Deficit';
        badgeEl.classList.add('critical');
      }
    }

    // Attended card
    document.getElementById('kpiAttendedClasses').textContent = totalAttended;
    document.getElementById('kpiAttendedSubtext').textContent = `out of ${totalClasses} held`;
    const attendedPct = totalClasses === 0 ? 0 : (totalAttended / totalClasses) * 100;
    document.getElementById('kpiAttendedBar').style.width = `${Math.min(100, attendedPct)}%`;

    // Missed card
    document.getElementById('kpiMissedClasses').textContent = missedClasses;
    const missedPct = totalClasses === 0 ? 0 : (missedClasses / totalClasses) * 100;
    document.getElementById('kpiMissedBar').style.width = `${Math.min(100, missedPct)}%`;

    // Health Card
    document.getElementById('kpiCriticalCount').textContent = countCritical;
    document.getElementById('pillSafeCount').textContent = `${countSafe} Safe`;
    document.getElementById('pillWarningCount').textContent = `${countWarning} Warning`;
    document.getElementById('pillCriticalCount').textContent = `${countCritical} Below`;
    document.getElementById('kpiTotalSubjectsCount').textContent = `Total ${appState.subjects.length} subjects`;

    // Critical Alert Banner
    const alertBox = document.getElementById('criticalAlertBox');
    const alertMsg = document.getElementById('criticalAlertMessage');
    if (countCritical > 0) {
      alertBox.classList.remove('d-none');
      alertMsg.textContent = `You have ${countCritical} subject${countCritical === 1 ? '' : 's'} falling below requirement. Immediate class attendance needed.`;
    } else {
      alertBox.classList.add('d-none');
    }

    // Chart badge
    const chartBadge = document.getElementById('chartTargetBadge');
    if (chartBadge) chartBadge.textContent = `Target: ${appState.settings.globalTarget}%`;
  }

  // Chart Rendering with Chart.js
  function renderChart() {
    const canvas = document.getElementById('attendanceBarChart');
    const emptyState = document.getElementById('chartEmptyState');
    if (!canvas) return;

    if (appState.subjects.length === 0) {
      if (appState.chartInstance) {
        appState.chartInstance.destroy();
        appState.chartInstance = null;
      }
      canvas.style.display = 'none';
      if (emptyState) emptyState.classList.remove('d-none');
      return;
    }

    canvas.style.display = 'block';
    if (emptyState) emptyState.classList.add('d-none');

    const labels = appState.subjects.map(s => s.name.length > 18 ? s.name.substring(0, 16) + '…' : s.name);
    const dataVals = appState.subjects.map(s => {
      const stats = calculateBunkStats(s.attended, s.total, s.target || appState.settings.globalTarget);
      return stats.currentPercentage;
    });

    const isDark = appState.currentTheme === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)';

    // Dynamic bar colors based on status
    const bgColors = appState.subjects.map(s => {
      const stats = calculateBunkStats(s.attended, s.total, s.target || appState.settings.globalTarget);
      if (stats.status === 'safe') return 'rgba(16, 185, 129, 0.85)';
      if (stats.status === 'warning') return 'rgba(245, 158, 11, 0.85)';
      return 'rgba(244, 63, 94, 0.85)';
    });

    const borderColors = appState.subjects.map(s => {
      const stats = calculateBunkStats(s.attended, s.total, s.target || appState.settings.globalTarget);
      if (stats.status === 'safe') return '#10b981';
      if (stats.status === 'warning') return '#f59e0b';
      return '#f43f5e';
    });

    if (appState.chartInstance) {
      appState.chartInstance.data.labels = labels;
      appState.chartInstance.data.datasets[0].data = dataVals;
      appState.chartInstance.data.datasets[0].backgroundColor = bgColors;
      appState.chartInstance.data.datasets[0].borderColor = borderColors;
      appState.chartInstance.options.scales.x.ticks.color = textColor;
      appState.chartInstance.options.scales.y.ticks.color = textColor;
      appState.chartInstance.options.scales.y.grid.color = gridColor;
      appState.chartInstance.update();
    } else {
      const ctx = canvas.getContext('2d');
      appState.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Attendance %',
              data: dataVals,
              backgroundColor: bgColors,
              borderColor: borderColors,
              borderWidth: 1.5,
              borderRadius: 6,
              maxBarThickness: 42
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return `Attendance: ${ctx.parsed.y.toFixed(1)}%`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
            },
            y: {
              min: 0,
              max: 100,
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                callback: function (val) { return val + '%'; },
                font: { family: 'Inter', size: 11 }
              }
            }
          }
        }
      });
    }
  }

  // Dashboard Bunk Cushion Summary List
  function renderBunkSummaryList() {
    const listEl = document.getElementById('bunkSummaryList');
    if (!listEl) return;

    if (appState.subjects.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state p-0" style="padding: 1.5rem 0;">
          <p class="text-muted">No subject data available.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = appState.subjects.map(s => {
      const stats = calculateBunkStats(s.attended, s.total, s.target || appState.settings.globalTarget);
      let actionTag = '';
      if (stats.status === 'safe') {
        actionTag = `<span class="bunk-item-action bunk-safe">+${stats.permissibleBunks} can bunk</span>`;
      } else if (stats.status === 'warning') {
        actionTag = stats.permissibleBunks > 0
          ? `<span class="bunk-item-action bunk-even">+${stats.permissibleBunks} can bunk</span>`
          : `<span class="bunk-item-action bunk-even">0 bunk margin</span>`;
      } else {
        actionTag = `<span class="bunk-item-action bunk-need">Must attend +${stats.requiredClasses}</span>`;
      }

      return `
        <div class="bunk-item">
          <div class="bunk-item-info">
            <span class="bunk-item-name">${escapeHtml(s.name)}</span>
            <span class="bunk-item-metric">${stats.currentPercentage.toFixed(1)}% (${s.attended}/${s.total}) · Target: ${stats.targetPercent}%</span>
          </div>
          ${actionTag}
        </div>
      `;
    }).join('');
  }

  // Dashboard Quick Track Subject Cards
  function renderDashboardSubjectCards() {
    const container = document.getElementById('dashboardSubjectCards');
    if (!container) return;

    if (appState.subjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">
            <i data-lucide="book-plus"></i>
          </div>
          <h3>No Subjects Enrolled Yet</h3>
          <p>Get started by adding your courses to track classes, analyze bunks, and monitor attendance targets.</p>
          <button class="btn btn-primary" onclick="window.AttendWise.openAddSubjectModal()">
            <i data-lucide="plus"></i>
            <span>Add Your First Subject</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = appState.subjects.map(sub => {
      const stats = calculateBunkStats(sub.attended, sub.total, sub.target || appState.settings.globalTarget);
      
      // Calculate circle circumference: r=58 => C = 2 * PI * 58 ≈ 364.42
      const circumference = 364.4;
      const offset = circumference - (stats.currentPercentage / 100) * circumference;
      
      let ringColor = 'var(--emerald)';
      if (stats.status === 'warning') ringColor = 'var(--amber)';
      if (stats.status === 'critical') ringColor = 'var(--rose)';

      return `
        <div class="subject-card status-${stats.status}">
          <div class="subject-card-top">
            <div>
              <h3 class="subject-name">${escapeHtml(sub.name)}</h3>
              <p class="subject-faculty">
                <i data-lucide="user" class="icon-inline"></i>
                <span>${sub.teacher ? escapeHtml(sub.teacher) : 'No Faculty Assigned'}</span>
              </p>
            </div>
            <span class="badge-status ${stats.status}">${stats.statusText}</span>
          </div>

          <div class="subject-ring-metric-row">
            <div class="circular-progress-wrap">
              <svg class="progress-ring" width="78" height="78">
                <circle class="progress-ring-circle-bg" stroke-width="7" cx="39" cy="39" r="32" />
                <circle class="progress-ring-circle-val" stroke-width="7" cx="39" cy="39" r="32"
                  style="stroke: ${ringColor}; stroke-dasharray: 201; stroke-dashoffset: ${201 - (stats.currentPercentage / 100) * 201};" />
              </svg>
              <div class="ring-text">
                <span class="ring-percentage">${stats.currentPercentage.toFixed(0)}%</span>
                <span class="ring-label">${sub.attended}/${sub.total}</span>
              </div>
            </div>

            <div class="subject-stats-columns">
              <div>
                <span class="stat-item-label">Attended</span>
                <div class="stat-item-val text-emerald">${sub.attended}</div>
              </div>
              <div>
                <span class="stat-item-label">Missed</span>
                <div class="stat-item-val text-danger">${stats.missed}</div>
              </div>
              <div>
                <span class="stat-item-label">Target</span>
                <div class="stat-item-val">${stats.targetPercent}%</div>
              </div>
              <div>
                <span class="stat-item-label">Safe Bunk</span>
                <div class="stat-item-val ${stats.permissibleBunks > 0 ? 'text-emerald' : 'text-muted'}">${stats.permissibleBunks}</div>
              </div>
            </div>
          </div>

          <div class="subject-bunk-verdict">
            ${escapeHtml(stats.explanation)}
          </div>

          <div class="attendance-quick-actions">
            <button class="btn btn-sm btn-track-attend" onclick="window.AttendWise.markAttendance('${sub.id}', 'attended')">
              <i data-lucide="check"></i>
              <span>Attended</span>
            </button>
            <button class="btn btn-sm btn-track-miss" onclick="window.AttendWise.markAttendance('${sub.id}', 'missed')">
              <i data-lucide="x"></i>
              <span>Missed</span>
            </button>
          </div>

          <div class="subject-card-footer">
            <span class="text-muted">Target: ${stats.targetPercent}%</span>
            <button class="btn-icon-subtle" title="Adjust attendance count manually" onclick="window.AttendWise.openManualEditModal('${sub.id}')">
              <i data-lucide="edit-3"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // View B: Subjects Management (Table & Filters)
  function renderSubjectsManagementView() {
    const container = document.getElementById('subjectsContainer');
    if (!container) return;

    // Filter and Sort Subjects
    let list = [...appState.subjects];

    // Search filter
    if (appState.searchQuery) {
      const q = appState.searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.teacher && s.teacher.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (appState.statusFilter !== 'all') {
      list = list.filter(s => {
        const stats = calculateBunkStats(s.attended, s.total, s.target || appState.settings.globalTarget);
        return stats.status === appState.statusFilter;
      });
    }

    // Sort By
    list.sort((a, b) => {
      const statsA = calculateBunkStats(a.attended, a.total, a.target || appState.settings.globalTarget);
      const statsB = calculateBunkStats(b.attended, b.total, b.target || appState.settings.globalTarget);

      switch (appState.sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'percentage_asc':
          return statsA.currentPercentage - statsB.currentPercentage;
        case 'percentage_desc':
          return statsB.currentPercentage - statsA.currentPercentage;
        case 'classes_desc':
          return b.total - a.total;
        default:
          return 0;
      }
    });

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i data-lucide="search-x"></i>
          </div>
          <h3>No Matching Subjects</h3>
          <p>No enrolled subjects match your current filter or search query.</p>
          <button class="btn btn-secondary btn-sm" onclick="window.AttendWise.resetFilters()">
            <span>Reset Search & Filters</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="subject-manage-table-wrap">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Subject Name</th>
                <th>Attendance</th>
                <th>Current %</th>
                <th>Target</th>
                <th>Status</th>
                <th>Permissible Bunks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(s => {
                const stats = calculateBunkStats(s.attended, s.total, s.target || appState.settings.globalTarget);
                return `
                  <tr>
                    <td>
                      <div class="table-subject-name">${escapeHtml(s.name)}</div>
                      <div class="table-teacher-name">${s.teacher ? escapeHtml(s.teacher) : 'No faculty specified'}</div>
                    </td>
                    <td>
                      <strong>${s.attended}</strong> / ${s.total} held
                      <div class="text-sm text-muted">(${stats.missed} missed)</div>
                    </td>
                    <td>
                      <strong class="${stats.status === 'safe' ? 'text-emerald' : (stats.status === 'warning' ? 'text-amber' : 'text-danger')}">
                        ${stats.currentPercentage.toFixed(1)}%
                      </strong>
                    </td>
                    <td>${stats.targetPercent}%</td>
                    <td>
                      <span class="badge-status ${stats.status}">${stats.statusText}</span>
                    </td>
                    <td>
                      ${stats.permissibleBunks > 0 
                        ? `<span class="text-emerald fw-bold">+${stats.permissibleBunks} classes</span>` 
                        : (stats.requiredClasses > 0 ? `<span class="text-danger fw-bold">Need +${stats.requiredClasses}</span>` : `<span class="text-muted">0 (Borderline)</span>`)}
                    </td>
                    <td>
                      <div class="table-actions">
                        <button class="btn-icon-subtle" title="Log Attended" onclick="window.AttendWise.markAttendance('${s.id}', 'attended')">
                          <i data-lucide="plus"></i>
                        </button>
                        <button class="btn-icon-subtle" title="Log Missed" onclick="window.AttendWise.markAttendance('${s.id}', 'missed')">
                          <i data-lucide="minus"></i>
                        </button>
                        <button class="btn-icon-subtle" title="Adjust Totals" onclick="window.AttendWise.openManualEditModal('${s.id}')">
                          <i data-lucide="sliders"></i>
                        </button>
                        <button class="btn-icon-subtle" title="Edit Subject" onclick="window.AttendWise.openEditSubjectModal('${s.id}')">
                          <i data-lucide="edit"></i>
                        </button>
                        <button class="btn-icon-subtle delete" title="Delete Subject" onclick="window.AttendWise.deleteSubject('${s.id}')">
                          <i data-lucide="trash-2"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // View C: Bunk Calculator Matrix
  function renderCalculatorMatrix() {
    const tbody = document.getElementById('bunkMatrixTableBody');
    if (!tbody) return;

    if (appState.subjects.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 2.5rem;">
            <p class="text-muted">No subjects added yet. Add courses to inspect the bunk matrix.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = appState.subjects.map(s => {
      const stats = calculateBunkStats(s.attended, s.total, s.target || appState.settings.globalTarget);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(s.name)}</strong>
            <div class="text-sm text-muted">${s.teacher ? escapeHtml(s.teacher) : 'Regular'}</div>
          </td>
          <td>${s.attended} / ${s.total}</td>
          <td>
            <strong class="${stats.status === 'safe' ? 'text-emerald' : (stats.status === 'warning' ? 'text-amber' : 'text-danger')}">
              ${stats.currentPercentage.toFixed(1)}%
            </strong>
          </td>
          <td>${stats.targetPercent}%</td>
          <td>
            ${stats.permissibleBunks > 0 
              ? `<span class="text-emerald fw-bold">+${stats.permissibleBunks} classes</span>` 
              : `<span class="text-muted">0 classes</span>`}
          </td>
          <td>
            ${stats.requiredClasses > 0 
              ? `<span class="text-danger fw-bold">+${stats.requiredClasses} consecutive</span>` 
              : `<span class="text-emerald">None needed</span>`}
          </td>
          <td>
            <span class="badge-status ${stats.status}">${stats.statusText}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function populateSimulatorDropdown() {
    const select = document.getElementById('simSubjectSelect');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Choose subject to load values --</option>' +
      appState.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.attended}/${s.total})</option>`).join('');
    
    if (currentVal) select.value = currentVal;
  }

  // Interactive Simulator Calculation
  function runSimulation() {
    const attendedInput = document.getElementById('simAttended');
    const totalInput = document.getElementById('simTotal');
    const targetInput = document.getElementById('simTarget');

    const A = parseInt(attendedInput.value, 10);
    const T = parseInt(totalInput.value, 10);
    const P = parseFloat(targetInput.value);

    if (isNaN(A) || isNaN(T) || A < 0 || T < 0) {
      showToast('Please provide valid positive class counts.', 'danger');
      return;
    }

    if (A > T) {
      showToast('Attended classes cannot be greater than total classes held.', 'danger');
      return;
    }

    const stats = calculateBunkStats(A, T, P);

    // Update Result UI
    const pctVal = document.getElementById('simPercentageVal');
    const statusBadge = document.getElementById('simStatusBadge');
    const circleVal = document.getElementById('simProgressCircle');
    const verdictTitle = document.getElementById('simVerdictTitle');
    const verdictDesc = document.getElementById('simVerdictDescription');
    const bunkMargin = document.getElementById('simBunkMargin');
    const bunkNote = document.getElementById('simBunkNote');
    const catchupVal = document.getElementById('simCatchupRequired');
    const catchupNote = document.getElementById('simCatchupNote');

    if (pctVal) pctVal.textContent = `${stats.currentPercentage.toFixed(1)}%`;

    // Ring offset (r=58 => C = 364.4)
    if (circleVal) {
      const circ = 364.4;
      const offset = circ - (stats.currentPercentage / 100) * circ;
      circleVal.style.strokeDashoffset = offset;
      if (stats.status === 'safe') circleVal.style.stroke = 'var(--emerald)';
      else if (stats.status === 'warning') circleVal.style.stroke = 'var(--amber)';
      else circleVal.style.stroke = 'var(--rose)';
    }

    if (statusBadge) {
      statusBadge.className = `badge ${stats.status === 'safe' ? 'badge-indigo' : (stats.status === 'warning' ? 'badge-indigo' : 'badge-danger')}`;
      statusBadge.textContent = stats.statusText;
    }

    if (verdictTitle) {
      if (stats.status === 'safe') {
        verdictTitle.textContent = 'Safe Attendance Zone';
        verdictTitle.className = 'text-emerald';
      } else if (stats.status === 'warning') {
        verdictTitle.textContent = 'Warning: Approaching Minimum';
        verdictTitle.className = 'text-amber';
      } else {
        verdictTitle.textContent = 'Critical Attendance Deficit';
        verdictTitle.className = 'text-danger';
      }
    }

    if (verdictDesc) verdictDesc.textContent = stats.explanation;

    if (bunkMargin) {
      bunkMargin.textContent = `${stats.permissibleBunks} classes`;
      bunkMargin.className = stats.permissibleBunks > 0 ? 'sim-kpi-value text-emerald' : 'sim-kpi-value text-muted';
    }
    if (bunkNote) {
      bunkNote.textContent = stats.permissibleBunks > 0 
        ? `Can safely miss while staying ≥ ${P}%` 
        : `Cannot afford to miss any classes`;
    }

    if (catchupVal) {
      catchupVal.textContent = `${stats.requiredClasses} classes`;
      catchupVal.className = stats.requiredClasses > 0 ? 'sim-kpi-value text-rose' : 'sim-kpi-value text-emerald';
    }
    if (catchupNote) {
      catchupNote.textContent = stats.requiredClasses > 0
        ? `Must attend back-to-back to reach ${P}%`
        : `Target criteria currently satisfied`;
    }

    refreshIcons();
  }

  // View D: Activity Timeline
  function renderActivityTimeline() {
    const timeline = document.getElementById('activityTimeline');
    if (!timeline) return;

    if (appState.activities.length === 0) {
      timeline.innerHTML = `
        <div class="empty-state">
          <p class="text-muted">No recorded actions in log.</p>
        </div>
      `;
      return;
    }

    timeline.innerHTML = appState.activities.map(act => {
      let icon = 'info';
      let markerClass = '';
      if (act.type === 'attended') {
        icon = 'check';
        markerClass = 'attended';
      } else if (act.type === 'missed') {
        icon = 'x';
        markerClass = 'missed';
      } else if (act.type === 'warning') {
        icon = 'alert-triangle';
      }

      const timeFormatted = formatTimeAgo(act.timestamp);

      return `
        <div class="timeline-item">
          <div class="timeline-marker ${markerClass}">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="timeline-header">
            <span class="timeline-title">${escapeHtml(act.title)}</span>
            <span class="timeline-time">${timeFormatted}</span>
          </div>
          <div class="timeline-desc">${escapeHtml(act.desc)}</div>
        </div>
      `;
    }).join('');
  }

  // View Navigation Handler
  function switchView(viewName) {
    appState.activeView = viewName;
    
    // Update view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(`view${capitalizeFirstLetter(viewName)}`);
    if (targetPanel) targetPanel.classList.add('active');

    // Update nav links
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update topbar titles
    const titleEl = document.getElementById('pageTitle');
    const subtitleEl = document.getElementById('pageSubtitle');
    switch (viewName) {
      case 'dashboard':
        titleEl.textContent = 'Dashboard Overview';
        subtitleEl.textContent = 'Monitor your attendance health and bunk margins';
        break;
      case 'subjects':
        titleEl.textContent = 'Subject Management';
        subtitleEl.textContent = 'Manage your enrolled courses, professors, and class records';
        break;
      case 'calculator':
        titleEl.textContent = 'Bunk Calculator & Forecast';
        subtitleEl.textContent = 'Simulate safe bunks and consecutive attendance catch-up';
        runSimulation();
        break;
      case 'activity':
        titleEl.textContent = 'Activity & Audit Log';
        subtitleEl.textContent = 'Track recent attendance updates and configuration changes';
        break;
      case 'settings':
        titleEl.textContent = 'Settings & Portability';
        subtitleEl.textContent = 'Backup attendance data or configure global target defaults';
        break;
    }

    // Close mobile sidebar if open
    closeMobileSidebar();
    refreshIcons();
  }

  // ==========================================
  // 7. BACKUP, IMPORT & EXPORT
  // ==========================================
  function exportDataAsJSON() {
    const backup = {
      app: 'AttendWise',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: appState.settings,
      subjects: appState.subjects,
      activities: appState.activities
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `attendwise_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Attendance backup exported successfully!', 'success');
  }

  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const parsed = JSON.parse(e.target.result);

        // Validation
        if (!parsed.subjects || !Array.isArray(parsed.subjects)) {
          throw new Error('Invalid backup schema: "subjects" array missing.');
        }

        // Validate each subject record
        const validatedSubjects = parsed.subjects.map((s, idx) => {
          if (!s.name || typeof s.name !== 'string') {
            throw new Error(`Subject at index ${idx} is missing a valid name.`);
          }
          const attended = Math.max(0, parseInt(s.attended, 10) || 0);
          const total = Math.max(0, parseInt(s.total, 10) || 0);
          if (attended > total) {
            throw new Error(`Subject "${s.name}" has attended classes exceeding total classes.`);
          }
          return {
            id: s.id || ('sub-imported-' + Date.now() + '-' + idx),
            name: s.name.trim(),
            teacher: s.teacher ? s.teacher.trim() : '',
            attended,
            total,
            target: parseFloat(s.target) || 75,
            createdAt: s.createdAt || Date.now()
          };
        });

        appState.subjects = validatedSubjects;
        if (parsed.settings) {
          appState.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        }
        if (parsed.activities && Array.isArray(parsed.activities)) {
          appState.activities = parsed.activities;
        }

        saveSubjects();
        saveSettings();
        saveActivities();

        logActivity('Data Restored', `Imported ${validatedSubjects.length} subjects from backup.`, 'info');
        showToast(`Successfully imported ${validatedSubjects.length} subjects!`, 'success');
        renderAllViews();
      } catch (err) {
        console.error('Import error:', err);
        showToast(`Import Failed: ${err.message}`, 'danger');
      } finally {
        event.target.value = ''; // Reset input
      }
    };
    reader.readAsText(file);
  }

  function resetToDemoData() {
    showConfirmModal(
      'Reset to Sample Data',
      'This will replace your current subjects with default sample data. Are you sure you want to proceed?',
      () => {
        appState.subjects = JSON.parse(JSON.stringify(SAMPLE_SUBJECTS));
        appState.settings = { ...DEFAULT_SETTINGS };
        saveSubjects();
        saveSettings();
        logActivity('System Reset', 'Restored default demo data.', 'warning');
        showToast('Sample data loaded!', 'success');
        renderAllViews();
      }
    );
  }

  function clearAllData() {
    showConfirmModal(
      'Purge All Attendance Records',
      'This will delete all subjects, attendance logs, and configurations from your browser storage. This cannot be undone.',
      () => {
        appState.subjects = [];
        appState.activities = [];
        appState.settings = { ...DEFAULT_SETTINGS };
        saveSubjects();
        saveSettings();
        saveActivities();
        logActivity('All Records Cleared', 'Data completely cleared.', 'danger');
        showToast('All data has been cleared.', 'danger');
        renderAllViews();
      }
    );
  }

  // ==========================================
  // 8. THEME TOGGLE
  // ==========================================
  function toggleTheme() {
    appState.currentTheme = appState.currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEYS.THEME, appState.currentTheme);
    updateThemeUI();
    renderChart();
  }

  function updateThemeUI() {
    document.body.setAttribute('data-theme', appState.currentTheme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      if (appState.currentTheme === 'dark') {
        themeIcon.setAttribute('data-lucide', 'sun');
      } else {
        themeIcon.setAttribute('data-lucide', 'moon');
      }
      refreshIcons();
    }
  }

  // ==========================================
  // 9. EVENT LISTENERS & MODAL BINDINGS
  // ==========================================
  function openAddSubjectModal() {
    const form = document.getElementById('subjectForm');
    form.reset();
    document.getElementById('editSubjectId').value = '';
    document.getElementById('subjectModalTitle').textContent = 'Add New Subject';
    document.getElementById('inputTargetPercentage').value = appState.settings.globalTarget;
    document.getElementById('targetPercentageDisplay').textContent = `${appState.settings.globalTarget}%`;
    clearFormErrors();
    document.getElementById('subjectModal').classList.add('open');
  }

  function openEditSubjectModal(id) {
    const sub = appState.subjects.find(s => s.id === id);
    if (!sub) return;

    clearFormErrors();
    document.getElementById('editSubjectId').value = sub.id;
    document.getElementById('subjectModalTitle').textContent = 'Edit Subject';
    document.getElementById('inputSubjectName').value = sub.name;
    document.getElementById('inputTeacherName').value = sub.teacher || '';
    document.getElementById('inputAttendedClasses').value = sub.attended;
    document.getElementById('inputTotalClasses').value = sub.total;
    document.getElementById('inputTargetPercentage').value = sub.target || appState.settings.globalTarget;
    document.getElementById('targetPercentageDisplay').textContent = `${sub.target || appState.settings.globalTarget}%`;
    document.getElementById('subjectModal').classList.add('open');
  }

  function closeSubjectModal() {
    document.getElementById('subjectModal').classList.remove('open');
  }

  function clearFormErrors() {
    document.getElementById('errorSubjectName').textContent = '';
    document.getElementById('errorAttendedClasses').textContent = '';
    document.getElementById('errorTotalClasses').textContent = '';
  }

  function openManualEditModal(id) {
    const sub = appState.subjects.find(s => s.id === id);
    if (!sub) return;

    document.getElementById('manualEditSubjectId').value = sub.id;
    document.getElementById('manualEditSubjectTitle').textContent = `Adjusting: ${sub.name}`;
    document.getElementById('manualAttended').value = sub.attended;
    document.getElementById('manualTotal').value = sub.total;
    document.getElementById('manualEditError').textContent = '';
    document.getElementById('manualEditModal').classList.add('open');
  }

  function closeManualEditModal() {
    document.getElementById('manualEditModal').classList.remove('open');
  }

  function openMobileSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
  }

  function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  }

  function setupEventListeners() {
    // Nav Click Handling
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        const view = this.getAttribute('data-view');
        switchView(view);
      });
    });

    // Mobile Sidebar Toggles
    document.getElementById('openSidebarBtn').addEventListener('click', openMobileSidebar);
    document.getElementById('closeSidebarBtn').addEventListener('click', closeMobileSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

    // Theme Toggle
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

    // Quick Add Button in Header
    document.getElementById('quickAddSubjectBtn').addEventListener('click', openAddSubjectModal);
    document.getElementById('openAddSubjectModalBtn').addEventListener('click', openAddSubjectModal);

    // Subject Modal Form Submit
    document.getElementById('subjectForm').addEventListener('submit', function (e) {
      e.preventDefault();
      clearFormErrors();

      const id = document.getElementById('editSubjectId').value;
      const name = document.getElementById('inputSubjectName').value.trim();
      const teacher = document.getElementById('inputTeacherName').value.trim();
      const attendedStr = document.getElementById('inputAttendedClasses').value;
      const totalStr = document.getElementById('inputTotalClasses').value;
      const target = document.getElementById('inputTargetPercentage').value;

      let hasError = false;
      if (!name) {
        document.getElementById('errorSubjectName').textContent = 'Subject name is required.';
        hasError = true;
      }

      const attended = parseInt(attendedStr, 10);
      const total = parseInt(totalStr, 10);

      if (isNaN(attended) || attended < 0) {
        document.getElementById('errorAttendedClasses').textContent = 'Enter a valid non-negative number.';
        hasError = true;
      }

      if (isNaN(total) || total < 0) {
        document.getElementById('errorTotalClasses').textContent = 'Enter a valid non-negative number.';
        hasError = true;
      }

      if (!hasError && attended > total) {
        document.getElementById('errorAttendedClasses').textContent = 'Attended classes cannot exceed total classes.';
        hasError = true;
      }

      if (hasError) return;

      if (id) {
        updateSubject(id, name, teacher, attended, total, target);
      } else {
        addSubject(name, teacher, attended, total, target);
      }
      closeSubjectModal();
    });

    // Subject Modal Controls
    document.getElementById('closeSubjectModalBtn').addEventListener('click', closeSubjectModal);
    document.getElementById('cancelSubjectModalBtn').addEventListener('click', closeSubjectModal);

    // Target slider in Subject modal
    document.getElementById('inputTargetPercentage').addEventListener('input', function (e) {
      document.getElementById('targetPercentageDisplay').textContent = `${e.target.value}%`;
    });

    // Manual Edit Attendance Modal
    document.getElementById('closeManualEditModalBtn').addEventListener('click', closeManualEditModal);
    document.getElementById('cancelManualEditBtn').addEventListener('click', closeManualEditModal);
    document.getElementById('manualEditForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const id = document.getElementById('manualEditSubjectId').value;
      const attended = document.getElementById('manualAttended').value;
      const total = document.getElementById('manualTotal').value;

      if (parseInt(attended, 10) > parseInt(total, 10)) {
        document.getElementById('manualEditError').textContent = 'Attended classes cannot exceed total classes.';
        return;
      }

      updateManualTotals(id, attended, total);
      closeManualEditModal();
    });

    // Confirmation Modal
    document.getElementById('closeConfirmModalBtn').addEventListener('click', hideConfirmModal);
    document.getElementById('confirmCancelBtn').addEventListener('click', hideConfirmModal);
    document.getElementById('confirmAcceptBtn').addEventListener('click', function () {
      if (typeof activeConfirmCallback === 'function') {
        activeConfirmCallback();
      }
      hideConfirmModal();
    });

    // Sidebar Target Range Slider
    const globalTargetSlider = document.getElementById('globalTargetRange');
    globalTargetSlider.addEventListener('input', function (e) {
      const val = parseInt(e.target.value, 10);
      appState.settings.globalTarget = val;
      document.getElementById('sidebarTargetValue').textContent = `${val}%`;
      saveSettings();
      renderAllViews();
    });

    // Critical Alert button
    document.getElementById('viewCriticalSubjectsBtn').addEventListener('click', () => {
      appState.statusFilter = 'critical';
      document.getElementById('statusFilterSelect').value = 'critical';
      switchView('subjects');
    });

    // Go to Manage button on dashboard
    document.getElementById('goToSubjectManagementBtn').addEventListener('click', () => {
      switchView('subjects');
    });

    // Search and Filters
    const searchInput = document.getElementById('subjectSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    searchInput.addEventListener('input', function (e) {
      appState.searchQuery = e.target.value;
      if (appState.searchQuery) {
        clearSearchBtn.classList.remove('d-none');
      } else {
        clearSearchBtn.classList.add('d-none');
      }
      renderSubjectsManagementView();
      refreshIcons();
    });

    clearSearchBtn.addEventListener('click', function () {
      searchInput.value = '';
      appState.searchQuery = '';
      clearSearchBtn.classList.add('d-none');
      renderSubjectsManagementView();
    });

    document.getElementById('statusFilterSelect').addEventListener('change', function (e) {
      appState.statusFilter = e.target.value;
      renderSubjectsManagementView();
    });

    document.getElementById('sortBySelect').addEventListener('change', function (e) {
      appState.sortBy = e.target.value;
      renderSubjectsManagementView();
    });

    // Bunk Simulator Form Controls
    document.getElementById('simTarget').addEventListener('input', function (e) {
      document.getElementById('simTargetDisplay').textContent = `${e.target.value}%`;
      runSimulation();
    });

    document.getElementById('simAttended').addEventListener('input', runSimulation);
    document.getElementById('simTotal').addEventListener('input', runSimulation);

    document.getElementById('simSubjectSelect').addEventListener('change', function (e) {
      const selectedId = e.target.value;
      if (!selectedId) return;
      const sub = appState.subjects.find(s => s.id === selectedId);
      if (sub) {
        document.getElementById('simAttended').value = sub.attended;
        document.getElementById('simTotal').value = sub.total;
        document.getElementById('simTarget').value = sub.target || appState.settings.globalTarget;
        document.getElementById('simTargetDisplay').textContent = `${sub.target || appState.settings.globalTarget}%`;
        runSimulation();
      }
    });

    document.getElementById('runSimulationBtn').addEventListener('click', runSimulation);

    // Settings View Event Handlers
    document.getElementById('saveGlobalPreferencesBtn').addEventListener('click', function () {
      const targetVal = parseInt(document.getElementById('settingsGlobalTargetInput').value, 10);
      const riskVal = parseInt(document.getElementById('settingsRiskThresholdInput').value, 10);

      if (isNaN(targetVal) || targetVal < 40 || targetVal > 99) {
        showToast('Please enter a target between 40% and 99%.', 'danger');
        return;
      }

      appState.settings.globalTarget = targetVal;
      appState.settings.riskThreshold = Math.max(1, riskVal || 5);
      saveSettings();
      showToast('Global attendance settings updated!', 'success');
      renderAllViews();
    });

    // Export & Import
    document.getElementById('exportDataBtn').addEventListener('click', exportDataAsJSON);
    document.getElementById('triggerImportBtn').addEventListener('click', function () {
      document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', handleImportFile);

    // Demo Data & Clear All
    document.getElementById('loadDemoDataBtn').addEventListener('click', resetToDemoData);
    document.getElementById('clearAllDataBtn').addEventListener('click', clearAllData);

    // Clear Activity Log
    document.getElementById('clearActivityLogBtn').addEventListener('click', function () {
      showConfirmModal(
        'Clear History',
        'Are you sure you want to clear your activity history?',
        () => {
          appState.activities = [];
          saveActivities();
          renderActivityTimeline();
          showToast('Activity log cleared.', 'info');
        }
      );
    });

    // Close modals on Escape key
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeSubjectModal();
        closeManualEditModal();
        hideConfirmModal();
      }
    });
  }

  // ==========================================
  // 10. UTILITIES
  // ==========================================
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // ==========================================
  // 11. INITIALIZATION
  // ==========================================
  function init() {
    loadFromStorage();
    setupEventListeners();

    // Sync settings form inputs
    const setTargetInput = document.getElementById('settingsGlobalTargetInput');
    if (setTargetInput) setTargetInput.value = appState.settings.globalTarget;
    const setRiskInput = document.getElementById('settingsRiskThresholdInput');
    if (setRiskInput) setRiskInput.value = appState.settings.riskThreshold || 5;

    renderAllViews();
    runSimulation();
  }

  // Expose global methods for inline HTML onclick calls
  window.AttendWise = {
    openAddSubjectModal,
    openEditSubjectModal,
    openManualEditModal,
    deleteSubject,
    markAttendance,
    resetFilters: function () {
      appState.searchQuery = '';
      appState.statusFilter = 'all';
      document.getElementById('subjectSearchInput').value = '';
      document.getElementById('clearSearchBtn').classList.add('d-none');
      document.getElementById('statusFilterSelect').value = 'all';
      renderSubjectsManagementView();
    }
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
