'use strict';
/**
 * admin.js — Admin Page (gto account only, Korean UI)
 * All 7 branches: daily + monthly toggle view + report generation
 */

var _adminCharts = {};
var _adminRptGlobalLang = 'en';
var _adminRptKoreaLang  = 'ko';
var _adminDailyBranch   = 'ALL';
var _adminDailyRegion   = 'all';  // 'all' | 'global' | 'korea'
var _adminMonthlyBranch = 'ALL';
var _adminMonthlyRegion = 'all';

/* ── 지점 메타 ── */
var _ADM_BR_ICONS = {AMNY:'🗽',AMLV:'🎰',AMDB:'🏜️',AMGN:'🏔',AMYS:'🌊',AMBS:'⚓',AMJJ:'🍊'};
var _ADM_BR_NAMES = {AMGN:'강릉',AMYS:'여수',AMBS:'부산',AMJJ:'제주',AMNY:'뉴욕',AMLV:'라스베가스',AMDB:'두바이'};
var _ADM_GLOBAL = ['AMNY','AMLV','AMDB'];
var _ADM_KOREA  = ['AMGN','AMYS','AMBS','AMJJ'];
var _ADM_ALL    = _ADM_GLOBAL.concat(_ADM_KOREA);

function _admBrsForRegion(r){
  if(r==='global') return _ADM_GLOBAL;
  if(r==='korea')  return _ADM_KOREA;
  return _ADM_ALL;
}

/* ══════════════════════════════════════════
   REPORT GENERATION — 상단 리포트 섹션
   ══════════════════════════════════════════ */
function setAdminRptLang(region, lang, btn){
  if(region==='global') _adminRptGlobalLang = lang;
  else _adminRptKoreaLang = lang;
  var toggleId = region==='global' ? 'adm-g-lang-toggle' : 'adm-k-lang-toggle';
  var wrap = document.getElementById(toggleId);
  if(wrap) wrap.querySelectorAll('.adm-lang-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.lang === lang);
  });
}

