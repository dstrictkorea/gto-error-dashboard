'use strict';

// ═══ ASSET AI SPEC SEARCH ═══
async function askAssetAI(logIdx,assetIdx){
  var r=G.logs[logIdx];if(!r)return;
  var ma=matchAssets(r.Branch,r.Zone);
  var a=ma[assetIdx];if(!a)return;
  var box=document.getElementById('asset-ai-result-'+logIdx);
  if(!box)return;
  box.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px">'
    +'<div style="width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:spin .8s linear infinite"></div>'
    +'<span style="font-size:11px;color:var(--t2)">AI searching specs for '+esc(a.Maker)+' '+esc(a.Model)+'...</span></div>';
  try{
    var resp=await fetch('/api/asset-ai',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({asset:a,incident:r})
    });
    var d=await resp.json();
    if(d.error)throw new Error(d.error);
    // Use fmtAI for consistent bullet rendering (visual layer)
    var html='<div style="padding:12px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;margin-top:6px">'
      +'<div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:8px;display:flex;align-items:center;gap:6px">'
      +'<span style="font-size:14px">\ud83d\udd0d</span>AI Equipment Analysis: '+esc(a.Maker)+' '+esc(a.Model)+'</div>';
    if(d.gemini) html+='<div style="margin-bottom:6px;padding:10px;background:#f0fdf4;border-radius:6px;border-left:3px solid #16a34a">'
      +'<div style="font-size:10px;font-weight:700;color:#16a34a;margin-bottom:4px;display:flex;align-items:center;gap:4px"><span>\ud83d\udfe2</span>Gemini</div>'
      +(typeof fmtAI==='function'?fmtAI(d.gemini,'#16a34a'):'<div style="white-space:pre-line;font-size:12px;color:var(--t1)">'+esc(d.gemini)+'</div>')
      +'</div>';
    if(d.groq) html+='<div style="padding:10px;background:#faf5ff;border-radius:6px;border-left:3px solid #7c3aed">'
      +'<div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:4px;display:flex;align-items:center;gap:4px"><span>\ud83d\udfe3</span>Groq (Llama)</div>'
      +(typeof fmtAI==='function'?fmtAI(d.groq,'#7c3aed'):'<div style="white-space:pre-line;font-size:12px;color:var(--t1)">'+esc(d.groq)+'</div>')
      +'</div>';
    if(!d.gemini&&!d.groq) html+='<div style="color:var(--t3);font-size:12px">No AI response — check API keys in .env</div>';
    html+='</div>';
    box.innerHTML=html;
  }catch(e){
    box.innerHTML='<div style="padding:6px;color:#dc2626;font-size:11px">\u274c '+esc(e.message)+'</div>';
  }
}

// ═══ REPORT TOGGLE STATE ═══
var _rptRegion = localStorage.getItem('region') || 'korea';
var _rptLang = 'en';
function setRptRegion(r){
  _rptRegion=r;
  document.querySelectorAll('#rpt-region-toggle .region-btn').forEach(function(b){
    b.classList.toggle('active',b.dataset.region===r);
  });
  _updateRptTags();
}
function setRptLang(l){
  _rptLang=l;
  document.querySelectorAll('#rpt-lang-toggle .region-btn').forEach(function(b){
    b.classList.toggle('active',b.dataset.lang===l);
  });
  _updateRptTags();
}
function _updateRptTags(){
  var flag=_rptRegion==='korea'?'🇰🇷 Korea':'🌍 Global';
  var langLabel=_rptLang==='ko'?'KOR':'ENG';
  var tag=flag+' · '+langLabel;
  var mt=document.getElementById('rpt-monthly-tag');if(mt)mt.textContent=tag;
  var at=document.getElementById('rpt-annual-tag');if(at)at.textContent=tag;
}

