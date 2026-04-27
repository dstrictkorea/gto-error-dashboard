'use strict';

var _p1Page=0, _p1Data=[], _p1PageSize=20;
var _p1SortKey='Date', _p1SortAsc=false; // default: Date descending
function getP1PageSize(){ var s=document.getElementById('f1-ps'); return s ? parseInt(s.value)||20 : _p1PageSize; }
var debouncedP1 = debounce(renderP1, 250);

function sortP1(key){
  if(_p1SortKey===key){ _p1SortAsc=!_p1SortAsc; }
  else { _p1SortKey=key; _p1SortAsc=true; }
  // Update arrow indicators
  document.querySelectorAll('#p1 thead .sortable').forEach(function(th){
    var arrow=th.querySelector('.sort-arrow');
    if(!arrow)return;
    if(th.getAttribute('data-sort')===key){
      arrow.textContent=_p1SortAsc?'↑':'↓';
      arrow.style.opacity='1';
      arrow.style.color='var(--purple)';
    } else {
      arrow.textContent='↕';
      arrow.style.opacity='0.3';
      arrow.style.color='inherit';
    }
  });
  applySortP1();
  _p1Page=0;
  renderP1Page();
}
function applySortP1(){
  try {
    var key=_p1SortKey, asc=_p1SortAsc;
    _p1Data.sort(function(a,b){
      if(!a || !b) return 0;
      var va=a[key]||'', vb=b[key]||'';
      // Numeric sort for Difficulty
      if(key==='Difficulty'){var na=parseInt(va)||0,nb=parseInt(vb)||0;return asc?(na-nb):(nb-na);}
      // Date sort
      if(key==='Date'){try{var da=new Date(va||''),db=new Date(vb||'');return asc?(da-db):(db-da);}catch(e){return 0;}}
      // String sort (case-insensitive)
      va=String(va).toLowerCase(); vb=String(vb).toLowerCase();
      if(va<vb) return asc?-1:1;
      if(va>vb) return asc?1:-1;
      return 0;
    });
  } catch(e) {
    console.error('[G-ATIS] applySortP1 error:', e);
  }
}

