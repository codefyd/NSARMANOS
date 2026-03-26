// ============================================================================
// نظام مجمع النصار - التطبيق الأمامي (Frontend)
// ============================================================================

(function () {
  // ============================================================================
  // الإعدادات والثوابت
  // ============================================================================

  const API_URL = window.APP_CONFIG && window.APP_CONFIG.API_URL;
  
  const state = {
    token: localStorage.getItem('quran_center_token') || '',
    userName: localStorage.getItem('quran_center_name') || '',
    userRole: localStorage.getItem('quran_center_role') || '',
    userCircle: localStorage.getItem('quran_center_circle') || ''
  };

  const loginModal = new bootstrap.Modal(document.getElementById('staffLoginModal'));

  // ============================================================================
  // وظائف التحقق والإعدادات
  // ============================================================================

  function ensureConfig() {
    if (!API_URL || API_URL.includes('ضع-هنا')) {
      Swal.fire({
        icon: 'warning',
        title: 'أكمل الإعداد أولاً',
        text: 'انسخ config.example.js إلى config.js وضع رابط Google Apps Script المنشور.'
      });
      return false;
    }
    return true;
  }

  // ============================================================================
  // وظائف الاتصال بـ API
  // ============================================================================

  async function api(action, data = {}, withToken = false) {
    if (!ensureConfig()) throw new Error('Missing config');
    
    const body = new URLSearchParams();
    body.append('action', action);
    
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        body.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
      }
    });
    
    if (withToken && state.token) {
      body.append('token', state.token);
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body
      });
      
      const json = await res.json();
      
      if (!json.success) {
        throw new Error(json.error || json.message || 'حدث خطأ');
      }
      
      return json;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // ============================================================================
  // وظائف التوجيه والعرض
  // ============================================================================

  function showView(name) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('d-none'));
    const map = {
      home: 'homeView',
      register: 'registerView',
      'student-data': 'studentDataView',
      staff: 'staffView'
    };
    document.getElementById(map[name] || 'homeView').classList.remove('d-none');
    if (name === 'staff') loadStaffDashboard();
  }

  function route() {
    const hash = (location.hash || '#/home').replace('#/', '');
    if (hash === 'staff' && !state.token) {
      loginModal.show();
      location.hash = '#/home';
      return;
    }
    showView(hash);
  }

  // ============================================================================
  // وظائف إدارة الجلسات
  // ============================================================================

  function setSession(data) {
    state.token = data.token;
    state.userName = data.name;
    state.userRole = data.role;
    state.userCircle = data.circle || '';
    
    localStorage.setItem('quran_center_token', data.token);
    localStorage.setItem('quran_center_name', data.name);
    localStorage.setItem('quran_center_role', data.role);
    localStorage.setItem('quran_center_circle', data.circle || '');
    
    updateAuthUI();
  }

  function clearSession() {
    state.token = '';
    state.userName = '';
    state.userRole = '';
    state.userCircle = '';
    
    localStorage.removeItem('quran_center_token');
    localStorage.removeItem('quran_center_name');
    localStorage.removeItem('quran_center_role');
    localStorage.removeItem('quran_center_circle');
    
    updateAuthUI();
  }

  function updateAuthUI() {
    document.getElementById('logoutBtn').classList.toggle('d-none', !state.token);
  }

  // ============================================================================
  // معالجات الأحداث
  // ============================================================================

  document.getElementById('openStaffLoginBtn').addEventListener('click', () => loginModal.show());
  document.getElementById('openStaffLoginBtn2').addEventListener('click', () => loginModal.show());
  
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      if (state.token) await api('logout', {}, true);
    } catch (e) {}
    clearSession();
    location.hash = '#/home';
  });

  // ============================================================================
  // نموذج تسجيل الدخول
  // ============================================================================

  document.getElementById('staffLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await api('login', { 'رمز الدخول': document.getElementById('staffCode').value });
      setSession(res.data);
      loginModal.hide();
      await Swal.fire({ 
        icon: 'success', 
        title: 'تم تسجيل الدخول', 
        timer: 1200, 
        showConfirmButton: false 
      });
      location.hash = '#/staff';
    } catch (err) {
      Swal.fire({ 
        icon: 'error', 
        title: 'تعذر الدخول', 
        text: err.message 
      });
    }
  });

  // ============================================================================
  // نموذج التسجيل
  // ============================================================================

  document.getElementById('registrationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await api('registerStudent', data);
      e.target.reset();
      Swal.fire({ 
        icon: 'success', 
        title: 'تم إرسال الطلب', 
        html: `رقم الطلب: <strong>${res.data['رقم الطلب']}</strong>` 
      });
    } catch (err) {
      Swal.fire({ 
        icon: 'error', 
        title: 'تعذر الإرسال', 
        text: err.message 
      });
    }
  });

  // ============================================================================
  // نموذج البحث عن بيانات الطالب
  // ============================================================================

  document.getElementById('studentLookupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await api('getStudentData', data);
      renderStudentResult(res.data);
    } catch (err) {
      document.getElementById('studentResult').innerHTML = 
        `<div class="alert alert-danger">${err.message}</div>`;
    }
  });

  // ============================================================================
  // وظائف عرض النتائج
  // ============================================================================

  function renderStudentResult(student) {
    document.getElementById('studentResult').innerHTML = `
      <div class="panel-card">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h5 class="mb-1 fw-bold">${student['اسم الطالب ثلاثي']}</h5>
            <div class="small-muted">الحلقة: ${student['الحلقة'] || 'غير محددة'} — الحالة: ${student['حالة الطالب'] || '-'}</div>
          </div>
          <button class="btn btn-outline-primary btn-sm" id="requestStudentEditBtn">طلب تعديل بيانات</button>
        </div>
        <div class="data-grid">
          ${dataItem('هوية الطالب', student['هوية الطالب'])}
          ${dataItem('جوال الطالب', student['رقم جوال الطالب'] || '-')}
          ${dataItem('جوال ولي الأمر', student['رقم جوال ولي الأمر'] || '-')}
          ${dataItem('تاريخ الميلاد', student['تاريخ ميلاد الطالب'] || '-')}
          ${dataItem('المرحلة', student['المرحلة الدراسية'] || '-')}
          ${dataItem('الصف', student['الصف الدراسي'] || '-')}
          ${dataItem('العنوان', student['العنوان / الحي'] || '-')}
          ${dataItem('مجموع الحفظ', student['مجموع الحفظ'] || '0')}
        </div>
      </div>`;

    document.getElementById('requestStudentEditBtn').addEventListener('click', async () => {
      const { value: formValues } = await Swal.fire({
        title: 'طلب تعديل بيانات',
        html: `
          <select id="swal-field" class="swal2-input">
            <option value="رقم جوال الطالب">رقم جوال الطالب</option>
            <option value="العنوان / الحي">العنوان / الحي</option>
            <option value="رقم جوال ولي الأمر">رقم جوال ولي الأمر</option>
          </select>
          <input id="swal-value" class="swal2-input" placeholder="القيمة الجديدة">
          <input id="swal-notes" class="swal2-input" placeholder="ملاحظات">
        `,
        focusConfirm: false,
        preConfirm: () => ({
          'الحقل المطلوب تعديله': document.getElementById('swal-field').value,
          'القيمة الجديدة': document.getElementById('swal-value').value,
          'ملاحظات': document.getElementById('swal-notes').value
        })
      });
      
      if (!formValues) return;
      
      try {
        await api('requestStudentUpdate', { 
          'هوية الطالب': student['هوية الطالب'], 
          ...formValues 
        });
        Swal.fire({ 
          icon: 'success', 
          title: 'تم إرسال طلب التعديل' 
        });
      } catch (err) {
        Swal.fire({ 
          icon: 'error', 
          title: 'تعذر إرسال الطلب', 
          text: err.message 
        });
      }
    });
  }

  function dataItem(label, value) {
    return `<div class="data-item"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  }

  // ============================================================================
  // لوحة تحكم العاملين
  // ============================================================================

  async function loadStaffDashboard() {
    try {
      const statsRes = await api('getDashboardBundle', {}, true);
      renderStats(statsRes.data['الإحصائيات']);
      document.getElementById('staffWelcome').textContent = 
        `مرحباً ${state.userName} — ${state.userRole}`;
      
      await Promise.all([
        loadRequests(statsRes.data),
        loadStudents(statsRes.data),
        loadWarnings(statsRes.data),
        loadSettings(statsRes.data)
      ]);
      
      applyRoleVisibility();
    } catch (err) {
      clearSession();
      Swal.fire({ 
        icon: 'error', 
        title: 'انتهت الجلسة أو لا توجد صلاحية', 
        text: err.message 
      });
      location.hash = '#/home';
    }
  }

  function renderStats(data) {
    document.getElementById('dashboardStats').innerHTML = `
      ${statCard('إجمالي الطلاب', data['إجمالي الطلاب'] || 0, 'fa-users')}
      ${statCard('الطلبات الجديدة', data['الطلبات الجديدة'] || 0, 'fa-inbox')}
      ${statCard('الإنذارات الجديدة', data['الإنذارات الجديدة'] || 0, 'fa-triangle-exclamation')}`;
  }

  function statCard(label, value, icon) {
    return `<div class="col-md-3 col-sm-6"><div class="kpi-card"><div class="bg-icon-float"><i class="fa-solid ${icon}"></i></div><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div></div>`;
  }

  async function loadRequests(data) {
    const wrap = document.getElementById('requestsTab');
    try {
      const requests = data['الطلبات'] || [];
      wrap.innerHTML = `
        <div class="table-card">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">الطلبات الواردة</h5>
          </div>
          ${renderRequestsTable(requests)}
        </div>`;
      bindRequestActions();
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-warning">${err.message}</div>`;
    }
  }

  function renderRequestsTable(items) {
    if (!items.length) return '<div class="text-muted">لا توجد طلبات حالياً</div>';
    
    return `<div class="table-responsive"><table class="table align-middle">
      <thead><tr>
        <th>رقم الطلب</th>
        <th>النوع</th>
        <th>الاسم</th>
        <th>الهوية</th>
        <th>الحالة</th>
        <th>التاريخ</th>
        <th>إجراء</th>
      </tr></thead>
      <tbody>${items.map(item => `
        <tr>
          <td>${item['رقم الطلب']}</td>
          <td>${item['نوع الطلب']}</td>
          <td>${item['اسم الطالب ثلاثي']}</td>
          <td>${item['هوية الطالب']}</td>
          <td>${item['حالة الطلب']}</td>
          <td>${formatDate(item['تاريخ الطلب'])}</td>
          <td>
            ${canManageRequests() && (item['حالة الطلب'] === 'جديد' || item['حالة الطلب'] === 'انتظار') ? `
              <button class="btn btn-sm btn-success req-approve" data-id="${item['رقم الطلب']}">اعتماد</button>
              <button class="btn btn-sm btn-outline-danger req-reject" data-id="${item['رقم الطلب']}">رفض</button>
            ` : '<span class="small-muted">—</span>'}
          </td>
        </tr>`).join('')}</tbody>
    </table></div>`;
  }

  function bindRequestActions() {
    document.querySelectorAll('.req-approve').forEach(btn => btn.addEventListener('click', async () => {
      const requestId = btn.dataset.id;
      const { value: circle } = await Swal.fire({ 
        title: 'اعتماد الطلب', 
        input: 'text', 
        inputLabel: 'اسم الحلقة (اختياري)', 
        inputPlaceholder: 'مثال: حلقة الفاروق' 
      });
      
      try {
        await api('processRequest', { 
          'رقم الطلب': requestId, 
          'الإجراء': 'قبول', 
          'الحلقة': circle || '' 
        }, true);
        Swal.fire({ 
          icon: 'success', 
          title: 'تم اعتماد الطلب' 
        });
        await loadStaffDashboard();
      } catch (err) {
        Swal.fire({ 
          icon: 'error', 
          title: 'تعذر اعتماد الطلب', 
          text: err.message 
        });
      }
    }));

    document.querySelectorAll('.req-reject').forEach(btn => btn.addEventListener('click', async () => {
      const requestId = btn.dataset.id;
      const { value: reason } = await Swal.fire({ 
        title: 'رفض الطلب', 
        input: 'textarea', 
        inputLabel: 'سبب الرفض', 
        inputPlaceholder: 'أدخل سبب الرفض' 
      });
      
      if (!reason) return;
      
      try {
        await api('processRequest', { 
          'رقم الطلب': requestId, 
          'الإجراء': 'رفض', 
          'سبب الرفض': reason 
        }, true);
        Swal.fire({ 
          icon: 'success', 
          title: 'تم رفض الطلب' 
        });
        await loadStaffDashboard();
      } catch (err) {
        Swal.fire({ 
          icon: 'error', 
          title: 'تعذر رفض الطلب', 
          text: err.message 
        });
      }
    }));
  }

  async function loadStudents(data) {
    const wrap = document.getElementById('studentsTab');
    try {
      const students = data['الطلاب'] || [];
      wrap.innerHTML = `
        <div class="table-card">
          <h5 class="mb-3">إدارة الطلاب</h5>
          ${renderStudentsTable(students)}
        </div>`;
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-warning">${err.message}</div>`;
    }
  }

  function renderStudentsTable(items) {
    if (!items.length) return '<div class="text-muted">لا يوجد طلاب</div>';
    
    return `<div class="table-responsive"><table class="table align-middle">
      <thead><tr>
        <th>الاسم</th>
        <th>الهوية</th>
        <th>الحلقة</th>
        <th>الحفظ</th>
        <th>الحالة</th>
      </tr></thead>
      <tbody>${items.map(item => `
        <tr>
          <td>${item['اسم الطالب ثلاثي']}</td>
          <td>${item['هوية الطالب']}</td>
          <td>${item['الحلقة'] || '-'}</td>
          <td>${item['مجموع الحفظ'] || 0}</td>
          <td>${item['حالة الطالب'] || '-'}</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
  }

  async function loadWarnings(data) {
    const wrap = document.getElementById('warningsTab');
    try {
      const warnings = data['الإنذارات_التعليمية'] || [];
      wrap.innerHTML = `
        <div class="table-card">
          <h5 class="mb-3">الإنذارات التعليمية</h5>
          ${renderWarningsTable(warnings)}
        </div>`;
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-warning">${err.message}</div>`;
    }
  }

  function renderWarningsTable(items) {
    if (!items.length) return '<div class="text-muted">لا توجد إنذارات</div>';
    
    return `<div class="table-responsive"><table class="table align-middle">
      <thead><tr>
        <th>الطالب</th>
        <th>الحلقة</th>
        <th>النوع</th>
        <th>السبب</th>
        <th>الإجراء</th>
      </tr></thead>
      <tbody>${items.map(item => `
        <tr>
          <td>${item['اسم الطالب']}</td>
          <td>${item['الحلقة']}</td>
          <td>${item['نوع الإنذار']}</td>
          <td>${item['سبب الإنذار']}</td>
          <td>${item['الإجراء الحالي']}</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
  }

  async function loadSettings(data) {
    const wrap = document.getElementById('settingsTab');
    try {
      wrap.innerHTML = `
        <div class="table-card">
          <h5 class="mb-3">الإعدادات</h5>
          <p class="text-muted">سيتم إضافة واجهة الإعدادات قريباً</p>
        </div>`;
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-warning">${err.message}</div>`;
    }
  }

  function applyRoleVisibility() {
    // إظهار/إخفاء العناصر حسب الدور
    if (state.userRole === 'معلم') {
      document.getElementById('studentsTabBtn').classList.add('d-none');
      document.getElementById('warningsTabBtn').classList.add('d-none');
      document.getElementById('settingsTabBtn').classList.add('d-none');
    }
  }

  function canManageRequests() {
    return ['مشرف إداري', 'مدير'].includes(state.userRole);
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-SA');
    } catch (e) {
      return dateString;
    }
  }

  // ============================================================================
  // تهيئة التطبيق
  // ============================================================================

  window.addEventListener('hashchange', route);
  route();
  updateAuthUI();

})();
