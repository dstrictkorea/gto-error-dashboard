'use strict';

// ═══ DATA LOADING ═══
var _isLoading = false;
var _autoRefreshTimer = null;
var _AUTO_REFRESH_MS = 60000; // 1 minute

var _loadRetryCount = 0;
var _MAX_LOAD_RETRIES = 1;

async function loadData(silent){
  if(_isLoading)return;_isLoading=true;
  var loadEl=el('loading'), loadS=el('load-s');
  if(!silent && loadEl){
    loadEl.style.display='flex';
    var isRetry = _loadRetryCount > 0;
    if(loadS) loadS.textContent = isRetry
      ? (typeof t==='function'?t('retryingLoad'):'Retrying connection...')
      : (typeof t==='function'?t('loadingSteps'):'Connecting \u2192 Authenticating \u2192 Loading data');
    // Show shimmer effect during retry for premium feel
    if(isRetry && loadEl) loadEl.classList.add('retry-loading');
  }
  if(_timer){clearTimeout(_timer);_timer=null}
  try{
    var r=await fetch('/api/data');
    if(r.status===401){window.location.href='/login';return}
    if(!r.ok){
      // Backend returns standardized { error: 'message' } on failure
      var errBody = null;
      try { errBody = await r.json(); } catch(je){}
      var serverMsg = (errBody && errBody.error) ? errBody.error : 'Server error ('+r.status+')';
      throw new Error(serverMsg);
    }
    var d=null;
    try { d=await r.json(); } catch(je){ throw new Error('Invalid JSON response'); }
    if(!d || typeof d !== 'object') throw new Error('Invalid response format');
    if(d.error)throw new Error(d.error);
    G.logs=((Array.isArray(d.logs)?d.logs:[])).filter(function(r){return r&&(r.Zone||r.IssueDetail)});
    G.history=((Array.isArray(d.history)?d.history:[])).filter(function(h){return h&&(h.zone||h.detail)});
    G.assets=((Array.isArray(d.assets)?d.assets:[])).filter(function(a){return a&&a.Name});
    G.meta=d.meta||{};
    _loadRetryCount = 0; // Reset on success
    var syncInfo=el('sync-info');
    if(syncInfo) syncInfo.textContent='\u2705 SharePoint Live \u00b7 '+(G.meta.lastSync||'');
    var syncEl=el('last-refresh');
    if(syncEl){
      var syncTime=new Date().toLocaleTimeString(_lang==='ko'?'ko-KR':'en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
      syncEl.textContent=(_lang==='ko'?'\ucd5c\uc885 \ub3d9\uae30\ud654: ':'Last sync: ')+syncTime;
    }
    if(!silent) toast('Data loaded \u2014 '+G.logs.length+'\uAC74','success');
    // Admin 페이지 pending render 처리
    if(typeof window._onAdminGLoaded==='function') window._onAdminGLoaded();

  }catch(e){
    var isNetworkErr = e && (e.name === 'TypeError' || e.message === 'Failed to fetch');
    var errMsg = isNetworkErr
      ? '\ub124\ud2b8\uc6cc\ud06c \uc624\ub958 \u2014 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694'
      : ((e&&e.message)?e.message:'Unknown error');
    errMsg=errMsg.length>80?errMsg.slice(0,80)+'\u2026':errMsg;
    var syncInfo2=el('sync-info');
    if(syncInfo2) syncInfo2.textContent='\u26a0\ufe0f '+errMsg;
    if(!silent) toast(errMsg,'error');

    // Auto-retry once after 3 seconds if first attempt failed
    if(_loadRetryCount < _MAX_LOAD_RETRIES){
      _loadRetryCount++;
      _isLoading=false;
      if(loadEl){ loadEl.classList.remove('retry-loading'); }
      setTimeout(function(){ loadData(silent); }, 3000);
      return;
    }
    _loadRetryCount = 0;
  }finally{
    _isLoading=false;
    if(!silent && loadEl){ loadEl.style.display='none'; loadEl.classList.remove('retry-loading'); }
  }
  waitForChart(function(){ initApp(); });
}
function reloadData(){_loadRetryCount=0;loadData(false)}

// ═══ AUTO-REFRESH (1 min interval) ═══
function _startAutoRefresh(){
  _stopAutoRefresh();
  _autoRefreshTimer=setInterval(function(){
    if(document.visibilityState==='visible') loadData(true);
  }, _AUTO_REFRESH_MS);
}
function _stopAutoRefresh(){
  if(_autoRefreshTimer){clearInterval(_autoRefreshTimer);_autoRefreshTimer=null}
}

// ═══ Chart.js Load Guard ═══
function waitForChart(cb, maxWait){
  if(typeof Chart !== 'undefined') return cb();
  var waited = 0, interval = 100, max = maxWait || 8000;
  var timer = setInterval(function(){
    waited += interval;
    if(typeof Chart !== 'undefined'){ clearInterval(timer); cb(); }
    else if(waited >= max){
      clearInterval(timer);
      console.warn('[G-ATIS] Chart.js failed to load from CDN, loading fallback...');
      var s = document.createElement('script');
      s.src = '/js/vendor/chart.umd.min.js';
      s.onload = function(){ cb(); };
      s.onerror = function(){ console.error('[G-ATIS] Chart.js fallback also failed'); cb(); };
      document.head.appendChild(s);
    }
  }, interval);
}

function initApp(){
  pulse(); fillSelects();
  if(typeof renderDaily==='function') renderDaily();
  if(typeof renderP0==='function') renderP0();
  if(typeof renderP1==='function') renderP1();
  if(typeof renderBranchPage==='function') renderBranchPage();
  if(typeof renderHist==='function') renderHist();
  var p0d=el('p0-date');
  if(p0d) p0d.textContent=NOW.toLocaleDateString(_lang==='ko'?'ko-KR':'en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  // Multi-timezone clocks with AM/PM + date/day
  var tzList=[
    {id:'Asia/Seoul',label:'Seoul (KST)'},
    {id:'Asia/Dubai',label:'Dubai (GST)'},
    {id:'America/New_York',label:'New York (EST)'},
    {id:'America/Los_Angeles',label:'LA (PST)'},
    {id:'America/Los_Angeles',label:'Las Vegas (PST)'}
  ];
  var _isMobile=document.body.classList.contains('mobile-app');
  function fmtTzClock(tzId){
    var now=new Date();
    var t=now.toLocaleTimeString('en-US',{timeZone:tzId,hour:'numeric',minute:'2-digit',hour12:true});
    if(_isMobile) t=t.replace(/\s?AM/,'a').replace(/\s?PM/,'p');
    var mo=now.toLocaleDateString('en-US',{timeZone:tzId,month:'short'});
    var dd=now.toLocaleDateString('en-US',{timeZone:tzId,day:'2-digit'});
    var ddd=now.toLocaleDateString('en-US',{timeZone:tzId,weekday:'short'}).toUpperCase();
    return {time:t, date:mo+'/'+dd+'('+ddd+')'};
  }
  var tzHtml=tzList.map(function(tz){
    var c=fmtTzClock(tz.id);
    var city=tz.label.split(' (')[0];
    var code=tz.label.match(/\(([^)]+)\)/);code=code?code[1]:'';
    return '<div class="tz-card">'
      +'<div class="tz-time">'+c.time+'</div>'
      +'<div class="tz-city">'+city+'</div>'
      +'<div class="tz-code">'+code+'</div>'
      +'</div>';
  }).join('');
  var wc=el('world-clocks'); if(wc) wc.innerHTML=tzHtml;
  var dwc=el('daily-world-clocks'); if(dwc) dwc.innerHTML=tzHtml;
}
function fillSelects(){
  // Monthly Overview year/month
  var ys=el('yearSel');
  if(ys && !ys.options.length){
    [CY-2,CY-1,CY].forEach(function(y){var o=document.createElement('option');o.value=y;o.textContent=y;if(y===CY)o.selected=true;ys.appendChild(o)});
    var ms=el('monthSel');
    if(ms) MONTHS.forEach(function(mn,i){var o=document.createElement('option');o.value=i;o.textContent=mn;if(i===CM)o.selected=true;ms.appendChild(o)});
  }
  // Incident Log zone filter (from data)
  var zones=unique(G.logs.map(function(r){return r.Zone})).filter(Boolean).sort();
  var zns=el('f1-zn');
  if(zns){
    zns.innerHTML='<option value="">All Zones</option>';
    zones.forEach(function(z){var o=document.createElement('option');o.value=z;o.textContent=z;zns.appendChild(o)});
  }

  // Incident Log year/month filter
  var f1yr=el('f1-yr');
  if(f1yr && !f1yr.options.length){
    var logYears=unique(G.logs.map(function(r){return(r.Date||'').split('-')[0]})).filter(function(y){return y&&y.length===4}).sort().reverse();
    if(!logYears.length) logYears=[String(CY)];
    f1yr.innerHTML='<option value="">All Years</option>';
    logYears.forEach(function(y){var o=document.createElement('option');o.value=y;o.textContent=y;f1yr.appendChild(o)});
    var f1mn=el('f1-mn');
    if(f1mn){
      f1mn.innerHTML='<option value="">All Months</option>';
      MONTHS.forEach(function(mn,i){var o=document.createElement('option');o.value=i+1;o.textContent=mn;f1mn.appendChild(o)});
    }
  }

  // Branch Detail year/month filter
  var byr=el('b-yr');
  if(byr && !byr.options.length){
    var brYears=unique(G.logs.map(function(r){return(r.Date||'').split('-')[0]})).filter(function(y){return y&&y.length===4}).sort().reverse();
    if(!brYears.length) brYears=[String(CY)];
    byr.innerHTML='<option value="">All Years</option>';
    brYears.forEach(function(y){var o=document.createElement('option');o.value=y;o.textContent=y;byr.appendChild(o)});
    var bmn=el('b-mn');
    if(bmn){
      bmn.innerHTML='<option value="">All Months</option>';
      MONTHS.forEach(function(mn,i){var o=document.createElement('option');o.value=i+1;o.textContent=mn;bmn.appendChild(o)});
    }
  }

  // Search tab zone/category filters
  var hzn=el('hist-zn');
  if(hzn){
    var histZones=unique(G.history.map(function(h){return h.zone})).filter(Boolean).sort();
    hzn.innerHTML='<option value="">All Zones</option>';
    histZones.forEach(function(z){var o=document.createElement('option');o.value=z;o.textContent=z;hzn.appendChild(o)});
  }
  var hca=el('hist-ca');
  if(hca){
    var histCats=unique(G.history.map(function(h){return h.cat})).filter(Boolean).sort();
    hca.innerHTML='<option value="">All Categories</option>';
    histCats.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;hca.appendChild(o)});
  }
}

// ═══ INITIAL LOAD ═══
loadData(false);
_startAutoRefresh();

// ═══ AUTO-REFRESH ON APP/TAB REOPEN ═══
var _visListenerAdded = false;
if (!_visListenerAdded) {
  _visListenerAdded = true;
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='visible'){
      loadData(true); // silent refresh when tab returns to foreground
      _startAutoRefresh(); // restart 1-min timer
    } else {
      _stopAutoRefresh(); // pause timer when tab hidden (save resources)
    }
  });
}