function renderP1(){
  if(!G||!Array.isArray(G.logs)) return;
  if(!el('f1-br')||!el('f1-zn')||!el('f1-ca')||!el('f1-s')) return;
  pulse();var br=el('f1-br').value,zn=el('f1-zn').value,ca=el('f1-ca').value,s=(el('f1-s').value||'').toLowerCase();
  var fyr=el('f1-yr').value,fmn=el('f1-mn').value,fdf=el('f1-df').value;
  // Tag original indices for O(1) lookup in renderP1Page
  (G.logs||[]).forEach(function(r,i){ if(r) r._idx=i; });
  _p1Data=(G.logs||[]).filter(function(r){
    if(!r) return false;
    if(br&&(r.Branch||'').toLowerCase()!==br.toLowerCase())return false;
    if(zn&&(r.Zone||'').toLowerCase()!==zn.toLowerCase())return false;
    if(ca&&(r.Category||'').toLowerCase()!==ca.toLowerCase())return false;
    if(fdf&&r.Difficulty!==parseInt(fdf))return false;
    if(fyr||fmn){var dp=((r.Date||'')).split('-');
      if(fyr&&dp[0]!==fyr)return false;
      if(fmn&&parseInt(dp[1])!==parseInt(fmn))return false;}
    if(s&&![r.IssueDetail,r.Zone,r.SolvedBy,r.ActionTaken].some(function(v){return v&&String(v).toLowerCase().indexOf(s)>=0}))return false;
    return true;
  });
  applySortP1();
  _p1Page=0;
  renderP1Page();
  // Mobile App: render visual dashboard instead of table
  if(typeof renderMobileP1 === 'function') renderMobileP1();
}
function renderP1Page(){
  var pageSize=getP1PageSize();
  var total=_p1Data.length, pages=Math.ceil(total/pageSize)||1;
  if(_p1Page>=pages)_p1Page=pages-1;
  if(_p1Page<0)_p1Page=0;

  // Show empty state if no results
  if(total===0){
    el('p1-cnt').textContent=t('showing')+' 0 '+t('of')+' 0';
    el('p1-tbl').innerHTML='<tr><td colspan="10"><div class="empty-state"><div class="empty-state-icon">☁️</div><div class="empty-state-title">'+t('noMatchingRecords')+'</div><div class="empty-state-subtitle">'+t('noMatchingSub')+'</div><button class="btn btn-sm btn-primary" onclick="el(\'f1-s\').value=\'\';el(\'f1-br\').value=\'\';el(\'f1-zn\').value=\'\';el(\'f1-ca\').value=\'\';el(\'f1-df\').value=\'\';el(\'f1-yr\').value=\'\';el(\'f1-mn\').value=\'\';renderP1()">'+t('resetFilters')+'</button></div></td></tr>';
    var pgEl=document.getElementById('p1-pager');if(pgEl)pgEl.innerHTML='';return
  }

  var start=_p1Page*pageSize, end=Math.min(start+pageSize,total);
  var pageData=_p1Data.slice(start,end);
  var pageRange=(_lang==='ko'?(start+1)+'-'+end+' / '+total+t('errors'):t('showing')+' '+(start+1)+'-'+end+' '+t('of')+' '+total);
  el('p1-cnt').textContent=pageRange;

  el('p1-tbl').innerHTML=pageData.map(function(r,rowIdx){
    var i=r._idx;
    var actualIdx=start+rowIdx;
    return'<tr class="cp" data-idx="'+i+'" onclick="showDetail(parseInt(this.getAttribute(\'data-idx\')))">'
      +'<td class="text-muted text-semibold text-nowrap">'+(actualIdx+1)+'</td>'
      +'<td>'+brBadge(r.Branch)+'</td><td><span class="zp">'+esc(r.Zone)+'</span></td><td class="text-muted text-xs">'+r.Date+'</td><td class="text-semibold text-sm">'+esc(r.SolvedBy)+'</td><td>'+catBadge(r.Category)+'</td><td class="td-left td-detail td-wrap" title="'+esc(r.IssueDetail)+'">'+esc(typeof autoTr==='function'?autoTr(r.IssueDetail):r.IssueDetail)+'</td><td class="text-xs text-muted">'+esc(typeof autoTrAction==='function'?autoTrAction(r.ActionType):r.ActionType)+'</td><td>'+tmBadge(typeof autoTr==='function'?autoTr(r.TimeTaken):r.TimeTaken)+'</td><td>'+stars(r.Difficulty)+'</td></tr>'
  }).join('');

  // Enhanced pagination controls
  var pgEl=document.getElementById('p1-pager');
  if(!pgEl){pgEl=document.createElement('div');pgEl.id='p1-pager';pgEl.className='pager-container';var tblWrap=el('p1-tbl').closest('.tbl-wrap');if(tblWrap)tblWrap.parentNode.insertBefore(pgEl,tblWrap.nextSibling)}

  var pgHtml='<div class="pager-wrap">';
  pgHtml+='<button class="page-btn page-btn-nav'+((_p1Page===0)?' disabled':'')+'" onclick="p1Go(0)" '+((_p1Page===0)?'disabled':'')+'>«</button>';
  pgHtml+='<button class="page-btn page-btn-nav'+((_p1Page===0)?' disabled':'')+'" onclick="p1Go('+(_p1Page-1)+')" '+((_p1Page===0)?'disabled':'')+'>‹</button>';

  var pStart=Math.max(0,_p1Page-3),pEnd=Math.min(pages,pStart+7);
  if(pEnd-pStart<7)pStart=Math.max(0,pEnd-7);
  for(var p=pStart;p<pEnd;p++){
    pgHtml+='<button class="page-btn'+(p===_p1Page?' page-btn-active':'')+'" onclick="p1Go('+p+')">'+(p+1)+'</button>';
  }
  pgHtml+='<button class="page-btn page-btn-nav'+((_p1Page>=pages-1)?' disabled':'')+'" onclick="p1Go('+(_p1Page+1)+')" '+((_p1Page>=pages-1)?'disabled':'')+'>›</button>';
  pgHtml+='<button class="page-btn page-btn-nav'+((_p1Page>=pages-1)?' disabled':'')+'" onclick="p1Go('+(pages-1)+')" '+((_p1Page>=pages-1)?'disabled':'')+'>»</button>';
  pgHtml+='</div>';

  // Page size selector
  pgHtml+='<div class="pager-ps"><span class="text-sm text-muted">'+t('perPage')+'</span>';
  [20,50,100].forEach(function(sz){
    pgHtml+='<button class="page-btn page-btn-sm'+(getP1PageSize()===sz?' page-btn-active':'')+'" onclick="el(\'f1-ps\').value='+sz+';_p1Page=0;renderP1Page()">'+sz+'</button>'
  });
  pgHtml+='</div>';

  // Keyboard hint
  pgHtml+='<div class="pager-hint">'+t('navigateHint')+'</div>';

  pgEl.innerHTML=pgHtml;
  closeDetail();
}
function p1Go(pg){_p1Page=pg;renderP1Page()}
function filterZone(z){goPage(2,document.querySelectorAll('.ntab')[2]);setTimeout(function(){el('f1-zn').value=z;renderP1()},100)}

