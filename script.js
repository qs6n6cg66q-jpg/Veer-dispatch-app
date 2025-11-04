// VEER ENTERPRISE DISPATCH APP - FINAL by Hardik
(function(){
  const USER_KEY = "veer_dispatch_user";

  function $(id){ return document.getElementById(id); }

  // ---------- DISPATCH PAGE ----------
  const user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
  if (!user) location.href = "index.html";

  $("userBadge").textContent = `Logged in as: ${user.mobile}`;

  const dtInput = $("dt");
  const pad = n=>n.toString().padStart(2,"0");
  const now = new Date();
  dtInput.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const userKey = `veer_dispatch_history_${user.mobile}`;
  function loadHistory(){ return JSON.parse(localStorage.getItem(userKey) || "[]"); }
  function saveHistory(list){ localStorage.setItem(userKey, JSON.stringify(list)); }

  function extractMapUrl(text){
    if(!text) return "";
    if(text.includes("google.com/maps")) return text;
    const match = text.match(/([-+]?\d*\.\d+),\s*([-+]?\d*\.\d+)/);
    if(match){
      return `https://www.google.com/maps?q=${match[1]},${match[2]}`;
    }
    return "";
  }

  function renderHistory(filter=""){
    const list = loadHistory().filter(r=>
      !filter || r.serial.includes(filter) ||
      r.receiver.toLowerCase().includes(filter.toLowerCase()) ||
      r.pname.toLowerCase().includes(filter.toLowerCase())
    ).sort((a,b)=> new Date(b.datetime)-new Date(a.datetime));

    const body = document.querySelector("#historyTable tbody");
    body.innerHTML = "";
    list.forEach((r,i)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(r.datetime).toLocaleString()}</td>
        <td>${r.pname || ''}</td>
        <td>${r.serial}</td>
        <td>${r.desc || ''}</td>
        <td>${r.receiver}</td>
        <td>${r.rmobile}</td>
        <td><a href="${extractMapUrl(r.rlocation)}" target="_blank">${r.rlocation||""}</a></td>
        <td><button data-i="${i}" class="delBtn">🗑</button></td>`;
      body.appendChild(tr);
    });
    document.querySelectorAll(".delBtn").forEach(btn=>{
      btn.onclick = ()=>{
        const list = loadHistory();
        list.splice(btn.dataset.i,1);
        saveHistory(list);
        renderHistory(filter);
      };
    });
  }

  renderHistory();

  $("dispatchForm").addEventListener("submit", e=>{
    e.preventDefault();
    const obj = {
      datetime: new Date($("dt").value).toISOString(),
      pname: $("pname").value.trim(),
      serial: $("serial").value.trim(),
      desc: $("desc").value.trim(),
      receiver: $("rname").value.trim(),
      rmobile: $("rmobile").value.trim(),
      rlocation: $("rloc").value.trim(),
      createdBy: user.mobile
    };
    if(!obj.pname || !obj.serial || !obj.receiver || !obj.rmobile)
      return alert("Please fill all required fields!");
    const list = loadHistory(); list.push(obj); saveHistory(list);
    renderHistory(); e.target.reset();
  });

  $("search").addEventListener("input", e=> renderHistory(e.target.value));

  $("getLocation").addEventListener("click", ()=>{
    if(!navigator.geolocation) return alert("GPS not supported");
    $("getLocation").textContent="Getting...";
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      $("rloc").value = `${lat},${lon}`;
      $("getLocation").textContent="📍 Fetch Current GPS";
    }, err=>{
      alert("GPS Error: "+err.message);
      $("getLocation").textContent="📍 Fetch Current GPS";
    });
  });

  $("exportExcel").addEventListener("click", ()=>{
    const data = loadHistory();
    if(!data.length) return alert("No data");
    const exportData = data.map(d => ({
      DateTime: new Date(d.datetime).toLocaleString(),
      ProductName: d.pname,
      SerialNo: d.serial,
      Description: d.desc,
      Receiver: d.receiver,
      Mobile: d.rmobile,
      Location: d.rlocation
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dispatch");
    const wbout = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    const blob = new Blob([wbout], {type:"application/octet-stream"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dispatch_${user.mobile}.xlsx`;
    a.click();
  });

  $("exportPdf").addEventListener("click", ()=>{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = loadHistory();
    if(!data.length) return alert("No data");
    doc.text(`VEER ENTERPRISE - ${user.mobile}`, 10,10);
    let y=20;
    data.forEach(d=>{
      doc.text(`${new Date(d.datetime).toLocaleString()} | ${d.pname} | ${d.serial} | ${d.receiver}`,10,y);
      y+=10; if(y>280){doc.addPage();y=20;}
    });
    doc.save(`dispatch_${user.mobile}.pdf`);
  });

  $("shareData").addEventListener("click", async ()=>{
    const data = loadHistory();
    if(!data.length) return alert("No data");
    const d = data[data.length-1];
    const text = `VEER DISPATCH\nProduct: ${d.pname}\nSerial: ${d.serial}\nReceiver: ${d.receiver}\nMobile: ${d.rmobile}\nLocation: ${d.rlocation}`;
    if(navigator.share){ await navigator.share({text}); } else {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard.");
    }
  });

  $("clearAll").addEventListener("click", ()=>{
    if(confirm("Delete all records?")){
      localStorage.removeItem(userKey);
      renderHistory();
    }
  });

  // 3-dot menu & Logout
  const menuBtn = $("menuBtn"), menuPopup = $("menuPopup"), logoutBtn = $("logoutBtn");
  menuBtn.addEventListener("click", ()=>{
    menuPopup.style.display = (menuPopup.style.display==="none"||menuPopup.style.display==="")?"block":"none";
  });
  document.addEventListener("click", e=>{
    if(!menuPopup.contains(e.target) && e.target!==menuBtn) menuPopup.style.display="none";
  });
  logoutBtn.addEventListener("click", ()=>{
    if(confirm("Logout?")){
      localStorage.removeItem(USER_KEY);
      location.href="index.html";
    }
  });
})();