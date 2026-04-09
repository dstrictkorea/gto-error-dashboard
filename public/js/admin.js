'use strict';
/**
 * admin.js — Admin Page (gto account only, Korean UI)
 * All 7 branches combined daily + monthly + report generation
 */

var _adminCharts = {};
var _adminRptRegion = 'global';
var _adminRptLang = 'en';
var _adminDailyBranch = 'ALL';

/* ═══ REPORT TOGGLE CONTROLS ═══ */
function setAdminRptRegion(r){
  _adminRptRegion = r;
  document.querySelectorAll('#admin-rpt-region-toggle .region-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.region === r);
  });
  _updateAdminRptTag();
}
function setAdminRptLang(l){
  _adminRptLang = l;
  document.querySelectorAll('#admin-rpt-lang-toggle .region-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.lang === l);
  });
  _updateAdminRptTag();
}
function _updateAdminRptTag(){
  var flag = _adminRptRegion === 'korea' ? '🇰🇷 Korea' : '🌍 Global';
  var langLabel = _adminRptLang === 'ko' ? 'KOR' : 'ENG';
  var tag = el('admin-rpt-tag');
  if(tag) tag.textContent = flag + ' · ' + langLabel;
}

/* ═══ ADMIN REPORT GENERATION ═══ */
async function adminReport(type, action){
  var lang = _adminRptLang, region = _adminRptRegion;
  var statusEl, endpoint, body;

  if(type === 'monthly'){
    var m = parseInt(el('admin-rpt-mn').value);
    var y = parseInt(el('admin-rpt-yr').value);
    if(isNaN(m)) m = CM; if(isNaN(y)) y = CY;
    statusEl = document.getElementById('admin-monthly-status');
    endpoint = '/api/report';
    body = { month: m, year: y, action: action, lang: lang, region: region };
  } else {
    var y2 = parseInt(el('admin-annual-yr').value);
    if(isNaN(y2)) y2 = CY;
    statusEl = document.getElementById('admin-annual-status');
    endpoint = '/api/annual-report';
    body = { year: y2, action: action, lang: lang, region: region };
  }

  if(!statusEl) return;
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px">'
    + '<div style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin .8s linear infinite"></div>'
    + '<span style="font-size:12px;color:var(--t2)">PDF 리포트 생성 중...</span></div>';

  try {
    var resp = await fetch(endpoint, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    var d = await resp.json();
    if(d.error) throw new Error(d.error);

    var byteChars = atob(d.pdfBase64);
    var byteArr = new Uint8Array(byteChars.length);
    for(var i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    var blob = new Blob([byteArr], {type:'application/pdf'});
    var url = URL.createObjectURL(blob);

    if(action === 'download'){
      var a = document.createElement('a'); a.href = url; a.download = d.fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
      statusEl.innerHTML = '<div style="padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0"><span style="font-size:12px;color:#059669">✅ ' + esc(d.fileName) + ' 다운로드 완료</span></div>';
    } else {
      window.open(url, '_blank');
      setTimeout(function(){ URL.revokeObjectURL(url); }, 120000);
      statusEl.innerHTML = '<div style="padding:8px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe"><span style="font-size:12px;color:#2563eb">👁 ' + esc(d.fileName) + ' 미리보기 열림</span></div>';
    }
    toast('PDF 리포트 생성 완료', 'success');
  } catch(e){
    statusEl.innerHTML = '<div style="padding:8px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca"><span style="font-size:12px;color:#dc2626">❌ 리포트 생성 실패: ' + esc(e.message) + '</span></div>';
    toast('리포트 생성 실패', 'error');
  }
}

/* ═══ BRANCH REPORT (site accounts — Monthly page) ═══ */
function initBranchReport(){
  if(!_loggedBranch) return; // gto = no branch report on Monthly
  var sec = document.getElementById('branch-report-section');
  var div = document.getElementById('branch-report-divider');
  if(!sec || !div) return;
  sec.style.display = 'block';
  div.style.display = '';
  // Auto-determine language: global branches → en, korea branches → ko
  var isKorea = typeof KOREA_BRANCHES !== 'undefined' && KOREA_BRANCHES.indexOf(_loggedBranch) >= 0;
  var autoLang = isKorea ? 'ko' : 'en';
  var titleEl = document.getElementById('branch-rpt-title');
  var subEl = document.getElementById('branch-rpt-sub');
  if(titleEl) titleEl.textContent = _loggedBranch + ' 월간 에러 리포트';
  if(subEl) subEl.textContent = isKorea ? '해당 지점 에러만 포함 (한국어)' : 'Branch-specific errors only (English)';
  // Store for branchReport()
  window._branchRptLang = autoLang;
}
async function branchReport(action){
  if(!_loggedBranch) return;
  var m = parseInt(el('monthSel').value);
  var y = parseInt(el('yearSel').value);
  if(isNaN(m)) m = CM; if(isNaN(y)) y = CY;
  var lang = window._branchRptLang || 'en';
  // Determine region from branch
  var isKorea = typeof KOREA_BRANCHES !== 'undefined' && KOREA_BRANCHES.indexOf(_loggedBranch) >= 0;
  var region = isKorea ? 'korea' : 'global';

  var statusEl = document.getElementById('branch-report-status');
  if(!statusEl) return;
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px">'
    + '<div style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin .8s linear infinite"></div>'
    + '<span style="font-size:12px;color:var(--t2)">PDF 생성 중...</span></div>';

  try {
    var resp = await fetch('/api/report', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ month: m, year: y, action: action, lang: lang, region: region, branch: _loggedBranch })
    });
    var d = await resp.json();
    if(d.error) throw new Error(d.error);

    var byteChars = atob(d.pdfBase64);
    var byteArr = new Uint8Array(byteChars.length);
    for(var i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    var blob = new Blob([byteArr], {type:'application/pdf'});
    var url = URL.createObjectURL(blob);

    if(action === 'download'){
      var a = document.createElement('a'); a.href = url; a.download = d.fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      statusEl.innerHTML = '<div style="padding:8px;background:#f0fdf4;border-radius:8px"><span style="font-size:12px;color:#059669">✅ 다운로드 완료</span></div>';
    } else {
      window.open(url, '_blank');
      statusEl.innerHTML = '<div style="padding:8px;background:#eff6ff;border-radius:8px"><span style="font-size:12px;color:#2563eb">👁 미리보기 열림</span></div>';
    }
  } catch(e){
    statusEl.innerHTML = '<div style="padding:8px;background:#fef2f2;border-radius:8px"><span style="font-size:12px;color:#dc2626">❌ ' + esc(e.message) + '</span></div>';
  }
}

