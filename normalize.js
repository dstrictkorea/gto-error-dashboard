'use strict';

const { ALL_BRANCHES } = require('./config');

// ══════════════════════════════════════════════
//  데이터 정규화
// ══════════════════════════════════════════════

// Preserved technical acronyms (case-preserving set)
const ACRONYMS = new Set([
  'PC','PCS','LED','HDMI','USB','TV','UPS','PDU','IP','DNS','DHCP','LAN','WAN','VLAN',
  'NAS','NDI','BMS','DMX','SFP','RGB','DVI','SDI','VGA','AV','AC','DC','OS','API',
  'URL','ID','UI','UX','PDF','CSV','JSON','HQ','VM','VPN','SSH','FTP','AI','ML',
  'IR','RF','PIR','LCD','OLED','4K','8K','2D','3D','HD','SD','UHD','QR','GPS'
]);

// Canonical label: fixes "TEabar" → "Teabar", "SOftware" → "Software",
// "GARDEN" → "Garden", preserves acronyms (PC, LED, HDMI).
// Never mangles well-formed labels ("Garden" stays "Garden").
function canonLabel(s) {
  if (s === null || s === undefined) return '';
  let v = String(s).trim().replace(/\s+/g, ' ');
  if (!v) return '';
  // Split on space, hyphen, slash, dot — preserve separators
  return v.split(/([\s\-\/\.])/).map(tok => {
    if (/^[\s\-\/\.]$/.test(tok)) return tok;
    if (!tok) return tok;
    // Pure digits or digit+letter codes like "4K", "001", "T-001" → keep
    if (/^\d+$/.test(tok)) return tok;
    if (/^\d+[A-Za-z]$/.test(tok)) return tok.toUpperCase();
    // Acronym preservation (ASCII-only check)
    const up = tok.toUpperCase();
    if (/^[A-Z]+$/.test(up) && ACRONYMS.has(up)) return up;
    // All-caps or malformed-case (GARDEN, TEabar, SOftware, GArden) → Title-case
    // Trigger: contains upper AND not already clean Title/lower
    const isAllUpper = /^[A-Z][A-Z0-9]*$/.test(tok);
    const hasMidUpper = /[a-z][A-Z]/.test(tok); // "teABar" pattern
    const isWeirdCase = /^[A-Z]{2,}[a-z]/.test(tok); // "TEabar", "SOftware"
    if (isAllUpper || hasMidUpper || isWeirdCase) {
      // Preserve unicode (Korean etc.) — only lowercase ASCII letters
      const lowered = tok.replace(/[A-Z]/g, c => c.toLowerCase());
      return lowered.charAt(0).toUpperCase() + lowered.slice(1);
    }
    return tok;
  }).join('');
}

function excelDate(v) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v).trim();
  if (!s) return '';
  if (s.includes('-')) return s;
  const n = Number(s);
  if (!isNaN(n) && n > 40000 && n < 100000) {
    try { return new Date(Math.round((n - 25569) * 864e5)).toISOString().split('T')[0]; }
    catch (_) { return ''; }
  }
  return s;
}

function fg(o,...keys) {
  const norm=s=>(s||'').toLowerCase().replace(/[\s_\-()/]/g,'');
  for (const k of keys) {
    if (o[k]!==undefined&&o[k]!==null&&o[k]!=='') return o[k];
    const m=Object.keys(o).find(ok=>norm(ok)===norm(k));
    if (m&&o[m]!==undefined&&o[m]!==null&&o[m]!=='') return o[m];
  }
  return '';
}

function normLog(r, branch) {
  if (!r || typeof r !== 'object') return { Branch: branch || '', Zone: '', Date: '', Time: '', SolvedBy: '', TimeTaken: '', ActionType: '', Category: '', IssueDetail: '', ActionTaken: '', Difficulty: 1, HQ: '' };
  const safeBranch = (typeof branch === 'string' && ALL_BRANCHES.includes(branch)) ? branch : 'AMGN';
  const rawDiff = parseInt(fg(r,'Difficulty','Diff','Issue Difficulty','IssueDifficulty','Level','Priority'), 10);
  const difficulty = (!isNaN(rawDiff) && rawDiff >= 1 && rawDiff <= 5) ? rawDiff : (isNaN(rawDiff) ? 1 : Math.min(5, Math.max(1, rawDiff)));
  return {
    Branch: safeBranch,
    Zone: String(fg(r,'Zone','zone','Area') || '').trim(),
    Date: excelDate(fg(r,'Date','date','Incident Date','Report Date')),
    Time: String(fg(r,'Time','time','Incident Time') || '').trim(),
    SolvedBy: String(fg(r,'SolvedBy','Solved By','Staff','Technician','Operator') || '').trim(),
    TimeTaken: String(fg(r,'TimeTaken','Time Taken','Duration') || '').trim(),
    ActionType: String(fg(r,'ActionType','Action Type','Method') || '').trim(),
    Category: String(fg(r,'Category','category','Issue Category') || '').trim(),
    IssueDetail: String(fg(r,'IssueDetail','Issue Detail','Issue','Problem','Description','Error') || '').trim(),
    ActionTaken: String(fg(r,'ActionTaken','Action Taken','Solution','Fix') || '').trim(),
    Difficulty: difficulty,
    // Severity — used by v2 content pipeline isCritical() classifier.
    // Empty string when not present so hasSeverityField() returns false cleanly.
    Severity: String(fg(r,'Severity','severity','SeverityLevel','Critical Level','Urgency') || '').trim(),
    HQ: String(fg(r,'HQ','HQ Comment','HQ Note','Tony Comment') || '').trim()
  };
}

function normAsset(r) {
  if (!r || typeof r !== 'object') return { Branch: '', Zone: '', Name: '', Model: '', Maker: '', Spec: '', Status: 'Active' };
  return {
    Branch: String(fg(r,'Branch','branch','Site') || '').trim(),
    Zone: String(fg(r,'Zone','zone','Area') || '').trim(),
    Name: String(fg(r,'Name','name','Asset Name','Equipment','Device') || '').trim(),
    Model: String(fg(r,'Model','model','Model No') || '').trim(),
    Maker: String(fg(r,'Maker','maker','Manufacturer','Brand') || '').trim(),
    Spec: String(fg(r,'Spec','spec','Specification','Specs') || '').trim(),
    Status: String(fg(r,'Status','status','State') || 'Active').trim()
  };
}

function normHist(r) {
  if (!r || typeof r !== 'object') return { date: '', zone: '', cat: '', detail: '', action: '', hq: '', hqEng: '' };
  return {
    date: excelDate(fg(r,'Date','date','Incident Date','Report Date')),
    zone: String(fg(r,'Zone','zone','Area') || '').trim(),
    cat: String(fg(r,'Issue Category','IssueCategory','Category','category','Type') || '').trim(),
    detail: String(fg(r,'Issue Details','IssueDetails','IssueDetail','Issue Detail','Issue','Description','Problem') || '').trim(),
    action: String(fg(r,'Action Taken','ActionTaken','Action','Solution','Fix') || '').trim(),
    hq: String(fg(r,'HQ Coment','HQ Coment ENG','HQ Comment','HQ','Tony Comment') || '').trim(),
    hqEng: String(fg(r,'HQ Coment ENG','HQ Comment ENG') || '').trim()
  };
}

module.exports = { excelDate, fg, normLog, normAsset, normHist, canonLabel };
