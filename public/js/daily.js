/**
 * daily.js — Daily Error Dashboard
 * d'strict Global Tech Ops
 * Timezone-aware: each branch toggle shows data in its local timezone
 */
'use strict';

var _dailyCharts = {};
var _dailyInited = false;

// If logged in as a site account, default to that branch; gto (HQ) defaults to ALL
var _dailyBranch = (typeof _loggedBranch !== 'undefined' && _loggedBranch)
  ? _loggedBranch
  : 'ALL';

/* ── Branch → Timezone map ── */
var _brTzMap={
  AMNY:{tz:'America/New_York',label:'New York Time'},
  AMLV:{tz:'America/Los_Angeles',label:'Las Vegas Time'},
  AMDB:{tz:'Asia/Dubai',label:'Dubai Time'},
  AMGN:{tz:'Asia/Seoul',label:'Korea Time'},
  AMYS:{tz:'Asia/Seoul',label:'Korea Time'},
  AMBS:{tz:'Asia/Seoul',label:'Korea Time'},
  AMJJ:{tz:'Asia/Seoul',label:'Korea Time'}
};

/* ══════════════════════════════
   TIMEZONE-AWARE DATE HELPERS
   ══════════════════════════════ */

/** Get "today" as YYYY-MM-DD in the branch's timezone.
 *  For ALL: use UTC (neutral) so no single regional timezone is assumed. */
function _tzToday(br){
  if(!br||br==='ALL'){
    // UTC as neutral default for ALL — avoids Seoul bias for global accounts
    return new Date().toLocaleDateString('en-CA',{timeZone:'UTC'});
  }
  var info=_brTzMap[br]||{tz:'UTC'};
  return new Date().toLocaleDateString('en-CA',{timeZone:info.tz}); // en-CA → YYYY-MM-DD
}

/** Get date N days ago as YYYY-MM-DD in the branch's timezone.
 *  For ALL: use UTC as neutral default. */
function _tzDaysAgo(br,n){
  if(!br||br==='ALL'){
    var du=new Date();
    du.setUTCDate(du.getUTCDate()-n);
    return du.toLocaleDateString('en-CA',{timeZone:'UTC'});
  }
  var info=_brTzMap[br]||{tz:'UTC'};
  var d=new Date();
  d.setDate(d.getDate()-n);
  return d.toLocaleDateString('en-CA',{timeZone:info.tz});
}

