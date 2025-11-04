// Replace these EmailJS placeholders with your real values
const EMAILJS_USER_ID = 'YOUR_EMAILJS_USER_ID'; // public key
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const ADMIN_EMAIL = 'er.hardik.7@gmail.com';

(function(){
  // Initialize EmailJS if user id provided
  if (EMAILJS_USER_ID && window.emailjs) {
    emailjs.init(EMAILJS_USER_ID);
  }

  // Helpers
  function $(id){ return document.getElementById(id) }
  const STORAGE_KEY = 'veer_dispatch_history_v1';
  const USER_KEY = 'veer_dispatch_user';

  // If on index.html -> Login flow
  if (document.getElementById('loginForm')) {
    const loginForm = $('loginForm');
    loginForm.addEventListener('submit', e=>{
      e.preventDefault();
      const mobile = $('mobileInput').value.trim();
      if (!mobile) return alert('Mobile number required');
      // save user
      const user = { mobile, createdAt: new Date().toISOString() };
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      // send email to admin notifying new user (if EmailJS configured)
      sendRegistrationEmail(user);
      // go to dispatch page
      location.href = 'dispatch.html';
    });
    return;
  }

  // If on dispatch.html -> main app
  const user = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  if (!user || !user.mobile) {
    // no user — redirect to login
    location.href = 'index.html';
  }

  // UI refs
  const userBadge = $('userBadge');
  const dispatchForm = $('dispatchForm');
  const historyTableBody = document.querySelector('#historyTable tbody');
  const dtInput = $('dt');

  userBadge.textContent = `You: ${user.mobile}`;

  // set datetime default
  const nowISO = new Date();
  // local datetime-local formatting
  function toDatetimeLocal(d){
    const pad = n=>n.toString().padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  dtInput.value = toDatetimeLocal(nowISO);

  // Load history
  function loadHistory(){
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  function saveHistory(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function renderHistory(filter=''){
    const data = loadHistory();
    const rows = data
      .filter(item=>!filter || (item.serial||'').includes(filter) || (item.receiver||'').toLowerCase().includes(filter.toLowerCase()))
      .sort((a,b)=> new Date(b.datetime) - new Date(a.datetime));
    historyTableBody.innerHTML = '';
    rows.forEach((r, idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${new Date(r.datetime).toLocaleString()}</td>
                      <td>${r.serial}</td>
                      <td>${r.receiver}</td>
                      <td>${r.rmobile}</td>
                      <td>${r.rlocation || ''}</td>
                      <td>
                        <button data-idx="${idx}" class="delBtn">Delete</button>
                      </td>`;
      historyTableBody.appendChild(tr);
    });
    // attach delete handlers
    document.querySelectorAll('.delBtn').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        const index = Number(ev.target.getAttribute('data-idx'));
        let list = loadHistory();
        // rows are sorted — delete by matching serial + datetime for safety
        const sorted = list.slice().sort((a,b)=> new Date(b.datetime) - new Date(a.datetime));
        const toDelete = sorted[index];
        if (!toDelete) return;
        // remove first matching element by id/time/serial
        const newList = list.filter(item => !(item.datetime===toDelete.datetime && item.serial===toDelete.serial && item.rmobile===toDelete.rmobile));
        saveHistory(newList);
        renderHistory($('search').value.trim());
      });
    });
  }

  renderHistory();

  // Submit dispatch
  dispatchForm.addEventListener('submit', e=>{
    e.preventDefault();
    const datetime = $('dt').value ? new Date($('dt').value).toISOString() : new Date().toISOString();
    const serial = $('serial').value.trim();
    const receiver = $('rname').value.trim();
    const rmobile = $('rmobile').value.trim();
    const rlocation = $('rloc').value.trim();

    if (!serial || !receiver || !rmobile) return alert('Serial, receiver name & mobile required');

    const entry = {
      datetime, serial, receiver, rmobile, rlocation, createdBy: user.mobile
    };

    const list = loadHistory();
    list.push(entry);
    saveHistory(list);
    renderHistory($('search').value.trim());

    // Optionally send a small email notification about each dispatch
    sendDispatchEmail(entry);

    // clear few fields
    $('serial').value=''; $('rname').value=''; $('rmobile').value=''; $('rloc').value='';
    $('dt').value = toDatetimeLocal(new Date());
  });

  // Search
  $('search').addEventListener('input', e=>{
    renderHistory(e.target.value.trim());
  });

  // Get GPS
  $('getLocation').addEventListener('click', ()=>{
    if (!navigator.geolocation) return alert('Geolocation not supported');
    $('getLocation').textContent = 'Fetching...';
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      const url = `https://www.google.com/maps?q=${lat},${lon}`;
      $('rloc').value = `${lat},${lon} (${url})`;
      $('getLocation').textContent = 'Fetch Current GPS';
    }, err=>{
      alert('GPS error: '+err.message);
      $('getLocation').textContent = 'Fetch Current GPS';
    }, {timeout:10000});
  });

  // Export to Excel (SheetJS)
  $('exportExcel').addEventListener('click', ()=>{
    const data = loadHistory().map(r=>({
      'DateTime': new Date(r.datetime).toLocaleString(),
      'Serial': r.serial,
      'Receiver': r.receiver,
      'Receiver Mobile': r.rmobile,
      'Receiver Location': r.rlocation || '',
      'Added By': r.createdBy || ''
    }));
    if (data.length===0) return alert('No data to export');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dispatches');
    const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
    const blob = new Blob([wbout],{type:'application/octet-stream'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `veer_dispatch_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
  });

  // Export to PDF (jsPDF)
  $('exportPdf').addEventListener('click', async ()=>{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    const data = loadHistory();
    if (data.length===0) return alert('No data to export');
    doc.setFontSize(12);
    doc.text(`VEER ENTERPRISE - Dispatch History (${new Date().toLocaleDateString()})`, 40, 40);
    // simple table starting y
    let y = 70;
    const rowHeight = 16;
    doc.setFontSize(10);
    doc.text('Date / Time',40,y); doc.text('Serial',160,y); doc.text('Receiver',240,y); doc.text('Mobile',360,y);
    y += rowHeight;
    data.forEach(r=>{
      if (y > 760) { doc.addPage(); y = 40; }
      doc.text(new Date(r.datetime).toLocaleString(), 40, y);
      doc.text(String(r.serial),160,y);
      doc.text(String(r.receiver),240,y);
      doc.text(String(r.rmobile),360,y);
      y += rowHeight;
    });
    doc.save(`veer_dispatch_${new Date().toISOString().slice(0,10)}.pdf`);
  });

  // Share (Web Share API)
  $('shareData').addEventListener('click', async ()=>{
    const data = loadHistory();
    if (!data.length) return alert('No data to share');
    const latest = data.slice(-1)[0];
    const text = `VEER Dispatch\nSerial: ${latest.serial}\nReceiver: ${latest.receiver}\nMobile: ${latest.rmobile}\nTime: ${new Date(latest.datetime).toLocaleString()}\nLocation: ${latest.rlocation || ''}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'VEER Dispatch', text }); }
      catch(err){ alert('Share canceled or failed: '+err); }
    } else {
      // fallback: copy text to clipboard
      try {
        await navigator.clipboard.writeText(text);
        alert('Latest dispatch copied to clipboard. Paste to share.');
      } catch(e){ alert('Share not supported on this device.'); }
    }
  });

  // Clear all local data
  $('clearAll').addEventListener('click', ()=>{
    if (!confirm('Clear all local dispatch records? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
  });

  // Email sending functions (requires EmailJS setup)
  function sendRegistrationEmail(userObj){
    if (!emailjs || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) return;
    const templateParams = {
      admin_email: ADMIN_EMAIL,
      user_mobile: userObj.mobile,
      user_created_at: userObj.createdAt
    };
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
      .then(()=> console.log('Registration email sent'))
      .catch(err=> console.error('Email send error', err));
  }
  function sendDispatchEmail(entry){
    if (!emailjs || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) return;
    // Using same template; you can create new template id if you prefer
    const templateParams = {
      admin_email: ADMIN_EMAIL,
      user_mobile: entry.createdBy,
      dispatch_datetime: new Date(entry.datetime).toLocaleString(),
      serial: entry.serial,
      receiver: entry.receiver,
      receiver_mobile: entry.rmobile,
      receiver_location: entry.rlocation || ''
    };
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
      .then(()=> console.log('Dispatch email sent'))
      .catch(err=> console.error('Email send error', err));
  }

  // initial render
  renderHistory();

})();