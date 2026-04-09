'use strict';
/**
 * admin.js v2 — Branch Detail 수준 디자인
 * Admin Page (gto only) + 지점 계정 리포트
 */

var _adminView='daily', _adminDailyBranch='ALL', _adminDailyRegion='all';
var _adminMonthlyBranch='ALL', _adminMonthlyRegion='all';
var _adminRptGlobalLang='en', _adminRptKoreaLang='ko';
var _adminCharts={};

var _AICONS={AMNY:'🗽',AMLV:'🎰',AMDB:'🏜️',AMGN:'🏔',AMYS:'🌊',AMBS:'⚓',AMJJ:'🍊'};
var _ANAMES={AMGN:'강릉',AMYS:'여수',AMBS:'부산',AMJJ:'제주',AMNY:'뉴욕',AMLV:'라스베가스',AMDB:'두바이'};
var _AGLOBAL=['AMNY','AMLV','AMDB'], _AKOREA=['AMGN','AMYS','AMBS','AMJJ'];
var _AALL=_AGLOBAL.concat(_AKOREA);
var _ACOLORS={AMGN:'#0891b2',AMYS:'#059669',AMBS:'#2563eb',AMJJ:'#7c3aed',AMNY:'#185FA5',AMLV:'#993C1D',AMDB:'#534AB7'};
function _abrs(r){return r==='global'?_AGLOBAL:r==='korea'?_AKOREA:_AALL;}

/* ── 뷰 전환 ── */
function admSwitchView(view){
  _adminView=view;
  var vd=document.getElementById('adm-view-daily');
  var vm=document.getElementById('adm-view-monthly');
  var bd=document.getElementById('adm-btn-daily');
  var bm=document.getElementById('adm-btn-monthly');
  if(vd) vd.style.display=view==='daily'?'':'none';
  if(vm) vm.style.display=view==='monthly'?'':'none';
  [bd,bm].forEach(function(b,i){
    if(!b) return;
    var isActive=(i===0&&view==='daily')||(i===1&&view==='monthly');
    b.style.background=isActive?'#534AB7':'var(--card)';
    b.style.color=isActive?'#fff':'var(--t1)';
    b.style.border=isActive?'none':'1px solid var(--border)';
  });
  if(view==='daily'){_renderAdmDailyStrip();renderAdminDaily();}
  if(view==='monthly'){_populateAdminSelects();_renderAdmMonthlyStrip();renderAdminMonthly();}
}

/* ── 리포트 생성 ── */
function setAdminRptLang(region,lang,btn){
  if(region==='global') _adminRptGlobalLang=lang;
  else _adminRptKoreaLang=lang;
  var wrap=document.getElementById(region==='global'?'adm-g-lang-toggle':'adm-k-lang-toggle');
  if(wrap) wrap.querySelectorAll('.adm-lang-btn').forEach(function(b){
    var a=b.dataset.lang===lang;
    b.classList.toggle('active',a);
    b.style.background=a?'#534AB7':'var(--card)';
    b.style.color=a?'#fff':'var(--t2)';
    b.style.borderColor=a?'#534AB7':'var(--border)';
  });
}

