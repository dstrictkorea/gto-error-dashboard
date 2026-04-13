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
    el('p1-tbl').innerHTML='<tr><td colspan="10" style="padding:40px;text-align:center"><div style="color:var(--t3)"><div style="font-size:32px;margin-bottom:8px">☁️</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">'+t('noMatchingRecords')+'</div><div style="font-size:12px;color:var(--t4);margin-bottom:16px">'+t('noMatchingSub')+'</div><button class="btn btn-sm" style="background:var(--purple);color:#fff;padding:6px 16px;border-radius:8px" onclick="el(\'f1-s\').value=\'\';el(\'f1-br\').value=\'\';el(\'f1-zn\').value=\'\';el(\'f1-ca\').value=\'\';el(\'f1-df\').value=\'\';el(\'f1-yr\').value=\'\';el(\'f1-mn\').value=\'\';renderP1()">'+t('resetFilters')+'</button></div></td></tr>';
    var pgEl=document.getElementById('p1-pager');if(pgEl)pgEl.innerHTML='';return
  }

  var start=_p1Page*pageSize, end=Math.min(start+pageSize,total);
  var pageData=_p1Data.slice(start,end);
  var pageRange=(_lang==='ko'?(start+1)+'-'+end+' / '+total+t('errors'):t('showing')+' '+(start+1)+'-'+end+' '+t('of')+' '+total);
  el('p1-cnt').textContent=pageRange;

  el('p1-tbl').innerHTML=pageData.map(function(r,rowIdx){
    var i=r._idx;
    var actualIdx=start+rowIdx;
    var zebra=actualIdx%2===0?'background:rgba(0,0,0,0.01)':'';
    return'<tr class="cp" data-idx="'+i+'" style="'+zebra+'" onclick="showDetail(parseInt(this.getAttribute(\'data-idx\')))">'
      +'<td style="color:var(--t3);font-weight:600;width:48px;white-space:nowrap">'+(actualIdx+1)+'</td>'
      +'<td>'+brBadge(r.Branch)+'</td><td><span class="zp">'+esc(r.Zone)+'</span></td><td style="color:var(--t3);font-size:12px">'+r.Date+'</td><td style="font-weight:500;font-size:13px">'+esc(r.SolvedBy)+'</td><td>'+catBadge(r.Category)+'</td><td class="td-left" title="'+esc(r.IssueDetail)+'" style="color:var(--t2);font-size:13px">'+esc(typeof autoTr==='function'?autoTr(r.IssueDetail):r.IssueDetail)+'</td><td style="font-size:11px;color:var(--t3)">'+esc(typeof autoTrAction==='function'?autoTrAction(r.ActionType):r.ActionType)+'</td><td>'+tmBadge(typeof autoTr==='function'?autoTr(r.TimeTaken):r.TimeTaken)+'</td><td>'+stars(r.Difficulty)+'</td></tr>'
  }).join('');

  // Enhanced pagination controls
  var pgEl=document.getElementById('p1-pager');
  if(!pgEl){pgEl=document.createElement('div');pgEl.id='p1-pager';pgEl.style.cssText='display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 0;flex-wrap:wrap;font-size:12px';var tblWrap=el('p1-tbl').closest('.tbl-wrap');if(tblWrap)tblWrap.parentNode.insertBefore(pgEl,tblWrap.nextSibling)}

  var pgHtml='<div style="display:flex;gap:2px;align-items:center">';
  pgHtml+='<button class="btn btn-ghost btn-sm" onclick="p1Go(0)" style="border-radius:6px;padding:6px 10px;min-width:auto;'+((_p1Page===0)?'opacity:.4':'')+'" '+((_p1Page===0)?'disabled':'')+'>«</button>';
  pgHtml+='<button class="btn btn-ghost btn-sm" onclick="p1Go('+(_p1Page-1)+')" style="border-radius:6px;padding:6px 10px;min-width:auto;'+((_p1Page===0)?'opacity:.4':'')+'" '+((_p1Page===0)?'disabled':'')+'>‹</button>';

  var pStart=Math.max(0,_p1Page-3),pEnd=Math.min(pages,pStart+7);
  if(pEnd-pStart<7)pStart=Math.max(0,pEnd-7);
  for(var p=pStart;p<pEnd;p++){
    pgHtml+='<button class="btn btn-sm" style="'+(p===_p1Page?'background:var(--purple);color:#fff;border-radius:6px;min-width:34px;height:32px;display:flex;align-items:center;justify-content:center':'background:var(--card);color:var(--t2);border:1px solid var(--border);border-radius:6px;min-width:34px;height:32px;display:flex;align-items:center;justify-content:center')+'" onclick="p1Go('+p+')">'+(p+1)+'</button>';
  }
  pgHtml+='<button class="btn btn-ghost btn-sm" onclick="p1Go('+(_p1Page+1)+')" style="border-radius:6px;padding:6px 10px;min-width:auto;'+((_p1Page>=pages-1)?'opacity:.4':'')+'" '+((_p1Page>=pages-1)?'disabled':'')+'>›</button>';
  pgHtml+='<button class="btn btn-ghost btn-sm" onclick="p1Go('+(pages-1)+')" style="border-radius:6px;padding:6px 10px;min-width:auto;'+((_p1Page>=pages-1)?'opacity:.4':'')+'" '+((_p1Page>=pages-1)?'disabled':'')+'>»</button>';
  pgHtml+='</div>';

  // Page size selector
  pgHtml+='<div style="display:flex;gap:4px;align-items:center;margin-left:12px"><span style="color:var(--t3);font-size:11px">'+t('perPage')+'</span>';
  [20,50,100].forEach(function(sz){
    pgHtml+='<button class="btn btn-sm" style="'+(getP1PageSize()===sz?'background:var(--purple);color:#fff;border-radius:6px;min-width:32px;height:28px':'background:var(--card);color:var(--t2);border:1px solid var(--border);border-radius:6px;min-width:32px;height:28px')+'" onclick="el(\'f1-ps\').value='+sz+';_p1Page=0;renderP1Page()">'+sz+'</button>'
  });
  pgHtml+='</div>';

  // Keyboard hint
  pgHtml+='<div style="flex-basis:100%;text-align:center;font-size:10px;color:var(--t4);margin-top:4px">'+t('navigateHint')+'</div>';

  pgEl.innerHTML=pgHtml;
  closeDetail();
}
function p1Go(pg){_p1Page=pg;renderP1Page()}
function filterZone(z){goPage(2,document.querySelectorAll('.ntab')[2]);setTimeout(function(){el('f1-zn').value=z;renderP1()},100)}

