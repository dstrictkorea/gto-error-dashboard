'use strict';

// ═══ FRONTEND VISUAL LAYER — renders structured bullet data from backend ═══
// Backend (ai.js) handles: data accuracy, prompt engineering, format control, best-of-N selection
// Frontend (report.js) handles: visual rendering, colors, icons, UX layout

// Format AI bullet text → styled HTML list with visual polish and interactivity
function fmtAI(text, accentColor) {
  if (!text) return '';
  accentColor = accentColor || 'var(--t1)';
  var lines = esc(text).split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  var hasBullets = lines.some(function(l){ return l.charAt(0) === '\u2022' || l.charAt(0) === '-'; });
  var id='ai-section-'+Math.random().toString(36).substr(2,9);
  var toggleHtml='';
  if (hasBullets) {
    var itemsHtml = lines.map(function(l){
      var t = l.replace(/^[\u2022\-]\s*/, '');
      if (!t) return '';
      t = highlightTech(t);
      return '<li style="margin-bottom:8px;line-height:1.7;padding:8px 12px;position:relative;font-size:13px;color:var(--t1);background:var(--bg);border-radius:4px;transition:all 0.2s;cursor:default">'
        + '<span style="position:absolute;left:4px;top:8px;color:' + accentColor + ';font-weight:900;font-size:16px">'+(accentColor.includes('dc2626')?'●':'●')+'</span>'
        + '<span style="display:block;padding-left:12px">'+t+'</span></li>';
    }).join('');
    toggleHtml='<button style="background:var(--bg);color:var(--t2);border:1px solid var(--border);padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;margin-left:auto;transition:all 0.2s" onclick="navigator.clipboard.writeText(document.getElementById(\''+id+'\').innerText);toast(t(\'copied\'),\'success\')" title="Copy section">📋</button>';
    return '<div id="'+id+'" style="display:flex;flex-direction:column"><ul style="margin:0;padding-left:0;list-style:none">' + itemsHtml + '</ul></div>';
  }
  return '<div id="'+id+'" style="font-size:13px;line-height:1.7;color:var(--t1);padding:8px 12px;background:var(--bg);border-radius:4px">' + lines.join('<br>') + '</div>';
}

