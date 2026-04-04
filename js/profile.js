// profile.js — Dedicated Member Profile and PDF logic
// ============================================================

App.registerPage('member-profile', initProfilePage);

async function initProfilePage() {
  if (!window.currentProfileId) {
    App.navigate('members');
    return;
  }
  const m = await DB.db.members.get(window.currentProfileId);
  if (!m) {
    App.toast('Member not found', 'error');
    App.navigate('members');
    return;
  }
  await renderProfileHtml(m);
}

async function renderProfileHtml(m) {
  const area = document.getElementById('profile-printable-area');
  const monthPlays = await DB.getMonthlyPayments({ memberId: m.memberId });
  const paid = monthPlays.filter(p=>p.status==='Paid').length;
  const unpaid = monthPlays.filter(p=>p.status==='Unpaid').length;
  
  const initials = (m.fullName||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const avatarHtml = m.photoUrl 
    ? `<img src="${m.photoUrl}" alt="Photo">`
    : `<span>${initials}</span>`;

  area.innerHTML = `
    <div class="profile-header-card">
      <div class="profile-avatar-lg">
        ${avatarHtml}
      </div>
      <div class="profile-title">
        <h2>${escHtml(m.fullName)} <span class="badge badge-${m.status==='Inactive'?'danger':'success'}">${m.status||'Active'}</span></h2>
        <div class="profile-meta"><strong>ID:</strong> ${m.memberId} &nbsp;|&nbsp; <strong>Join Date:</strong> ${App.formatDate(m.joinDate)}</div>
        <div class="profile-meta" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap">
          <span class="badge badge-success" style="font-size:0.8rem">Paid Months: ${paid}</span>
          <span class="badge badge-danger" style="font-size:0.8rem">Unpaid Months: ${unpaid}</span>
          <span class="badge badge-info" style="font-size:0.8rem">Total Paid: ${App.formatCurrency(monthPlays.filter(p=>p.status==='Paid').reduce((s,p)=>s+(p.amount||0),0))}</span>
        </div>
      </div>
    </div>

    <div class="profile-section">
      <h3>📋 Basic & Contact Information</h3>
      <div class="profile-grid">
        <div class="profile-item"><div class="profile-label">Mobile Number</div><div class="profile-value">${m.mobile||'—'}</div></div>
        <div class="profile-item"><div class="profile-label">Date of Birth</div><div class="profile-value">${App.formatDate(m.dob)}</div></div>
        <div class="profile-item"><div class="profile-label">Gender</div><div class="profile-value">${m.gender||'—'}</div></div>
      </div>
    </div>

    <div class="profile-section">
      <h3>🏛️ Identity & Family</h3>
      <div class="profile-grid">
        <div class="profile-item"><div class="profile-label">NID Number</div><div class="profile-value">${m.nid||'—'}</div></div>
        <div class="profile-item"><div class="profile-label">Father's Name</div><div class="profile-value">${escHtml(m.father||'—')}</div></div>
        <div class="profile-item"><div class="profile-label">Mother's Name</div><div class="profile-value">${escHtml(m.mother||'—')}</div></div>
        <div class="profile-item"><div class="profile-label">Spouse Name</div><div class="profile-value">${escHtml(m.spouse||'—')}</div></div>
      </div>
    </div>

    <div class="profile-section">
      <h3>📍 Address Information</h3>
      <div class="profile-grid">
        <div class="profile-item" style="grid-column: 1 / -1"><div class="profile-label">Present Address</div><div class="profile-value">${escHtml(m.presentAddress || m.address || '—')}</div></div>
        <div class="profile-item" style="grid-column: 1 / -1"><div class="profile-label">Permanent Address</div><div class="profile-value">${escHtml(m.permanentAddress || '—')}</div></div>
      </div>
    </div>

    ${ (m.nidFrontUrl || m.nidBackUrl) ? `
    <div class="profile-section" id="print-hide-images">
      <h3>📸 Identity Documents</h3>
      <div class="profile-images-grid">
        ${m.nidFrontUrl ? `<div class="profile-img-card"><div class="profile-img-label">NID Front</div><img src="${m.nidFrontUrl}" alt="NID Front" onclick="window.open(this.src)"></div>` : ''}
        ${m.nidBackUrl ? `<div class="profile-img-card"><div class="profile-img-label">NID Back</div><img src="${m.nidBackUrl}" alt="NID Back" onclick="window.open(this.src)"></div>` : ''}
      </div>
    </div>
    ` : ''}
  `;
}

window.printProfile = () => {
  window.print();
};

window.exportProfilePDF = async () => {
  const source = document.getElementById('profile-printable-area');
  if (!source || !source.innerHTML.trim()) { 
    App.toast('No profile data found in the area!', 'error'); 
    return; 
  }

  let mName = document.querySelector('.profile-title h2')?.innerText || 'Member';
  mName = mName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  const pdfFileName = `Profile_${mName}.pdf`;

  // Helper to ensure all images in an element are loaded
  const waitForImages = (container) => {
    const images = Array.from(container.querySelectorAll('img'));
    return Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = img.onerror = resolve;
      });
    }));
  };

  App.toast('Generating PDF...', 'info');
  
  // 1. Enter PDF Export Mode (Forces white background/dark text via CSS)
  document.body.classList.add('pdf-export-mode');
  
  try {
    // 2. Wait for layout and images
    await waitForImages(source);
    await new Promise(r => setTimeout(r, 500)); // Brief pause for style applying

    const options = {
      margin:      10,
      filename:    pdfFileName,
      image:       { type: 'jpeg', quality: 0.9 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false, 
        backgroundColor: '#ffffff',
        width: 800 // Consistent width for PDF
      },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // 3. Capture directly from the visible element
    await html2pdf().set(options).from(source).save(pdfFileName);
    App.toast('PDF Exported Successfully ✅', 'success');
  } catch (error) {
    console.error('PDF Export Error:', error);
    App.toast('Failed to generate PDF: ' + error.message, 'error');
  } finally {
    // 4. Exit PDF Export Mode
    document.body.classList.remove('pdf-export-mode');
  }
};