/* ═══ ADMIN PAGE INIT ═══ */
function initAdminPage(){
  if(typeof _loggedId === 'undefined' || _loggedId !== 'gto') return;

  // Show Admin tab
  var tab = document.getElementById('adminTab');
  if(tab) tab.style.display = '';

  // Show Admin page div
  var page = document.getElementById('pAdmin');
  if(page) page.style.display = '';

  // Populate report selects
  _populateAdminSelects();
}

function _populateAdminSelects(){
  var years = [CY, CY-1, CY-2];
  // Monthly report selects
  var rptYr = el('admin-rpt-yr');
  var rptMn = el('admin-rpt-mn');
  var annualYr = el('admin-annual-yr');
  if(rptYr){
    rptYr.innerHTML = years.map(function(y){ return '<option value="'+y+'"'+(y===CY?' selected':'')+'>'+y+'</option>'; }).join('');
  }
  if(rptMn){
    rptMn.innerHTML = MONTHS.map(function(m,i){ return '<option value="'+i+'"'+(i===CM?' selected':'')+'>'+m+'</option>'; }).join('');
  }
  if(annualYr){
    annualYr.innerHTML = years.map(function(y){ return '<option value="'+y+'"'+(y===CY?' selected':'')+'>'+y+'</option>'; }).join('');
  }
  // Admin monthly view selects
  var amYr = el('admin-yearSel');
  var amMn = el('admin-monthSel');
  if(amYr){
    amYr.innerHTML = years.map(function(y){ return '<option value="'+y+'"'+(y===CY?' selected':'')+'>'+y+'</option>'; }).join('');
  }
  if(amMn){
    amMn.innerHTML = MONTHS.map(function(m,i){ return '<option value="'+i+'"'+(i===CM?' selected':'')+'>'+m+'</option>'; }).join('');
  }
}

