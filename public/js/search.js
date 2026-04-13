'use strict';
var debouncedHist = debounce(renderHist, 300);

function toggleAcc(btn){
  var body=btn.nextElementSibling;
  var open=body.style.display!=='none';
  var arrow=btn.querySelector('.acc-arrow');
  var duration=open?300:400; // Match CSS animation duration
  if(open){
    body.style.maxHeight=body.scrollHeight+'px';
    body.style.overflow='hidden';
    requestAnimationFrame(function(){
      body.style.transition='max-height '+duration+'ms ease-out';
      body.style.maxHeight='0px';
    });
    setTimeout(function(){body.style.display='none'},duration);
    arrow.style.transform='rotate(0deg)';
  }else{
    body.style.display='block';
    body.style.maxHeight='0px';
    body.style.overflow='hidden';
    requestAnimationFrame(function(){
      body.style.transition='max-height '+duration+'ms ease-in';
      body.style.maxHeight=body.scrollHeight+'px';
    });
    setTimeout(function(){body.style.maxHeight='none';body.style.overflow='visible'},duration);
    arrow.style.transform='rotate(90deg)';
  }
}
function renderHist(){
  if(!G||!Array.isArray(G.history)) return;
  if(!el('hist-s-main')||!el('hist-zn')||!el('hist-ca')) return;
  var s=(el('hist-s-main').value||'').toLowerCase();
  var fzn=el('hist-zn').value,fca=el('hist-ca').value;
  var hasFilters=fzn||fca||s;
  var d=(G.history||[]).filter(function(h){
    if(fzn&&(h.zone||'').toLowerCase()!==fzn.toLowerCase())return false;
    if(fca&&(h.cat||'').toLowerCase()!==fca.toLowerCase())return false;
    if(s&&![h.detail,h.zone,h.action,h.cat,h.hq,h.hqEng].some(function(v){return v&&v.toLowerCase().indexOf(s)>=0}))return false;
    return true;
  });
  el('hist-cnt').textContent=d.length+' '+t('errors');
  var zones=unique(d.map(function(h){return h.zone})).sort();
  if(!zones.length){
    el('hist-list').innerHTML='<div class="empty-state">'
      +'<div class="empty-state-icon">☁️</div>'
      +'<div class="empty-state-title">'+t('noFound')+'</div>'
      +'<div class="empty-state-subtitle">'+t('tryDiffSearch')+'</div>'
      +'</div>';
    return;
  }
  var html='';
  zones.forEach(function(z,zi){
    var zl=z.toLowerCase();
    var zItems=d.filter(function(h){return(h.zone||'').toLowerCase()===zl});
    var cats=unique(zItems.map(function(h){return h.cat||'Other'})).sort();
    // Zone accordion header with gradient
    html+='<div style="margin-bottom:12px;animation:slideIn 0.4s ease-out '+(zi*0.05)+'s both">';
    html+='<button onclick="toggleAcc(this)" style="width:100%;display:flex;align-items:center;gap:10px;padding:12px 16px;background:linear-gradient(135deg,var(--blue-bg),var(--blue-bg)88);border:1px solid var(--blue)33;border-radius:8px;cursor:pointer;text-align:left;transition:all 0.2s;hover-border-color:var(--blue)">';
    html+='<span class="acc-arrow" style="font-size:14px;color:var(--blue);width:16px;height:16px;display:flex;align-items:center;justify-content:center;transition:transform 0.3s ease">▶</span>';
    html+='<span style="font-size:14px;font-weight:700;color:var(--blue);letter-spacing:0.02em;flex:1">'+esc(z)+'</span>';
    html+='<span style="font-size:12px;color:#fff;font-weight:600;background:var(--blue);padding:4px 12px;border-radius:100px">'+zItems.length+'</span>';
    html+='</button>';
    html+='<div style="display:none;padding:8px 0 8px 0;margin-top:6px">';
    // Category sub-groups with tree style
    cats.forEach(function(cat,ci){
      var cItems=zItems.filter(function(h){return(h.cat||'Other')===cat});
      var catIcons={Software:'🖥',Hardware:'⚙️',Network:'🌐',Other:'📋'};
      var catIcon=catIcons[cat]||'📋';
      html+='<div style="margin-bottom:8px;margin-left:8px">';
      html+='<button onclick="toggleAcc(this)" style="width:calc(100% - 16px);display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--sub);border:1px solid var(--border);border-left:3px solid var(--purple);border-radius:6px;cursor:pointer;text-align:left;transition:all 0.2s">';
      html+='<span style="font-size:14px">'+catIcon+'</span>';
      html+='<span class="acc-arrow" style="font-size:12px;color:var(--purple);width:14px;display:flex;align-items:center;justify-content:center;transition:transform 0.3s ease">▶</span>';
      html+='<span style="font-size:13px;font-weight:600;color:var(--t1);flex:1">'+esc(cat)+'</span>';
      html+='<span style="font-size:11px;color:var(--t3);background:var(--purple)11;padding:2px 8px;border-radius:4px;font-weight:600">'+cItems.length+'</span>';
      html+='</button>';
      html+='<div style="display:none;padding:8px 0 8px 24px">';
      cItems.slice(0,30).forEach(function(h){
        var hqBlock='';
        if(h.hqEng) hqBlock+='<div style="font-size:11px;color:var(--purple);margin-top:8px;padding:8px;background:var(--purple)08;border-left:3px solid var(--purple);border-radius:4px;font-weight:600">'+t('hqLabel')+': '+esc(typeof autoTr==='function'?autoTr(h.hqEng):h.hqEng)+'</div>';
        if(h.hq&&h.hq!==h.hqEng) hqBlock+='<div style="font-size:10px;color:var(--t3);margin-top:4px">'+(_lang==='ko'?'':'KR: ')+esc(h.hq)+'</div>';
        var dateBlock=h.date?'<span style="position:absolute;top:8px;right:12px;font-size:10px;color:var(--t3);background:var(--sub);padding:3px 8px;border-radius:4px;font-weight:600">'+esc(h.date)+'</span>':'';
        html+='<div class="sp-sol-card" style="position:relative;margin-bottom:12px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:6px;transition:all 0.2s;cursor:pointer">'
          +dateBlock
          +'<div class="sp-sol-issue" style="font-weight:600;color:var(--t0);margin-bottom:6px;padding-right:60px">'+esc(typeof autoTr==='function'?autoTr(h.detail):h.detail)+'</div>'
          +'<div class="sp-sol-action" style="margin-bottom:6px;display:flex;align-items:center;gap:6px"><span style="color:var(--green);font-weight:700;font-size:16px">→</span><span style="color:var(--green);font-weight:600;font-size:12px">'+esc(typeof autoTr==='function'?autoTr(h.action):h.action)+'</span><button style="margin-left:auto;background:var(--purple)11;color:var(--purple);border:1px solid var(--purple)33;border-radius:4px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:600;transition:all 0.2s" onclick="navigator.clipboard.writeText('+JSON.stringify(h.action).replace(/</g,'\\u003c').replace(/'/g,'\\u0027')+');toast(t(\'copied\'),\'success\')" title="Copy">📋</button></div>'
          +hqBlock+'</div>';
      });
      if(cItems.length>30) html+='<div style="font-size:11px;color:var(--t3);padding:8px 14px;font-style:italic;opacity:0.6">… +'+(cItems.length-30)+(_lang==='ko'?' 건 더':' more')+'</div>';
      html+='</div></div>';
    });
    html+='</div></div>';
  });
  el('hist-list').innerHTML=html;
}