// ═══ PDF ANNUAL REPORT ═══
async function generateAnnualReport(action){
  var lang=_rptLang, region=_rptRegion;
  var y=parseInt(el('yearSel').value);
  if(isNaN(y))y=CY;
  var status=document.getElementById('annual-report-status');
  if(!status) return;
  status.style.display='block';
  // Accessibility: mark report status as live region
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  var loadLabel = lang==='ko' ? '연간 PDF 리포트 생성 중... SharePoint 데이터 수집 → 분석 → PDF 생성' : 'Generating Annual PDF report... Collecting data → Analysis → PDF generation';
  status.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px">'
    +'<div style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin .8s linear infinite" aria-hidden="true"></div>'
    +'<span style="font-size:12px;color:var(--t2)">'+loadLabel+'</span></div>';

  try{
    var resp=await fetch('/api/annual-report',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({year:y,action:action,lang:lang,region:region})
    });
    var d=await resp.json();
    if(d.error) throw new Error(d.error);

    var byteChars=atob(d.pdfBase64);
    var byteArr=new Uint8Array(byteChars.length);
    for(var i=0;i<byteChars.length;i++) byteArr[i]=byteChars.charCodeAt(i);
    var blob=new Blob([byteArr],{type:'application/pdf'});
    var url=URL.createObjectURL(blob);

    if(action==='download'){
      var a=document.createElement('a');a.href=url;a.download=d.fileName;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(function(){URL.revokeObjectURL(url)},3000);
      status.innerHTML='<div style="padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">'
        +'<span style="font-size:12px;color:#059669">'+esc(d.fileName)+' Download complete ('+(d.size/1024).toFixed(0)+'KB)</span></div>';
      toast('Annual PDF download complete','success');
    }else if(action==='preview'){
      window.open(url,'_blank');
      setTimeout(function(){URL.revokeObjectURL(url)},120000);
      status.innerHTML='<div style="padding:8px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe">'
        +'<span style="font-size:12px;color:#2563eb">'+esc(d.fileName)+' Preview tab opened</span></div>';
      toast('Annual PDF preview','success');
    }else if(action==='email'){
      var a=document.createElement('a');a.href=url;a.download=d.fileName;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      var yrShort=String(y).slice(2);
      var subject, body;
      if(lang==='ko'){
        subject=encodeURIComponent('[DSKR] 연간 에러 리포트_'+y);
        body=encodeURIComponent('안녕하세요,\n\nDSKR 기술운영팀입니다.\n첨부파일로 '+y+'년 연간 에러 리포트를 전달드립니다.\n\n감사합니다.\n\nDSKR Technical Operation Team');
      } else {
        subject=encodeURIComponent('[DSKR] Annual Error Report Summary_'+y);
        body=encodeURIComponent('Dear all,\n\nThis is DSKR Tech Operation Team.\nPlease find the attached Annual Error Report Summary for '+y+'.\n\nThank you.\n\nBest,\nDSKR Technical Operation Team');
      }
      window.open('mailto:?subject='+subject+'&body='+body,'_self');
      setTimeout(function(){URL.revokeObjectURL(url)},3000);
      status.innerHTML='<div style="padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">'
        +'<span style="font-size:12px;color:#059669">PDF downloaded + Email client opened</span><br>'
        +'<span style="font-size:11px;color:var(--t3)">Attach the downloaded PDF to your email</span></div>';
      toast('Annual PDF downloaded + Email client opened','success');
    }
  }catch(e){
    status.innerHTML='<div style="padding:8px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca">'
      +'<span style="font-size:12px;color:#dc2626">Annual report failed: '+esc(e.message)+'</span></div>';
    toast('Annual report generation failed','error');
  }
}