async function adminReport(region, action){
  var lang     = region==='global' ? _adminRptGlobalLang : _adminRptKoreaLang;
  var yearSelId  = region==='global' ? 'adm-g-year'  : 'adm-k-year';
  var monthSelId = region==='global' ? 'adm-g-month' : 'adm-k-month';
  var statusId   = region==='global' ? 'adm-g-status': 'adm-k-status';

  var yearEl  = document.getElementById(yearSelId);
  var monthEl = document.getElementById(monthSelId);
  var statusEl = document.getElementById(statusId);
  if(!yearEl || !monthEl || !statusEl) return;

  var year     = parseInt(yearEl.value);
  var monthVal = parseInt(monthEl.value);
  var isAnnual = isNaN(monthVal) || monthVal === -1;
  var endpoint = isAnnual ? '/api/annual-report' : '/api/report';
  var body     = isAnnual
    ? { year:year, action:action, lang:lang, region:region }
    : { month:monthVal, year:year, action:action, lang:lang, reportType:'monthly', region:region };

  statusEl.style.display = 'block';
  statusEl.style.cssText = 'display:block;padding:8px 12px;border-radius:6px;font-size:12px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;margin-top:8px';
  statusEl.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(30,64,175,.3);border-top-color:#1e40af;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px"></span>리포트 생성 중...';

  try {
    var resp = await fetch(endpoint, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    var d = await resp.json();
    if(!d.ok) throw new Error(d.error || '생성 실패');

    statusEl.style.cssText = 'display:block;padding:8px 12px;border-radius:6px;font-size:12px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;margin-top:8px';
    statusEl.textContent = '✅ ' + d.message;

    if(action === 'download' || action === 'preview'){
      var bin = atob(d.pdfBase64);
      var arr = new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      var blob = new Blob([arr],{type:'application/pdf'});
      var url  = URL.createObjectURL(blob);
      if(action === 'download'){
        var a = document.createElement('a'); a.href=url; a.download=d.fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
      } else {
        window.open(url,'_blank');
        setTimeout(function(){ URL.revokeObjectURL(url); }, 120000);
      }
    }
    if(typeof toast==='function') toast(d.fileName + ' 생성 완료', 'success');
  } catch(e){
    statusEl.style.cssText = 'display:block;padding:8px 12px;border-radius:6px;font-size:12px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;margin-top:8px';
    statusEl.textContent = '❌ ' + e.message;
    if(typeof toast==='function') toast('리포트 생성 실패', 'error');
  }
}

/* ══════════════════════════════════════════
   DAILY TOGGLE — 일일 현황
   ══════════════════════════════════════════ */
var _brTzMap = {
  AMNY:{tz:'America/New_York'}, AMLV:{tz:'America/Los_Angeles'},
  AMDB:{tz:'Asia/Dubai'}, AMGN:{tz:'Asia/Seoul'},
  AMYS:{tz:'Asia/Seoul'}, AMBS:{tz:'Asia/Seoul'}, AMJJ:{tz:'Asia/Seoul'}
};
function _tzToday2(br){
  return new Date().toLocaleDateString('en-CA',{timeZone:(_brTzMap[br]||{tz:'Asia/Seoul'}).tz});
}
function _tzWeekAgo2(br){
  var d=new Date(); d.setDate(d.getDate()-7);
  return d.toLocaleDateString('en-CA',{timeZone:(_brTzMap[br]||{tz:'Asia/Seoul'}).tz});
}

function admSetDailyRegion(r, btn){
  _adminDailyRegion  = r;
  _adminDailyBranch  = 'ALL';
  document.querySelectorAll('#adm-daily-region-tabs .adm-rtab').forEach(function(b){
    b.classList.toggle('active', b===btn);
  });
  _renderAdminDailyBrStrip();
  renderAdminDaily();
}
function admSelectDailyBranch(b){
  _adminDailyBranch = (_adminDailyBranch===b && b!=='ALL') ? 'ALL' : b;
  _renderAdminDailyBrStrip();
  renderAdminDaily();
}
function _renderAdminDailyBrStrip(){
  var strip = document.getElementById('adm-daily-br-strip'); if(!strip) return;
  var brs = _admBrsForRegion(_adminDailyRegion);
  var BC  = typeof BR_COLORS_MAP!=='undefined' ? BR_COLORS_MAP : {};
  var html = '<button class="adm-br-btn'+((_adminDailyBranch==='ALL')?' adm-br-active':'')
    + '" onclick="admSelectDailyBranch(\'ALL\')" style="'
    + (_adminDailyBranch==='ALL'?'background:#534AB7;color:#fff;border-color:#534AB7':'')+'">📍 전체</button>';
  brs.forEach(function(b){
    var isA = _adminDailyBranch===b;
    var col = BC[b]||'#534AB7';
    html += '<button class="adm-br-btn'+(isA?' adm-br-active':'')+'" onclick="admSelectDailyBranch(\''+b+'\')"'
      + ' style="'+(isA?'background:'+col+';color:#fff;border-color:'+col:'')+'">'
      + (_ADM_BR_ICONS[b]||'📍')+' '+b+'</button>';
  });
  strip.innerHTML = html;
}

function renderAdminDaily(){
  if(!G||!G.logs) return;
  var brs = _admBrsForRegion(_adminDailyRegion);
  var br  = _adminDailyBranch;
  var BC  = typeof BR_COLORS_MAP!=='undefined' ? BR_COLORS_MAP : {};

  // 오늘/주간 로그 수집
  var todayLogs=[], weekLogs=[];
  brs.forEach(function(b){
    if(br!=='ALL' && b!==br) return;
    var today=_tzToday2(b), weekAgo=_tzWeekAgo2(b);
    G.logs.forEach(function(r){
      if(r.Branch!==b) return;
      var rd=(r.Date||'').split('T')[0];
      if(rd>=weekAgo && rd<=today) weekLogs.push(r);
      if(rd===today) todayLogs.push(r);
    });
  });

  // KPI
  var kpiEl = document.getElementById('adm-daily-kpi');
  if(kpiEl){
    var crit = todayLogs.filter(function(r){return (r.Difficulty||0)>=4;}).length;
    var brCountHtml = '';
    brs.forEach(function(b){
      if(br!=='ALL' && b!==br) return;
      var cnt = todayLogs.filter(function(r){return r.Branch===b;}).length;
      brCountHtml += '<div class="mc" style="border-left:3px solid '+(BC[b]||'#534AB7')+'">'
        +'<div class="mc-lbl">'+(_ADM_BR_ICONS[b]||'')+' '+b+'</div>'
        +'<div class="mc-val" style="color:'+(BC[b]||'#534AB7')+'">'+cnt+'</div>'
        +'<div style="font-size:10px;color:var(--t3)">'+(_ADM_BR_NAMES[b]||b)+'</div></div>';
    });
    kpiEl.innerHTML =
      '<div class="mc"><div class="mc-lbl">오늘 총 에러</div><div class="mc-val" style="color:#534AB7">'+todayLogs.length+'</div></div>'
      +'<div class="mc"><div class="mc-lbl">주간 에러 (7일)</div><div class="mc-val" style="color:#2563eb">'+weekLogs.length+'</div></div>'
      +'<div class="mc"><div class="mc-lbl" style="color:#dc2626">위험 장애 (Lv.4+)</div><div class="mc-val" style="color:#dc2626">'+crit+'</div></div>'
      + brCountHtml;
  }

  // 추이 차트
  var cv = document.getElementById('adm-daily-trend');
  if(cv){
    var isDark = document.documentElement.classList.contains('dark-mode');
    if(_adminCharts.dailyTrend) { _adminCharts.dailyTrend.destroy(); _adminCharts.dailyTrend=null; }
    var labels=[], data=[];
    for(var i=6;i>=0;i--){
      var d2=new Date(); d2.setDate(d2.getDate()-i);
      var ds=d2.toLocaleDateString('en-CA'); labels.push(ds.slice(5));
      var n=G.logs.filter(function(r){
        var rd=(r.Date||'').split('T')[0];
        if(rd!==ds) return false;
        if(br!=='ALL' && r.Branch!==br) return false;
        return brs.indexOf(r.Branch)>=0;
      }).length;
      data.push(n);
    }
    _adminCharts.dailyTrend = new Chart(cv,{
      type:'bar',
      data:{labels:labels,datasets:[{data:data,backgroundColor:data.map(function(_,i){return i===6?'#534AB7':'#8B83D9';}),borderRadius:6,borderSkipped:false}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{y:{beginAtZero:true,ticks:{stepSize:1,precision:0,color:isDark?'#ededed':'#111110',font:{size:10}}},
          x:{ticks:{color:isDark?'#ededed':'#111110',font:{size:10}}}}}
    });
  }

  // 오늘 에러 목록
  var tbody = document.getElementById('adm-daily-tbody');
  if(tbody){
    var sorted = todayLogs.slice().sort(function(a,b){return (b.Difficulty||0)-(a.Difficulty||0);});
    if(!sorted.length){
      tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--t3)">오늘 에러 없음 ✅</td></tr>';
    } else {
      var BC2=typeof BR_COLORS_MAP!=='undefined'?BR_COLORS_MAP:{};
      tbody.innerHTML=sorted.slice(0,50).map(function(r,i){
        var dc=r.Difficulty>=4?'#dc2626':r.Difficulty>=3?'#d97706':'#16a34a';
        return '<tr>'
          +'<td style="color:var(--t3);font-size:11px">'+(i+1)+'</td>'
          +'<td><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:800;color:#fff;background:'+(BC2[r.Branch]||'#534AB7')+'">'+esc(r.Branch)+'</span></td>'
          +'<td style="font-weight:600;font-size:12px">'+esc(r.Zone||'--')+'</td>'
          +'<td style="font-size:11px;color:var(--t2)">'+esc(r.Category||'--')+'</td>'
          +'<td style="font-size:12px">'+esc((r.IssueDetail||'').slice(0,55))+((r.IssueDetail||'').length>55?'…':'')+'</td>'
          +'<td style="text-align:center"><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:800;color:#fff;background:'+dc+'">Lv.'+(r.Difficulty||1)+'</span></td>'
          +'</tr>';
      }).join('');
    }
  }
}

/* ══════════════════════════════════════════
   MONTHLY TOGGLE — 월간 현황
   ══════════════════════════════════════════ */
function admSetMonthlyRegion(r, btn){
  _adminMonthlyRegion = r;
  _adminMonthlyBranch = 'ALL';
  document.querySelectorAll('#adm-monthly-region-tabs .adm-rtab').forEach(function(b){
    b.classList.toggle('active', b===btn);
  });
  _renderAdminMonthlyBrStrip();
  renderAdminMonthly();
}
function admSelectMonthlyBranch(b){
  _adminMonthlyBranch = (_adminMonthlyBranch===b && b!=='ALL') ? 'ALL' : b;
  _renderAdminMonthlyBrStrip();
  renderAdminMonthly();
}
function _renderAdminMonthlyBrStrip(){
  var strip = document.getElementById('adm-monthly-br-strip'); if(!strip) return;
  var brs = _admBrsForRegion(_adminMonthlyRegion);
  var BC  = typeof BR_COLORS_MAP!=='undefined' ? BR_COLORS_MAP : {};
  var html = '<button class="adm-br-btn'+((_adminMonthlyBranch==='ALL')?' adm-br-active':'')
    + '" onclick="admSelectMonthlyBranch(\'ALL\')" style="'
    + (_adminMonthlyBranch==='ALL'?'background:#534AB7;color:#fff;border-color:#534AB7':'')+'">📍 전체</button>';
  brs.forEach(function(b){
    var isA=_adminMonthlyBranch===b;
    var col=BC[b]||'#534AB7';
    html += '<button class="adm-br-btn'+(isA?' adm-br-active':'')+'" onclick="admSelectMonthlyBranch(\''+b+'\')"'
      +' style="'+(isA?'background:'+col+';color:#fff;border-color:'+col:'')+'">'
      +(_ADM_BR_ICONS[b]||'📍')+' '+b+'</button>';
  });
  strip.innerHTML = html;
}

function renderAdminMonthly(){
  if(!G||!G.logs) return;
  var isDark = document.documentElement.classList.contains('dark-mode');
  var ySel = document.getElementById('adm-m-year');
  var mSel = document.getElementById('adm-m-month');
  if(!ySel||!mSel) return;
  var y = parseInt(ySel.value)||CY;
  var m = parseInt(mSel.value);
  if(isNaN(m)) m=CM;

  var brs = _admBrsForRegion(_adminMonthlyRegion);
  var br  = _adminMonthlyBranch;
  var BC  = typeof BR_COLORS_MAP!=='undefined' ? BR_COLORS_MAP : {};

  var md = G.logs.filter(function(r){
    var d=new Date(r.Date);
    if(d.getMonth()!==m||d.getFullYear()!==y) return false;
    if(brs.indexOf(r.Branch)<0) return false;
    if(br!=='ALL'&&r.Branch!==br) return false;
    return true;
  });
  var prevM=m===0?11:m-1, prevY=m===0?y-1:y;
  var lm = G.logs.filter(function(r){
    var d=new Date(r.Date);
    if(d.getMonth()!==prevM||d.getFullYear()!==prevY) return false;
    if(brs.indexOf(r.Branch)<0) return false;
    if(br!=='ALL'&&r.Branch!==br) return false;
    return true;
  });

  // KPI
  var kpiEl = document.getElementById('adm-monthly-kpi');
  if(kpiEl){
    var crit=md.filter(function(r){return(r.Difficulty||0)>=4;}).length;
    var mom=md.length-lm.length;
    var momStr=(mom>=0?'+':'')+mom;
    var momCol=mom>0?'#dc2626':mom<0?'#16a34a':'#64748b';
    var brHtml='';
    brs.forEach(function(b){
      if(br!=='ALL'&&b!==br) return;
      var cnt=md.filter(function(r){return r.Branch===b;}).length;
      var pcnt=lm.filter(function(r){return r.Branch===b;}).length;
      var d2=cnt-pcnt;
      brHtml+='<div class="mc" style="border-left:3px solid '+(BC[b]||'#534AB7')+'">'
        +'<div class="mc-lbl">'+(_ADM_BR_ICONS[b]||'')+' '+b+'</div>'
        +'<div class="mc-val" style="color:'+(BC[b]||'#534AB7')+'">'+cnt+'</div>'
        +'<div style="font-size:10px;color:'+(d2>0?'#dc2626':d2<0?'#16a34a':'#64748b')+'">전월비 '+(d2>=0?'+':'')+d2+'</div>'
        +'</div>';
    });
    kpiEl.innerHTML=
      '<div class="mc"><div class="mc-lbl">총 에러</div><div class="mc-val" style="color:#534AB7">'+md.length+'</div>'
      +'<div style="font-size:10px;color:'+momCol+'">전월비 '+momStr+'</div></div>'
      +'<div class="mc"><div class="mc-lbl" style="color:#dc2626">위험 장애(Lv.4+)</div><div class="mc-val" style="color:#dc2626">'+crit+'</div></div>'
      +brHtml;
  }

  // 추이 차트
  var tv = document.getElementById('adm-monthly-trend');
  if(tv){
    if(_adminCharts.monthlyTrend){_adminCharts.monthlyTrend.destroy();_adminCharts.monthlyTrend=null;}
    var MONTHS_KO=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    var gridC=isDark?'#2e2e2e':'#e5e4df', tickC=isDark?'#ededed':'#111110';
    var datasets=[];
    if(br!=='ALL'){
      var dat=MONTHS_KO.map(function(_,mi){
        return G.logs.filter(function(r){var d=new Date(r.Date);return d.getMonth()===mi&&d.getFullYear()===y&&r.Branch===br;}).length;
      });
      datasets.push({label:br,data:dat,borderColor:BC[br]||'#534AB7',backgroundColor:'rgba(83,74,183,0.08)',fill:true,tension:0.35,pointRadius:3,borderWidth:2.5});
    } else {
      brs.forEach(function(b){
        var dat=MONTHS_KO.map(function(_,mi){
          return G.logs.filter(function(r){var d=new Date(r.Date);return d.getMonth()===mi&&d.getFullYear()===y&&r.Branch===b;}).length;
        });
        datasets.push({label:b,data:dat,borderColor:BC[b]||'#999',backgroundColor:'transparent',fill:false,tension:0.35,pointRadius:2,borderWidth:1.8});
      });
    }
    _adminCharts.monthlyTrend=new Chart(tv,{
      type:'line',data:{labels:MONTHS_KO,datasets:datasets},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:500},
        plugins:{legend:{position:'top',align:'end',labels:{boxWidth:10,padding:8,font:{size:10},color:tickC}}},
        scales:{x:{grid:{color:gridC},ticks:{font:{size:10},color:tickC}},y:{grid:{color:gridC},beginAtZero:true,ticks:{stepSize:1,precision:0,font:{size:10},color:tickC}}}}
    });
  }

  // 카테고리 차트
  var cc = document.getElementById('adm-monthly-cat');
  if(cc){
    if(_adminCharts.monthlyCat){_adminCharts.monthlyCat.destroy();_adminCharts.monthlyCat=null;}
    var sw=md.filter(function(r){return r.Category==='Software';}).length;
    var hw=md.filter(function(r){return r.Category==='Hardware';}).length;
    var nw=md.filter(function(r){return r.Category==='Network';}).length;
    _adminCharts.monthlyCat=new Chart(cc,{
      type:'doughnut',
      data:{labels:['소프트웨어','하드웨어','네트워크'],datasets:[{data:[sw,hw,nw],backgroundColor:['#ca8a04','#2563eb','#7c3aed'],borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:8,font:{size:10},color:isDark?'#ededed':'#111110'}}}}
    });
  }

  // 에러 목록
  var tbody=document.getElementById('adm-monthly-tbody');
  if(tbody){
    var sorted=md.slice().sort(function(a,b){return new Date(b.Date)-new Date(a.Date);});
    var BC2=typeof BR_COLORS_MAP!=='undefined'?BR_COLORS_MAP:{};
    if(!sorted.length){
      tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--t3)">해당 기간 에러 없음</td></tr>';
    } else {
      tbody.innerHTML=sorted.slice(0,100).map(function(r,i){
        var dc=r.Difficulty>=4?'#dc2626':r.Difficulty>=3?'#d97706':'#16a34a';
        return '<tr>'
          +'<td style="color:var(--t3);font-size:11px">'+(i+1)+'</td>'
          +'<td><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:800;color:#fff;background:'+(BC2[r.Branch]||'#534AB7')+'">'+esc(r.Branch)+'</span></td>'
          +'<td style="font-weight:600;font-size:12px">'+esc(r.Zone||'--')+'</td>'
          +'<td style="font-size:11px;color:var(--t2)">'+esc(r.Date||'')+'</td>'
          +'<td style="font-size:12px">'+esc((r.IssueDetail||'').slice(0,55))+((r.IssueDetail||'').length>55?'…':'')+'</td>'
          +'<td style="text-align:center"><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:800;color:#fff;background:'+dc+'">Lv.'+(r.Difficulty||1)+'</span></td>'
          +'</tr>';
      }).join('');
    }
  }
}