/** Standard ISO day from Date object (local) */
function _isoDay(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

/** Parse YYYY-MM-DD to Date */
function _parseDay(s){ if(!s)return null; var p=s.split('T')[0].split('-'); return p.length===3?new Date(+p[0],p[1]-1,+p[2]):null; }

function renderDaily(){
  if(!G||!Array.isArray(G.logs)) return;
  _fillDailyBranchToggles();
  _updateDaily();
  _updateSubmitBtnState();
}

/* ── Branch toggle buttons ── */
function _fillDailyBranchToggles(){
  var wrap=el('daily-branch-toggles'); if(!wrap) return;
  var regionBrs=typeof getRegionBranches==='function'?getRegionBranches():['AMNY','AMLV','AMDB'];
  var BC=typeof BR_COLORS_MAP!=='undefined'?BR_COLORS_MAP:{};
  var icons={AMNY:'🗽',AMLV:'🎰',AMDB:'🏜️',AMGN:'🏔',AMYS:'🌊',AMBS:'⚓',AMJJ:'🍊'};
  var allActive=(!_dailyBranch||_dailyBranch==='ALL'||regionBrs.indexOf(_dailyBranch)<0);
  var html='<button class="branch-seg-btn'+(allActive?' branch-seg-active':'')+'" onclick="_selectDailyBranch(\'ALL\')" style="--seg-c:#1e293b" data-color="#1e293b"><span>🌐</span><span>ALL</span></button>';
  regionBrs.forEach(function(b){
    var isActive=_dailyBranch===b;
    var col=BC[b]||'#534AB7';
    html+='<button class="branch-seg-btn'+(isActive?' branch-seg-active':'')+'" onclick="_selectDailyBranch(\''+b+'\')" style="--seg-c:'+col+'" data-color="'+col+'"><span>'+(icons[b]||'📍')+'</span><span>'+b+'</span></button>';
  });
  wrap.innerHTML=html;
}
function _selectDailyBranch(b){
  _dailyBranch=b;
  _fillDailyBranchToggles();
  _updateDaily();
  _updateSubmitBtnState();
}

/* ── Update error submit button based on account + selected branch ── */
function _updateSubmitBtnState(){
  var btn=document.getElementById('dailySubmitBtn');
  if(!btn) return;
  // HQ (gto) account: always enabled
  if(typeof _loggedBranch==='undefined'||!_loggedBranch){
    btn.disabled=false;btn.style.opacity='1';btn.style.pointerEvents='auto';
    btn.title='';
    // Hide checklist row — HQ has no branch-specific checklist
    var chkRow=document.getElementById('dailyChecklistRow');
    if(chkRow) chkRow.classList.remove('visible');
    return;
  }
  // Site account: only enabled when viewing own branch (or ALL)
  var viewing=_dailyBranch||'ALL';
  if(viewing==='ALL'||viewing===_loggedBranch){
    btn.disabled=false;btn.style.opacity='1';btn.style.pointerEvents='auto';
    btn.title='';
  }else{
    btn.disabled=true;btn.style.opacity='0.35';btn.style.pointerEvents='none';
    btn.title='타 지점 에러 제출 불가 (Only your branch)';
  }
  // Show checklist row for branch accounts that have a checklist URL
  var chkRow=document.getElementById('dailyChecklistRow');
  if(chkRow){
    var hasUrl=typeof OPEN_CHECKLIST_URLS!=='undefined'&&!!OPEN_CHECKLIST_URLS[_loggedBranch];
    chkRow.classList.toggle('visible',hasUrl);
  }
}

/* ══════════════════════════════
   LOG FILTERING (TIMEZONE-AWARE)
   ══════════════════════════════ */

/** Get logs for the past 7 days in branch's timezone */
function _logsForWeek(br){
  var today=_tzToday(br);
  var weekAgo=_tzDaysAgo(br,7);
  var regionBrs=typeof getRegionBranches==='function'?getRegionBranches():['AMNY','AMLV','AMDB'];
  return G.logs.filter(function(r){
    var rd=(r.Date||'').split('T')[0];
    if(!rd||rd<weekAgo||rd>today) return false;
    if(br&&br!=='ALL'&&r.Branch!==br) return false;
    if(br==='ALL'&&regionBrs.indexOf(r.Branch)<0) return false;
    return true;
  });
}

/** Get logs for a specific date string */
function _logsForDay(ds,br){
  var regionBrs=typeof getRegionBranches==='function'?getRegionBranches():['AMNY','AMLV','AMDB'];
  return (G.logs||[]).filter(function(r){
    var rd=(r.Date||'').split('T')[0];
    if(rd!==ds) return false;
    if(br&&br!=='ALL'&&r.Branch!==br) return false;
    if((!br||br==='ALL')&&regionBrs.indexOf(r.Branch)<0) return false;
    return true;
  });
}

/* ── Main update (timezone-aware) ── */
function _updateDaily(){
  var br=_dailyBranch||'ALL';
  var ds=_tzToday(br); // "today" in the branch's timezone
  _renderDailyKPI(ds,br);
  _renderDailyBranchToday(ds,br);
  _renderDailyTrend(ds,br);
  _renderDailyTopZone(ds,br);
  _renderDailyCat(ds,br);
  _renderDailyTopCat(ds,br);
  _renderDailyList(ds,br);
}

/* ═══════════════════════
   TODAY BY BRANCH STRIP (ALL view only)
   ═══════════════════════ */
function _renderDailyBranchToday(ds,br){
  var c=el('daily-branch-today'); if(!c) return;
  /* Only shown in ALL view; hide for single-branch */
  if(br && br!=='ALL'){ c.innerHTML=''; c.style.display='none'; return; }
  c.style.display='';

  var regionBrs=typeof getRegionBranches==='function'?getRegionBranches():['AMNY','AMLV','AMDB'];
  var BC=typeof BR_COLORS_MAP!=='undefined'?BR_COLORS_MAP:{};
  var icons={AMNY:'🗽',AMLV:'🎰',AMDB:'🏜️',AMGN:'🏔',AMYS:'🌊',AMBS:'⚓',AMJJ:'🍊'};

  /* Each branch uses its OWN timezone for "today" */
  var items=regionBrs.map(function(b){
    var bds=_tzToday(b);
    var cnt=_logsForDay(bds,b).length;
    return {br:b, cnt:cnt, col:BC[b]||'#534AB7', icon:icons[b]||'📍'};
  });
  items.sort(function(a,b){ return b.cnt-a.cnt; });

  var total=items.reduce(function(s,i){return s+i.cnt;},0);
  var h='<div class="bbt-wrap">'
    +'<div class="bbt-title">'+(t('todayByBranch')||'Today by Branch')+'</div>'
    +'<div class="bbt-list">';
  items.forEach(function(item){
    var pct=total?Math.round(item.cnt/total*100):0;
    var muted=item.cnt===0;
    h+='<div class="bbt-item'+(muted?' bbt-zero':'')+'" style="--bbt-c:'+item.col+'">'
      +'<span class="bbt-icon">'+item.icon+'</span>'
      +'<span class="bbt-br">'+esc(item.br)+'</span>'
      +'<span class="bbt-cnt">'+item.cnt+'</span>'
      +(total&&item.cnt?'<span class="bbt-pct">'+pct+'%</span>':'')
      +'</div>';
  });
  h+='</div></div>';
  c.innerHTML=h;
}

/* ═══════════════════════
   KPI CARDS
   ═══════════════════════ */
function _renderDailyKPI(ds,br){
  var c=el('daily-kpi'); if(!c)return;
  var weekLogs=_logsForWeek(br);
  var todayLogs=_logsForDay(ds,br);

  /* prev week for comparison (timezone-aware) */
  var pw_start=_tzDaysAgo(br,14);
  var pw_end=_tzDaysAgo(br,7);
  var regionBrs=typeof getRegionBranches==='function'?getRegionBranches():['AMNY','AMLV','AMDB'];
  var prevWeekLogs=(G.logs||[]).filter(function(r){
    var rd=(r.Date||'').split('T')[0];
    if(!rd||rd<pw_start||rd>=pw_end) return false;
    if(br&&br!=='ALL'&&r.Branch!==br) return false;
    if(br==='ALL'&&regionBrs.indexOf(r.Branch)<0) return false;
    return true;
  });

  var cnt=weekLogs.length, prev=prevWeekLogs.length, todayCnt=todayLogs.length;
  var dw=cnt-prev;

  /* avg errors per day */
  var avgDay=(cnt/7).toFixed(1);

  /* timezone indicator */
  var tzInfo=_brTzMap[br];
  var tzLabel=tzInfo?tzInfo.label:'';

  c.innerHTML=
    '<div class="mc"><div class="mc-label">'+t('thisWeek')+'</div><div class="mc-val kpi-purple">'+cnt+'</div>'+(tzLabel?'<div class="mc-delta text-xs text-muted">'+tzLabel+'</div>':'')+'</div>'+
    '<div class="mc"><div class="mc-label">'+t('kpiToday')+'</div><div class="mc-val kpi-blue">'+todayCnt+'</div><div class="mc-delta text-xs text-muted">'+ds+'</div></div>'+
    '<div class="mc"><div class="mc-label">'+t('vsPrevWeek')+'</div><div class="mc-val '+(dw>=0?'delta-up':'delta-dn')+'">'+(dw>=0?'+':'')+dw+'</div><div class="mc-delta">'+(prev?Math.round(dw/prev*100)+'%':'—')+'</div></div>'+
    '<div class="mc"><div class="mc-label">'+t('avgPerDay')+'</div><div class="mc-val kpi-violet">'+avgDay+'</div><div class="mc-delta">'+t('errorsPerDay')+'</div></div>';
}

/* ═══════════════════════
   7-DAY TREND BAR CHART
   ═══════════════════════ */
/* ── Shared empty-state helper ── */
function _dailyEmptyState(icon,title,sub){
  return '<div class="empty-state-box">'
    +'<div class="empty-state-icon">'+icon+'</div>'
    +'<div class="empty-state-title">'+(title||'No Data')+'</div>'
    +'<div class="empty-state-sub">'+(sub||'')+'</div></div>';
}

function _renderDailyTrend(ds,br){
  var cv=el('daily-trend-chart'); if(!cv)return;
  var dark=document.documentElement.classList.contains('dark-mode');
  var labels=[],data=[],colors=[];
  /* Build 7-day range in branch timezone */
  for(var i=6;i>=0;i--){
    var s=_tzDaysAgo(br,i);
    labels.push(s.slice(5)); /* MM-DD */
    var n=_logsForDay(s,br).length; data.push(n);
    colors.push(i===0?'#534AB7':'#8B83D9');
  }
  if(_dailyCharts.trend) _dailyCharts.trend.destroy();
  var maxVal=Math.max.apply(null,data)||1;
  /* Empty state: all 7 days = 0 */
  var allZero=data.every(function(v){return v===0;});
  if(allZero){
    cv.style.display='none';
    var wrap=cv.parentElement;
    var exist=wrap.querySelector('.empty-chart-state');
    if(!exist){
      var d=document.createElement('div');
      d.className='empty-chart-state';
      d.innerHTML=_dailyEmptyState('📊',t('no_errors')||'No Errors This Week',t('no_errors_sub')||'All systems operational');
      wrap.appendChild(d);
    }
    return;
  }
  /* Remove empty state if present */
  cv.style.display='';
  var oldEmpty=cv.parentElement.querySelector('.empty-chart-state');
  if(oldEmpty) oldEmpty.remove();
  _dailyCharts.trend=new Chart(cv,{
    type:'bar',
    data:{labels:labels,datasets:[{data:data,backgroundColor:colors,borderRadius:8,borderSkipped:false}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(26,26,24,0.95)',cornerRadius:10,padding:10,titleFont:{size:12,family:"'Pretendard',sans-serif"},bodyFont:{size:11,family:"'Pretendard',sans-serif"}}},
      scales:{y:{beginAtZero:true,ticks:{stepSize:1,precision:0,color:dark?'#ededed':'#111110',font:{size:12,weight:'600'}},grid:{color:dark?'#2e2e2e':'#e8e7e3'}},
              x:{ticks:{color:dark?'#ededed':'#111110',font:{size:12}},grid:{display:false}}},
      onClick:function(evt,elems){
        if(elems.length>0){
          var idx=elems[0].index;
          /* Navigate to Error Log page — the date is labels[idx] (MM-DD) */
          goPage(2);
          if(typeof renderP1==='function') renderP1();
        }
      }
    },
    plugins:[{
      id:'trendBarLabels',
      afterDatasetsDraw:function(chart){
        var ctx=chart.ctx;
        var meta=chart.getDatasetMeta(0);
        if(!meta||!meta.data)return;
        meta.data.forEach(function(bar,idx){
          var val=data[idx];
          if(val===0)return; /* skip 0 */
          ctx.save();
          ctx.font='bold 12px Pretendard,Montserrat,sans-serif';
          ctx.textAlign='center';
          /* if bar is tall enough (>30% of chart), draw inside white; otherwise above black */
          var barH=chart.chartArea.bottom-bar.y;
          var tall=barH>28;
          if(tall){
            ctx.fillStyle='#fff';
            ctx.textBaseline='middle';
            ctx.fillText(val,bar.x,bar.y+barH/2);
          }else{
            ctx.fillStyle=dark?'#e5e5e5':'#111110';
            ctx.textBaseline='bottom';
            ctx.fillText(val,bar.x,bar.y-4);
          }
          ctx.restore();
        });
      }
    }]
  });
}

/* ═══════════════════════
   CATEGORY DOUGHNUT
   ═══════════════════════ */
function _renderDailyCat(ds,br){
  var cv=el('daily-cat-chart'); if(!cv)return;
  var dark=document.documentElement.classList.contains('dark-mode');
  var logs=_logsForWeek(br);
  var cc={}; logs.forEach(function(r){ var k=r.Category||'Unknown'; cc[k]=(cc[k]||0)+1; });
  var labs=Object.keys(cc), vals=labs.map(function(k){return cc[k];});
  var BC=['#534AB7','#60a5fa','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#06b6d4'];

  if(_dailyCharts.cat) _dailyCharts.cat.destroy();
  var total=logs.length;
  /* Empty state */
  if(total===0){
    cv.style.display='none';
    var wrap=cv.parentElement;
    var exist=wrap.querySelector('.empty-chart-state');
    if(!exist){
      var d=document.createElement('div');
      d.className='empty-chart-state';
      d.innerHTML=_dailyEmptyState('🍩',t('no_errors')||'No Errors This Week',t('noCategoryData'));
      wrap.appendChild(d);
    }
    return;
  }
  cv.style.display='';
  var oldEmpty=cv.parentElement.querySelector('.empty-chart-state');
  if(oldEmpty) oldEmpty.remove();
  _dailyCharts.cat=new Chart(cv,{
    type:'doughnut',
    data:{labels:labs,datasets:[{data:vals,backgroundColor:BC.slice(0,labs.length),borderColor:dark?'#171717':'#fff',borderWidth:2}]},
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'62%',
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:8,font:{size:12,family:"'Pretendard',sans-serif"},color:dark?'#ededed':'#111110',usePointStyle:true,pointStyle:'circle'}},
               tooltip:{backgroundColor:'rgba(26,26,24,0.95)',cornerRadius:10,padding:10}},
      onClick:function(evt,elems){
        if(elems.length>0){
          var idx=elems[0].index;
          var cat=labs[idx];
          var sel=document.getElementById('f1-ca');
          if(sel){sel.value=cat;goPage(2);if(typeof renderP1==='function')renderP1();}
        }
      }
    },
    plugins:[{
      id:'dailyCenterText',
      afterDatasetsDraw:function(chart){
        var meta=chart.getDatasetMeta(0);
        if(!meta||!meta.data||!meta.data[0])return;
        var arc=meta.data[0];
        var cx=arc.x,cy=arc.y,ctx=chart.ctx;
        ctx.save();
        var fs=Math.round(Math.min(chart.width,chart.height)/6.5);
        ctx.font='800 '+fs+'px Pretendard,Montserrat,sans-serif';
        ctx.textAlign='center';
        var m=ctx.measureText(String(total));
        var th=m.actualBoundingBoxAscent+(m.actualBoundingBoxDescent||0);
        ctx.textBaseline='alphabetic';
        ctx.fillStyle=dark?'#f5f5f4':'#111110';
        ctx.fillText(String(total),cx,cy+th/2-1);
        ctx.restore();
      }
    }]
  });
}

