(function(){
  const CONFIG = window.APP_CONFIG || {};
  const STORAGE_KEY = 'nsar_session_v2';
  const state = {
    session: JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'),
    dashboard: null
  };

  function byId(id){return document.getElementById(id)}
  function showLoading(show){const el=byId('loadingOverlay'); if(el) el.classList.toggle('show', !!show)}
  function ensureApi(){
    if(!CONFIG.API_URL || CONFIG.API_URL.includes('ضع-')) throw new Error('أكمل ملف config.js وضع رابط Google Apps Script المنشور');
  }
  async function api(action, payload={}){
    ensureApi();
    showLoading(true);
    try{
      const res = await fetch(CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action}, payload))});
      const json = await res.json();
      if(!json.success) throw new Error(json.error || 'حدث خطأ');
      return json.data;
    }finally{showLoading(false)}
  }
  function toast(icon,title,text=''){ if(window.Swal) return Swal.fire({icon,title,text,confirmButtonText:'حسنًا'}); alert(title + (text ? '\n'+text : '')); }
  function setSession(data){ state.session=data; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  function clearSession(){ state.session=null; localStorage.removeItem(STORAGE_KEY); }
  function roleCan(role, roles){ return roles.includes(role); }
  function dataItem(label,val){ return `<div class="data-item"><div class="label">${label}</div><div class="value">${val ?? ''}</div></div>`; }
  function whats(num){ return `https://wa.me/966${String(num).replace(/^0/,'')}`; }
  function safe(v){ return v==null?'':String(v); }
  function tableFromRows(headers, rows){
    if(!rows.length) return `<div class="empty-state">لا توجد بيانات حالياً</div>`;
    return `<div class="table-responsive"><table class="table table-hover align-middle"><thead><tr>${headers.map(h=>`<th>${h.label}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td>${typeof h.render==='function'?h.render(r):safe(r[h.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  async function initHome(){
    const setupBtn = byId('setupSystemBtn');
    if(setupBtn) setupBtn.onclick = async ()=>{
      try{ const res = await api('setupSystem'); await toast('success','تمت التهيئة',res.message); }catch(e){ toast('error','تعذر التهيئة',e.message); }
    };
  }

  async function initRegisterPage(){
    const form = byId('registrationForm'); if(!form) return;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      try{
        const res = await api('registerStudent', data);
        form.reset();
        await toast('success','تم إرسال الطلب',`رقم الطلب: ${res.requestId}`);
      }catch(err){ toast('error','تعذر إرسال الطلب',err.message); }
    });
  }

  async function initLookupPage(){
    const searchForm = byId('studentLookupForm'); if(!searchForm) return;
    let current = null;
    searchForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(searchForm).entries());
      try{
        current = await api('lookupStudent', data);
        const st = current.student;
        byId('studentResult').innerHTML = `<div class="section-card"><div class="d-flex justify-content-between align-items-center mb-3"><div><h4 class="mb-1 fw-bold">${st['اسم_الطالب']}</h4><div class="small-muted">الحلقة: ${st['الحلقة']||'غير محددة'} — الحالة: ${st['حالة_الطالب']||'-'}</div></div><button class="btn btn-outline-primary" id="openUpdateModalBtn">طلب تعديل / تعبئة</button></div><div class="data-grid">${dataItem('هوية الطالب',st['هوية_الطالب'])}${dataItem('جوال الطالب',st['جوال_الطالب'])}${dataItem('تاريخ الميلاد',st['تاريخ_الميلاد'])}${dataItem('العنوان',st['العنوان'])}${dataItem('المرحلة الدراسية',st['المرحلة_الدراسية'])}${dataItem('الصف الدراسي',st['الصف_الدراسي'])}${dataItem('اسم ولي الأمر',st['اسم_ولي_الأمر'])}${dataItem('جوال ولي الأمر',st['جوال_ولي_الأمر'])}${dataItem('صلة ولي الأمر',st['صلة_ولي_الأمر'])}${dataItem('مجموع الحفظ',st['مجموع_الحفظ']||'')}</div></div>`;
        byId('openUpdateModalBtn').onclick = openUpdateDialog;
      }catch(err){ byId('studentResult').innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
    });

    async function openUpdateDialog(){
      if(!current) return;
      const st = current.student;
      const editable = ['جوال_الطالب','تاريخ_الميلاد','العنوان','المرحلة_الدراسية','الصف_الدراسي','مجموع_الحفظ','الحلقة'];
      const html = editable.map(field=>`<label class="form-label mt-2">${field}</label><input id="f_${field}" class="form-control" value="${safe(st[field])}">`).join('');
      const {value} = await Swal.fire({title:'طلب تعديل بيانات الطالب',html:`<div class="text-end">${html}</div>`,focusConfirm:false,preConfirm:()=>{
        const fields={}; editable.forEach(f=>fields[f]=document.getElementById(`f_${f}`).value); return fields; },confirmButtonText:'إرسال الطلب'});
      if(!value) return;
      try{
        const res = await api('submitStudentUpdates',{studentId:st['معرف_الطالب'], fields:value});
        await toast('success','تم استلام الطلب',`تم التحديث المباشر: ${res.updatedDirectly.join('، ') || 'لا يوجد'}${res.updateRequests.length ? '\nطلبات التعديل: '+res.updateRequests.join('، ') : ''}`);
      }catch(err){ toast('error','تعذر إرسال الطلب',err.message); }
    }
  }

  async function initLoginPage(){
    const form = byId('staffLoginForm'); if(!form) return;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      try{
        const pin = byId('staffPin').value.trim();
        const session = await api('login',{pin});
        setSession(session);
        location.href='staff-dashboard.html';
      }catch(err){ toast('error','تعذر تسجيل الدخول',err.message); }
    });
  }

  async function initDashboardPage(){
    if(!byId('dashboardRoot')) return;
    if(!state.session?.token){ location.href='staff-login.html'; return; }
    byId('currentUserName').textContent = state.session.name;
    byId('currentUserRole').textContent = state.session.role;
    byId('logoutBtn').onclick = async ()=>{ try{ await api('logout',{token:state.session.token}); }catch(_e){} clearSession(); location.href='staff-login.html'; };
    document.querySelectorAll('.side-link').forEach(link=>link.onclick = (e)=>{ e.preventDefault(); switchPanel(link.dataset.panel, link); });
    byId('refreshDashboardBtn').onclick = loadDashboard;
    await loadDashboard();
  }

  function switchPanel(name, link){
    document.querySelectorAll('.page-panel').forEach(p=>p.classList.toggle('active', p.id===name));
    document.querySelectorAll('.side-link').forEach(l=>l.classList.toggle('active', l===link || l.dataset.panel===name));
  }

  async function loadDashboard(){
    try{
      state.dashboard = await api('getDashboard',{token:state.session.token});
      const role = state.dashboard.session.role;
      const stats = state.dashboard.stats;
      byId('kpis').innerHTML = [
        ['عدد الطلاب',stats.students,'fa-users'],['عدد الحلق',stats.circles,'fa-layer-group'],['الطلبات الجديدة',stats.newRequests,'fa-file-circle-plus'],['طلبات الانتظار',stats.waitingRequests,'fa-hourglass-half'],['الإنذارات التعليمية المفتوحة',stats.openEducationalWarnings,'fa-triangle-exclamation'],['الإنذارات الإدارية الجديدة',stats.newAdministrativeWarnings,'fa-bell']
      ].map(x=>`<div class="col-md-4 col-lg-4"><div class="kpi-card"><i class="fa-solid ${x[2]} bg-icon-float"></i><div class="kpi-label">${x[0]}</div><div class="kpi-value">${x[1]}</div></div></div>`).join('');
      renderStudents(role);
      renderRequests(role);
      renderWarnings(role);
      renderSettings(role);
      const firstAllowed = role=== 'معلم' ? 'panelStudents' : 'panelStudents';
      switchPanel(firstAllowed, document.querySelector(`.side-link[data-panel="${firstAllowed}"]`));
    }catch(err){
      if(err.message.includes('الجلسة')){ clearSession(); location.href='staff-login.html'; return; }
      toast('error','تعذر تحميل اللوحة',err.message);
    }
  }

  function renderStudents(role){
    const ds = state.dashboard.datasets;
    const students = ds.students;
    byId('studentsTableWrap').innerHTML = tableFromRows([
      {label:'الاسم',key:'اسم_الطالب',render:r=>`<button class="btn btn-link p-0 student-detail-btn" data-id="${r['معرف_الطالب']}">${r['اسم_الطالب']}</button>`},
      {label:'الهوية',key:'هوية_الطالب'}, {label:'الحلقة',key:'الحلقة'}, {label:'المعلم',key:'المعلم'}, {label:'مجموع الحفظ',key:'مجموع_الحفظ'}, {label:'حالة الطالب',key:'حالة_الطالب'}
    ], students);
    document.querySelectorAll('.student-detail-btn').forEach(btn=>btn.onclick = ()=>openStudentDetail(btn.dataset.id));
    const canManage = roleCan(role,['مشرف إداري','مدير']);
    byId('studentActions').classList.toggle('d-none', !canManage);
    if(canManage){
      byId('openAddStudentBtn').onclick = ()=>openStudentForm();
      byId('openBulkUpdateBtn').onclick = ()=>openBulkDialog();
      byId('exportCsvBtn').onclick = ()=>exportCsv(students);
    }
  }

  async function openStudentDetail(id){
    const st = state.dashboard.datasets.students.find(s=>s['معرف_الطالب']===id); if(!st) return;
    const role = state.dashboard.session.role;
    const canEdit = roleCan(role,['مشرف إداري','مدير']);
    const notes = state.dashboard.datasets.teacherNotes.filter(n=>n['معرف_الطالب']===id);
    const html = `<div class="text-end">`+
      `<div class="data-grid mb-3">${['اسم_الطالب','هوية_الطالب','جوال_الطالب','العنوان','المرحلة_الدراسية','الصف_الدراسي','جوال_ولي_الأمر','هوية_ولي_الأمر','صلة_ولي_الأمر','الحلقة','مجموع_الحفظ','حالة_الطالب'].map(k=>dataItem(k,st[k]||'')).join('')}</div>`+
      `<div class="mt-3"><h6 class="fw-bold">ملاحظات المعلمين</h6>${notes.length?notes.map(n=>`<div class="border rounded-3 p-2 mb-2"><div class="small-muted">${n['المعلم']} — ${n['تاريخ_الإضافة']}</div><div>${n['الملاحظة']}</div></div>`).join(''):'<div class="small-muted">لا توجد ملاحظات</div>'}</div>`+
      `</div>`;
    await Swal.fire({title:st['اسم_الطالب'],html,showCancelButton:canEdit,confirmButtonText:'إغلاق',cancelButtonText:'تعديل'}).then(async(result)=>{ if(result.dismiss===Swal.DismissReason.cancel) openStudentForm(st); });
  }

  async function openStudentForm(student=null){
    const lists = state.dashboard.datasets.lists;
    const optionify = (rows,key='الاسم',val='الاسم', current='')=>rows.map(r=>`<option value="${r[val]}" ${String(current)===String(r[val])?'selected':''}>${r[key]}</option>`).join('');
    const html = `
      <div class="text-end">
        <div class="row g-2">
          <div class="col-md-6"><label class="form-label">اسم الطالب</label><input id="studentName" class="form-control" value="${safe(student?.['اسم_الطالب'])}"></div>
          <div class="col-md-6"><label class="form-label">هوية الطالب</label><input id="studentNationalId" class="form-control" value="${safe(student?.['هوية_الطالب'])}"></div>
          <div class="col-md-6"><label class="form-label">جوال الطالب</label><input id="studentMobile" class="form-control" value="${safe(student?.['جوال_الطالب'])}"></div>
          <div class="col-md-6"><label class="form-label">تاريخ الميلاد</label><input id="studentBirthDate" type="date" class="form-control" value="${safe(student?.['تاريخ_الميلاد'])}"></div>
          <div class="col-12"><label class="form-label">العنوان</label><input id="studentAddress" class="form-control" value="${safe(student?.['العنوان'])}"></div>
          <div class="col-md-6"><label class="form-label">المرحلة</label><select id="stage" class="form-select"><option value="">اختر</option>${optionify(lists.stages,'الاسم','الاسم',student?.['المرحلة_الدراسية'])}</select></div>
          <div class="col-md-6"><label class="form-label">الصف</label><select id="grade" class="form-select"><option value="">اختر</option>${optionify(lists.grades,'الاسم','الاسم',student?.['الصف_الدراسي'])}</select></div>
          <div class="col-md-6"><label class="form-label">اسم ولي الأمر</label><input id="guardianName" class="form-control" value="${safe(student?.['اسم_ولي_الأمر'])}"></div>
          <div class="col-md-6"><label class="form-label">جوال ولي الأمر</label><input id="guardianMobile" class="form-control" value="${safe(student?.['جوال_ولي_الأمر'])}"></div>
          <div class="col-md-6"><label class="form-label">هوية ولي الأمر</label><input id="guardianNationalId" class="form-control" value="${safe(student?.['هوية_ولي_الأمر'])}"></div>
          <div class="col-md-6"><label class="form-label">صلة ولي الأمر</label><select id="guardianRelation" class="form-select"><option value="">اختر</option>${optionify(lists.relations,'الاسم','الاسم',student?.['صلة_ولي_الأمر'])}</select></div>
          <div class="col-md-6"><label class="form-label">الحلقة</label><select id="circle" class="form-select"><option value="">اختر</option>${optionify(lists.circles,'اسم_الحلقة','اسم_الحلقة',student?.['الحلقة'])}</select></div>
          <div class="col-md-6"><label class="form-label">المعلم</label><input id="teacher" class="form-control" value="${safe(student?.['المعلم'])}"></div>
          <div class="col-md-4"><label class="form-label">مجموع الحفظ</label><input id="savedParts" class="form-control" value="${safe(student?.['مجموع_الحفظ'])}"></div>
          <div class="col-md-4"><label class="form-label">حالة الطالب</label><select id="studentStatus" class="form-select"><option value="">اختر</option>${optionify(lists.statuses,'الاسم','الاسم',student?.['حالة_الطالب'])}</select></div>
          <div class="col-md-4"><label class="form-label">عدد التأخر</label><input id="lateCount" class="form-control" value="${safe(student?.['عدد_التأخر'])}"></div>
          <div class="col-md-4"><label class="form-label">عدد الغياب</label><input id="absenceCount" class="form-control" value="${safe(student?.['عدد_الغياب'])}"></div>
          <div class="col-md-4"><label class="form-label">عدد الغياب بعذر</label><input id="excusedAbsenceCount" class="form-control" value="${safe(student?.['عدد_الغياب_بعذر'])}"></div>
        </div>
      </div>`;
    const {value} = await Swal.fire({title:student?'تعديل طالب':'إضافة طالب',html,width:900,focusConfirm:false,confirmButtonText:'حفظ',preConfirm:()=>({studentId:student?.['معرف_الطالب']||'',studentName:byId('studentName').value,studentNationalId:byId('studentNationalId').value,studentMobile:byId('studentMobile').value,studentBirthDate:byId('studentBirthDate').value,studentAddress:byId('studentAddress').value,stage:byId('stage').value,grade:byId('grade').value,guardianName:byId('guardianName').value,guardianMobile:byId('guardianMobile').value,guardianNationalId:byId('guardianNationalId').value,guardianRelation:byId('guardianRelation').value,circle:byId('circle').value,teacher:byId('teacher').value,savedParts:byId('savedParts').value,studentStatus:byId('studentStatus').value,lateCount:byId('lateCount').value,absenceCount:byId('absenceCount').value,excusedAbsenceCount:byId('excusedAbsenceCount').value})});
    if(!value) return;
    try{ await api('saveStudent',Object.assign({token:state.session.token}, value)); await toast('success','تم الحفظ'); await loadDashboard(); }catch(err){ toast('error','تعذر الحفظ',err.message); }
  }

  async function openBulkDialog(){
    const ids = state.dashboard.datasets.students.map(s=>`<option value="${s['معرف_الطالب']}">${s['اسم_الطالب']}</option>`).join('');
    const lists = state.dashboard.datasets.lists;
    const circles = lists.circles.map(c=>`<option value="${c['اسم_الحلقة']}">${c['اسم_الحلقة']}</option>`).join('');
    const grades = lists.grades.map(c=>`<option value="${c['الاسم']}">${c['الاسم']}</option>`).join('');
    const statuses = lists.statuses.map(c=>`<option value="${c['الاسم']}">${c['الاسم']}</option>`).join('');
    const {value} = await Swal.fire({title:'تعديل جماعي',html:`<div class="text-end"><label class="form-label">الطلاب</label><select multiple id="bulkIds" class="form-select" style="height:180px">${ids}</select><div class="row g-2 mt-2"><div class="col-md-6"><label class="form-label">الحلقة</label><select id="bulkCircle" class="form-select"><option value="">بدون تغيير</option>${circles}</select></div><div class="col-md-6"><label class="form-label">الصف</label><select id="bulkGrade" class="form-select"><option value="">بدون تغيير</option>${grades}</select></div><div class="col-md-6"><label class="form-label">مجموع الحفظ</label><input id="bulkSaved" class="form-control"></div><div class="col-md-6"><label class="form-label">حالة الطالب</label><select id="bulkStatus" class="form-select"><option value="">بدون تغيير</option>${statuses}</select></div></div></div>`,width:800,focusConfirm:false,confirmButtonText:'تنفيذ',preConfirm:()=>({studentIds:Array.from(byId('bulkIds').selectedOptions).map(o=>o.value),circle:byId('bulkCircle').value,grade:byId('bulkGrade').value,savedParts:byId('bulkSaved').value,studentStatus:byId('bulkStatus').value})});
    if(!value) return;
    try{ await api('bulkUpdateStudents',Object.assign({token:state.session.token},value)); await toast('success','تم التعديل الجماعي'); await loadDashboard(); }catch(err){ toast('error','تعذر التنفيذ',err.message); }
  }

  function exportCsv(rows){
    const headers = Object.keys(rows[0]||{}); if(!headers.length) return;
    const csv = [headers.join(','), ...rows.map(r=>headers.map(h=>`"${String(r[h]??'').replaceAll('"','""')}"`).join(','))].join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='students.csv'; a.click(); URL.revokeObjectURL(url);
  }

  function renderRequests(role){
    const canManage = roleCan(role,['مشرف إداري','مدير']);
    byId('requestsPanelWrap').classList.toggle('d-none', !canManage);
    if(!canManage) return;
    const ds = state.dashboard.datasets;
    const reqs = ds.registrationRequests;
    const upd = ds.updateRequests;
    const circlesOptions = ds.lists.circles.map(c=>`<option value="${c['اسم_الحلقة']}">${c['اسم_الحلقة']}</option>`).join('');
    const reqHeaders = [
      {label:'اسم الطالب',key:'اسم_الطالب'},
      {label:'هوية الطالب',key:'هوية_الطالب'},
      {label:'جوال الطالب',key:'جوال_الطالب',render:r=>`<a href="${whats(r['جوال_الطالب'])}" target="_blank">${r['جوال_الطالب']}</a>`},
      {label:'جوال ولي الأمر',key:'جوال_ولي_الأمر',render:r=>`<a href="${whats(r['جوال_ولي_الأمر'])}" target="_blank">${r['جوال_ولي_الأمر']}</a>`},
      {label:'المرحلة',key:'المرحلة_الدراسية'},
      {label:'الصف',key:'الصف_الدراسي'},
      {label:'الحالة',key:'الحالة'},
      {label:'إجراءات',render:r=>`<div class="d-flex gap-1 flex-wrap"><button class="btn btn-sm btn-success reg-act" data-id="${r['معرف_الطلب']}" data-status="مقبول">قبول</button><button class="btn btn-sm btn-warning reg-act" data-id="${r['معرف_الطلب']}" data-status="انتظار">انتظار</button><button class="btn btn-sm btn-danger reg-act" data-id="${r['معرف_الطلب']}" data-status="مرفوض">رفض</button></div>`}
    ];
    byId('registrationRequestsTable').innerHTML = tableFromRows(reqHeaders, reqs);
    document.querySelectorAll('.reg-act').forEach(btn=>btn.onclick = async ()=>{
      const status = btn.dataset.status, requestId = btn.dataset.id;
      let circle='', teacher='', rejectionReason='';
      if(status==='مقبول'){
        const {value} = await Swal.fire({title:'قبول الطلب',html:`<label class="form-label d-block text-end">الحلقة</label><select id="accCircle" class="form-select">${circlesOptions}</select><label class="form-label d-block text-end mt-2">المعلم</label><input id="accTeacher" class="form-control">`,preConfirm:()=>({circle:byId('accCircle').value,teacher:byId('accTeacher').value}),confirmButtonText:'اعتماد'});
        if(!value) return; circle=value.circle; teacher=value.teacher;
      }
      if(status==='مرفوض'){
        const {value} = await Swal.fire({title:'سبب الرفض',input:'text',inputLabel:'اكتب سبب الرفض',confirmButtonText:'اعتماد الرفض'}); if(!value) return; rejectionReason=value;
      }
      try{ await api('processRegistrationRequest',{token:state.session.token,requestId,status,circle,teacher,rejectionReason}); await toast('success','تم تحديث الطلب'); await loadDashboard(); }catch(err){ toast('error','تعذر تحديث الطلب',err.message); }
    });

    byId('updateRequestsTable').innerHTML = tableFromRows([
      {label:'اسم الطالب',key:'اسم_الطالب'}, {label:'الحقل',key:'الحقل'}, {label:'القيمة السابقة',key:'القيمة_السابقة'}, {label:'القيمة الجديدة',key:'القيمة_الجديدة'}, {label:'الحالة',key:'الحالة'},
      {label:'إجراء',render:r=>`<div class="d-flex gap-1"><button class="btn btn-sm btn-success upd-act" data-id="${r['معرف_الطلب']}" data-status="مقبول">قبول</button><button class="btn btn-sm btn-danger upd-act" data-id="${r['معرف_الطلب']}" data-status="مرفوض">رفض</button></div>`}
    ], upd);
    document.querySelectorAll('.upd-act').forEach(btn=>btn.onclick = async ()=>{
      let rejectionReason=''; if(btn.dataset.status==='مرفوض'){ const {value}= await Swal.fire({title:'سبب الرفض',input:'text'}); if(!value) return; rejectionReason=value; }
      try{ await api('processUpdateRequest',{token:state.session.token,requestId:btn.dataset.id,status:btn.dataset.status,rejectionReason}); await toast('success','تمت معالجة الطلب'); await loadDashboard(); }catch(err){ toast('error','تعذر المعالجة',err.message); }
    });
  }

  function renderWarnings(role){
    const ds = state.dashboard.datasets;
    byId('teacherToolsWrap').classList.toggle('d-none', !roleCan(role,['معلم','مدير','مشرف إداري']));
    byId('educationalToolsWrap').classList.toggle('d-none', !roleCan(role,['مشرف تعليمي','مشرف إداري','مدير']));
    byId('adminWarningsToolsWrap').classList.toggle('d-none', !roleCan(role,['مشرف إداري','مدير']));

    byId('notesTable').innerHTML = tableFromRows([
      {label:'الطالب',key:'اسم_الطالب'},{label:'الحلقة',key:'الحلقة'},{label:'المعلم',key:'المعلم'},{label:'الملاحظة',key:'الملاحظة'},{label:'التاريخ',key:'تاريخ_الإضافة'}
    ], ds.teacherNotes);

    byId('eduWarningsTable').innerHTML = tableFromRows([
      {label:'الطالب',key:'اسم_الطالب'},{label:'الحلقة',key:'الحلقة'},{label:'السبب',key:'سبب_الإنذار'},{label:'الإجراء الحالي',key:'الإجراء_الحالي'},{label:'الحالة',key:'الحالة'},{label:'إجراء',render:r=>`<button class="btn btn-sm btn-outline-primary warning-update" data-type="تعليمي" data-id="${r['معرف_الإنذار']}">تحديث</button>`}
    ], ds.educationalWarnings);

    byId('adminWarningsTable').innerHTML = tableFromRows([
      {label:'الطالب',key:'اسم_الطالب'},{label:'الحلقة',key:'الحلقة'},{label:'النوع',key:'نوع_الإنذار'},{label:'رقم العتبة',key:'رقم_العتبة'},{label:'عدد الحالات',key:'عدد_الحالات'},{label:'الإجراء الحالي',key:'الإجراء_الحالي'},{label:'الحالة',key:'الحالة'},{label:'الرسالة',key:'قالب_الرسالة'},{label:'إجراء',render:r=>`<button class="btn btn-sm btn-outline-primary warning-update" data-type="إداري" data-id="${r['معرف_الإنذار']}">تحديث</button>`}
    ], ds.administrativeWarnings);

    document.querySelectorAll('.warning-update').forEach(btn=>btn.onclick = ()=>openWarningUpdate(btn.dataset.type, btn.dataset.id));
    const addNote = byId('addTeacherNoteBtn'); if(addNote) addNote.onclick = ()=>openTeacherNoteDialog();
    const addEdu = byId('addEduWarningBtn'); if(addEdu) addEdu.onclick = ()=>openEduWarningDialog();
    const genAdmin = byId('generateAdminWarningsBtn'); if(genAdmin) genAdmin.onclick = async ()=>{ try{ const res=await api('generateAdministrativeWarnings',{token:state.session.token}); await toast('success','تم توليد الإنذارات',res.created.join('، ') || 'لا توجد حالات جديدة'); await loadDashboard(); }catch(err){ toast('error','تعذر التوليد',err.message);} };
  }

  async function openTeacherNoteDialog(){
    const opts = state.dashboard.datasets.students.map(s=>`<option value="${s['معرف_الطالب']}">${s['اسم_الطالب']}</option>`).join('');
    const {value}= await Swal.fire({title:'إضافة ملاحظة',html:`<label class="form-label d-block text-end">الطالب</label><select id="noteStudent" class="form-select">${opts}</select><label class="form-label d-block text-end mt-2">الملاحظة</label><textarea id="noteText" class="form-control"></textarea>`,preConfirm:()=>({studentId:byId('noteStudent').value,note:byId('noteText').value}),confirmButtonText:'حفظ'});
    if(!value) return; try{ await api('addTeacherNote',{token:state.session.token,...value}); await toast('success','تم حفظ الملاحظة'); await loadDashboard(); }catch(err){ toast('error','تعذر الحفظ',err.message); }
  }

  async function openEduWarningDialog(){
    const opts = state.dashboard.datasets.students.map(s=>`<option value="${s['معرف_الطالب']}">${s['اسم_الطالب']}</option>`).join('');
    const {value}= await Swal.fire({title:'إنذار تعليمي جديد',html:`<label class="form-label d-block text-end">الطالب</label><select id="ewStudent" class="form-select">${opts}</select><label class="form-label d-block text-end mt-2">السبب</label><textarea id="ewReason" class="form-control"></textarea><label class="form-label d-block text-end mt-2">الإجراء الحالي</label><input id="ewAction" class="form-control" value="جديد">`,preConfirm:()=>({studentId:byId('ewStudent').value,reason:byId('ewReason').value,actionName:byId('ewAction').value}),confirmButtonText:'إنشاء'});
    if(!value) return; try{ await api('addEducationalWarning',{token:state.session.token,...value}); await toast('success','تم إنشاء الإنذار'); await loadDashboard(); }catch(err){ toast('error','تعذر الإنشاء',err.message); }
  }

  async function openWarningUpdate(type, id){
    const {value}= await Swal.fire({title:'تحديث الإنذار',html:`<label class="form-label d-block text-end">الإجراء الحالي</label><input id="waAction" class="form-control" value="تم التواصل"><label class="form-label d-block text-end mt-2">الحالة</label><select id="waStatus" class="form-select"><option>جديد</option><option>متابعة</option><option>تم التواصل</option><option>استدعاء ولي الأمر</option><option>مكتمل</option><option>مغلق</option></select>`,preConfirm:()=>({actionName:byId('waAction').value,status:byId('waStatus').value}),confirmButtonText:'حفظ'});
    if(!value) return; try{ await api('updateWarningAction',{token:state.session.token,warningType:type,warningId:id,...value}); await toast('success','تم تحديث الإنذار'); await loadDashboard(); }catch(err){ toast('error','تعذر التحديث',err.message); }
  }

  function renderSettings(role){
    const wrap = byId('settingsWrap'); if(!wrap) return;
    const canManage = roleCan(role,['مشرف إداري','مدير']);
    wrap.classList.toggle('d-none', !canManage); if(!canManage) return;
    const lists = state.dashboard.datasets.lists;
    const groups = [
      ['الحلق','الدوائر',lists.circles,'اسم_الحلقة'],
      ['المستخدمون','المستخدمون',lists.users,'الاسم'],
      ['قوالب الرسائل','القوالب',lists.templates,'العنوان'],
      ['عتبات الإنذارات','العتبات',lists.thresholds,'نوع_الإنذار'],
      ['إجراءات الإنذارات','الإجراءات',lists.actions,'الاسم']
    ];
    wrap.innerHTML = groups.map(g=>`<div class="col-md-6"><div class="section-card h-100"><h5 class="fw-bold mb-2">${g[0]}</h5><div class="small-muted mb-3">عدد السجلات: ${g[2].length}</div><div class="border rounded-3 p-2" style="max-height:220px;overflow:auto">${g[2].map(item=>`<div class="py-1 border-bottom small">${safe(item[g[3]])}</div>`).join('') || '<div class="small-muted">لا توجد عناصر</div>'}</div></div></div>`).join('');
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    try{
      await initHome();
      await initRegisterPage();
      await initLookupPage();
      await initLoginPage();
      await initDashboardPage();
    }catch(err){ console.error(err); }
  });
})();