/* ══════════════════════════════════════════
   BRANCH REPORT — 지점 계정 월간 현황 하단
   ══════════════════════════════════════════ */
function initBranchReport(){
  if(typeof _loggedBranch==='undefined'||!_loggedBranch) return;
  var sec = document.getElementById('branch-report-section');
  var div = document.getElementById('branch-report-divider');
  if(sec) sec.style.display='block';
  if(div) div.style.display='';

  var br = _loggedBranch;
  var isKorea = typeof KOREA_BRANCHES!=='undefined' && KOREA_BRANCHES.indexOf(br)>=0;
  var autoLang = isKorea ? 'ko' : 'en';
  var region   = isKorea ? 'korea' : 'global';
  var brLabel  = _ADM_BR_NAMES[br] || br;
  window._branchRptLang   = autoLang;
  window._branchRptRegion = region;

  if(!sec) return;
  sec.innerHTML = [
    '<div class="section-divider" id="branch-report-divider"></div>',
    '<div style="margin-top:4px">',
    '<div style="font-size:13px;font-weight:800;color:var(--t0);margin-bottom:12px">📋 ',
    isKorea ? brLabel+' 지점 리포트 생성' : br+' Branch Report',
    '</div>',
    // 코멘트 입력란
    '<div class="card" style="border:1px solid rgba(83,74,183,0.15);margin-bottom:12px;padding:14px">',
    '<div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:6px">',
    isKorea ? '📝 담당자 코멘트 / 비고 (선택)' : '📝 Manager Comment / Remarks (optional)',
    '</div>',
    '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;line-height:1.6">',
    isKorea
      ? '개별 안내사항, 심각한 내용, 따로 보고할 추가 내용이 있으면 입력하세요. 입력된 내용은 리포트 상단에 게시됩니다.'
      : 'Add any individual notes, serious issues, or additional information. Content will appear at the top of the report.',
    '</div>',
    '<textarea id="branch-rpt-comment" rows="3" style="width:100%;padding:10px 12px;border-radius:8px;',
    'border:1.5px solid var(--border);background:var(--bg);color:var(--t0);',
    'font-family:var(--f,sans-serif);font-size:13px;resize:vertical;outline:none;transition:border-color .2s"',
    ' placeholder="'+(isKorea
      ? '예: LED 모듈 이상 관련 추가 조사 필요. 벤더 미팅 일정 협의 중.'
      : 'e.g. LED module anomaly requires further investigation. Vendor meeting being scheduled.')+'"',
    '></textarea>',
    '</div>',
    // 월간 리포트 카드
    '<div class="card" style="border:1px solid rgba(168,85,247,0.2);margin-bottom:12px;padding:14px">',
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">',
    '<div style="display:flex;align-items:center;gap:8px">',
    '<span style="font-size:11px;font-weight:800;color:#fff;background:var(--purple);padding:2px 8px;border-radius:4px">MONTHLY</span>',
    '<div>',
    '<div style="font-size:13px;font-weight:800;color:var(--t0)">'+(isKorea?brLabel+' 월간 에러 리포트':br+' Monthly Error Report')+'</div>',
    '<div style="font-size:11px;color:var(--t3);margin-top:1px">'+(isKorea?'해당 지점 에러만 · 한국어 리포트':'Branch errors only · English report')+'</div>',
    '</div></div>',
    '<span style="font-size:10px;font-weight:700;color:var(--t3);background:var(--sub);padding:3px 8px;border-radius:6px">'+(isKorea?'🇰🇷':'🌍')+' '+br+(isKorea?' · KOR':' · ENG')+'</span>',
    '</div>',
    '<div style="display:flex;gap:6px;flex-wrap:wrap">',
    '<button class="btn btn-sm" style="flex:1;background:var(--purple);color:#fff;font-weight:700;border-radius:8px" onclick="branchReport(\'download\',\'monthly\')">'+(isKorea?'⬇ 다운로드':'⬇ Download')+'</button>',
    '<button class="btn btn-sm" style="flex:1;background:#2563eb;color:#fff;font-weight:700;border-radius:8px" onclick="branchReport(\'preview\',\'monthly\')">'+(isKorea?'👁 미리보기':'👁 Preview')+'</button>',
    '</div>',
    '<div id="br-monthly-status" style="margin-top:8px;display:none;padding:8px 12px;border-radius:6px;font-size:12px;"></div>',
    '</div>',
    // 연간 리포트 카드
    '<div class="card" style="border:1px solid rgba(15,118,110,0.2);padding:14px">',
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">',
    '<div style="display:flex;align-items:center;gap:8px">',
    '<span style="font-size:11px;font-weight:800;color:#fff;background:#0f766e;padding:2px 8px;border-radius:4px">ANNUAL</span>',
    '<div>',
    '<div style="font-size:13px;font-weight:800;color:var(--t0)">'+(isKorea?brLabel+' 연간 에러 리포트':br+' Annual Error Report')+'</div>',
    '<div style="font-size:11px;color:var(--t3);margin-top:1px">'+(isKorea?'해당 지점 연간 누적':'Branch annual summary')+'</div>',
    '</div></div>',
    '</div>',
    '<div style="display:flex;gap:6px;flex-wrap:wrap">',
    '<button class="btn btn-sm" style="flex:1;background:#0f766e;color:#fff;font-weight:700;border-radius:8px" onclick="branchReport(\'download\',\'annual\')">'+(isKorea?'⬇ 다운로드':'⬇ Download')+'</button>',
    '<button class="btn btn-sm" style="flex:1;background:#0d9488;color:#fff;font-weight:700;border-radius:8px" onclick="branchReport(\'preview\',\'annual\')">'+(isKorea?'👁 미리보기':'👁 Preview')+'</button>',
    '</div>',
    '<div id="br-annual-status" style="margin-top:8px;display:none;padding:8px 12px;border-radius:6px;font-size:12px;"></div>',
    '</div></div>'
  ].join('');
}