// Highlight technical terms in AI output for quick scanning
function highlightTech(text) {
  // IP addresses
  text = text.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, '<code style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600;font-family:monospace">$1</code>');
  // Error codes: ERR-XXX, 0x...
  text = text.replace(/\b(ERR-[A-Z0-9]+|0x[0-9A-Fa-f]+)\b/g, '<code style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600;font-family:monospace">$1</code>');
  // File paths: /path/to/file or C:\path\file
  text = text.replace(/\b([A-Za-z]:\\[^\s]*|\/[^\s]*\.[a-z]{2,4})\b/g, '<code style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600;font-family:monospace">$1</code>');
  // Time durations: 15min, 2hr, 30sec
  text = text.replace(/\b(\d+\s*(?:min|hr|sec|hour|minute|second))\b/gi, '<code style="background:#f3f4f6;color:#374151;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600;font-family:monospace">$1</code>');
  // Device codes: T-t-pc-006, pj-001, etc.
  text = text.replace(/\b([A-Z]-[a-z]-[a-z]+-\d{2,3})\b/g, '<code style="background:#eff6ff;color:#2563eb;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600;font-family:monospace">$1</code>');
  // Firmware versions: v1.2.3, firmware 4.5
  text = text.replace(/\b(v\d+[\.\d]*|firmware\s*[\d\.]+|F\/W\s*[\d\.]+)\b/gi, '<code style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600;font-family:monospace">$1</code>');
  // Model numbers
  text = text.replace(/\b([A-Z]{2,}[-\d]{4,}|Model\s*#?\s*[A-Z0-9\-]+)\b/g, '<code style="background:#f5e6ff;color:#7c3aed;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600;font-family:monospace">$1</code>');
  return text;
}

// ═══ AI COMMENT — Difficulty ≥ 4 ═══
async function requestAI(idx){
  var r=G.logs[idx];if(!r)return;
  var box=el('ai-result');
  if(!box) return; // overlay not open
  // Skeleton shimmer loading state
  box.innerHTML='<div style="animation:fadeIn 0.4s ease-out">'
    +'<div style="background:linear-gradient(90deg,var(--border) 25%,var(--card) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 2s infinite;height:20px;border-radius:6px;margin-bottom:12px;width:40%"></div>'
    +'<div style="background:linear-gradient(90deg,var(--border) 25%,var(--card) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 2s infinite;height:60px;border-radius:6px;margin-bottom:12px"></div>'
    +'<div style="background:linear-gradient(90deg,var(--border) 25%,var(--card) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 2s infinite;height:60px;border-radius:6px"></div>'
    +'<div style="font-size:11px;color:var(--t3);margin-top:12px;text-align:center">'+t('aiAnalyzing')+'</div>'
    +'</div>';
  try{
    var resp=await fetch('/api/ai-comment',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        incident:r,
        assets:matchAssets(r.Branch,r.Zone),
        history:searchSimilar(r.Branch,r.Zone,r.Category,r.IssueDetail),
        lang:_lang
      })
    });
    if(!box.isConnected) return; // overlay was closed while fetching
    var d=await resp.json();
    if(!box.isConnected) return; // overlay was closed while parsing
    if(!d.enabled){
      var guide=d.guide||{};
      box.innerHTML='<div style="padding:16px;background:#fef3c7;border-radius:8px;border:1px solid #fde68a;animation:slideIn 0.4s ease-out">'
        +'<div style="font-weight:700;color:#92400e;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span style="font-size:18px">⚙️</span>'+t('aiNotConfigured')+'</div>'
        +'<div style="color:#78350f;font-size:12px;line-height:1.9;margin-top:10px">'
        +'<div style="margin-bottom:8px"><b style="color:#b45309">1. Gemini:</b> <a href="'+(guide.gemini||'#')+'" target="_blank" style="color:#2563eb;text-decoration:underline">aistudio.google.com/apikey</a></div>'
        +'<div style="margin-bottom:8px"><b style="color:#b45309">2. Groq:</b> <a href="'+(guide.groq||'#')+'" target="_blank" style="color:#2563eb;text-decoration:underline">console.groq.com</a></div>'
        +'<div><b style="color:#b45309">3. Mistral:</b> <a href="'+(guide.mistral||'#')+'" target="_blank" style="color:#2563eb;text-decoration:underline">console.mistral.ai</a></div>'
        +'</div></div>';
      return;
    }

    var R=d.result;
    if(!R){
      box.innerHTML='<div style="padding:16px;background:var(--bg);border-radius:8px;border:1px solid var(--border);text-align:center;color:var(--t3)">'+t('aiNoResponse')+'</div>';
      return;
    }

    // ── Visual card config: icon, label, color, background ──
    var sections = [
      {key:'root',    icon:'🔴', label:t('aiRootCause'),    color:'#dc2626', bg:'#fef2f2', border:'#dc2626'},
      {key:'action',  icon:'🟢', label:t('aiAction'),       color:'#16a34a', bg:'#f0fdf4', border:'#16a34a'},
      {key:'prevent', icon:'🔵', label:t('aiPrevention'),   color:'#2563eb', bg:'#eff6ff', border:'#2563eb'},
      {key:'equipment',icon:'🟡',label:t('aiEquipment'),    color:'#ca8a04', bg:'#fefce8', border:'#ca8a04'},
      {key:'pattern', icon:'🟣', label:t('aiPattern'),      color:'var(--purple)', bg:'#faf5ff', border:'var(--purple)'}
    ];

    var html='<div style="padding:16px;background:linear-gradient(135deg,#f8f7ff,#faf5ff);border-radius:10px;border:1.5px solid var(--purple);backdrop-filter:blur(10px);animation:slideIn 0.4s ease-out">';

    // Header with source info
    html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--purple)33">'
      +'<div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">🤖</span><span style="font-size:14px;font-weight:800;color:var(--purple)">'+t('aiAnalysisResult')+'</span></div>'
      +'<div style="font-size:11px;color:var(--t2);background:var(--card);padding:4px 12px;border-radius:12px;font-weight:600">'+d.aiCount+' '+t('aiModels')+' · '+t('aiBest')+': <span style="color:var(--purple);font-weight:700">'+esc(d.source)+'</span></div>'
      +'</div>';

    // Render section cards dynamically
    sections.forEach(function(sec,i){
      var val = R[sec.key];
      if(!val) return;
      html+='<div style="margin-bottom:10px;padding:12px 14px;background:'+sec.bg+';border-radius:8px;border-left:4px solid '+sec.border+';transition:all 0.2s;animation:slideIn 0.4s ease-out '+(i*0.08)+'s both" onmouseover="this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.1)\';" onmouseout="this.style.boxShadow=\'none\'">'
        +'<div style="font-size:11px;font-weight:700;color:'+sec.color+';margin-bottom:8px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:0.05em">'
        +'<span style="font-size:16px">'+sec.icon+'</span>'+sec.label+'</div>'
        +fmtAI(val, sec.color)
        +'</div>';
    });

    html+='<div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--purple)33">'
      +'<button style="flex:1;background:var(--purple);color:#fff;border:none;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s" onclick="requestAI('+idx+')">🔄 '+t('aiRegenerate')+'</button>'
      +'<button style="flex:1;background:var(--card);color:var(--t1);border:1px solid var(--border);padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s" onclick="navigator.clipboard.writeText(document.getElementById(\'ai-result\').innerText);toast(t(\'analysisCopied\'),\'success\')">📋 '+t('aiCopyAll')+'</button>'
      +'</div>';

    html+='</div>';
    box.innerHTML=html;
    toast(t('aiAnalysisComplete'),'success');
  }catch(e){
    if(!box.isConnected) return; // overlay was closed during fetch
    box.innerHTML='<div style="padding:16px;background:#fee2e2;border-radius:8px;border:1px solid #fecaca;animation:slideIn 0.4s ease-out">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:16px">❌</span><span style="color:#dc2626;font-weight:700">'+t('aiFailed')+'</span></div>'
      +'<div style="color:#991b1b;font-size:12px;margin-bottom:10px">'+esc(e.message)+'</div>'
      +'<button style="background:#dc2626;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600" onclick="requestAI('+idx+')">'+t('aiRetry')+'</button>'
      +'</div>';
    toast(t('aiAnalysisFailed'),'error');
  }
}
