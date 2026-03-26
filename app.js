(function () {
  const CONFIG = window.APP_CONFIG || {};
  const STORAGE_KEY = "nsar_session_v3";

  const state = {
    session: readSession(),
    dashboard: null,
  };

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (_e) {
      return null;
    }
  }

  function saveSession(session) {
    state.session = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    state.session = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function safe(value) {
    return value == null ? "" : String(value);
  }

  function escapeHtml(value) {
    return safe(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function ensureApi() {
    if (!CONFIG.API_URL || CONFIG.API_URL.includes("ضع-")) {
      throw new Error("أكمل ملف config.js وضع رابط Google Apps Script المنشور");
    }
  }

  function showLoading(show) {
    const overlay = byId("loadingOverlay");
    if (overlay) overlay.classList.toggle("show", !!show);
  }

  async function api(action, payload = {}) {
    ensureApi();
    showLoading(true);
    try {
      const response = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({ action, ...payload }),
      });

      let json;
      try {
        json = await response.json();
      } catch (_e) {
        throw new Error("تعذر قراءة استجابة الخادم");
      }

      if (!json.success) {
        throw new Error(json.error || "حدث خطأ غير متوقع");
      }

      return json.data;
    } catch (error) {
      throw error;
    } finally {
      showLoading(false);
    }
  }

  async function toast(icon, title, text = "") {
    if (window.Swal) {
      return Swal.fire({
        icon,
        title,
        text,
        confirmButtonText: "حسنًا",
      });
    }
    alert(title + (text ? "\n" + text : ""));
  }

  function whatsappLink(phone) {
    const raw = safe(phone).replace(/\D/g, "");
    if (!raw) return "#";
    const normalized = raw.startsWith("966")
      ? raw
      : raw.startsWith("0")
      ? "966" + raw.slice(1)
      : raw;
    return `https://wa.me/${normalized}`;
  }

  function dataItem(label, value) {
    return `
      <div class="data-item">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function tableFromRows(headers, rows) {
    if (!rows || !rows.length) {
      return `<div class="empty-state">لا توجد بيانات حالياً</div>`;
    }

    return `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr>
              ${headers.map((h) => `<th>${escapeHtml(h.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                return `
                  <tr>
                    ${headers
                      .map((h) => {
                        if (typeof h.render === "function") {
                          return `<td>${h.render(row)}</td>`;
                        }
                        return `<td>${escapeHtml(row[h.key])}</td>`;
                      })
                      .join("")}
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function roleCan(role, roles) {
    return roles.includes(role);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = safe(value);
  }

  function csvDownload(filename, content) {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function initHome() {
    const setupBtn = byId("setupSystemBtn");
    if (!setupBtn) return;

    setupBtn.addEventListener("click", async () => {
      try {
        const result = await api("setupSystem");
        await toast("success", "تمت التهيئة بنجاح", result.message || "");
      } catch (error) {
        await toast("error", "تعذر تنفيذ التهيئة", error.message);
      }
    });
  }

  async function initRegisterPage() {
    const form = byId("registrationForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = Object.fromEntries(new FormData(form).entries());

      try {
        const result = await api("registerStudent", data);
        form.reset();
        await toast("success", "تم إرسال طلب التسجيل", `رقم الطلب: ${result.requestId}`);
      } catch (error) {
        await toast("error", "تعذر إرسال الطلب", error.message);
      }
    });
  }

  async function initLookupPage() {
    const form = byId("studentLookupForm");
    const resultWrap = byId("studentResult");
    if (!form || !resultWrap) return;

    let currentLookup = null;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const data = Object.fromEntries(new FormData(form).entries());
        const result = await api("lookupStudent", data);
        currentLookup = result;

        const st = result.student || {};
        resultWrap.innerHTML = `
          <div class="section-card">
            <div class="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-3">
              <div>
                <h4 class="mb-1 fw-bold">${escapeHtml(st["اسم_الطالب"])}</h4>
                <div class="small-muted">
                  الحلقة: ${escapeHtml(st["الحلقة"] || "غير محددة")} — الحالة: ${escapeHtml(st["حالة_الطالب"] || "-")}
                </div>
              </div>
              <button class="btn btn-outline-primary" id="openUpdateModalBtn">طلب تعديل / تعبئة</button>
            </div>

            <div class="data-grid">
              ${dataItem("هوية الطالب", st["هوية_الطالب"])}
              ${dataItem("جوال الطالب", st["جوال_الطالب"])}
              ${dataItem("تاريخ الميلاد", st["تاريخ_الميلاد"])}
              ${dataItem("العنوان", st["العنوان"])}
              ${dataItem("المرحلة الدراسية", st["المرحلة_الدراسية"])}
              ${dataItem("الصف الدراسي", st["الصف_الدراسي"])}
              ${dataItem("اسم ولي الأمر", st["اسم_ولي_الأمر"])}
              ${dataItem("جوال ولي الأمر", st["جوال_ولي_الأمر"])}
              ${dataItem("هوية ولي الأمر", st["هوية_ولي_الأمر"])}
              ${dataItem("صلة ولي الأمر", st["صلة_ولي_الأمر"])}
              ${dataItem("الحلقة", st["الحلقة"])}
              ${dataItem("مجموع الحفظ", st["مجموع_الحفظ"] || "")}
            </div>
          </div>
        `;

        const btn = byId("openUpdateModalBtn");
        if (btn) btn.addEventListener("click", openUpdateDialog);
      } catch (error) {
        resultWrap.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
      }
    });

    async function openUpdateDialog() {
      if (!currentLookup || !window.Swal) return;

      const st = currentLookup.student || {};
      const editableFields = [
        "جوال_الطالب",
        "تاريخ_الميلاد",
        "العنوان",
        "المرحلة_الدراسية",
        "الصف_الدراسي",
        "مجموع_الحفظ",
        "الحلقة",
      ];

      const html = editableFields
        .map((field) => {
          return `
            <label class="form-label mt-2">${escapeHtml(field)}</label>
            <input id="f_${field}" class="form-control" value="${escapeHtml(st[field])}">
          `;
        })
        .join("");

      const { value } = await Swal.fire({
        title: "طلب تعديل بيانات الطالب",
        html: `<div class="text-end">${html}</div>`,
        focusConfirm: false,
        confirmButtonText: "إرسال الطلب",
        preConfirm: () => {
          const fields = {};
          editableFields.forEach((field) => {
            const input = document.getElementById(`f_${field}`);
            fields[field] = input ? input.value : "";
          });
          return fields;
        },
      });

      if (!value) return;

      try {
        const result = await api("submitStudentUpdates", {
          studentId: st["معرف_الطالب"],
          fields: value,
        });

        const direct = (result.updatedDirectly || []).length
          ? result.updatedDirectly.join("، ")
          : "لا يوجد";
        const reqs = (result.updateRequests || []).length
          ? "\nطلبات التعديل: " + result.updateRequests.join("، ")
          : "";

        await toast("success", "تم استلام الطلب", `تم التحديث المباشر: ${direct}${reqs}`);
      } catch (error) {
        await toast("error", "تعذر إرسال الطلب", error.message);
      }
    }
  }

  async function initLoginPage() {
    const form = byId("staffLoginForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const pin = safe(byId("staffPin")?.value).trim();
        const session = await api("login", { pin });
        saveSession(session);
        location.href = "staff-dashboard.html";
      } catch (error) {
        await toast("error", "تعذر تسجيل الدخول", error.message);
      }
    });
  }

  async function initDashboardPage() {
    const root = byId("dashboardRoot");
    if (!root) return;

    if (!state.session?.token) {
      location.href = "staff-login.html";
      return;
    }

    setText("currentUserName", state.session.name);
    setText("currentUserRole", state.session.role);

    const logoutBtn = byId("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await api("logout", { token: state.session.token });
        } catch (_e) {
        }
        clearSession();
        location.href = "staff-login.html";
      });
    }

    const refreshBtn = byId("refreshDashboardBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", loadDashboard);
    }

    qsa(".side-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        switchPanel(link.dataset.panel, link);
      });
    });

    await loadDashboard();
  }

  function switchPanel(panelId, clickedLink) {
    qsa(".page-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === panelId);
    });

    qsa(".side-link").forEach((link) => {
      link.classList.toggle(
        "active",
        link === clickedLink || link.dataset.panel === panelId
      );
    });
  }

  async function loadDashboard() {
    try {
      state.dashboard = await api("getDashboard", { token: state.session.token });

      const role = state.dashboard?.session?.role || state.session?.role || "";
      const stats = state.dashboard?.stats || {};

      renderKpis(stats);
      renderStudents(role);
      renderRequests(role);
      renderWarnings(role);
      renderSettings(role);

      const firstPanel = qs('.side-link[data-panel="panelStudents"]');
      if (firstPanel) switchPanel("panelStudents", firstPanel);
    } catch (error) {
      if (safe(error.message).includes("الجلسة")) {
        clearSession();
        location.href = "staff-login.html";
        return;
      }
      await toast("error", "تعذر تحميل اللوحة", error.message);
    }
  }

  function renderKpis(stats) {
    const wrap = byId("kpis");
    if (!wrap) return;

    const items = [
      ["عدد الطلاب", stats.students || 0, "fa-users"],
      ["عدد الحلق", stats.circles || 0, "fa-layer-group"],
      ["الطلبات الجديدة", stats.newRequests || 0, "fa-file-circle-plus"],
      ["طلبات الانتظار", stats.waitingRequests || 0, "fa-hourglass-half"],
      ["الإنذارات التعليمية المفتوحة", stats.openEducationalWarnings || 0, "fa-triangle-exclamation"],
      ["الإنذارات الإدارية الجديدة", stats.newAdministrativeWarnings || 0, "fa-bell"],
    ];

    wrap.innerHTML = items
      .map(([label, value, icon]) => {
        return `
          <div class="col-md-4 col-lg-4">
            <div class="kpi-card">
              <i class="fa-solid ${icon} bg-icon-float"></i>
              <div class="kpi-label">${escapeHtml(label)}</div>
              <div class="kpi-value">${escapeHtml(value)}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderStudents(role) {
    const wrap = byId("studentsTableWrap");
    if (!wrap || !state.dashboard) return;

    const students = state.dashboard.datasets?.students || [];

    wrap.innerHTML = tableFromRows(
      [
        {
          label: "الاسم",
          key: "اسم_الطالب",
          render: (r) =>
            `<button class="btn btn-link p-0 student-detail-btn" data-id="${escapeHtml(
              r["معرف_الطالب"]
            )}">${escapeHtml(r["اسم_الطالب"])}</button>`,
        },
        { label: "الهوية", key: "هوية_الطالب" },
        { label: "الحلقة", key: "الحلقة" },
        { label: "المعلم", key: "المعلم" },
        { label: "مجموع الحفظ", key: "مجموع_الحفظ" },
        { label: "حالة الطالب", key: "حالة_الطالب" },
      ],
      students
    );

    qsa(".student-detail-btn").forEach((btn) => {
      btn.addEventListener("click", () => openStudentDetail(btn.dataset.id));
    });

    const actionsWrap = byId("studentActions");
    const canManage = roleCan(role, ["مشرف إداري", "مدير"]);
    if (actionsWrap) actionsWrap.classList.toggle("d-none", !canManage);

    if (!canManage) return;

    const addBtn = byId("openAddStudentBtn");
    const bulkBtn = byId("openBulkUpdateBtn");
    const exportBtn = byId("exportCsvBtn");

    if (addBtn) addBtn.onclick = () => openStudentForm();
    if (bulkBtn) bulkBtn.onclick = () => openBulkDialog();
    if (exportBtn) exportBtn.onclick = () => exportStudentsCsv();
  }

  async function openStudentDetail(studentId) {
    if (!state.dashboard || !window.Swal) return;

    const st = (state.dashboard.datasets?.students || []).find(
      (s) => safe(s["معرف_الطالب"]) === safe(studentId)
    );
    if (!st) return;

    const notes = (state.dashboard.datasets?.teacherNotes || []).filter(
      (n) => safe(n["معرف_الطالب"]) === safe(studentId)
    );

    const role = state.dashboard?.session?.role || "";
    const canEdit = roleCan(role, ["مشرف إداري", "مدير"]);

    const notesHtml = notes.length
      ? notes
          .map(
            (n) => `
              <div class="border rounded-3 p-2 mb-2">
                <div class="fw-bold">${escapeHtml(n["المعلم"])}</div>
                <div class="small-muted mb-1">${escapeHtml(n["تاريخ_الإضافة"])}</div>
                <div>${escapeHtml(n["الملاحظة"])}</div>
              </div>
            `
          )
          .join("")
      : `<div class="small-muted">لا توجد ملاحظات</div>`;

    await Swal.fire({
      title: escapeHtml(st["اسم_الطالب"]),
      width: 900,
      confirmButtonText: canEdit ? "إغلاق" : "حسنًا",
      html: `
        <div class="text-end">
          <div class="data-grid mb-4">
            ${dataItem("هوية الطالب", st["هوية_الطالب"])}
            ${dataItem("جوال الطالب", st["جوال_الطالب"])}
            ${dataItem("العنوان", st["العنوان"])}
            ${dataItem("المرحلة الدراسية", st["المرحلة_الدراسية"])}
            ${dataItem("الصف الدراسي", st["الصف_الدراسي"])}
            ${dataItem("اسم ولي الأمر", st["اسم_ولي_الأمر"])}
            ${dataItem("جوال ولي الأمر", st["جوال_ولي_الأمر"])}
            ${dataItem("الحلقة", st["الحلقة"])}
            ${dataItem("المعلم", st["المعلم"])}
            ${dataItem("مجموع الحفظ", st["مجموع_الحفظ"])}
            ${dataItem("حالة الطالب", st["حالة_الطالب"])}
          </div>
          <div>
            <h6 class="fw-bold mb-2">ملاحظات الطالب</h6>
            ${notesHtml}
          </div>
        </div>
      `,
      showDenyButton: canEdit,
      denyButtonText: "تعديل البيانات",
    }).then(async (result) => {
      if (result.isDenied && canEdit) {
        await openStudentForm(st);
      }
    });
  }

  async function openStudentForm(student = null) {
    if (!window.Swal || !state.dashboard) return;

    const lists = state.dashboard.datasets?.lists || {};
    const circles = lists.circles || [];
    const grades = lists.grades || [];
    const stages = lists.stages || [];
    const statuses = lists.statuses || [];
    const relations = lists.relations || [];

    const selectHtml = (id, items, valueKey, selectedValue) => {
      const options = items
        .map((item) => {
          const value = safe(item[valueKey]);
          const selected = value === safe(selectedValue) ? "selected" : "";
          return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(value)}</option>`;
        })
        .join("");
      return `<select id="${id}" class="form-select"><option value="">-- اختر --</option>${options}</select>`;
    };

    const html = `
      <div class="text-end">
        <div class="row g-2">
          <div class="col-md-6">
            <label class="form-label">اسم الطالب</label>
            <input id="sf_studentName" class="form-control" value="${escapeHtml(student?.["اسم_الطالب"])}">
          </div>
          <div class="col-md-6">
            <label class="form-label">هوية الطالب</label>
            <input id="sf_studentNationalId" class="form-control" value="${escapeHtml(student?.["هوية_الطالب"])}">
          </div>
          <div class="col-md-6">
            <label class="form-label">جوال الطالب</label>
            <input id="sf_studentMobile" class="form-control" value="${escapeHtml(student?.["جوال_الطالب"])}">
          </div>
          <div class="col-md-6">
            <label class="form-label">تاريخ الميلاد</label>
            <input id="sf_studentBirthDate" type="date" class="form-control" value="${escapeHtml(student?.["تاريخ_الميلاد"])}">
          </div>
          <div class="col-md-12">
            <label class="form-label">العنوان</label>
            <input id="sf_studentAddress" class="form-control" value="${escapeHtml(student?.["العنوان"])}">
          </div>
          <div class="col-md-6">
            <label class="form-label">المرحلة</label>
            ${selectHtml("sf_stage", stages, "الاسم", student?.["المرحلة_الدراسية"])}
          </div>
          <div class="col-md-6">
            <label class="form-label">الصف</label>
            ${selectHtml("sf_grade", grades, "الاسم", student?.["الصف_الدراسي"])}
          </div>
          <div class="col-md-6">
            <label class="form-label">اسم ولي الأمر</label>
            <input id="sf_guardianName" class="form-control" value="${escapeHtml(student?.["اسم_ولي_الأمر"])}">
          </div>
          <div class="col-md-6">
            <label class="form-label">جوال ولي الأمر</label>
            <input id="sf_guardianMobile" class="form-control" value="${escapeHtml(student?.["جوال_ولي_الأمر"])}">
          </div>
          <div class="col-md-6">
            <label class="form-label">هوية ولي الأمر</label>
            <input id="sf_guardianNationalId" class="form-control" value="${escapeHtml(student?.["هوية_ولي_الأمر"])}">
          </div>
          <div class="col-md-6">
            <label class="form-label">صلة ولي الأمر</label>
            ${selectHtml("sf_guardianRelation", relations, "الاسم", student?.["صلة_ولي_الأمر"])}
          </div>
          <div class="col-md-6">
            <label class="form-label">الحلقة</label>
            ${selectHtml("sf_circle", circles, "اسم_الحلقة", student?.["الحلقة"])}
          </div>
          <div class="col-md-6">
            <label class="form-label">المعلم</label>
            <input id="sf_teacher" class="form-control" value="${escapeHtml(student?.["المعلم"])}">
          </div>
          <div class="col-md-6">
            <label class="form-label">مجموع الحفظ</label>
            <input id="sf_savedParts" class="form-control" value="${escapeHtml(student?.["مجموع_الحفظ"])}">
          </div>
          <div class="col-md-6">
            <label class="form-label">حالة الطالب</label>
            ${selectHtml("sf_studentStatus", statuses, "الاسم", student?.["حالة_الطالب"])}
          </div>
          <div class="col-md-4">
            <label class="form-label">عدد التأخر</label>
            <input id="sf_lateCount" type="number" min="0" class="form-control" value="${escapeHtml(student?.["عدد_التأخر"] || 0)}">
          </div>
          <div class="col-md-4">
            <label class="form-label">عدد الغياب</label>
            <input id="sf_absenceCount" type="number" min="0" class="form-control" value="${escapeHtml(student?.["عدد_الغياب"] || 0)}">
          </div>
          <div class="col-md-4">
            <label class="form-label">عدد الغياب بعذر</label>
            <input id="sf_excusedAbsenceCount" type="number" min="0" class="form-control" value="${escapeHtml(student?.["عدد_الغياب_بعذر"] || 0)}">
          </div>
        </div>
      </div>
    `;

    const { value } = await Swal.fire({
      title: student ? "تعديل بيانات الطالب" : "إضافة طالب جديد",
      html,
      width: 1000,
      focusConfirm: false,
      confirmButtonText: student ? "حفظ التعديلات" : "إضافة الطالب",
      preConfirm: () => {
        return {
          studentId: student?.["معرف_الطالب"] || "",
          studentName: safe(byId("sf_studentName")?.value).trim(),
          studentNationalId: safe(byId("sf_studentNationalId")?.value).trim(),
          studentMobile: safe(byId("sf_studentMobile")?.value).trim(),
          studentBirthDate: safe(byId("sf_studentBirthDate")?.value).trim(),
          studentAddress: safe(byId("sf_studentAddress")?.value).trim(),
          stage: safe(byId("sf_stage")?.value).trim(),
          grade: safe(byId("sf_grade")?.value).trim(),
          guardianName: safe(byId("sf_guardianName")?.value).trim(),
          guardianMobile: safe(byId("sf_guardianMobile")?.value).trim(),
          guardianNationalId: safe(byId("sf_guardianNationalId")?.value).trim(),
          guardianRelation: safe(byId("sf_guardianRelation")?.value).trim(),
          circle: safe(byId("sf_circle")?.value).trim(),
          teacher: safe(byId("sf_teacher")?.value).trim(),
          savedParts: safe(byId("sf_savedParts")?.value).trim(),
          studentStatus: safe(byId("sf_studentStatus")?.value).trim(),
          lateCount: safe(byId("sf_lateCount")?.value).trim(),
          absenceCount: safe(byId("sf_absenceCount")?.value).trim(),
          excusedAbsenceCount: safe(byId("sf_excusedAbsenceCount")?.value).trim(),
        };
      },
    });

    if (!value) return;

    try {
      const result = await api("saveStudent", {
        token: state.session.token,
        ...value,
      });
      await toast("success", student ? "تم تحديث الطالب" : "تمت إضافة الطالب", result.message || "");
      await loadDashboard();
    } catch (error) {
      await toast("error", "تعذر حفظ البيانات", error.message);
    }
  }

  async function openBulkDialog() {
    if (!window.Swal || !state.dashboard) return;

    const students = state.dashboard.datasets?.students || [];
    const lists = state.dashboard.datasets?.lists || {};
    const circles = lists.circles || [];
    const grades = lists.grades || [];
    const statuses = lists.statuses || [];

    const multiStudents = students
      .map(
        (s) =>
          `<option value="${escapeHtml(s["معرف_الطالب"])}">${escapeHtml(
            s["اسم_الطالب"]
          )}</option>`
      )
      .join("");

    const selectOptions = (items, key) =>
      items
        .map((item) => `<option value="${escapeHtml(item[key])}">${escapeHtml(item[key])}</option>`)
        .join("");

    const { value } = await Swal.fire({
      title: "تعديل جماعي للطلاب",
      width: 900,
      html: `
        <div class="text-end">
          <label class="form-label">الطلاب</label>
          <select id="bulkStudentIds" class="form-select" multiple size="10">${multiStudents}</select>

          <div class="row g-2 mt-2">
            <div class="col-md-4">
              <label class="form-label">الحلقة</label>
              <select id="bulkCircle" class="form-select">
                <option value="">بدون تغيير</option>
                ${selectOptions(circles, "اسم_الحلقة")}
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label">الصف</label>
              <select id="bulkGrade" class="form-select">
                <option value="">بدون تغيير</option>
                ${selectOptions(grades, "الاسم")}
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label">حالة الطالب</label>
              <select id="bulkStatus" class="form-select">
                <option value="">بدون تغيير</option>
                ${selectOptions(statuses, "الاسم")}
              </select>
            </div>
            <div class="col-md-12">
              <label class="form-label">مجموع الحفظ</label>
              <input id="bulkSavedParts" class="form-control" placeholder="مثال: 5 أجزاء">
            </div>
          </div>
        </div>
      `,
      confirmButtonText: "تنفيذ التعديل",
      preConfirm: () => {
        const select = byId("bulkStudentIds");
        const ids = Array.from(select?.selectedOptions || []).map((o) => o.value);
        return {
          studentIds: ids,
          circle: safe(byId("bulkCircle")?.value).trim(),
          grade: safe(byId("bulkGrade")?.value).trim(),
          studentStatus: safe(byId("bulkStatus")?.value).trim(),
          savedParts: safe(byId("bulkSavedParts")?.value).trim(),
        };
      },
    });

    if (!value) return;
    if (!value.studentIds || !value.studentIds.length) {
      await toast("warning", "تنبيه", "اختر طالبًا واحدًا على الأقل");
      return;
    }

    try {
      const result = await api("bulkUpdateStudents", {
        token: state.session.token,
        ...value,
      });
      await toast("success", "تم التعديل الجماعي", result.message || "");
      await loadDashboard();
    } catch (error) {
      await toast("error", "تعذر تنفيذ التعديل", error.message);
    }
  }

  async function exportStudentsCsv() {
    try {
      const result = await api("exportStudentsCsv", {
        token: state.session.token,
      });
      csvDownload(result.filename, result.content);
    } catch (error) {
      await toast("error", "تعذر تصدير CSV", error.message);
    }
  }

  function renderRequests(role) {
    const wrap = byId("requestsPanelWrap");
    if (!wrap || !state.dashboard) return;

    const canManage = roleCan(role, ["مشرف إداري", "مدير"]);
    wrap.classList.toggle("d-none", !canManage);
    if (!canManage) return;

    const ds = state.dashboard.datasets || {};
    const reqs = ds.registrationRequests || [];
    const upd = ds.updateRequests || [];
    const circles = ds.lists?.circles || [];

    const circlesOptions = circles
      .map(
        (c) => `<option value="${escapeHtml(c["اسم_الحلقة"])}">${escapeHtml(c["اسم_الحلقة"])}</option>`
      )
      .join("");

    const regTable = byId("registrationRequestsTable");
    const updTable = byId("updateRequestsTable");

    if (regTable) {
      regTable.innerHTML = tableFromRows(
        [
          { label: "اسم الطالب", key: "اسم_الطالب" },
          { label: "هوية الطالب", key: "هوية_الطالب" },
          {
            label: "جوال الطالب",
            key: "جوال_الطالب",
            render: (r) =>
              `<a href="${whatsappLink(r["جوال_الطالب"])}" target="_blank">${escapeHtml(
                r["جوال_الطالب"]
              )}</a>`,
          },
          {
            label: "جوال ولي الأمر",
            key: "جوال_ولي_الأمر",
            render: (r) =>
              `<a href="${whatsappLink(r["جوال_ولي_الأمر"])}" target="_blank">${escapeHtml(
                r["جوال_ولي_الأمر"]
              )}</a>`,
          },
          { label: "المرحلة", key: "المرحلة_الدراسية" },
          { label: "الصف", key: "الصف_الدراسي" },
          { label: "الحالة", key: "الحالة" },
          {
            label: "إجراءات",
            render: (r) => `
              <div class="d-flex gap-1 flex-wrap">
                <button class="btn btn-sm btn-success reg-act" data-id="${escapeHtml(r["معرف_الطلب"])}" data-status="مقبول">قبول</button>
                <button class="btn btn-sm btn-warning reg-act" data-id="${escapeHtml(r["معرف_الطلب"])}" data-status="انتظار">انتظار</button>
                <button class="btn btn-sm btn-danger reg-act" data-id="${escapeHtml(r["معرف_الطلب"])}" data-status="مرفوض">رفض</button>
              </div>
            `,
          },
        ],
        reqs
      );

      qsa(".reg-act", regTable).forEach((btn) => {
        btn.addEventListener("click", async () => {
          const status = btn.dataset.status;
          const requestId = btn.dataset.id;
          let circle = "";
          let teacher = "";
          let rejectionReason = "";

          if (status === "مقبول") {
            const { value } = await Swal.fire({
              title: "قبول الطلب",
              html: `
                <div class="text-end">
                  <label class="form-label d-block">الحلقة</label>
                  <select id="accCircle" class="form-select">${circlesOptions}</select>
                  <label class="form-label d-block mt-2">المعلم</label>
                  <input id="accTeacher" class="form-control">
                </div>
              `,
              confirmButtonText: "اعتماد",
              preConfirm: () => ({
                circle: safe(byId("accCircle")?.value).trim(),
                teacher: safe(byId("accTeacher")?.value).trim(),
              }),
            });
            if (!value) return;
            circle = value.circle;
            teacher = value.teacher;
          }

          if (status === "مرفوض") {
            const { value } = await Swal.fire({
              title: "سبب الرفض",
              input: "text",
              inputLabel: "اكتب سبب الرفض",
              confirmButtonText: "اعتماد الرفض",
            });
            if (!value) return;
            rejectionReason = value;
          }

          try {
            await api("processRegistrationRequest", {
              token: state.session.token,
              requestId,
              status,
              circle,
              teacher,
              rejectionReason,
            });
            await toast("success", "تم تحديث الطلب");
            await loadDashboard();
          } catch (error) {
            await toast("error", "تعذر تحديث الطلب", error.message);
          }
        });
      });
    }

    if (updTable) {
      updTable.innerHTML = tableFromRows(
        [
          { label: "اسم الطالب", key: "اسم_الطالب" },
          { label: "الحقل", key: "الحقل" },
          { label: "القيمة السابقة", key: "القيمة_السابقة" },
          { label: "القيمة الجديدة", key: "القيمة_الجديدة" },
          { label: "الحالة", key: "الحالة" },
          {
            label: "إجراء",
            render: (r) => `
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-success upd-act" data-id="${escapeHtml(r["معرف_الطلب"])}" data-status="مقبول">قبول</button>
                <button class="btn btn-sm btn-danger upd-act" data-id="${escapeHtml(r["معرف_الطلب"])}" data-status="مرفوض">رفض</button>
              </div>
            `,
          },
        ],
        upd
      );

      qsa(".upd-act", updTable).forEach((btn) => {
        btn.addEventListener("click", async () => {
          let rejectionReason = "";

          if (btn.dataset.status === "مرفوض") {
            const { value } = await Swal.fire({
              title: "سبب الرفض",
              input: "text",
            });
            if (!value) return;
            rejectionReason = value;
          }

          try {
            await api("processUpdateRequest", {
              token: state.session.token,
              requestId: btn.dataset.id,
              status: btn.dataset.status,
              rejectionReason,
            });
            await toast("success", "تمت معالجة طلب التعديل");
            await loadDashboard();
          } catch (error) {
            await toast("error", "تعذر المعالجة", error.message);
          }
        });
      });
    }
  }

  function renderWarnings(role) {
    if (!state.dashboard) return;

    const ds = state.dashboard.datasets || {};

    const teacherToolsWrap = byId("teacherToolsWrap");
    const eduToolsWrap = byId("educationalToolsWrap");
    const adminToolsWrap = byId("adminWarningsToolsWrap");

    if (teacherToolsWrap) {
      teacherToolsWrap.classList.toggle(
        "d-none",
        !roleCan(role, ["معلم", "مدير", "مشرف إداري"])
      );
    }

    if (eduToolsWrap) {
      eduToolsWrap.classList.toggle(
        "d-none",
        !roleCan(role, ["مشرف تعليمي", "مشرف إداري", "مدير"])
      );
    }

    if (adminToolsWrap) {
      adminToolsWrap.classList.toggle(
        "d-none",
        !roleCan(role, ["مشرف إداري", "مدير"])
      );
    }

    const notesTable = byId("notesTable");
    if (notesTable) {
      notesTable.innerHTML = tableFromRows(
        [
          { label: "الطالب", key: "اسم_الطالب" },
          { label: "الحلقة", key: "الحلقة" },
          { label: "المعلم", key: "المعلم" },
          { label: "الملاحظة", key: "الملاحظة" },
          { label: "التاريخ", key: "تاريخ_الإضافة" },
        ],
        ds.teacherNotes || []
      );
    }

    const eduWarningsTable = byId("eduWarningsTable");
    if (eduWarningsTable) {
      eduWarningsTable.innerHTML = tableFromRows(
        [
          { label: "الطالب", key: "اسم_الطالب" },
          { label: "الحلقة", key: "الحلقة" },
          { label: "السبب", key: "سبب_الإنذار" },
          { label: "الإجراء الحالي", key: "الإجراء_الحالي" },
          { label: "الحالة", key: "الحالة" },
          {
            label: "إجراء",
            render: (r) =>
              `<button class="btn btn-sm btn-outline-primary warning-update" data-type="تعليمي" data-id="${escapeHtml(
                r["معرف_الإنذار"]
              )}">تحديث</button>`,
          },
        ],
        ds.educationalWarnings || []
      );
    }

    const adminWarningsTable = byId("adminWarningsTable");
    if (adminWarningsTable) {
      adminWarningsTable.innerHTML = tableFromRows(
        [
          { label: "الطالب", key: "اسم_الطالب" },
          { label: "الحلقة", key: "الحلقة" },
          { label: "النوع", key: "نوع_الإنذار" },
          { label: "رقم العتبة", key: "رقم_العتبة" },
          { label: "عدد الحالات", key: "عدد_الحالات" },
          { label: "الإجراء الحالي", key: "الإجراء_الحالي" },
          { label: "الحالة", key: "الحالة" },
          { label: "الرسالة", key: "قالب_الرسالة" },
          {
            label: "إجراء",
            render: (r) =>
              `<button class="btn btn-sm btn-outline-primary warning-update" data-type="إداري" data-id="${escapeHtml(
                r["معرف_الإنذار"]
              )}">تحديث</button>`,
          },
        ],
        ds.administrativeWarnings || []
      );
    }

    qsa(".warning-update").forEach((btn) => {
      btn.addEventListener("click", () => openWarningUpdate(btn.dataset.type, btn.dataset.id));
    });

    const addTeacherNoteBtn = byId("addTeacherNoteBtn");
    if (addTeacherNoteBtn) addTeacherNoteBtn.onclick = () => openTeacherNoteDialog();

    const addEduWarningBtn = byId("addEduWarningBtn");
    if (addEduWarningBtn) addEduWarningBtn.onclick = () => openEduWarningDialog();

    const generateAdminWarningsBtn = byId("generateAdminWarningsBtn");
    if (generateAdminWarningsBtn) {
      generateAdminWarningsBtn.onclick = async () => {
        try {
          const result = await api("generateAdministrativeWarnings", {
            token: state.session.token,
          });

          await toast(
            "success",
            "تم توليد الإنذارات",
            (result.created || []).length ? result.created.join("، ") : "لا توجد حالات جديدة"
          );

          await loadDashboard();
        } catch (error) {
          await toast("error", "تعذر التوليد", error.message);
        }
      };
    }
  }

  async function openTeacherNoteDialog() {
    if (!window.Swal || !state.dashboard) return;

    const students = state.dashboard.datasets?.students || [];
    const opts = students
      .map(
        (s) => `<option value="${escapeHtml(s["معرف_الطالب"])}">${escapeHtml(s["اسم_الطالب"])}</option>`
      )
      .join("");

    const { value } = await Swal.fire({
      title: "إضافة ملاحظة",
      html: `
        <div class="text-end">
          <label class="form-label d-block">الطالب</label>
          <select id="noteStudent" class="form-select">${opts}</select>
          <label class="form-label d-block mt-2">الملاحظة</label>
          <textarea id="noteText" class="form-control" rows="4"></textarea>
        </div>
      `,
      confirmButtonText: "حفظ",
      preConfirm: () => ({
        studentId: safe(byId("noteStudent")?.value).trim(),
        note: safe(byId("noteText")?.value).trim(),
      }),
    });

    if (!value) return;

    try {
      await api("addTeacherNote", {
        token: state.session.token,
        ...value,
      });
      await toast("success", "تم حفظ الملاحظة");
      await loadDashboard();
    } catch (error) {
      await toast("error", "تعذر الحفظ", error.message);
    }
  }

  async function openEduWarningDialog() {
    if (!window.Swal || !state.dashboard) return;

    const students = state.dashboard.datasets?.students || [];
    const opts = students
      .map(
        (s) => `<option value="${escapeHtml(s["معرف_الطالب"])}">${escapeHtml(s["اسم_الطالب"])}</option>`
      )
      .join("");

    const { value } = await Swal.fire({
      title: "إنذار تعليمي جديد",
      html: `
        <div class="text-end">
          <label class="form-label d-block">الطالب</label>
          <select id="ewStudent" class="form-select">${opts}</select>
          <label class="form-label d-block mt-2">السبب</label>
          <textarea id="ewReason" class="form-control" rows="4"></textarea>
          <label class="form-label d-block mt-2">الإجراء الحالي</label>
          <input id="ewAction" class="form-control" value="جديد">
        </div>
      `,
      confirmButtonText: "إنشاء",
      preConfirm: () => ({
        studentId: safe(byId("ewStudent")?.value).trim(),
        reason: safe(byId("ewReason")?.value).trim(),
        actionName: safe(byId("ewAction")?.value).trim(),
      }),
    });

    if (!value) return;

    try {
      await api("addEducationalWarning", {
        token: state.session.token,
        ...value,
      });
      await toast("success", "تم إنشاء الإنذار");
      await loadDashboard();
    } catch (error) {
      await toast("error", "تعذر الإنشاء", error.message);
    }
  }

  async function openWarningUpdate(type, id) {
    if (!window.Swal) return;

    const { value } = await Swal.fire({
      title: "تحديث الإنذار",
      html: `
        <div class="text-end">
          <label class="form-label d-block">الإجراء الحالي</label>
          <input id="waAction" class="form-control" value="تم التواصل">
          <label class="form-label d-block mt-2">الحالة</label>
          <select id="waStatus" class="form-select">
            <option>جديد</option>
            <option>متابعة</option>
            <option>تم التواصل</option>
            <option>استدعاء ولي الأمر</option>
            <option>مكتمل</option>
            <option>مغلق</option>
          </select>
        </div>
      `,
      confirmButtonText: "حفظ",
      preConfirm: () => ({
        actionName: safe(byId("waAction")?.value).trim(),
        status: safe(byId("waStatus")?.value).trim(),
      }),
    });

    if (!value) return;

    try {
      await api("updateWarningAction", {
        token: state.session.token,
        warningType: type,
        warningId: id,
        ...value,
      });
      await toast("success", "تم تحديث الإنذار");
      await loadDashboard();
    } catch (error) {
      await toast("error", "تعذر التحديث", error.message);
    }
  }

  function renderSettings(role) {
    const wrap = byId("settingsWrap");
    if (!wrap || !state.dashboard) return;

    const canManage = roleCan(role, ["مشرف إداري", "مدير"]);
    wrap.classList.toggle("d-none", !canManage);
    if (!canManage) return;

    const lists = state.dashboard.datasets?.lists || {};
    const groups = [
      ["الحلق", lists.circles || [], "اسم_الحلقة"],
      ["المستخدمون", lists.users || [], "الاسم"],
      ["قوالب الرسائل", lists.templates || [], "العنوان"],
      ["عتبات الإنذارات", lists.thresholds || [], "نوع_الإنذار"],
      ["إجراءات الإنذارات", lists.actions || [], "الاسم"],
    ];

    wrap.innerHTML = groups
      .map(([title, items, key]) => {
        return `
          <div class="col-md-6">
            <div class="section-card h-100">
              <h5 class="fw-bold mb-2">${escapeHtml(title)}</h5>
              <div class="small-muted mb-3">عدد السجلات: ${items.length}</div>
              <div class="border rounded-3 p-2" style="max-height:220px;overflow:auto">
                ${
                  items.length
                    ? items
                        .map(
                          (item) =>
                            `<div class="py-1 border-bottom small">${escapeHtml(item[key])}</div>`
                        )
                        .join("")
                    : `<div class="small-muted">لا توجد عناصر</div>`
                }
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await initHome();
      await initRegisterPage();
      await initLookupPage();
      await initLoginPage();
      await initDashboardPage();
    } catch (error) {
      console.error(error);
    }
  });

  window.NSAR_APP = {
    api,
    state,
    clearSession,
    saveSession,
    loadDashboard,
  };
})();
