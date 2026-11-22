const $=s=>document.querySelector(s);
const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const iso=d=>d.toISOString().slice(0,10);
const today=iso(new Date());
const addDays=(s,n)=>{const d=new Date(s);d.setDate(d.getDate()+n);return iso(d)};
const diff=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);

// Data now comes from MySQL through the Express API (server.js)
let vehicles=[],customers=[],rentals=[],token=null;
async function api(path,method='GET',body){
  const res=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Server error');
  return data;
}
async function load(){const d=await api('/data');vehicles=d.vehicles;customers=d.customers;rentals=d.rentals}
async function run(fn,msg){try{await fn();await load();if(msg)toast(msg);render();return true}catch(err){toast(err.message);return false}}
let user=null;
function modal(html){const m=document.createElement('div');m.className='ov';m.innerHTML=`<div class="md" role="dialog" aria-modal="true">${html}</div>`;m.onclick=x=>{if(x.target===m||x.target.dataset.x)m.remove()};document.body.appendChild(m);return m}
function bindSearch(id,key){const q=$('#'+id);q.value=window[key]||'';q.oninput=()=>{window[key]=q.value;render();const n=$('#'+id);n.focus();n.setSelectionRange(99,99)}}
const loginView=`<div class="panel login"><h1>Sign in</h1><p style="color:var(--muted)">Staff only. Demo login: admin / admin123</p><div class="form" style="grid-template-columns:1fr;margin-top:14px"><label>Username<input id="lu" autocomplete="username"></label><label>Password<input id="lp" type="password" autocomplete="current-password"></label><button id="lg">Sign in</button></div></div>`;
function receipt(r){const v=V(r.vid),c=C(r.cid),d=diff(r.from,r.to);
 modal(`<h2>Rental receipt #${String(r.id).padStart(4,'0')}</h2><table style="min-width:0"><tr><td>Customer</td><td>${e(c.name)}</td></tr><tr><td>Vehicle</td><td>${e(v.name)} ${plate(v.plate)}</td></tr><tr><td>Period</td><td>${r.from} to ${r.to} (${d} days)</td></tr><tr><td>Rate</td><td>${inr(v.rate)} per day</td></tr><tr><td>Rental charge</td><td>${inr(r.total)}</td></tr><tr><td>Late fee</td><td>${inr(r.fee||0)}</td></tr><tr><td><b>Total paid</b></td><td><b>${inr(r.total+(r.fee||0))}</b></td></tr><tr><td>Method</td><td>${e(r.method||'-')}</td></tr></table><div class="bar" style="margin-top:14px"><button onclick="window.print()">Print</button><button class="ghost" data-x="1">Close</button></div>`)}

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2200)}
const V=id=>vehicles.find(x=>x.id==id), C=id=>customers.find(x=>x.id==id);
const tag=s=>`<span class="tag ${s}">${s}</span>`;
const plate=p=>`<span class="plate">${e(p)}</span>`;
const isLate=r=>r.status==='Active'&&r.to<today;
const header=(t,sub,extra='')=>`<div class="top"><div><h1>${t}</h1><p>${sub}</p></div>${extra}</div>`;