async function adminReport(region,action){
  var lang=region==='global'?_adminRptGlobalLang:_adminRptKoreaLang;
  var yearEl=document.getElementById(region==='global'?'adm-g-year':'adm-k-year');
  var monthEl=document.getElementById(region==='global'?'adm-g-month':'adm-k-month');
  var statusEl=document.getElementById(region==='global'?'adm-g-status':'adm-k-status');
  if(!yearEl||!monthEl||!statusEl) return;
  var year=parseInt(yearEl.value), monthVal=parseInt(monthEl.value);
  var isAnnual=isNaN(monthVal)||monthVal===-1;
  var endpoint=isAnnual?'/api/annual-report':'/api/report';
  var body=isAnnual?{year:year,action:action,lang:lang,region:region}:{month:monthVal,year:year,action:action,lang:lang,reportType:'monthly',region:region};
  statusEl.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:12px;font-weight:600;background:var(--bg);border:1px solid var(--border);margin-top:10px;color:var(--t2)';
  statusEl.innerHTML='<div style="display:flex;align-items:center;gap:8px"><div style="width:14px;height:14px;border:2px solid var(--border);border-top-color:#534AB7;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>PDF 생성 중...</div>';
  try {
    var resp=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await resp.json();
    if(!d.ok) throw new Error(d.error||'생성 실패');
    statusEl.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:12px;font-weight:600;background:#f0fdf4;border:1px solid #86efac;margin-top:10px;color:#166534';
    statusEl.textContent='✅ '+d.message;
    if(action==='download'||action==='preview'){
      var bin=atob(d.pdfBase64),arr=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      var blob=new Blob([arr],{type:'application/pdf'}),url=URL.createObjectURL(blob);
      if(action==='download'){var a=document.createElement('a');a.href=url;a.download=d.fileName;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},3000);}
      else{window.open(url,'_blank');setTimeout(function(){URL.revokeObjectURL(url);},120000);}
    }
    if(typeof toast==='function') toast(d.fileName+' 생성 완료','success');
  } catch(e){
    statusEl.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:12px;font-weight:600;background:#fef2f2;border:1px solid #fca5a5;margin-top:10px;color:#991b1b';
    statusEl.textContent='❌ '+e.message;
    if(typeof toast==='function') toast('리포트 생성 실패','error');
  }
}

/* ── 일일 현황 ── */
var _aTz={AMNY:{tz:'America/New_York'},AMLV:{tz:'America/Los_Angeles'},AMDB:{tz:'Asia/Dubai'},AMGN:{tz:'Asia/Seoul'},AMYS:{tz:'Asia/Seoul'},AMBS:{tz:'Asia/Seoul'},AMJJ:{tz:'Asia/Seoul'}};
function _atToday(br){return new Date().toLocaleDateString('en-CA',{timeZone:(_aTz[br]||{tz:'Asia/Seoul'}).tz});}
function _atWeekAgo(br){var d=new Date();d.setDate(d.getDate()-7);return d.toLocaleDateString('en-CA',{timeZone:(_aTz[br]||{tz:'Asia/Seoul'}).tz});}