async function branchReport(action, type){
  if(typeof _loggedBranch==='undefined'||!_loggedBranch) return;
  var br      = _loggedBranch;
  var lang    = window._branchRptLang   || 'en';
  var region  = window._branchRptRegion || 'global';
  var isKorea = region === 'korea';
  var commentEl = document.getElementById('branch-rpt-comment');
  var comment   = commentEl ? commentEl.value : '';
  var mSel = document.getElementById('monthSel');
  var ySel = document.getElementById('yearSel');
  var month = mSel ? parseInt(mSel.value) : CM;
  var year  = ySel ? parseInt(ySel.value)  : CY;
  var statusId = type==='annual' ? 'br-annual-status' : 'br-monthly-status';
  var statusEl = document.getElementById(statusId);

  if(statusEl){
    statusEl.style.display='block';
    statusEl.style.cssText='display:block;padding:8px 12px;border-radius:6px;font-size:12px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;margin-top:8px';
    statusEl.innerHTML='<span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(30,64,175,.3);border-top-color:#1e40af;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px"></span>'+(isKorea?'리포트 생성 중...':'Generating report...');
  }

  var endpoint = type==='annual' ? '/api/annual-report' : '/api/report';
  var body = type==='annual'
    ? {year:year, action:action, lang:lang, region:region, comment:comment, branchFilter:br}
    : {month:month, year:year, action:action, lang:lang, reportType:'monthly', region:region, comment:comment, branchFilter:br};

  try {
    var resp = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d = await resp.json();
    if(!d.ok) throw new Error(d.error||(isKorea?'생성 실패':'Generation failed'));
    if(statusEl){
      statusEl.style.cssText='display:block;padding:8px 12px;border-radius:6px;font-size:12px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;margin-top:8px';
      statusEl.textContent='✅ '+d.message;
    }
    if(action==='download'||action==='preview'){
      var bin=atob(d.pdfBase64), arr=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      var blob=new Blob([arr],{type:'application/pdf'});
      var url=URL.createObjectURL(blob);
      if(action==='download'){
        var a=document.createElement('a'); a.href=url; a.download=d.fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){URL.revokeObjectURL(url);},3000);
      } else {window.open(url,'_blank'); setTimeout(function(){URL.revokeObjectURL(url);},120000);}
    }
    if(typeof toast==='function') toast(d.fileName+(isKorea?' 생성 완료':' generated'),'success');
  } catch(e){
    if(statusEl){
      statusEl.style.cssText='display:block;padding:8px 12px;border-radius:6px;font-size:12px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;margin-top:8px';
      statusEl.textContent='❌ '+e.message;
    }
    if(typeof toast==='function') toast((isKorea?'리포트 생성 실패: ':'Report failed: ')+e.message,'error');
  }
}

