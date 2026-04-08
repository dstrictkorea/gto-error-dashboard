'use strict';

// Branch table sort state
var _brSortKey='Date', _brSortAsc=false;
function brSort(key){
  if(_brSortKey===key){ _brSortAsc=!_brSortAsc; }
  else { _brSortKey=key; _brSortAsc=true; }
  _brPage=0;
  renderBranchContent();
}
function applyBrSort(d){
  var key=_brSortKey, asc=_brSortAsc;
  return d.slice().sort(function(a,b){
    var va=a[key]||'', vb=b[key]||'';
    if(key==='Difficulty') return asc?(va-vb):(vb-va);
    if(key==='Date'){var da=new Date(va),db=new Date(vb);return asc?(da-db):(db-da);}
    va=String(va).toLowerCase(); vb=String(vb).toLowerCase();
    if(va<vb) return asc?-1:1;
    if(va>vb) return asc?1:-1;
    return 0;
  });
}

function renderBranchPage(){
  var isKorea=typeof _region!=='undefined'&&_region==='korea';
  var B=[{id:'ALL',col:'#1e293b',city:t('allBranchesLabel'),emoji:'🌐'}];
  if(isKorea){
    B.push({id:'AMGN',col:'#0891b2',city:_lang==='ko'?'강릉':'Gangneung',emoji:'🏔'});
    B.push({id:'AMYS',col:'#059669',city:_lang==='ko'?'여수':'Yeosu',emoji:'🌊'});
    B.push({id:'AMBS',col:'#2563eb',city:_lang==='ko'?'부산':'Busan',emoji:'⚓'});
    B.push({id:'AMJJ',col:'#7c3aed',city:_lang==='ko'?'제주':'Jeju',emoji:'🍊'});
  } else {
    B.push({id:'AMNY',col:'#185FA5',city:t('newYork'),emoji:'🗽'});
    B.push({id:'AMLV',col:'#993C1D',city:t('lasVegas'),emoji:'🎰'});
    B.push({id:'AMDB',col:'#534AB7',city:t('dubai'),emoji:'🏜️'});
  }
  el('branch-sel').innerHTML='<div class="branch-seg-container">'+B.map(function(b){
    return'<button class="branch-seg-btn'+(b.id===curBranch?' branch-seg-active':'')+'" onclick="selBranch(\''+b.id+'\',this)" style="'+(b.id===curBranch?'background:'+b.col+';color:#fff':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+'">'
      +'<span style="font-size:16px;margin-right:4px">'+b.emoji+'</span>'
      +'<span style="font-weight:600;letter-spacing:0.01em">'+b.id+'</span>'
      +'<span style="font-size:12px;margin-left:6px;opacity:0.7">'+b.city+'</span>'
      +'</button>';
  }).join('')+'</div>';
  renderBranchContent();
}
function selBranch(b,btn){
  curBranch=b;_brPage=0;
  var allBtns=document.querySelectorAll('.branch-seg-btn');
  var branchColors={ALL:'#1e293b',AMGN:'#0891b2',AMYS:'#059669',AMBS:'#2563eb',AMJJ:'#7c3aed',AMNY:'#185FA5',AMLV:'#993C1D',AMDB:'#534AB7'};
  allBtns.forEach(function(x){
    x.classList.remove('branch-seg-active');
    x.style.background='var(--card)';
    x.style.color='var(--t1)';
    x.style.border='1px solid var(--border)';
  });
  btn.classList.add('branch-seg-active');
  btn.style.background=branchColors[b];
  btn.style.color='#fff';
  btn.style.border='none';
  renderBranchContent();
}
function renderBranchContent(){
  var b=curBranch;
  var regionBrs=typeof getRegionBranches==='function'?getRegionBranches():['AMNY','AMLV','AMDB'];
  var allD=b==='ALL'?G.logs.filter(function(r){return regionBrs.indexOf(r.Branch)>=0}).sort(function(a,c){return new Date(c.Date)-new Date(a.Date)}):getByBranch(b);
  var byVal=el('b-yr').value,bmVal=el('b-mn').value;
  var d=allD.filter(function(r){
    if(byVal){var p=(r.Date||'').split('-');if(p[0]!==byVal)return false;if(bmVal&&String(parseInt(p[1]))!==bmVal)return false}
    else if(bmVal){var p2=(r.Date||'').split('-');if(String(parseInt(p2[1]))!==bmVal)return false}
    return true;
  });
  if(b==='ALL') return renderAllBranches(d);
  var col=(BR_COLORS_MAP&&BR_COLORS_MAP[b])||{AMGN:'#0891b2',AMYS:'#059669',AMBS:'#2563eb',AMJJ:'#7c3aed',AMNY:'#185FA5',AMLV:'#993C1D',AMDB:'#534AB7'}[b]||'#534AB7';
  var city=(BR_NAMES&&BR_NAMES[b])||b;
  var sw=d.filter(function(r){return r.Category==='Software'}).length,hw=d.filter(function(r){return r.Category==='Hardware'}).length;
  var crit=d.filter(function(r){return r.Difficulty>=4}).length;
  var zc={};d.forEach(function(r){zc[r.Zone]=(zc[r.Zone]||0)+1});
  var mz=Math.max.apply(null,Object.values(zc).concat([1]));
  var now=new Date();
  var timeStr=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
  el('branch-content').innerHTML=
    '<div style="background:linear-gradient(135deg,'+col+'11 0%,'+col+'08 100%);border:1px solid'+col+'22;border-radius:12px;padding:20px;margin-bottom:24px;position:relative;overflow:hidden">'
    +'<div style="position:absolute;top:0;right:0;width:200px;height:100%;background:repeating-linear-gradient(45deg,transparent,transparent 10px,'+col+'05 10px,'+col+'05 20px);opacity:0.3"></div>'
    +'<div style="position:relative;z-index:1">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:12px">'
    +'<div style="display:flex;align-items:baseline;gap:12px">'
    +'<div style="font-size:32px;font-weight:900;color:'+col+';font-family:var(--f-display);letter-spacing:-0.03em">'+b+'</div>'
    +'<div style="font-size:14px;color:var(--t2);font-weight:500">'+city+'</div>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--green)11;border-radius:6px;border:1px solid var(--green)33">'
    +'<div style="width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite"></div>'
    +'<span style="font-size:12px;color:var(--green);font-weight:600">'+t('online')+'</span>'
    +'</div>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--t3)">'+t('lastUpdate')+' '+timeStr+'</div>'
    +'</div></div>'
    +'<div class="g4">'
    +'<div class="card mc kpi-animated" style="--mc-c:'+col+'"><div class="mc-lbl">'+t('totalErrors')+'</div><div class="mc-val" style="font-family:var(--f-display)">'+d.length+'</div></div>'
    +'<div class="card mc kpi-animated" style="--mc-c:#ca8a04"><div class="mc-lbl">'+t('swErrors')+'</div><div class="mc-val" style="font-family:var(--f-display)">'+sw+'</div></div>'
    +'<div class="card mc kpi-animated" style="--mc-c:#2563eb"><div class="mc-lbl">'+t('hwErrors')+'</div><div class="mc-val" style="font-family:var(--f-display)">'+hw+'</div></div>'
    +'<div class="card mc kpi-animated" style="--mc-c:#dc2626"><div class="mc-lbl">'+t('criticalErrors')+'</div><div class="mc-val" style="font-family:var(--f-display)">'+crit+'</div></div>'
    +'</div>'
    +'<div class="card" style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><span style="font-size:18px">📊</span><div class="ctitle" style="margin:0">'+t('zoneBreakdown')+'</div></div>'
    +'<div class="bchart">'+Object.entries(zc).sort(function(a,c){return c[1]-a[1]}).map(function(e,i){
      var sharePct=d.length?Math.round(e[1]/d.length*100):0;
      var barWidth=Math.round(e[1]/mz*100);
      var opacities=['1','0.85','0.7','0.6','0.5'];var opacity=opacities[Math.min(i,4)];
      return'<div class="brow">'
        +'<div class="blbl">'+esc(e[0])+'</div>'
        +'<div class="btrk" style="flex:1">'
        +'<div class="bfil" style="width:'+barWidth+'%;background:'+col+';opacity:'+opacity+'" title="'+esc(e[0])+': '+e[1]+' / '+d.length+' Total">'
        +'<span style="display:inline-block;margin-right:8px;font-weight:600;font-size:12px">'+sharePct+'%</span>'
        +'</div></div>'
        +'<div class="bnum">'+e[1]+'</div></div>';
    }).join('')+'</div></div>'
    +brBuildTable(d, [
      {label:t('zone'),key:'Zone'},{label:t('date'),key:'Date'},{label:t('solvedBy'),key:'SolvedBy'},
      {label:t('category'),key:'Category'},{label:t('thIssueDetail'),key:'IssueDetail'},{label:t('duration'),key:'TimeTaken'},{label:t('thDiff'),key:'Difficulty'}
    ], function(r){
      return'<tr><td><span class="zp">'+esc(r.Zone)+'</span></td><td style="color:var(--t3)">'+r.Date+'</td><td style="font-weight:500">'+esc(r.SolvedBy)+'</td><td>'+catFull(r.Category)+'</td><td class="td-left" title="'+esc(r.IssueDetail)+'" style="color:var(--t2)">'+esc(typeof autoTr==='function'?autoTr(r.IssueDetail):r.IssueDetail)+'</td><td>'+tmBadge(typeof autoTr==='function'?autoTr(r.TimeTaken):r.TimeTaken)+'</td><td>'+stars(r.Difficulty)+'</td></tr>';
    }, b+' — '+t('allErrors'));
}

function renderAllBranches(d){
  var brs=typeof getRegionBranches==='function'?getRegionBranches():['AMNY','AMLV','AMDB'];
  var cols=BR_COLORS_MAP||{AMGN:'#0891b2',AMYS:'#059669',AMBS:'#2563eb',AMJJ:'#7c3aed',AMNY:'#185FA5',AMLV:'#993C1D',AMDB:'#534AB7'};
  var cities=BR_NAMES||{};
  var sw=d.filter(function(r){return r.Category==='Software'}).length,hw=d.filter(function(r){return r.Category==='Hardware'}).length;
  var crit=d.filter(function(r){return r.Difficulty>=4}).length;
  var brCards=brs.map(function(b,i){
    var bd=d.filter(function(r){return r.Branch===b}),cnt=bd.length;
    return'<div class="card mc kpi-animated" style="--mc-c:'+cols[b]+';background:linear-gradient(135deg,'+cols[b]+'11 0%,'+cols[b]+'05 100%);animation:slideIn 0.5s ease-out '+(i*0.1)+'s both">'
      +'<div class="mc-lbl">'+b+' <span style="font-weight:400;color:var(--t4)">('+cities[b]+')</span></div>'
      +'<div class="mc-val" style="font-family:var(--f-display);color:'+cols[b]+'">'+cnt+'</div>'
      +'</div>';
  }).join('');
  var zc={};d.forEach(function(r){zc[r.Zone]=(zc[r.Zone]||0)+1});
  var mz=Math.max.apply(null,Object.values(zc).concat([1]));
  var zoneChart=Object.entries(zc).sort(function(a,c){return c[1]-a[1]}).slice(0,15).map(function(e,i){
    var zBr={};d.filter(function(r){return r.Zone===e[0]}).forEach(function(r){zBr[r.Branch]=(zBr[r.Branch]||0)+1});
    var mainBr=Object.entries(zBr).sort(function(a,b){return b[1]-a[1]})[0];
    var barCol=mainBr?cols[mainBr[0]]:'#534AB7';
    var sharePct=d.length?Math.round(e[1]/d.length*100):0;
    var barWidth=Math.round(e[1]/mz*100);
    return'<div class="brow">'
      +'<div class="blbl">'+esc(e[0])+'</div>'
      +'<div class="btrk" style="flex:1">'
      +'<div class="bfil" style="width:'+barWidth+'%;background:'+barCol+'" title="'+esc(e[0])+': '+e[1]+' / '+d.length+' Total">'
      +'<span style="display:inline-block;margin-right:6px;font-weight:600;font-size:12px">'+sharePct+'%</span>'
      +'</div></div>'
      +'<div class="bnum">'+e[1]+'</div></div>';
  }).join('');

  el('branch-content').innerHTML=
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:24px">'
    +'<div style="font-size:28px;font-weight:900;color:var(--t0);font-family:var(--f-display);letter-spacing:-0.03em">🌐 ALL</div>'
    +'<div style="font-size:14px;color:var(--t2);font-weight:500">'+t('globalOverview')+'</div>'
    +'</div>'
    +'<div class="g4">'
    +'<div class="card mc kpi-animated" style="--mc-c:var(--t0)"><div class="mc-lbl">'+t('totalErrors')+'</div><div class="mc-val" style="font-family:var(--f-display)">'+d.length+'</div></div>'
    +'<div class="card mc kpi-animated" style="--mc-c:#ca8a04"><div class="mc-lbl">'+t('swErrors')+'</div><div class="mc-val" style="font-family:var(--f-display)">'+sw+'</div></div>'
    +'<div class="card mc kpi-animated" style="--mc-c:#2563eb"><div class="mc-lbl">'+t('hwErrors')+'</div><div class="mc-val" style="font-family:var(--f-display)">'+hw+'</div></div>'
    +'<div class="card mc kpi-animated" style="--mc-c:#dc2626"><div class="mc-lbl">'+t('criticalErrors')+'</div><div class="mc-val" style="font-family:var(--f-display)">'+crit+'</div></div>'
    +'</div>'
    +'<div class="g3" style="margin-bottom:16px">'+brCards+'</div>'
    +'<div class="card" style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><span style="font-size:18px">📍</span><div class="ctitle" style="margin:0">'+t('zoneBreakdown')+'</div></div><div class="bchart">'+zoneChart+'</div></div>'
    +brBuildTable(d, [
      {label:t('branch'),key:'Branch'},{label:t('zone'),key:'Zone'},{label:t('date'),key:'Date'},{label:t('solvedBy'),key:'SolvedBy'},
      {label:t('category'),key:'Category'},{label:t('thIssueDetail'),key:'IssueDetail'},{label:t('duration'),key:'TimeTaken'},{label:t('thDiff'),key:'Difficulty'}
    ], function(r){
      var bCols={AMNY:'#2563eb',AMLV:'#ea580c',AMDB:'#7c3aed',HQ:'#534AB7'};
      return'<tr><td style="font-weight:600;color:'+(bCols[r.Branch]||'var(--t1)')+'">'+r.Branch+'</td><td><span class="zp">'+esc(r.Zone)+'</span></td><td style="color:var(--t3)">'+r.Date+'</td><td style="font-weight:500">'+esc(r.SolvedBy)+'</td><td>'+catFull(r.Category)+'</td><td class="td-left" title="'+esc(r.IssueDetail)+'" style="color:var(--t2)">'+esc(typeof autoTr==='function'?autoTr(r.IssueDetail):r.IssueDetail)+'</td><td>'+tmBadge(typeof autoTr==='function'?autoTr(r.TimeTaken):r.TimeTaken)+'</td><td>'+stars(r.Difficulty)+'</td></tr>';
    }, t('allBranchErrors'));
}

var _brPage=0, _brPageSize=20;
function brBuildTable(d, cols, colFn, title) {
  // Apply sort
  var sorted=applyBrSort(d);
  var total=sorted.length, pages=Math.ceil(total/_brPageSize)||1;
  if(_brPage>=pages)_brPage=pages-1;if(_brPage<0)_brPage=0;
  var start=_brPage*_brPageSize, end=Math.min(start+_brPageSize,total);
  var pageData=sorted.slice(start,end);

  // Sortable headers
  var hdr=cols.map(function(c){
    var isActive=_brSortKey===c.key;
    var arrow=isActive?(_brSortAsc?'↑':'↓'):'↕';
    var arrowColor=isActive?'color:var(--purple);opacity:1':'color:inherit;opacity:0.3';
    return'<th class="sortable" style="font-weight:600;color:var(--t3);border-bottom:2px solid var(--border);padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;cursor:pointer;user-select:none;white-space:nowrap;transition:all 0.12s" onclick="brSort(\''+c.key+'\')" onmouseover="this.style.color=\'var(--t1)\'" onmouseout="this.style.color=\'var(--t3)\'">'
      +c.label+' <span style="font-size:10px;margin-left:2px;'+arrowColor+'">'+arrow+'</span></th>';
  }).join('');

  var body=pageData.map(function(r,i){
    var row=colFn(r);
    return row.replace('<tr>','<tr style="'+(i%2===0?'background:var(--card)':'background:var(--bg)')+'">')
  }).join('');

  // Pagination
  var pgHtml='<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:16px 0;flex-wrap:wrap;border-top:1px solid var(--border);margin-top:12px">';
  pgHtml+='<button class="btn btn-ghost btn-sm" style="border-radius:6px;padding:6px 8px;font-size:14px;width:32px;height:32px;display:flex;align-items:center;justify-content:center" onclick="_brPage=0;renderBranchContent()" '+(_brPage===0?'disabled style="opacity:.3"':'')+'>«</button>';
  pgHtml+='<button class="btn btn-ghost btn-sm" style="border-radius:6px;padding:6px 8px;font-size:14px;width:32px;height:32px;display:flex;align-items:center;justify-content:center" onclick="_brPage--;renderBranchContent()" '+(_brPage===0?'disabled style="opacity:.3"':'')+'>‹</button>';
  pgHtml+='<span style="font-size:12px;color:var(--t2);margin:0 8px">'+(start+1)+'-'+end+(_lang==='ko'?' / '+total+t('errors'):' of '+total)+'</span>';
  var pStart=Math.max(0,_brPage-2),pEnd=Math.min(pages,pStart+5);if(pEnd-pStart<5)pStart=Math.max(0,pEnd-5);
  for(var p=pStart;p<pEnd;p++){
    pgHtml+='<button class="btn btn-sm" style="'+(p===_brPage?'background:var(--purple);color:#fff;border:none':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+';min-width:32px;height:32px;border-radius:6px;font-weight:600;font-size:12px" onclick="_brPage='+p+';renderBranchContent()">'+(p+1)+'</button>';
  }
  pgHtml+='<button class="btn btn-ghost btn-sm" style="border-radius:6px;padding:6px 8px;font-size:14px;width:32px;height:32px;display:flex;align-items:center;justify-content:center" onclick="_brPage++;renderBranchContent()" '+(_brPage>=pages-1?'disabled style="opacity:.3"':'')+'>›</button>';
  pgHtml+='<button class="btn btn-ghost btn-sm" style="border-radius:6px;padding:6px 8px;font-size:14px;width:32px;height:32px;display:flex;align-items:center;justify-content:center" onclick="_brPage=Math.ceil('+total+'/'+_brPageSize+')-1;renderBranchContent()" '+(_brPage>=pages-1?'disabled style="opacity:.3"':'')+'>»</button>';
  // Per page selector
  pgHtml+='<div style="display:flex;gap:4px;align-items:center;margin-left:12px"><span style="color:var(--t3);font-size:11px">'+t('perPage')+'</span>';
  [20,50,100].forEach(function(sz){
    pgHtml+='<button class="btn btn-sm" style="'+(_brPageSize===sz?'background:var(--purple);color:#fff;border-radius:6px;min-width:32px;height:28px':'background:var(--card);color:var(--t2);border:1px solid var(--border);border-radius:6px;min-width:32px;height:28px')+'" onclick="_brPageSize='+sz+';_brPage=0;renderBranchContent()">'+sz+'</button>';
  });
  pgHtml+='</div>';
  pgHtml+='</div>';

  return '<div class="tbl-wrap"><div class="tbl-hdr"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:16px">📋</span><div class="tbl-title">'+title+'</div><span class="rcnt" style="background:var(--purple)20;color:var(--purple);padding:4px 10px;border-radius:100px;font-weight:600;font-size:12px">'+total+' '+t('records')+'</span></div></div><div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%"><thead><tr>'+hdr+'</tr></thead><tbody>'+body+'</tbody></table></div></div>'+pgHtml;
}