/* ═══ ADMIN DAILY (ALL 7 BRANCHES) ═══ */
function renderAdminDaily(){
  if(!G || !G.logs) return;
  var allBrs = typeof ALL_BRANCHES !== 'undefined' ? ALL_BRANCHES : ['AMGN','AMYS','AMBS','AMJJ','AMNY','AMLV','AMDB'];
  var br = _adminDailyBranch;

  // Branch toggles
  var wrap = el('admin-daily-branch-toggles');
  if(wrap){
    var icons = {AMNY:'🗽',AMLV:'🎰',AMDB:'🏜️',AMGN:'🏔',AMYS:'🌊',AMBS:'⚓',AMJJ:'🍊'};
    var BC = typeof BR_COLORS_MAP !== 'undefined' ? BR_COLORS_MAP : {};
    var html = '<button style="padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:'+(br==='ALL'?'none':'1px solid var(--border)')+';background:'+(br==='ALL'?'var(--purple)':'var(--card)')+';color:'+(br==='ALL'?'#fff':'var(--t1)')+'" onclick="_adminSelectBranch(\'ALL\')">전체</button>';
    allBrs.forEach(function(b){
      var active = br === b;
      var col = BC[b] || '#534AB7';
      html += '<button style="padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:'+(active?'none':'1px solid var(--border)')+';background:'+(active?col:'var(--card)')+';color:'+(active?'#fff':'var(--t1)')+';display:inline-flex;align-items:center;gap:4px" onclick="_adminSelectBranch(\''+b+'\')">'+(icons[b]||'📍')+' '+b+'</button>';
    });
    wrap.innerHTML = html;
  }

  // KPI
  var kpiEl = el('admin-daily-kpi');
  if(kpiEl){
    var today = new Date().toLocaleDateString('en-CA');
    var weekAgo = (function(){ var d = new Date(); d.setDate(d.getDate()-7); return d.toLocaleDateString('en-CA'); })();
    var weekLogs = G.logs.filter(function(r){
      var rd = (r.Date||'').split('T')[0];
      if(!rd || rd < weekAgo || rd > today) return false;
      if(br !== 'ALL' && r.Branch !== br) return false;
      return true;
    });
    var todayLogs = weekLogs.filter(function(r){ return (r.Date||'').split('T')[0] === today; });
    kpiEl.innerHTML =
      '<div class="mc"><div class="mc-label">이번 주 (7일)</div><div class="mc-val" style="color:#534AB7">'+weekLogs.length+'</div></div>'
      +'<div class="mc"><div class="mc-label">오늘</div><div class="mc-val" style="color:#60a5fa">'+todayLogs.length+'</div><div class="mc-delta" style="background:none;font-size:10px;color:var(--t4)">'+today+'</div></div>';
  }

  // Trend chart
  _renderAdminDailyTrend(br);
  // Top zones
  _renderAdminDailyTopZone(br);
}

function _adminSelectBranch(b){
  _adminDailyBranch = b;
  renderAdminDaily();
}