// ═══ PDF MONTHLY REPORT ═══
async function generateReport(action){
  var lang=_rptLang, region=_rptRegion;
  var m=parseInt(el('monthSel').value),y=parseInt(el('yearSel').value);
  if(isNaN(m))m=CM;if(isNaN(y))y=CY;
  var monNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var status=document.getElementById('report-status');
  if(!status) return;
  status.style.display='block';
  // Accessibility: mark report status as live region
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  var loadLabel = lang==='ko' ? 'PDF 리포트 생성 중... SharePoint 데이터 수집 → 분석 → PDF 생성' : 'Generating PDF report... Collecting SharePoint data → Analysis → PDF generation';
  var accentColor = 'var(--purple)';
  status.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px">'
    +'<div style="width:16px;height:16px;border:2px solid var(--border);border-top-color:'+accentColor+';border-radius:50%;animation:spin .8s linear infinite" aria-hidden="true"></div>'
    +'<span style="font-size:12px;color:var(--t2)">'+loadLabel+'</span></div>';

  try{
    var resp=await fetch('/api/report',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({month:m,year:y,action:action,lang:lang,region:region})
    });
    var d=await resp.json();
    if(d.error) throw new Error(d.error);

    // Base64 → Blob
    var byteChars=atob(d.pdfBase64);
    var byteArr=new Uint8Array(byteChars.length);
    for(var i=0;i<byteChars.length;i++) byteArr[i]=byteChars.charCodeAt(i);
    var blob=new Blob([byteArr],{type:'application/pdf'});
    var url=URL.createObjectURL(blob);

    if(action==='download'){
      var a=document.createElement('a');
      a.href=url;a.download=d.fileName;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(function(){URL.revokeObjectURL(url)},3000);
      status.innerHTML='<div style="padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">'
        +'<span style="font-size:12px;color:#059669">'+esc(d.fileName)+' Download complete ('+(d.size/1024).toFixed(0)+'KB)</span></div>';
      toast('PDF download complete','success');

    }else if(action==='preview'){
      window.open(url,'_blank');
      setTimeout(function(){URL.revokeObjectURL(url)},120000);
      status.innerHTML='<div style="padding:8px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe">'
        +'<span style="font-size:12px;color:#2563eb">'+esc(d.fileName)+' Preview tab opened</span></div>';
      toast('PDF preview','success');

    }else if(action==='email'){
      var a=document.createElement('a');
      a.href=url;a.download=d.fileName;
      document.body.appendChild(a);a.click();document.body.removeChild(a);

      var monShort=monNames[m].slice(0,3);
      var yrShort=String(y).slice(2);
      var subject, body;
      if(lang==='ko'){
        subject=encodeURIComponent('[DSKR] 월간 에러 리포트_'+monShort+'/'+yrShort);
        body=encodeURIComponent(
          '안녕하세요,\n\n'
          +'DSKR 기술운영팀입니다.\n'
          +'첨부파일로 '+monShort+'/'+yrShort+' 월간 에러 리포트를 전달드립니다.\n\n'
          +'감사합니다.\n\n'
          +'DSKR Technical Operation Team'
        );
      } else {
        subject=encodeURIComponent('[DSKR] Monthly Error Report Summary_'+monShort+'/'+yrShort);
        body=encodeURIComponent(
          'Dear all,\n\n'
          +'This is DSKR Tech Operation Team.\n'
          +'Please find the attached Monthly Error Report Summary for '+monShort+'/'+yrShort+'\n\n'
          +'Thank you.\n\n'
          +'Best,\n'
          +'DSKR Technical Operation Team'
        );
      }
      window.open('mailto:?subject='+subject+'&body='+body,'_self');
      setTimeout(function(){URL.revokeObjectURL(url)},3000);

      status.innerHTML='<div style="padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">'
        +'<span style="font-size:12px;color:#059669">PDF downloaded + Email client opened</span><br>'
        +'<span style="font-size:11px;color:var(--t3)">Attach the downloaded PDF to your email</span></div>';
      toast('PDF downloaded + Email client opened','success');
    }
  }catch(e){
    status.innerHTML='<div style="padding:8px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca">'
      +'<span style="font-size:12px;color:#dc2626">Report generation failed: '+esc(e.message)+'</span><br>'
      +'<span style="font-size:11px;color:var(--t3)">Check server console for details</span></div>';
    toast('Report generation failed','error');
  }
}