/* ═══════════════════════
   TOP CATEGORY RANKING
   ═══════════════════════ */
function _renderDailyTopCat(ds,br){
  var c=el('daily-topcat'); if(!c)return;
  var logs=_logsForWeek(br);
  var cc={}; logs.forEach(function(r){ var k=r.Category||'Unknown'; cc[k]=(cc[k]||0)+1; });
  var sorted=Object.keys(cc).map(function(k){return {cat:k,cnt:cc[k]};});
  sorted.sort(function(a,b){return b.cnt-a.cnt;});
  var top5=sorted.slice(0,5);
  var total=logs.length||1;
  var catColors={'Software':'#534AB7','Hardware':'#ef4444','Network':'#f59e0b','Display':'#60a5fa','Audio':'#10b981','Control':'#8b5cf6','Power':'#f97316','Unknown':'#a1a1a1'};

  if(!top5.length){
    c.innerHTML=_dailyEmptyState('📂',t('noCatData'),t('noErrorsThisWeek'));
    return;
  }
  var h='';
  top5.forEach(function(item,i){
    var pct=Math.round(item.cnt/total*100);
    var col=catColors[item.cat]||'#534AB7';
    var catJson=JSON.stringify(item.cat).replace(/</g,'\\u003c');
    h+='<div class="rank-row'+(i<top5.length-1?' rank-row-bordered':'')+'" onclick="(function(){var s=document.getElementById(\'f1-ca\');if(s){s.value='+catJson+';goPage(2);if(typeof renderP1===\'function\')renderP1();}})()">'
      +'<div class="rank-num">#'+(i+1)+'</div>'
      +'<div class="rank-content">'
      +'<div class="flex-row-between mb-2"><span class="text-sm text-semibold">'+esc(item.cat)+'</span><span class="text-xs text-bold" style="color:'+col+'">'+pct+'%</span></div>'
      +'<div class="bar-track" style="height:18px"><div class="bar-segment" style="background:'+col+';width:'+pct+'%;min-width:'+(item.cnt>0?'24px':'0')+'"></div>'
      +'<span class="bar-label">'+item.cnt+'</span></div>'
      +'</div></div>';
  });
  c.innerHTML=h;
}