function admSetDailyRegion(r,btn){
  _adminDailyRegion=r;_adminDailyBranch='ALL';
  document.querySelectorAll('#adm-daily-region-tabs .adm-rtab').forEach(function(b){b.classList.toggle('active',b===btn);});
  _renderAdmDailyStrip();renderAdminDaily();
}
function _renderAdmDailyStrip(){
  var strip=document.getElementById('adm-daily-br-strip');if(!strip) return;
  var brs=_abrs(_adminDailyRegion),br=_adminDailyBranch;
  var html='<button class="branch-seg-btn'+(br==='ALL'?' branch-seg-active':'')+'" onclick="admSelDailyBr(\'ALL\')" style="'+(br==='ALL'?'background:#1e293b;color:#fff':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+'"><span style="font-size:14px">🌐</span><span style="font-weight:600">전체</span></button>';
  brs.forEach(function(b){var isA=br===b,col=_ACOLORS[b]||'#534AB7';html+='<button class="branch-seg-btn'+(isA?' branch-seg-active':'')+'" onclick="admSelDailyBr(\''+b+'\')" style="'+(isA?'background:'+col+';color:#fff':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+'"><span style="font-size:14px">'+(_AICONS[b]||'📍')+'</span><span style="font-weight:600">'+b+'</span><span style="font-size:11px;margin-left:4px;opacity:0.75">'+(_ANAMES[b]||'')+'</span></button>';});
  strip.innerHTML=html;
}
function admSelDailyBr(b){_adminDailyBranch=(_adminDailyBranch===b&&b!=='ALL')?'ALL':b;_renderAdmDailyStrip();renderAdminDaily();}

function renderAdminDaily(){
  if(!G||!G.logs) return;
  var brs=_abrs(_adminDailyRegion),br=_adminDailyBranch;
  var todayLogs=[],weekLogs=[];
  brs.forEach(function(b){
    if(br!=='ALL'&&b!==br) return;
    var today=_atToday(b),weekAgo=_atWeekAgo(b);
    G.logs.forEach(function(r){
      if(r.Branch!==b) return;
      var rd=(r.Date||'').split('T')[0];
      if(rd>=weekAgo&&rd<=today) weekLogs.push(r);
      if(rd===today) todayLogs.push(r);
    });
  });
  var kpiEl=document.getElementById('adm-daily-kpi');
  if(kpiEl){
    var crit=todayLogs.filter(function(r){return(r.Difficulty||0)>=4;}).length;
    var sw=todayLogs.filter(function(r){return r.Category==='Software';}).length;
    var hw=todayLogs.filter(function(r){return r.Category==='Hardware';}).length;
    var brCards='';
    brs.forEach(function(b){
      if(br!=='ALL'&&b!==br) return;
      var cnt=todayLogs.filter(function(r){return r.Branch===b;}).length;
      var col=_ACOLORS[b]||'#534AB7';
      brCards+='<div class="card" style="border-top:3px solid '+col+'">'
        +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:16px">'+(_AICONS[b]||'')+'</span>'
        +'<div><div style="font-size:11px;font-weight:800;color:'+col+'">'+b+'</div><div style="font-size:10px;color:var(--t3)">'+(_ANAMES[b]||'')+'</div></div></div>'
        +'<div style="font-size:28px;font-weight:900;color:'+col+';line-height:1">'+cnt+'</div></div>';
    });
    kpiEl.innerHTML=
      '<div class="card" style="border-top:3px solid #534AB7"><div style="font-size:10px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">오늘 총 에러</div><div style="font-size:32px;font-weight:900;color:#534AB7;line-height:1">'+todayLogs.length+'</div></div>'
      +'<div class="card" style="border-top:3px solid #2563eb"><div style="font-size:10px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">주간 에러 (7일)</div><div style="font-size:32px;font-weight:900;color:#2563eb;line-height:1">'+weekLogs.length+'</div></div>'
      +'<div class="card" style="border-top:3px solid #dc2626"><div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">위험 Lv.4+</div><div style="font-size:32px;font-weight:900;color:#dc2626;line-height:1">'+crit+'</div></div>'
      +'<div class="card" style="border-top:3px solid #ca8a04"><div style="font-size:10px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">SW / HW</div><div style="font-size:26px;font-weight:900;color:var(--t0);line-height:1">'+sw+' / '+hw+'</div></div>'
      +brCards;
  }
  var cv=document.getElementById('adm-daily-trend');
  if(cv){
    var isDark=document.documentElement.classList.contains('dark-mode');
    if(_adminCharts.dT){_adminCharts.dT.destroy();_adminCharts.dT=null;}
    var labels=[],data=[];
    for(var i=6;i>=0;i--){var d2=new Date();d2.setDate(d2.getDate()-i);var ds=d2.toLocaleDateString('en-CA');labels.push(ds.slice(5));data.push(G.logs.filter(function(r){var rd=(r.Date||'').split('T')[0];if(rd!==ds)return false;if(br!=='ALL'&&r.Branch!==br)return false;return _abrs(_adminDailyRegion).indexOf(r.Branch)>=0;}).length);}
    var gc=isDark?'#2e2e2e':'#e5e4df',tc=isDark?'#ededed':'#111110';
    _adminCharts.dT=new Chart(cv,{type:'bar',data:{labels:labels,datasets:[{data:data,backgroundColor:data.map(function(_,i){return i===6?'#534AB7':'rgba(83,74,183,0.35)';}),borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#111',cornerRadius:8,padding:10}},scales:{y:{beginAtZero:true,grid:{color:gc},ticks:{stepSize:1,precision:0,color:tc,font:{size:11}}},x:{grid:{display:false},ticks:{color:tc,font:{size:11}}}}}});
  }
  var tbody=document.getElementById('adm-daily-tbody');
  if(tbody){
    if(!todayLogs.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--t3);font-size:13px">오늘 발생한 에러가 없습니다 ✅</td></tr>';}
    else{tbody.innerHTML=todayLogs.slice().sort(function(a,b){return(b.Difficulty||0)-(a.Difficulty||0);}).slice(0,50).map(function(r,i){var col=_ACOLORS[r.Branch]||'#534AB7';var dc=r.Difficulty>=4?'#dc2626':r.Difficulty>=3?'#d97706':'#16a34a';return'<tr><td style="color:var(--t3);font-size:11px;padding:9px 10px">'+(i+1)+'</td><td style="padding:9px 10px"><span style="display:inline-block;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:800;color:#fff;background:'+col+'">'+esc(r.Branch)+'</span></td><td style="padding:9px 10px;font-weight:700;font-size:12px">'+esc(r.Zone||'--')+'</td><td style="padding:9px 10px;font-size:11px;color:var(--t2)">'+esc(r.Category||'--')+'</td><td style="padding:9px 10px;font-size:12px">'+esc((r.IssueDetail||'').slice(0,60))+((r.IssueDetail||'').length>60?'…':'')+'</td><td style="padding:9px 10px;text-align:center"><span style="display:inline-block;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:800;color:#fff;background:'+dc+'">Lv.'+(r.Difficulty||1)+'</span></td></tr>';}).join('');}
  }
}

/* ── 월간 현황 ── */
function admSetMonthlyRegion(r,btn){_adminMonthlyRegion=r;_adminMonthlyBranch='ALL';document.querySelectorAll('#adm-monthly-region-tabs .adm-rtab').forEach(function(b){b.classList.toggle('active',b===btn);});_renderAdmMonthlyStrip();renderAdminMonthly();}
function _renderAdmMonthlyStrip(){
  var strip=document.getElementById('adm-monthly-br-strip');if(!strip) return;
  var brs=_abrs(_adminMonthlyRegion),br=_adminMonthlyBranch;
  var html='<button class="branch-seg-btn'+(br==='ALL'?' branch-seg-active':'')+'" onclick="admSelMonthlyBr(\'ALL\')" style="'+(br==='ALL'?'background:#1e293b;color:#fff':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+'"><span style="font-size:14px">🌐</span><span style="font-weight:600">전체</span></button>';
  brs.forEach(function(b){var isA=br===b,col=_ACOLORS[b]||'#534AB7';html+='<button class="branch-seg-btn'+(isA?' branch-seg-active':'')+'" onclick="admSelMonthlyBr(\''+b+'\')" style="'+(isA?'background:'+col+';color:#fff':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+'"><span style="font-size:14px">'+(_AICONS[b]||'📍')+'</span><span style="font-weight:600">'+b+'</span><span style="font-size:11px;margin-left:4px;opacity:0.75">'+(_ANAMES[b]||'')+'</span></button>';});
  strip.innerHTML=html;
}
function admSelMonthlyBr(b){_adminMonthlyBranch=(_adminMonthlyBranch===b&&b!=='ALL')?'ALL':b;_renderAdmMonthlyStrip();renderAdminMonthly();}

function renderAdminMonthly(){
  if(!G||!G.logs) return;
  var isDark=document.documentElement.classList.contains('dark-mode');
  var ySel=document.getElementById('adm-m-year'),mSel=document.getElementById('adm-m-month');
  if(!ySel||!mSel) return;
  var y=parseInt(ySel.value)||CY,m=parseInt(mSel.value);if(isNaN(m))m=CM;
  var brs=_abrs(_adminMonthlyRegion),br=_adminMonthlyBranch;
  var md=G.logs.filter(function(r){var d=new Date(r.Date);return d.getMonth()===m&&d.getFullYear()===y&&brs.indexOf(r.Branch)>=0&&(br==='ALL'||r.Branch===br);});
  var prevM=m===0?11:m-1,prevY=m===0?y-1:y;
  var lm=G.logs.filter(function(r){var d=new Date(r.Date);return d.getMonth()===prevM&&d.getFullYear()===prevY&&brs.indexOf(r.Branch)>=0&&(br==='ALL'||r.Branch===br);});
  var kpiEl=document.getElementById('adm-monthly-kpi');
  if(kpiEl){
    var crit=md.filter(function(r){return(r.Difficulty||0)>=4;}).length;
    var mom=md.length-lm.length,momStr=(mom>=0?'+':'')+mom,momCol=mom>0?'#dc2626':mom<0?'#16a34a':'#64748b';
    var sw=md.filter(function(r){return r.Category==='Software';}).length;
    var hw=md.filter(function(r){return r.Category==='Hardware';}).length;
    var avgD=md.length?(md.reduce(function(s,r){return s+(r.Difficulty||1);},0)/md.length).toFixed(1):'0.0';
    var brCards='';
    brs.forEach(function(b){
      if(br!=='ALL'&&b!==br) return;
      var cnt=md.filter(function(r){return r.Branch===b;}).length;
      var pcnt=lm.filter(function(r){return r.Branch===b;}).length;
      var d2=cnt-pcnt,col=_ACOLORS[b]||'#534AB7';
      brCards+='<div class="card" style="border-top:3px solid '+col+'">'
        +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:16px">'+(_AICONS[b]||'')+'</span>'
        +'<div><div style="font-size:11px;font-weight:800;color:'+col+'">'+b+'</div><div style="font-size:10px;color:var(--t3)">'+(_ANAMES[b]||'')+'</div></div></div>'
        +'<div style="font-size:28px;font-weight:900;color:'+col+';line-height:1;margin-bottom:4px">'+cnt+'</div>'
        +'<div style="font-size:10px;color:'+(d2>0?'#dc2626':d2<0?'#16a34a':'#64748b')+'">전월비 '+(d2>=0?'+':'')+d2+'</div></div>';
    });
    kpiEl.innerHTML=
      '<div class="card" style="border-top:3px solid #534AB7"><div style="font-size:10px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">총 에러</div><div style="font-size:32px;font-weight:900;color:#534AB7;line-height:1;margin-bottom:4px">'+md.length+'</div><div style="font-size:11px;color:'+momCol+';font-weight:700">'+momStr+' vs 전월</div></div>'
      +'<div class="card" style="border-top:3px solid #dc2626"><div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">위험 Lv.4+</div><div style="font-size:32px;font-weight:900;color:#dc2626;line-height:1">'+crit+'</div></div>'
      +'<div class="card" style="border-top:3px solid #ca8a04"><div style="font-size:10px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">SW / HW</div><div style="font-size:26px;font-weight:900;color:var(--t0);line-height:1">'+sw+' / '+hw+'</div></div>'
      +'<div class="card" style="border-top:3px solid #7c3aed"><div style="font-size:10px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">평균 난이도</div><div style="font-size:32px;font-weight:900;color:#7c3aed;line-height:1">'+avgD+'</div></div>'
      +brCards;
  }
  var tv=document.getElementById('adm-monthly-trend');
  if(tv){
    if(_adminCharts.mT){_adminCharts.mT.destroy();_adminCharts.mT=null;}
    var MK=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    var gc=isDark?'#2e2e2e':'#e5e4df',tc=isDark?'#ededed':'#111110';
    var datasets=[];
    if(br!=='ALL'){var dat=MK.map(function(_,mi){return G.logs.filter(function(r){var d=new Date(r.Date);return d.getMonth()===mi&&d.getFullYear()===y&&r.Branch===br;}).length;});var ctx=tv.getContext('2d');var grad=ctx.createLinearGradient(0,0,0,200);grad.addColorStop(0,isDark?'rgba(83,74,183,0.3)':'rgba(83,74,183,0.15)');grad.addColorStop(1,'rgba(83,74,183,0)');datasets.push({label:br,data:dat,borderColor:_ACOLORS[br]||'#534AB7',backgroundColor:grad,fill:true,tension:0.35,pointRadius:3,borderWidth:2.5});}
    else{brs.forEach(function(b){var dat=MK.map(function(_,mi){return G.logs.filter(function(r){var d=new Date(r.Date);return d.getMonth()===mi&&d.getFullYear()===y&&r.Branch===b;}).length;});datasets.push({label:b,data:dat,borderColor:_ACOLORS[b]||'#999',backgroundColor:'transparent',fill:false,tension:0.35,pointRadius:2,borderWidth:1.8});});}
    _adminCharts.mT=new Chart(tv,{type:'line',data:{labels:MK,datasets:datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{position:'top',align:'end',labels:{boxWidth:10,padding:8,font:{size:10},color:tc}},tooltip:{backgroundColor:'#111',cornerRadius:8,padding:10,mode:'index',intersect:false}},scales:{x:{grid:{color:gc},ticks:{font:{size:10},color:tc}},y:{grid:{color:gc},beginAtZero:true,ticks:{stepSize:1,precision:0,font:{size:10},color:tc}}}}});
  }
  var cc=document.getElementById('adm-monthly-cat');
  if(cc){
    if(_adminCharts.mC){_adminCharts.mC.destroy();_adminCharts.mC=null;}
    var sw2=md.filter(function(r){return r.Category==='Software';}).length;
    var hw2=md.filter(function(r){return r.Category==='Hardware';}).length;
    var nw=md.filter(function(r){return r.Category==='Network';}).length;
    _adminCharts.mC=new Chart(cc,{type:'doughnut',data:{labels:['소프트웨어','하드웨어','네트워크','기타'],datasets:[{data:[sw2,hw2,nw,md.length-sw2-hw2-nw],backgroundColor:['#ca8a04','#2563eb','#7c3aed','#64748b'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:10,font:{size:10},color:isDark?'#ededed':'#111110'}},tooltip:{backgroundColor:'#111',cornerRadius:8,padding:10}}}});
  }
  var tbody=document.getElementById('adm-monthly-tbody');
  if(tbody){
    var sorted=md.slice().sort(function(a,b){return new Date(b.Date)-new Date(a.Date);});
    if(!sorted.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--t3);font-size:13px">해당 기간 에러 없음</td></tr>';}
    else{tbody.innerHTML=sorted.slice(0,100).map(function(r,i){var col=_ACOLORS[r.Branch]||'#534AB7';var dc=r.Difficulty>=4?'#dc2626':r.Difficulty>=3?'#d97706':'#16a34a';return'<tr><td style="color:var(--t3);font-size:11px;padding:9px 10px">'+(i+1)+'</td><td style="padding:9px 10px"><span style="display:inline-block;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:800;color:#fff;background:'+col+'">'+esc(r.Branch)+'</span></td><td style="padding:9px 10px;font-weight:700;font-size:12px">'+esc(r.Zone||'--')+'</td><td style="padding:9px 10px;font-size:11px;color:var(--t2)">'+esc(r.Date||'')+'</td><td style="padding:9px 10px;font-size:12px">'+esc((r.IssueDetail||'').slice(0,60))+((r.IssueDetail||'').length>60?'…':'')+'</td><td style="padding:9px 10px;text-align:center"><span style="display:inline-block;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:800;color:#fff;background:'+dc+'">Lv.'+(r.Difficulty||1)+'</span></td></tr>';}).join('');}
  }
}

/* ── 지점 계정 리포트 ── */
function initBranchReport(){
  if(typeof _loggedBranch==='undefined'||!_loggedBranch) return;
  var sec=document.getElementById('branch-report-section');if(!sec) return;
  var br=_loggedBranch;
  var isKorea=typeof KOREA_BRANCHES!=='undefined'&&KOREA_BRANCHES.indexOf(br)>=0;
  var lang=isKorea?'ko':'en',region=isKorea?'korea':'global';
  var brName=_ANAMES[br]||br,brIcon=_AICONS[br]||'📍',brCol=_ACOLORS[br]||'#534AB7';
  window._brRptLang=lang;window._brRptRegion=region;
  sec.innerHTML=[
    '<div class="section-divider"></div><div style="margin-top:4px">',
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">',
    '<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;font-size:20px;background:'+brCol+'22">'+brIcon+'</span>',
    '<div><div style="font-size:15px;font-weight:800;color:var(--t0)">'+(isKorea?brName+' 지점 리포트 생성':br+' Branch Report')+'</div>',
    '<div style="font-size:11px;color:var(--t2);margin-top:1px">'+(isKorea?'해당 지점 에러만 포함':'Branch-specific errors only')+'</div></div></div>',
    '<div class="card" style="border:1.5px solid rgba(83,74,183,0.15);margin-bottom:12px">',
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span style="font-size:14px">📝</span>',
    '<div style="font-size:12px;font-weight:700;color:var(--t0)">'+(isKorea?'담당자 코멘트 / 비고':'Manager Comment / Remarks')+'</div>',
    '<span style="font-size:10px;color:var(--t3);margin-left:auto">'+(isKorea?'선택사항':'Optional')+'</span></div>',
    '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;padding:8px 10px;background:var(--bg);border-radius:6px">',
    isKorea?'💡 개별 안내사항, 심각한 내용, 따로 보고할 사항을 입력하세요. 입력된 내용은 리포트 상단에 게시됩니다.'
      :'💡 Add individual notes, serious issues, or additional information. Content will appear at the top of the report.',
    '</div>',
    '<textarea id="branch-rpt-comment" rows="3" style="width:100%;padding:10px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);color:var(--t0);font-family:var(--f,sans-serif);font-size:13px;resize:vertical;outline:none;transition:border-color .2s;line-height:1.6" onfocus="this.style.borderColor=\'#534AB7\'" onblur="this.style.borderColor=\'var(--border)\'"',
    ' placeholder="'+(isKorea?'예: LED 모듈 이상 관련 추가 조사 필요. 벤더 미팅 일정 협의 중.':'e.g. LED module anomaly requires further investigation.')+'"',
    '></textarea></div>',
    '<div class="card" style="border-left:4px solid '+brCol+';margin-bottom:12px">',
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">',
    '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;font-weight:800;color:#fff;background:'+brCol+';padding:3px 10px;border-radius:5px">MONTHLY</span>',
    '<div><div style="font-size:13px;font-weight:800;color:var(--t0)">'+(isKorea?brName+' 월간 에러 리포트':br+' Monthly Error Report')+'</div>',
    '<div style="font-size:11px;color:var(--t3);margin-top:1px">'+(isKorea?'한국어 리포트':'English report')+'</div></div></div>',
    '<span style="font-size:10px;font-weight:700;color:var(--t3);background:var(--bg);padding:3px 10px;border-radius:20px;border:1px solid var(--border)">'+(isKorea?'🇰🇷 KOR':'🌍 ENG')+'</span></div>',
    '<div style="display:flex;gap:8px">',
    '<button class="btn btn-sm" style="flex:1;background:'+brCol+';color:#fff;font-weight:700;border-radius:8px;padding:10px" onclick="branchReport(\'download\',\'monthly\')">'+(isKorea?'⬇ 다운로드':'⬇ Download')+'</button>',
    '<button class="btn btn-sm" style="flex:1;background:var(--card);color:var(--t1);border:1.5px solid var(--border);font-weight:700;border-radius:8px;padding:10px" onclick="branchReport(\'preview\',\'monthly\')">'+(isKorea?'👁 미리보기':'👁 Preview')+'</button>',
    '</div><div id="br-monthly-status"></div></div>',
    '<div class="card" style="border-left:4px solid #0f766e">',
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">',
    '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;font-weight:800;color:#fff;background:#0f766e;padding:3px 10px;border-radius:5px">ANNUAL</span>',
    '<div><div style="font-size:13px;font-weight:800;color:var(--t0)">'+(isKorea?brName+' 연간 에러 리포트':br+' Annual Error Report')+'</div>',
    '<div style="font-size:11px;color:var(--t3);margin-top:1px">'+(isKorea?'해당 지점 연간 누적':'Branch annual summary')+'</div></div></div>',
    '<span style="font-size:10px;font-weight:700;color:var(--t3);background:var(--bg);padding:3px 10px;border-radius:20px;border:1px solid var(--border)">'+(isKorea?'🇰🇷 KOR':'🌍 ENG')+'</span></div>',
    '<div style="display:flex;gap:8px">',
    '<button class="btn btn-sm" style="flex:1;background:#0f766e;color:#fff;font-weight:700;border-radius:8px;padding:10px" onclick="branchReport(\'download\',\'annual\')">'+(isKorea?'⬇ 다운로드':'⬇ Download')+'</button>',
    '<button class="btn btn-sm" style="flex:1;background:var(--card);color:var(--t1);border:1.5px solid var(--border);font-weight:700;border-radius:8px;padding:10px" onclick="branchReport(\'preview\',\'annual\')">'+(isKorea?'👁 미리보기':'👁 Preview')+'</button>',
    '</div><div id="br-annual-status"></div></div></div>'
  ].join('');
  sec.style.display='block';
}

async function branchReport(action,type){
  if(typeof _loggedBranch==='undefined'||!_loggedBranch) return;
  var br=_loggedBranch,lang=window._brRptLang||'en',region=window._brRptRegion||'global';
  var isKorea=region==='korea';
  var comment=(document.getElementById('branch-rpt-comment')||{}).value||'';
  var mSel=document.getElementById('monthSel'),ySel=document.getElementById('yearSel');
  var month=mSel?parseInt(mSel.value):CM,year=ySel?parseInt(ySel.value):CY;
  var statusEl=document.getElementById(type==='annual'?'br-annual-status':'br-monthly-status');
  if(statusEl){statusEl.style.cssText='padding:10px 14px;border-radius:8px;font-size:12px;font-weight:600;background:var(--bg);border:1px solid var(--border);margin-top:10px;color:var(--t2)';statusEl.innerHTML='<div style="display:flex;align-items:center;gap:8px"><div style="width:14px;height:14px;border:2px solid var(--border);border-top-color:#534AB7;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>'+(isKorea?'리포트 생성 중...':'Generating...')+'</div>';}
  var endpoint=type==='annual'?'/api/annual-report':'/api/report';
  var body=type==='annual'?{year:year,action:action,lang:lang,region:region,comment:comment,branchFilter:br}:{month:month,year:year,action:action,lang:lang,reportType:'monthly',region:region,comment:comment,branchFilter:br};
  try {
    var resp=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await resp.json();if(!d.ok) throw new Error(d.error||(isKorea?'생성 실패':'Failed'));
    if(statusEl){statusEl.style.cssText='padding:10px 14px;border-radius:8px;font-size:12px;font-weight:600;background:#f0fdf4;border:1px solid #86efac;margin-top:10px;color:#166534';statusEl.textContent='✅ '+d.message;}
    if(action==='download'||action==='preview'){var bin=atob(d.pdfBase64),arr=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);var blob=new Blob([arr],{type:'application/pdf'}),url=URL.createObjectURL(blob);if(action==='download'){var a=document.createElement('a');a.href=url;a.download=d.fileName;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},3000);}else{window.open(url,'_blank');setTimeout(function(){URL.revokeObjectURL(url);},120000);}}
    if(typeof toast==='function') toast(d.fileName+(isKorea?' 생성 완료':' generated'),'success');
  } catch(e){
    if(statusEl){statusEl.style.cssText='padding:10px 14px;border-radius:8px;font-size:12px;font-weight:600;background:#fef2f2;border:1px solid #fca5a5;margin-top:10px;color:#991b1b';statusEl.textContent='❌ '+e.message;}
    if(typeof toast==='function') toast((isKorea?'리포트 생성 실패: ':'Report failed: ')+e.message,'error');
  }
}

/* ── 초기화 ── */
function _populateAdminSelects(){
  var MK=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],years=[CY,CY-1,CY-2];
  ['adm-g-year','adm-k-year','adm-m-year'].forEach(function(id){var s=document.getElementById(id);if(!s||s.options.length) return;years.forEach(function(y){var o=document.createElement('option');o.value=y;o.textContent=y+'년';if(y===CY)o.selected=true;s.appendChild(o);});});
  ['adm-g-month','adm-k-month','adm-m-month'].forEach(function(id){var s=document.getElementById(id);if(!s||s.options.length>1) return;MK.forEach(function(mn,i){var o=document.createElement('option');o.value=i;o.textContent=mn;if(i===CM)o.selected=true;s.appendChild(o);});});
}

function initAdminPage(){
  if(typeof _loggedId==='undefined'||_loggedId!=='gto') return;
  var tab=document.getElementById('adminTab');if(tab) tab.style.display='';
  _populateAdminSelects();_renderAdmDailyStrip();_renderAdmMonthlyStrip();
}

function renderAdmin(){
  if(_adminView==='daily') renderAdminDaily();
  if(_adminView==='monthly') renderAdminMonthly();
}

(function(){function _i(){initAdminPage();initBranchReport();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',_i);else setTimeout(_i,100);})();