var _openDetailIdx=-1;
var _detailKeyHandler=null;
var _detailOverlayEl=null;

function closeDetail(){
  // Legacy inline row (defensive — in case any caller still inserts it)
  var legacy=document.querySelector('.detail-row');
  if(legacy&&legacy.parentNode)legacy.parentNode.removeChild(legacy);
  // New overlay
  if(_detailOverlayEl&&_detailOverlayEl.parentNode){
    _detailOverlayEl.classList.remove('show');
    var el=_detailOverlayEl;
    // allow transition to play then remove
    setTimeout(function(){ if(el&&el.parentNode) el.parentNode.removeChild(el); },220);
    _detailOverlayEl=null;
  }
  document.body.classList.remove('issue-overlay-open');
  _openDetailIdx=-1;
  if(_detailKeyHandler){document.removeEventListener('keydown',_detailKeyHandler);_detailKeyHandler=null;}
}

function toggleCollapsible(el){
  try{ el.classList.toggle('open'); }catch(e){}
}

function showDetail(idx){
  // Toggle: same row clicked again → close
  if(_openDetailIdx===idx){closeDetail();return}
  closeDetail();
  var r=G.logs[idx];if(!r)return;
  _openDetailIdx=idx;

  var sim=searchSimilar(r.Branch,r.Zone,r.Category,r.IssueDetail,r);

  // Section 1: Issue Context
  var ctxHtml='<div class="detail-section"><div class="detail-section-hdr"><span class="detail-section-icon">📋</span><div class="detail-section-title">'+t('issueContext')+'</div></div>'
    +'<div class="mb-4"><div class="text-md text-bold">'+esc(typeof autoTr==='function'?autoTr(r.IssueDetail):r.IssueDetail)+'</div></div>'
    +'<div class="ctx-grid"><div><span class="ctx-meta-label">'+t('branch')+'</span>'+brBadge(r.Branch)+'</div>'
    +'<div><span class="ctx-meta-label">'+t('zone')+'</span><span class="zp ctx-meta-tag" style="color:var(--t1)">'+esc(r.Zone)+'</span></div>'
    +'<div><span class="ctx-meta-label">'+t('category')+'</span>'+catFull(r.Category)+'</div>'
    +'<div><span class="ctx-meta-label">'+t('date')+'</span><span class="ctx-meta-tag">'+r.Date+'</span></div></div>'
    +'</div>';

  // Section 2: Resolution
  var resHtml='<div class="detail-section"><div class="detail-section-hdr"><span class="detail-section-icon">✓</span><div class="detail-section-title">'+t('resolution')+'</div></div>'
    +'<div class="ctx-grid ctx-grid-wide">'
    +'<div class="ctx-card"><div class="ctx-label">👤 '+t('solvedBy')+'</div><div class="ctx-value">'+esc(r.SolvedBy)+'</div></div>'
    +'<div class="ctx-card"><div class="ctx-label">⚡ '+t('action')+'</div><div class="ctx-value">'+esc(typeof autoTr==='function'?autoTr(r.ActionTaken):r.ActionTaken)+'</div></div>'
    +'<div class="ctx-card"><div class="ctx-label">⏱ '+t('duration')+'</div><div class="ctx-value">'+esc(typeof autoTr==='function'?autoTr(r.TimeTaken):r.TimeTaken)+'</div></div>'
    +'</div>'
    +(r.HQ?'<div class="hq-banner"><span class="hq-banner-label">🏢 '+t('hqLabel')+':</span> <span style="color:var(--t1)">'+esc(typeof autoTr==='function'?autoTr(r.HQ):r.HQ)+'</span></div>':'')
    +'</div>';

  // Section 3: Similar Cases — 100-Point Scoring System (COLLAPSIBLE)
  var simHtml='<div class="issue-collapsible" data-collapsible="sim">'
    +'<div class="issue-collapsible-hdr" onclick="toggleCollapsible(this.parentNode)">'
    +'<span class="detail-section-icon">📊</span>'
    +'<div class="issue-collapsible-title">'+t('similarCasesCount')+' ('+sim.length+')</div>'
    +'<span class="issue-collapsible-chev">▾</span>'
    +'</div>'
    +'<div class="issue-collapsible-body">'
    +'<div style="font-size:10px;color:var(--t4);margin-bottom:12px">'+(_lang==='ko'?'장비 40 · 카테고리 25 · 증상 15 · Zone 10 · 장소 10 = 100점 만점 (75점 이상 표시)':'Equip 40 · Category 25 · Symptom 15 · Zone 10 · Place 10 = 100pt max (≥75pt shown)')+'</div>';
  if(sim.length){
    simHtml+='<div style="position:relative;padding:0 0 0 24px">';
    sim.forEach(function(h,hi){
      var hqPart='';
      if(h.hqEng) hqPart='<div style="color:var(--purple);font-size:11px;margin-top:4px">'+t('hqLabel')+': '+esc(typeof autoTr==='function'?autoTr(h.hqEng):h.hqEng)+'</div>';
      if(h.hq&&h.hq!==h.hqEng) hqPart+='<div style="color:var(--t3);font-size:10px">'+(_lang==='ko'?'':'KR: ')+esc(h.hq)+'</div>';
      // Score badge & breakdown
      var sc=h._matchScore||0;
      var bd=h._matchBreakdown||{};
      var scoreColor=sc>=100?'#059669':sc>=90?'#534AB7':'#d97706';
      var scoreBadge='<span style="display:inline-flex;align-items:center;gap:4px;float:right">';
      // Mini breakdown pills
      if(bd.equip)  scoreBadge+='<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(83,74,183,0.12);color:var(--purple)" title="'+(_lang==='ko'?'장비 카테고리':'Equipment')+'">'+(_lang==='ko'?'장비':'EQ')+' +'+bd.equip+'</span>';
      if(bd.cat)    scoreBadge+='<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(59,130,246,0.12);color:#3b82f6" title="'+(_lang==='ko'?'이슈 카테고리':'Category')+'">'+(_lang==='ko'?'분류':'CAT')+' +'+bd.cat+'</span>';
      if(bd.place)  scoreBadge+='<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(245,158,11,0.12);color:#d97706" title="'+(_lang==='ko'?'장소 유형':'Place Type')+'">'+(_lang==='ko'?'장소':'PLC')+' +'+bd.place+'</span>';
      if(bd.zone)   scoreBadge+='<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(16,185,129,0.12);color:#059669" title="Zone">ZN +'+bd.zone+'</span>';
      if(bd.keyword) scoreBadge+='<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(139,92,246,0.12);color:#8b5cf6" title="'+(_lang==='ko'?'증상 키워드 중복':'Symptom Keyword Overlap')+'">'+(_lang==='ko'?'증상':'SYM')+' +'+bd.keyword+'</span>';
      scoreBadge+='<span style="font-size:11px;font-weight:800;color:'+scoreColor+';background:rgba(0,0,0,0.04);padding:2px 7px;border-radius:6px;min-width:36px;text-align:center">'+sc+'pt</span>';
      scoreBadge+='</span>';

      var dotColor=sc>=100?'#059669':sc>=90?'var(--purple)':'#d97706';
      simHtml+='<div style="position:relative;margin-bottom:12px;padding-bottom:12px;'+(hi<sim.length-1?'border-left:2px solid var(--border)':'')+'"><div style="position:absolute;left:-30px;top:2px;width:12px;height:12px;background:'+dotColor+';border-radius:50%;border:2px solid var(--card)"></div>'
        +'<div style="font-weight:600;color:var(--t0);font-size:12px">'+esc(h.zone)+' · '+(typeof autoTrCat==='function'?esc(autoTrCat(h.cat||'')):esc(h.cat||''))+' <span style="color:var(--t3);font-weight:400;margin-right:4px">'+(h.date||'—')+'</span>'+scoreBadge+'</div>'
        +'<div style="color:var(--t1);font-size:12px;margin-top:3px">'+esc(typeof autoTr==='function'?autoTr(h.detail):h.detail)+'</div>'
        +'<div style="color:#059669;font-size:12px;margin-top:3px;font-weight:500">\u2192 '+esc(typeof autoTr==='function'?autoTr(h.action):h.action)+'</div>'
        +hqPart
        +'</div>'
    });
    simHtml+='</div>';
  } else {
    simHtml+='<div class="no-similar-box">'+(_lang==='ko'?'80점 이상 일치하는 유사사례가 없습니다':t('noSimilarCases'))+'</div>';
  }
  simHtml+='</div></div>'; // close issue-collapsible-body + issue-collapsible

  // Section 4: AI Analysis (COLLAPSIBLE)
  var aiHtml='<div class="issue-collapsible" data-collapsible="ai">'
    +'<div class="issue-collapsible-hdr" onclick="toggleCollapsible(this.parentNode)">'
    +'<span class="detail-section-icon">🤖</span>'
    +'<div class="issue-collapsible-title">'+t('aiAnalysis')
    +(r.Difficulty>=4?'  ⚠ DIFFICULTY '+r.Difficulty:'')
    +'</div>'
    +'<span class="issue-collapsible-chev">▾</span>'
    +'</div>'
    +'<div class="issue-collapsible-body">'
    +'<div class="ai-panel">'
    +'<div id="ai-result" style="font-size:12px;color:var(--t1);margin-bottom:10px">'
    +(r.Difficulty>=4
      ?'<strong style="color:var(--t0)">'+t('highDiffDetected')+'</strong> '+t('highDiffSub')
      :'<strong style="color:var(--t0)">'+t('aiReadyLabel')+'</strong> '+t('aiReadySub'))
    +'</div>'
    +'<button class="btn btn-sm" style="background:var(--purple);color:#fff;font-size:11px;border-radius:8px;padding:8px 16px;font-weight:600;width:100%" onclick="requestAI('+idx+')">'+t('requestAI')+'</button>'
    +'</div>'
    +'</div></div>';

  var headerTitle=(typeof autoTr==='function'?autoTr(r.IssueDetail):r.IssueDetail)||t('issueContext');
  var bodyHtml='<div class="detail-panel">'
    +ctxHtml+resHtml+simHtml+aiHtml
    +'</div>';

  // Build overlay (works as modal on desktop, bottom sheet on mobile via CSS)
  var overlay=document.createElement('div');
  overlay.className='issue-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.innerHTML=
    '<div class="issue-overlay-dialog" role="document">'
      +'<div class="issue-overlay-drag" aria-hidden="true"><div class="issue-overlay-drag-bar"></div></div>'
      +'<div class="issue-overlay-header">'
        +'<div class="issue-overlay-title">'+esc(headerTitle)+'</div>'
        +'<button type="button" class="issue-overlay-close" aria-label="Close" onclick="closeDetail()">×</button>'
      +'</div>'
      +'<div class="issue-overlay-body">'+bodyHtml+'</div>'
    +'</div>';

  // Click outside dialog closes
  overlay.addEventListener('click',function(e){ if(e.target===overlay) closeDetail(); });

  document.body.appendChild(overlay);
  document.body.classList.add('issue-overlay-open');
  _detailOverlayEl=overlay;
  // Trigger enter transition
  requestAnimationFrame(function(){ overlay.classList.add('show'); });

  // Mobile drag-to-close
  attachSheetDrag(overlay);

  // Keyboard: ESC close + arrow pagination (no row to scroll to now)
  if(_detailKeyHandler){document.removeEventListener('keydown',_detailKeyHandler);}
  _detailKeyHandler=function(e){
    if(e.key==='Escape'){closeDetail();return;}
    if(e.key==='ArrowLeft'&&_p1Page>0){p1Go(_p1Page-1)}
    else if(e.key==='ArrowRight'&&_p1Page<Math.ceil(_p1Data.length/getP1PageSize())-1){p1Go(_p1Page+1)}
  };
  document.addEventListener('keydown',_detailKeyHandler);
}