/* ═══════════════════════
   TOP ZONE RANKING
   ═══════════════════════ */
function _renderDailyTopZone(ds,br){
  var c=el('daily-topzone'); if(!c)return;
  var logs=_logsForWeek(br);
  var zc={}; logs.forEach(function(r){ var k=r.Zone||'Unknown'; zc[k]=(zc[k]||0)+1; });
  var sorted=Object.keys(zc).map(function(k){return {zone:k,cnt:zc[k]};});
  sorted.sort(function(a,b){return b.cnt-a.cnt;});
  var top5=sorted.slice(0,5);
  var total=logs.length||1;
  var zoneColors=['#534AB7','#60a5fa','#f59e0b','#10b981','#8b5cf6'];

  if(!top5.length){
    c.innerHTML=_dailyEmptyState('🗺️',t('noZoneData'),t('noErrorsThisWeek'));
    return;
  }
  var h='';
  top5.forEach(function(item,i){
    var pct=Math.round(item.cnt/total*100);
    var col=zoneColors[i]||'#534AB7';
    var zoneJson=JSON.stringify(item.zone).replace(/</g,'\\u003c');
    h+='<div class="rank-row'+(i<top5.length-1?' rank-row-bordered':'')+'" onclick="(function(){var s=document.getElementById(\'f1-zn\');if(s){s.value='+zoneJson+';goPage(2);if(typeof renderP1===\'function\')renderP1();}})()">'
      +'<div class="rank-num">#'+(i+1)+'</div>'
      +'<div class="rank-content">'
      +'<div class="flex-row-between mb-2"><span class="text-sm text-semibold">'+esc(item.zone)+'</span><span class="text-xs text-bold" style="color:'+col+'">'+pct+'%</span></div>'
      +'<div class="bar-track" style="height:18px"><div class="bar-segment" style="background:'+col+';width:'+pct+'%;min-width:'+(item.cnt>0?'24px':'0')+'"></div>'
      +'<span class="bar-label">'+item.cnt+'</span></div>'
      +'</div></div>';
  });
  c.innerHTML=h;
}

