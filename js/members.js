// members.js — Member CRUD, search, profile slide-over
// ============================================================

App.registerPage('members', initMembersPage);

let membersData = [];
let memberSearch = '';
let memberSort = { col: 'memberId', dir: 'asc' };
let memberPage = 1;
const MEMBER_PAGE_SIZE = 15;

async function initMembersPage() {
  await renderMembersTable();
  setupMembersEvents();
}

function setupMembersEvents() {
  // Search
  const searchEl = document.getElementById('member-search');
  searchEl?.addEventListener('input', e => {
    memberSearch = e.target.value;
    memberPage = 1;
    renderMembersTable();
  });

  // Add member button
  document.getElementById('add-member-btn')?.addEventListener('click', () => openMemberModal());

  // Form submit
  document.getElementById('member-form')?.addEventListener('submit', saveMember);

  // Table header sorting
  document.querySelectorAll('#members-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (memberSort.col === col) memberSort.dir = memberSort.dir === 'asc' ? 'desc' : 'asc';
      else { memberSort.col = col; memberSort.dir = 'asc'; }
      renderMembersTable();
    });
  });
}

async function renderMembersTable() {
  membersData = await DB.getMembers(memberSearch);

  // Sort
  membersData.sort((a, b) => {
    let av = a[memberSort.col] || '', bv = b[memberSort.col] || '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return memberSort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  // Pagination
  const total   = membersData.length;
  const pages   = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE));
  memberPage    = Math.min(memberPage, pages);
  const start   = (memberPage - 1) * MEMBER_PAGE_SIZE;
  const slice   = membersData.slice(start, start + MEMBER_PAGE_SIZE);

  const tbody   = document.getElementById('members-tbody');
  if (!tbody) return;

  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><h3>No members found</h3><p>Add your first member to get started.</p></div></td></tr>`;
  } else {
    tbody.innerHTML = slice.map(m => `
      <tr>
        <td class="td-id" data-label="ID">${m.memberId}</td>
        <td class="td-name" data-label="Full Name">${escHtml(m.fullName)}</td>
        <td data-label="Mobile">${escHtml(m.mobile || '—')}</td>
        <td data-label="NID">${escHtml(m.nid || '—')}</td>
        <td data-label="Join Date">${App.formatDate(m.joinDate)}</td>
        <td data-label="Status"><span class="badge badge-${m.status==='Inactive'?'danger':'success'}">${m.status||'Active'}</span></td>
        <td class="td-actions">
          <button class="action-btn view" onclick="viewMemberProfile(${m.id})">👁 Profile</button>
          <button class="action-btn edit" onclick="openMemberModal(${m.id})">✏️ Edit</button>
          <button class="action-btn delete" onclick="deleteMemberConfirm(${m.id},'${escHtml(m.fullName)}')">🗑</button>
        </td>
      </tr>`).join('');
  }

  // Count
  document.getElementById('member-count').textContent = `${total} member${total !== 1 ? 's' : ''}`;

  // Pagination
  renderPagination('member-pagination', memberPage, pages, p => { memberPage = p; renderMembersTable(); });

  // Sort headers
  document.querySelectorAll('#members-table th[data-sort]').forEach(th => {
    th.classList.remove('sorted-asc','sorted-desc');
    if (th.dataset.sort === memberSort.col) th.classList.add(`sorted-${memberSort.dir}`);
  });
}

// ---- MODAL ----
async function openMemberModal(id = null) {
  const form  = document.getElementById('member-form');
  const title = document.getElementById('member-modal-title');
  form.reset();
  document.getElementById('member-id-hidden').value = '';

  if (id) {
    const m = await DB.db.members.get(id);
    if (!m) return;
    title.textContent = '✏️ Edit Member';
    document.getElementById('member-id-hidden').value = id;
    document.getElementById('f-fullName').value   = m.fullName   || '';
    document.getElementById('f-mobile').value     = m.mobile     || '';
    document.getElementById('f-email').value      = m.email      || '';
    document.getElementById('f-dob').value        = m.dob        || '';
    document.getElementById('f-gender').value     = m.gender     || 'Male';
    document.getElementById('f-nid').value        = m.nid        || '';
    document.getElementById('f-nid-issue').value  = m.nidIssue   || '';
    document.getElementById('f-father').value     = m.father     || '';
    document.getElementById('f-mother').value     = m.mother     || '';
    document.getElementById('f-spouse').value     = m.spouse     || '';
    document.getElementById('f-present-address').value   = m.presentAddress || m.address || '';
    document.getElementById('f-permanent-address').value = m.permanentAddress || '';
    document.getElementById('f-joinDate').value   = m.joinDate   || '';
    document.getElementById('f-status').value     = m.status     || 'Active';

    // Populate images
    setPreviewImage('f-photo', m.photoUrl);
    setPreviewImage('f-nidFront', m.nidFrontUrl);
    setPreviewImage('f-nidBack', m.nidBackUrl);
  } else {
    title.textContent = '➕ Add Member';
    document.getElementById('f-joinDate').value   = new Date().toISOString().split('T')[0];
    document.getElementById('f-gender').value     = 'Male';
    document.getElementById('f-status').value     = 'Active';
    ['f-photo','f-nidFront','f-nidBack'].forEach(k => setPreviewImage(k, null));
  }
  App.openModal('member-modal');
}

function initImageUploads() {
  ['f-photo','f-nidFront','f-nidBack'].forEach(id => {
    const wrapper = document.getElementById(`wrap-${id}`);
    const input   = document.getElementById(id);
    const rmBtn   = document.getElementById(`rm-${id}`);
    const preview = document.getElementById(`preview-${id}`);
    const img     = document.getElementById(`img-${id}`);

    if (preview) {
      preview.addEventListener('click', (e) => {
        if (e.target === rmBtn) return;
        input.click();
      });
    }

    if (input) {
      input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => setPreviewImage(id, ev.target.result);
          reader.readAsDataURL(file);
        }
      });
    }

    if (rmBtn) {
      rmBtn.addEventListener('click', () => {
        input.value = ''; // clear file
        // keep track if it was an existing DB image by clearing the image src
        setPreviewImage(id, null);
      });
    }
  });
}
document.addEventListener('DOMContentLoaded', initImageUploads);

function setPreviewImage(inputId, base64Str) {
  const img   = document.getElementById(`img-${inputId}`);
  const rmBtn = document.getElementById(`rm-${inputId}`);
  const input = document.getElementById(inputId); // the file input

  if (base64Str) {
    img.src = base64Str;
    img.style.display = 'block';
    rmBtn.style.display = 'block';
  } else {
    img.src = '';
    img.style.display = 'none';
    rmBtn.style.display = 'none';
    if(input) input.value = '';
  }
}

async function saveMember(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('member-id-hidden').value) || null;

  // Grab Base64 from current preview image src
  const getImgVal = (inputId) => {
    const src = document.getElementById(`img-${inputId}`)?.src;
    return (src && src.startsWith('data:')) ? src : null;
  };

  const data = {
    fullName :  document.getElementById('f-fullName').value.trim(),
    mobile   :  document.getElementById('f-mobile').value.trim(),
    email    :  document.getElementById('f-email').value.trim(),
    dob      :  document.getElementById('f-dob').value,
    gender   :  document.getElementById('f-gender').value,
    nid      :  document.getElementById('f-nid').value.trim(),
    nidIssue :  document.getElementById('f-nid-issue').value,
    father   :  document.getElementById('f-father').value.trim(),
    mother   :  document.getElementById('f-mother').value.trim(),
    spouse   :  document.getElementById('f-spouse').value.trim(),
    presentAddress  :  document.getElementById('f-present-address').value.trim(),
    permanentAddress:  document.getElementById('f-permanent-address').value.trim(),
    address  :  document.getElementById('f-present-address').value.trim(), // fallback
    joinDate :  document.getElementById('f-joinDate').value,
    status   :  document.getElementById('f-status').value,

    photoUrl    : getImgVal('f-photo'),
    nidFrontUrl : getImgVal('f-nidFront'),
    nidBackUrl  : getImgVal('f-nidBack')
  };
  if (!data.fullName) { App.toast('Name is required', 'error'); return; }

  if (id) {
    // Make sure we keep existing images if they weren't removed or replaced
    const old = await DB.db.members.get(id);
    if (!data.photoUrl && document.getElementById('img-f-photo').src) data.photoUrl = old.photoUrl;
    if (!data.nidFrontUrl && document.getElementById('img-f-nidFront').src) data.nidFrontUrl = old.nidFrontUrl;
    if (!data.nidBackUrl && document.getElementById('img-f-nidBack').src) data.nidBackUrl = old.nidBackUrl;

    await DB.updateMember(id, data);
    App.toast('Member updated ✅', 'success');
  } else {
    await DB.addMember(data);
    App.toast('Member added ✅', 'success');
  }
  App.closeAllModals();
  await renderMembersTable();
}

function deleteMemberConfirm(id, name) {
  App.confirm('Delete Member', `Are you sure you want to delete "${name}"? All their payment records will remain in history.`, async () => {
    await DB.deleteMember(id);
    App.toast('Member deleted', 'warning');
    await renderMembersTable();
  }, true);
}

function viewMemberProfile(id) {
  window.currentProfileId = id;
  App.navigate('member-profile');
}

// ---- HELPERS ----
function renderPagination(containerId, current, total, onPage) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (total <= 1) { el.innerHTML = ''; return; }
  let html = `<button class="page-btn" ${current===1?'disabled':''} onclick="(${onPage.toString()})(${current-1})">‹</button>`;
  for (let i = 1; i <= total; i++) {
    if (total > 7 && Math.abs(i - current) > 2 && i !== 1 && i !== total) {
      if (i === 2 || i === total - 1) html += `<button class="page-btn" disabled>…</button>`;
      continue;
    }
    html += `<button class="page-btn ${i===current?'active':''}" onclick="(${onPage.toString()})(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${current===total?'disabled':''} onclick="(${onPage.toString()})(${current+1})">›</button>`;
  el.innerHTML = html;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// expose for global inline handlers
window.openMemberModal     = openMemberModal;
window.deleteMemberConfirm = deleteMemberConfirm;
window.viewMemberProfile   = viewMemberProfile;
window.renderPagination    = renderPagination;
window.escHtml             = escHtml;