const views={
dashboard(){
  const rented=vehicles.filter(v=>v.status==='Rented').length;
  const revenue=rentals.filter(r=>r.paid).reduce((s,r)=>s+r.total,0);
  const due=rentals.filter(r=>r.status==='Active'&&r.to<=addDays(today,1));
  return header('Dashboard','Today’s fleet and rental activity at a glance.')+
  `<div class="stats">
    <div class="stat"><b>${vehicles.length}</b><span>Vehicles in fleet</span></div>
    <div class="stat"><b>${vehicles.filter(v=>v.status==='Available').length}</b><span>Available now</span></div>
    <div class="stat"><b>${rented}</b><span>Currently rented</span></div>
    <div class="stat"><b>${inr(revenue)}</b><span>Payments received</span></div></div>
  <div class="panel"><h2>Returns due by tomorrow</h2>${due.length?`<div class="tw"><table><tr><th>Vehicle</th><th>Customer</th><th>Due back</th></tr>${due.map(r=>`<tr><td>${plate(V(r.vid).plate)}</td><td>${e(C(r.cid).name)}</td><td>${r.to}</td></tr>`).join('')}</table></div>`:'<p class="empty">No returns are due. Nothing needs your attention.</p>'}</div>
  <div class="panel"><h2>Fleet status</h2><div class="tw"><table><tr><th>Vehicle</th><th>Plate</th><th>Status</th></tr>${vehicles.map(v=>`<tr><td>${e(v.name)}</td><td>${plate(v.plate)}</td><td>${tag(v.status)}</td></tr>`).join('')}</table></div></div>`;
},
vehicles(){
  const f=window._vf||'All';
  const list=vehicles.filter(v=>(f==='All'||v.status===f)&&(v.name+v.plate+v.type).toLowerCase().includes((window._vq||'').toLowerCase()));
  return header('Vehicles','Every vehicle you rent out, with its daily rate and status.')+
  `<div class="panel"><h2>Add a vehicle</h2><div class="form">
    <label>Name<input id="vn" placeholder="e.g. Tata Nexon"></label>
    <label>Plate number<input id="vp" placeholder="HR 26 XX 0000"></label>
    <label>Type<select id="vt"><option>Hatchback</option><option>Sedan</option><option>SUV</option><option>MPV</option><option>Bike</option></select></label>
    <label>Rate per day (₹)<input id="vr" type="number" min="1"></label>
    <button id="addv">Add vehicle</button></div></div>
  <div class="panel"><div class="bar"><input id="vq" type="search" placeholder="Search name, plate or type" aria-label="Search vehicles"><label>Show<select id="vf">${['All','Available','Rented','Maintenance'].map(s=>`<option ${s===f?'selected':''}>${s}</option>`).join('')}</select></label></div>
  <div class="tw"><table><tr><th>Vehicle</th><th>Plate</th><th>Type</th><th>Per day</th><th>Status</th><th></th></tr>
  ${list.map(v=>`<tr><td>${e(v.name)}</td><td>${plate(v.plate)}</td><td>${e(v.type)}</td><td>${inr(v.rate)}</td><td>${tag(v.status)}</td>
  <td>${v.status==='Rented'?'':`<button class="ghost" data-mt="${v.id}">${v.status==='Maintenance'?'Mark available':'Send to maintenance'}</button>`}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No vehicles match this filter.</td></tr>'}</table></div></div>`;
},
book(){
  const av=vehicles.filter(v=>v.status==='Available');
  return header('New rental','Pick a customer and an available vehicle, then choose dates.')+
  `<div class="panel"><div class="form">
    <label>Customer<select id="bc">${customers.map(c=>`<option value="${c.id}">${e(c.name)}</option>`).join('')}</select></label>
    <label>Vehicle<select id="bv">${av.map(v=>`<option value="${v.id}">${e(v.name)} – ${inr(v.rate)}/day</option>`).join('')||'<option value="">No vehicles available</option>'}</select></label>
    <label>Pick-up date<input id="bf" type="date" value="${today}" min="${today}"></label>
    <label>Return date<input id="bt" type="date" value="${addDays(today,2)}" min="${today}"></label></div>
  <div class="sum"><span id="bs"></span><button id="bgo" ${av.length?'':'disabled'}>Confirm rental</button></div></div>`;
},
rentals(){
  return header('Rentals','Active and past rentals. Return a vehicle to free it up.','<button class="ghost" id="csv">Export CSV</button>')+
  `<div class="panel"><div class="bar"><input id="rq" type="search" placeholder="Search plate, vehicle or customer" aria-label="Search rentals"></div><div class="tw"><table><tr><th>Vehicle</th><th>Customer</th><th>Dates</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr>
  ${rentals.slice().reverse().filter(r=>(V(r.vid).plate+V(r.vid).name+C(r.cid).name).toLowerCase().includes((window._rq||'').toLowerCase())).map(r=>{const late=isLate(r);const fee=late?diff(r.to,today)*V(r.vid).rate:0;
  return `<tr><td>${plate(V(r.vid).plate)}</td><td>${e(C(r.cid).name)}</td><td>${r.from} to ${r.to}</td><td>${inr(r.total+(r.status==='Returned'?(r.fee||0):0))}${late?`<br><small class="Overdue">+${inr(fee)} late fee so far</small>`:''}</td>
  <td>${r.paid?tag('Paid')+` <small>${e(r.method||'')}</small> <button class="ghost" data-rc="${r.id}">Receipt</button>`:`<button class="ghost" data-pay="${r.id}">Record payment</button>`}</td><td>${tag(late?'Overdue':r.status)}</td>
  <td>${r.status==='Active'?`<button class="ghost" data-ret="${r.id}">Return vehicle</button>`:''}</td></tr>`}).join('')}</table></div></div>`;
},
customers(){
  return header('Customers','People who have rented from you.')+
  `<div class="panel"><h2>Add a customer</h2><div class="form">
    <label>Full name<input id="cn"></label><label>Phone<input id="cp"></label><label>Driving licence no.<input id="cl"></label>
    <button id="addc">Add customer</button></div></div>
  <div class="panel"><div class="bar"><input id="cq" type="search" placeholder="Search name, phone or licence" aria-label="Search customers"></div><div class="tw"><table><tr><th>Name</th><th>Phone</th><th>Licence</th><th>Rentals</th><th></th></tr>
  ${customers.filter(c=>(c.name+c.phone+c.license).toLowerCase().includes((window._cq||'').toLowerCase())).map(c=>`<tr><td>${e(c.name)}</td><td>${e(c.phone)}</td><td>${e(c.license)}</td><td>${rentals.filter(r=>r.cid===c.id).length}</td><td><button class="ghost" data-ch="${c.id}">History</button></td></tr>`).join('')}</table></div></div>`;
}};