/* ═══════════════════════
   ERROR LIST (MAX 15)
   ═══════════════════════ */

/** Format time from Excel serial or HH:mm → "h:mm AM/PM"
 *  No timezone conversion — Excel already stores branch-local time */
function _fmtBrTime(dateStr,timeStr,branch){
  try{
    if(!timeStr&&timeStr!==0) return '-';
    var num=parseFloat(timeStr);
    var hh,mm;
    if(!isNaN(num)&&num>=0&&num<1){
      /* Excel serial: 0.375 = 9:00, 0.5 = 12:00 */
      var totalMin=Math.round(num*24*60);
      hh=Math.floor(totalMin/60);
      mm=totalMin%60;
    }else if(typeof timeStr==='string'&&timeStr.indexOf(':')>=0){
      var tp=timeStr.split(':');
      hh=parseInt(tp[0])||0;
      mm=parseInt(tp[1])||0;
    }else{
      return String(timeStr);
    }
    var ap=hh>=12?'PM':'AM';
    var h12=hh%12||12;
    return h12+':'+String(mm).padStart(2,'0')+' '+ap;
  }catch(e){ return String(timeStr||'-'); }
}

function _renderDailyList(ds,br){
  var c=el('daily-list'); if(!c)return;
  var logs=_logsForWeek(br);
  logs.sort(function(a,b){
    var da=a.Date||'',db=b.Date||'';
    if(da!==db) return da<db?1:-1;
    var ta=parseFloat(a.Time)||0,tb=parseFloat(b.Time)||0;
    return tb-ta;
  });
  var show=logs.slice(0,15);
  var BC=typeof BR_COLORS_MAP!=='undefined'?BR_COLORS_MAP:{AMGN:'#0891b2',AMYS:'#059669',AMBS:'#2563eb',AMJJ:'#7c3aed',AMNY:'#185FA5',AMLV:'#993C1D',AMDB:'#534AB7'};

  if(!show.length){
    c.innerHTML='<div class="daily-empty"><div class="empty-state-icon">✅</div><div class="empty-state-title">'+(t('no_errors')||'No Errors Reported')+'</div><div class="empty-state-subtitle">'+(t('no_errors_sub')||'All Clear For This Date')+'</div></div>';
    return;
  }

  var h='';
  show.forEach(function(r){
    var detail=r.IssueDetail||'-';
    if(detail.length>60)detail=detail.slice(0,60)+'\u2026';
    var timeFmt=_fmtBrTime(r.Date,r.Time,r.Branch);
    h+='<div class="daily-err-card">'
      +'<div class="daily-err-top">'
      +'<span class="daily-err-time">'+esc((r.Date||'').slice(5))+' '+timeFmt+'</span>'
      +'<span class="daily-err-badge" style="background:'+(BC[r.Branch]||'#534AB7')+'">'+esc(r.Branch)+'</span>'
      +'</div>'
      +'<div class="daily-err-zone">'+esc(r.Zone||'-')+'</div>'
      +'<div class="daily-err-detail">'+esc(detail)+'</div>'
      +'</div>';
  });

  if(logs.length>10){
    h+='<button class="daily-more-btn" onclick="goPage(2)">'+(t('view_all_errors')||'View All In Error Log')+' →</button>';
  }
  c.innerHTML=h;
}