var _openDetailIdx=-1;
var _detailKeyHandler=null;
function closeDetail(){
  var old=document.querySelector('.detail-row');
  if(old)old.parentNode.removeChild(old);
  _openDetailIdx=-1;
  if(_detailKeyHandler){document.removeEventListener('keydown',_detailKeyHandler);_detailKeyHandler=null;}
}
function showDetail(idx){
  // Toggle: same row clicked again → close
  if(_openDetailIdx===idx){closeDetail();return}
  closeDetail();
  var r=G.logs[idx];if(!r)return;
  _openDetailIdx=idx;

  var sim=searchSimilar(r.Branch,r.Zone,r.Category,r.IssueDetail,r);

  // Section 1: Issue Context
  var ctxHtml='<div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:16px">📋</span><div style="font-size:13px;font-weight:700;color:var(--t0);text-transform:uppercase;letter-spacing:0.5px">'+t('issueContext')+'</div></div>'
    +'<div style="margin-bottom:10px"><div style="font-size:16px;font-weight:700;line-height:1.5;color:var(--t0)">'+esc(typeof autoTr==='function'?autoTr(r.IssueDetail):r.IssueDetail)+'</div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;font-size:12px"><div><span style="color:var(--t3);display:block;margin-bottom:4px">'+t('branch')+'</span>'+brBadge(r.Branch)+'</div>'
    +'<div><span style="color:var(--t3);display:block;margin-bottom:4px">'+t('zone')+'</span><span class="zp" style="background:var(--card);color:var(--t1);padding:4px 8px;border-radius:6px;display:inline-block">'+esc(r.Zone)+'</span></div>'
    +'<div><span style="color:var(--t3);display:block;margin-bottom:4px">'+t('category')+'</span>'+catFull(r.Category)+'</div>'
    +'<div><span style="color:var(--t3);display:block;margin-bottom:4px">'+t('date')+'</span><span style="background:var(--card);color:var(--t2);padding:4px 8px;border-radius:6px;display:inline-block;font-size:11px">'+r.Date+'</span></div></div>'
    +'</div>';

  // Section 2: Resolution
  var resHtml='<div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:16px">✓</span><div style="font-size:13px;font-weight:700;color:var(--t0);text-transform:uppercase;letter-spacing:0.5px">'+t('resolution')+'</div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">'
    +'<div style="padding:12px;background:var(--card);border-radius:10px;border:1px solid var(--border)"><div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">👤 '+t('solvedBy')+'</div><div style="font-size:13px;font-weight:600;color:var(--t0)">'+esc(r.SolvedBy)+'</div></div>'
    +'<div style="padding:12px;background:var(--card);border-radius:10px;border:1px solid var(--border)"><div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">⚡ '+t('action')+'</div><div style="font-size:13px;font-weight:600;color:var(--t0)">'+esc(typeof autoTr==='function'?autoTr(r.ActionTaken):r.ActionTaken)+'</div></div>'
    +'<div style="padding:12px;background:var(--card);border-radius:10px;border:1px solid var(--border)"><div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">⏱ '+t('duration')+'</div><div style="font-size:13px;font-weight:600;color:var(--t0)">'+esc(typeof autoTr==='function'?autoTr(r.TimeTaken):r.TimeTaken)+'</div></div>'
    +'</div>'
    +(r.HQ?'<div style="margin-top:12px;padding:10px;background:rgba(83,74,183,0.1);border-radius:8px;border-left:3px solid var(--purple)"><span style="color:var(--purple);font-weight:600;font-size:11px">🏢 '+t('hqLabel')+':</span> <span style="color:var(--t1)">'+esc(typeof autoTr==='function'?autoTr(r.HQ):r.HQ)+'</span></div>':'')
    +'</div>';

  // Section 3: Similar Cases — 100-Point Scoring System
  var simHtml='<div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:16px">📊</span><div style="font-size:13px;font-weight:700;color:var(--t0);text-transform:uppercase;letter-spacing:0.5px">'+t('similarCasesCount')+' ('+sim.length+')</div></div>'
    +'<div style="font-size:10px;color:var(--t4);margin-bottom:12px;padding-left:24px">'+(_lang==='ko'?'장비 40 · 카테고리 25 · 증상 15 · Zone 10 · 장소 10 = 100점 만점 (75점 이상 표시)':'Equip 40 · Category 25 · Symptom 15 · Zone 10 · Place 10 = 100pt max (≥75pt shown)')+'</div>';
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
    simHtml+='<div style="color:var(--t3);font-size:12px;padding:16px;text-align:center;background:rgba(0,0,0,0.02);border-radius:8px">'+(_lang==='ko'?'80점 이상 일치하는 유사사례가 없습니다':t('noSimilarCases'))+'</div>';
  }
  simHtml+='</div>';

  // Section 4: AI Analysis
  var aiHtml='<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:16px">🤖</span><div style="font-size:13px;font-weight:700;color:var(--t0);text-transform:uppercase;letter-spacing:0.5px">'+t('aiAnalysis')+'</div>'
    +(r.Difficulty>=4?'<span style="background:rgba(255,193,7,0.15);color:#d97706;font-size:9px;font-weight:700;padding:3px 8px;border-radius:6px">⚠ DIFFICULTY '+r.Difficulty+'</span>':'')
    +'</div>'
    +'<div style="padding:16px;background:linear-gradient(135deg,rgba(83,74,183,0.08),rgba(123,58,237,0.05));border:1px solid rgba(83,74,183,0.2);border-radius:10px;margin-bottom:12px">'
    +'<div id="ai-result" style="font-size:12px;color:var(--t1);margin-bottom:10px">'
    +(r.Difficulty>=4
      ?'<strong style="color:var(--t0)">'+t('highDiffDetected')+'</strong> '+t('highDiffSub')
      :'<strong style="color:var(--t0)">'+t('aiReadyLabel')+'</strong> '+t('aiReadySub'))
    +'</div>'
    +'<button class="btn btn-sm" style="background:var(--purple);color:#fff;font-size:11px;border-radius:8px;padding:8px 16px;font-weight:600;width:100%" onclick="requestAI('+idx+')">'+t('requestAI')+'</button>'
    +'</div></div>';

  var html='<div class="detail-panel" style="animation:slideInDetail 0.3s ease-out"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div style="font-size:18px;letter-spacing:-0.02em;font-weight:800;color:var(--t0)"></div><button class="btn btn-ghost" style="width:32px;height:32px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;color:var(--t2);font-size:16px;transition:all 0.2s;background:transparent;border:1px solid transparent;cursor:pointer" onmouseover="this.style.background=\'var(--card)\';this.style.borderColor=\'var(--border)\'" onmouseout="this.style.background=\'transparent\';this.style.borderColor=\'transparent\'" onclick="closeDetail()">×</button></div>'
    +ctxHtml+resHtml+simHtml+aiHtml
    +'</div>';

  // Find the clicked row in the table and insert detail row right after it
  var rows=el('p1-tbl').querySelectorAll('tr');
  var clickedRow=null;
  rows.forEach(function(tr){if(tr.getAttribute('data-idx')===String(idx))clickedRow=tr});
  if(!clickedRow)return;

  var detailTr=document.createElement('tr');
  detailTr.className='detail-row';
  var td=document.createElement('td');
  td.colSpan=10;
  td.style.padding='0';
  td.style.textAlign='left';
  td.innerHTML=html;
  detailTr.appendChild(td);
  clickedRow.parentNode.insertBefore(detailTr,clickedRow.nextSibling);
  detailTr.scrollIntoView({behavior:'smooth',block:'nearest'});

  // Add keyboard navigation for pagination (removeEventListener-safe)
  if(_detailKeyHandler){document.removeEventListener('keydown',_detailKeyHandler);}
  _detailKeyHandler=function(e){
    if(e.key==='Escape'){closeDetail();return;}
    if(e.key==='ArrowLeft'&&_p1Page>0){p1Go(_p1Page-1)}
    else if(e.key==='ArrowRight'&&_p1Page<Math.ceil(_p1Data.length/getP1PageSize())-1){p1Go(_p1Page+1)}
  };
  document.addEventListener('keydown',_detailKeyHandler);
}