/* ══════════════════════════════════════════
   ADMIN PAGE INIT
   ══════════════════════════════════════════ */
function initAdminPage(){
  if(typeof _loggedId==='undefined'||_loggedId!=='gto') return;

  // Admin 탭 표시
  var tab = document.getElementById('adminTab');
  if(tab) tab.style.display='';

  // 셀렉트 초기화
  _populateAdminSelects();

  // 지점 스트립 초기화
  _renderAdminDailyBrStrip();
  _renderAdminMonthlyBrStrip();
}

function _populateAdminSelects(){
  var MONTHS_KO=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  var years=[CY,CY-1,CY-2];

  // 리포트용 연도/월 셀렉트
  ['adm-g-year','adm-k-year','adm-m-year'].forEach(function(id){
    var s=document.getElementById(id); if(!s||s.options.length) return;
    years.forEach(function(y){
      var o=document.createElement('option'); o.value=y; o.textContent=y+'년'; if(y===CY)o.selected=true; s.appendChild(o);
    });
  });
  ['adm-g-month','adm-k-month'].forEach(function(id){
    var s=document.getElementById(id); if(!s||s.options.length>1) return;
    MONTHS_KO.forEach(function(mn,i){
      var o=document.createElement('option'); o.value=i; o.textContent=mn; if(i===CM)o.selected=true; s.appendChild(o);
    });
  });
  var amMn=document.getElementById('adm-m-month');
  if(amMn&&!amMn.options.length){
    MONTHS_KO.forEach(function(mn,i){
      var o=document.createElement('option'); o.value=i; o.textContent=mn; if(i===CM)o.selected=true; amMn.appendChild(o);
    });
  }
}

function renderAdmin(){
  renderAdminDaily();
  renderAdminMonthly();
}

// DOM 준비 후 초기화
(function(){
  function _adminInit(){
    initAdminPage();
    initBranchReport();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_adminInit);
  else setTimeout(_adminInit,100);
})();