// Mobile bottom-sheet drag-to-close. Only binds on touch devices under the
// mobile breakpoint; no-op on desktop (CSS hides the drag handle).
function attachSheetDrag(overlay){
  var dialog=overlay.querySelector('.issue-overlay-dialog');
  var handle=overlay.querySelector('.issue-overlay-drag');
  var header=overlay.querySelector('.issue-overlay-header');
  if(!dialog) return;
  var isMobile=function(){ return window.matchMedia&&window.matchMedia('(max-width: 768px)').matches; };
  var startY=0, curY=0, dragging=false;

  function onStart(e){
    if(!isMobile()) return;
    var touch=e.touches?e.touches[0]:e;
    startY=touch.clientY; curY=0; dragging=true;
    dialog.classList.add('is-dragging');
  }
  function onMove(e){
    if(!dragging) return;
    var touch=e.touches?e.touches[0]:e;
    var dy=touch.clientY-startY;
    if(dy<0) dy=0;
    curY=dy;
    dialog.style.transform='translateY('+dy+'px)';
    if(e.cancelable) e.preventDefault();
  }
  function onEnd(){
    if(!dragging) return;
    dragging=false;
    dialog.classList.remove('is-dragging');
    if(curY>120){
      // dismiss
      dialog.style.transform='translateY(100%)';
      closeDetail();
    } else {
      dialog.style.transform='';
    }
  }

  [handle, header].forEach(function(el){
    if(!el) return;
    el.addEventListener('touchstart', onStart, {passive:true});
    el.addEventListener('touchmove',  onMove,  {passive:false});
    el.addEventListener('touchend',   onEnd);
    el.addEventListener('touchcancel',onEnd);
  });
}