views.reports=()=>{
  const amt=r=>r.total+(r.fee||0),paid=rentals.filter(r=>r.paid);
  const group=(f,L)=>{const m={};L.forEach(r=>{const k=f(r);m[k]=(m[k]||0)+amt(r)});return Object.entries(m).sort((a,b)=>b[1]-a[1])};
  const bars=rows=>rows.length?rows.map(([k,v])=>`<div class="bar2"><span>${e(k)}</span><i style="width:${Math.max(3,v/rows[0][1]*100)}%"></i><b>${inr(v)}</b></div>`).join(''):'<p class="empty">No payments recorded yet.</p>';
  const days=rentals.reduce((s,r)=>s+diff(r.from,r.to),0);
  return header('Reports','Revenue and usage based on all rentals.')+
  `<div class="stats"><div class="stat"><b>${inr(paid.reduce((s,r)=>s+amt(r),0))}</b><span>Revenue received</span></div>
   <div class="stat"><b>${inr(rentals.filter(r=>!r.paid).reduce((s,r)=>s+amt(r),0))}</b><span>Payments pending</span></div>
   <div class="stat"><b>${inr(rentals.reduce((s,r)=>s+(r.fee||0),0))}</b><span>Late fees charged</span></div>
   <div class="stat"><b>${rentals.length?(days/rentals.length).toFixed(1):0}</b><span>Average days per rental</span></div></div>
  <div class="panel"><h2>Revenue by vehicle type</h2>${bars(group(r=>V(r.vid).type,paid))}</div>
  <div class="panel"><h2>Revenue by vehicle</h2>${bars(group(r=>V(r.vid).name,paid))}</div>
  <div class="panel"><h2>Revenue by payment method</h2>${bars(group(r=>r.method||'Other',paid))}</div>`};