function _renderAdminDailyTrend(br){
  var cv = el('admin-daily-trend'); if(!cv) return;
  var dark = document.documentElement.classList.contains('dark-mode');
  if(_adminCharts.dailyTrend) _adminCharts.dailyTrend.destroy();
  var labels = [], data = [];
  for(var i = 6; i >= 0; i--){
    var d = new Date(); d.setDate(d.getDate()-i);
    var ds = d.toLocaleDateString('en-CA');
    labels.push(ds.slice(5));
    var n = G.logs.filter(function(r){
      var rd = (r.Date||'').split('T')[0];
      if(rd !== ds) return false;
      if(br !== 'ALL' && r.Branch !== br) return false;
      return true;
    }).length;
    data.push(n);
  }
  _adminCharts.dailyTrend = new Chart(cv, {
    type:'bar',
    data:{labels:labels,datasets:[{data:data,backgroundColor:data.map(function(_,i){return i===6?'#534AB7':'#8B83D9'}),borderRadius:8,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1,precision:0,color:dark?'#ededed':'#111110'}},x:{ticks:{color:dark?'#ededed':'#111110'}}}}
  });
}

function _renderAdminDailyTopZone(br){
  var c = el('admin-daily-topzone'); if(!c) return;
  var today = new Date().toLocaleDateString('en-CA');
  var weekAgo = (function(){ var d = new Date(); d.setDate(d.getDate()-7); return d.toLocaleDateString('en-CA'); })();
  var logs = G.logs.filter(function(r){
    var rd = (r.Date||'').split('T')[0];
    if(!rd || rd < weekAgo || rd > today) return false;
    if(br !== 'ALL' && r.Branch !== br) return false;
    return true;
  });
  var zc = {}; logs.forEach(function(r){ var k = r.Zone||'Unknown'; zc[k] = (zc[k]||0)+1; });
  var sorted = Object.keys(zc).map(function(k){ return {zone:k,cnt:zc[k]}; }).sort(function(a,b){ return b.cnt-a.cnt; }).slice(0,5);
  var total = logs.length || 1;
  var colors = ['#534AB7','#60a5fa','#f59e0b','#10b981','#8b5cf6'];
  if(!sorted.length){ c.innerHTML = '<div style="text-align:center;color:var(--t3);padding:20px">에러 없음</div>'; return; }
  c.innerHTML = sorted.map(function(item,i){
    var pct = Math.round(item.cnt/total*100);
    return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;'+(i<sorted.length-1?'border-bottom:1px solid var(--border)':'')+'">'
      +'<div style="min-width:20px;font-size:12px;font-weight:700;color:var(--t1)">#'+(i+1)+'</div>'
      +'<div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:12px;font-weight:600;color:var(--t0)">'+esc(item.zone)+'</span><span style="font-size:11px;font-weight:700;color:'+colors[i]+'">'+pct+'%</span></div>'
      +'<div style="background:var(--border);border-radius:4px;height:14px;overflow:hidden"><div style="background:'+colors[i]+';height:100%;border-radius:4px;width:'+pct+'%;min-width:20px"></div></div>'
      +'</div></div>';
  }).join('');
}