function render(){
  document.body.classList.toggle('out',!user);
  if(!user){$('#app').innerHTML=loginView;
    $('#lg').onclick=async()=>{try{const d=await api('/login','POST',{username:$('#lu').value.trim(),password:$('#lp').value});token=d.token;user=d.name;await load();render()}catch(err){toast(err.message)}};
    $('#lp').onkeydown=x=>{if(x.key==='Enter')$('#lg').click()};return}
  const v=(location.hash.slice(1)||'dashboard');const name=views[v]?v:'dashboard';
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===name));
  $('#app').innerHTML=views[name]();
  bind(name);
}
function bind(n){
  if(n==='vehicles'){
    bindSearch('vq','_vq');$('#vf').onchange=x=>{window._vf=x.target.value;render()};
    $('#addv').onclick=()=>{const name=$('#vn').value.trim(),p=$('#vp').value.trim().toUpperCase(),r=+$('#vr').value;
      if(!name||!p||!(r>0))return toast('Enter a name, plate number and daily rate.');
      if(vehicles.some(v=>v.plate===p))return toast('That plate number is already in the fleet.');
      run(()=>api('/vehicles','POST',{plate:p,name,type:$('#vt').value,rate:r}),'Vehicle added')};
    document.querySelectorAll('[data-mt]').forEach(b=>b.onclick=()=>{const v=V(b.dataset.mt);run(()=>api('/vehicles/'+v.id+'/status','PATCH',{status:v.status==='Maintenance'?'Available':'Maintenance'}))});
  }
  if(n==='book'){
    const calc=()=>{const v=V($('#bv').value),d=diff($('#bf').value,$('#bt').value);
      if(!v){$('#bs').textContent='All vehicles are rented or in maintenance.';return}
      $('#bs').innerHTML=d>0?`${d} day${d>1?'s':''} × ${inr(v.rate)} = <b>${inr(d*v.rate)}</b>`:'Return date must be after pick-up date.';
      $('#bgo').disabled=d<=0}
    ['bc','bv','bf','bt'].forEach(i=>$('#'+i).onchange=calc);calc();
    $('#bgo').onclick=()=>{const v=V($('#bv').value),d=diff($('#bf').value,$('#bt').value);
      run(()=>api('/rentals','POST',{vehicle_id:v.id,customer_id:+$('#bc').value,start:$('#bf').value,end:$('#bt').value}),'Rental confirmed').then(ok=>{if(ok)location.hash='rentals'});
      };
  }
  if(n==='rentals'){
    document.querySelectorAll('[data-ret]').forEach(b=>b.onclick=()=>run(()=>api('/rentals/'+b.dataset.ret+'/return','POST'),'Vehicle returned'));
    bindSearch('rq','_rq');
    document.querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>receipt(rentals.find(x=>x.id==b.dataset.rc)));
    document.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{const r=rentals.find(x=>x.id==b.dataset.pay);
      const m=modal(`<h2>Record payment</h2><p>${inr(r.total+(r.fee||0))} for ${e(V(r.vid).name)}</p><label>Payment method<select id="pm"><option>Cash</option><option>UPI</option><option>Card</option></select></label><div class="bar" style="margin-top:14px"><button id="pok">Save payment</button><button class="ghost" data-x="1">Cancel</button></div>`);
      m.querySelector('#pok').onclick=()=>{const method=m.querySelector('#pm').value;m.remove();run(()=>api('/rentals/'+r.id+'/payment','POST',{method}),'Payment recorded')}});
    $('#csv').onclick=()=>{const rows=[['ID','Vehicle','Plate','Customer','From','To','Total','Late fee','Status','Paid','Method'],...rentals.map(r=>[r.id,V(r.vid).name,V(r.vid).plate,C(r.cid).name,r.from,r.to,r.total,r.fee||0,r.status,r.paid?'Yes':'No',r.method||''])];
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(x=>x.map(y=>'"'+String(y).replace(/"/g,'""')+'"').join(',')).join('\n')],{type:'text/csv'}));a.download='rentals.csv';a.click()};
  }
  if(n==='customers'){
    bindSearch('cq','_cq');
    document.querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>{const c=C(b.dataset.ch),L=rentals.filter(r=>r.cid===c.id);
      modal(`<h2>${e(c.name)}’s rentals</h2>${L.length?`<table style="min-width:0">${L.map(r=>`<tr><td>${e(V(r.vid).name)}</td><td>${r.from} to ${r.to}</td><td>${inr(r.total)}</td><td>${tag(r.status)}</td></tr>`).join('')}</table>`:'<p class="empty">No rentals yet.</p>'}<div class="bar" style="margin-top:14px"><button class="ghost" data-x="1">Close</button></div>`)});
    $('#addc').onclick=()=>{const name=$('#cn').value.trim(),phone=$('#cp').value.trim(),l=$('#cl').value.trim();
      if(!name||!phone||!l)return toast('Fill in name, phone and licence number.');
      run(()=>api('/customers','POST',{name,phone,license:l}),'Customer added')};
  }
}
$('#lo').onclick=()=>{user=null;token=null;render()};
$('#th').onclick=()=>{const d=document.documentElement;const dark=(d.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'))==='dark';d.dataset.theme=dark?'light':'dark'};
addEventListener('hashchange',render);render();