/* ═══ ADMIN MONTHLY (ALL 7 BRANCHES) ═══ */
function renderAdminMonthly(){
  if(!G || !G.logs) return;
  var dark = document.documentElement.classList.contains('dark-mode');
  var m = parseInt(el('admin-monthSel').value);
  var y = parseInt(el('admin-yearSel').value);
  if(isNaN(m)) m = CM; if(isNaN(y)) y = CY;
  var allBrs = typeof ALL_BRANCHES !== 'undefined' ? ALL_BRANCHES : ['AMGN','AMYS','AMBS','AMJJ','AMNY','AMLV','AMDB'];
  var md = getByMonth(m,y);
  var lm = m === 0 ? getByMonth(11,y-1) : getByMonth(m-1,y);
  var BC = typeof BR_COLORS_MAP !== 'undefined' ? BR_COLORS_MAP : {};

  // KPI — all branches
  var kpi = el('admin-monthly-kpi');
  if(kpi){
    var d = md.length - lm.length;
    kpi.innerHTML =
      '<div class="mc"><div class="mc-label">전체 에러</div><div class="mc-val" style="color:#534AB7">'+md.length+'</div></div>'
      +'<div class="mc"><div class="mc-label">전월 대비</div><div class="mc-val" style="color:'+(d>=0?'#ef4444':'#10b981')+'">'+(d>=0?'+':'')+d+'</div></div>';
    allBrs.forEach(function(br){
      var cnt = md.filter(function(r){ return r.Branch===br; }).length;
      kpi.innerHTML += '<div class="mc"><div class="mc-label">'+br+'</div><div class="mc-val" style="color:'+(BC[br]||'#534AB7')+'">'+cnt+'</div></div>';
    });
  }

  // Trend chart
  var tv = el('admin-monthly-trend');
  if(tv){
    if(_adminCharts.monthlyTrend) _adminCharts.monthlyTrend.destroy();
    var tLabels = MONTHS.map(function(m){ return m.slice(0,3); });
    var tData = MONTHS.map(function(_,mi){ return getByMonth(mi,y).length; });
    _adminCharts.monthlyTrend = new Chart(tv, {
      type:'line',
      data:{labels:tLabels,datasets:[{label:String(y),data:tData,borderColor:'#534AB7',backgroundColor:'rgba(83,74,183,0.1)',fill:true,tension:0.35,pointRadius:3,borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1,precision:0,color:dark?'#ededed':'#111110'}},x:{ticks:{color:dark?'#ededed':'#111110'}}}}
    });
  }

  // Category chart
  var cc = el('admin-monthly-cat');
  if(cc){
    if(_adminCharts.monthlyCat) _adminCharts.monthlyCat.destroy();
    var catData = [
      md.filter(function(r){return r.Category==='Software'}).length,
      md.filter(function(r){return r.Category==='Hardware'}).length,
      md.filter(function(r){return r.Category==='Network'}).length
    ];
    _adminCharts.monthlyCat = new Chart(cc, {
      type:'doughnut',
      data:{labels:['Software','Hardware','Network'],datasets:[{data:catData,backgroundColor:['#ca8a04','#2563eb','#7c3aed'],borderWidth:2,borderColor:dark?'#1a1a18':'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:8,font:{size:12},color:dark?'#ededed':'#111110',usePointStyle:true,pointStyle:'circle'}}}}
    });
  }

  // Top issues
  var ti = el('admin-top-issues');
  if(ti){
    var map = {};
    md.forEach(function(r){
      var k = r.Branch+'|'+r.Zone+'|'+r.Category;
      if(!map[k]) map[k] = {br:r.Branch,zone:r.Zone,cat:r.Category,cnt:0,s:r.IssueDetail};
      map[k].cnt++;
    });
    var top = Object.values(map).sort(function(a,b){ return b.cnt-a.cnt; }).slice(0,8);
    var medals = ['🥇','🥈','🥉'];
    ti.innerHTML = top.length ? top.map(function(v,i){
      var rank = i < 3 ? '<span style="font-size:16px">'+medals[i]+'</span>' : '<span style="color:var(--t3);font-weight:700">'+(i+1)+'</span>';
      return '<tr><td>'+rank+'</td><td>'+brBadge(v.br)+'</td><td><span class="zp">'+esc(v.zone)+'</span></td><td>'+catFull(v.cat)+'</td><td class="td-left" style="color:var(--t2)">'+esc(v.s)+'</td><td style="font-size:18px;font-weight:800">'+v.cnt+'</td></tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;padding:22px;color:var(--t3)">에러 없음</td></tr>';
  }
}

/* ═══ RENDER ALL ADMIN ═══ */
function renderAdmin(){
  renderAdminDaily();
  renderAdminMonthly();
}

/* ═══ INIT ON DOM READY ═══ */
(function(){
  function _adminInit(){
    initAdminPage();
    initBranchReport();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _adminInit);
  else setTimeout(_adminInit, 100);
})();
