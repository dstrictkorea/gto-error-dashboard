'use strict';

// ══════════════════════════════════════════════
//  데이터 정규화
// ══════════════════════════════════════════════
function excelDate(v) {
  if (!v) return '';
  if (typeof v==='string' && v.includes('-')) return v;
  const n=Number(v);
  if (!isNaN(n)&&n>40000) return new Date(Math.round((n-25569)*864e5)).toISOString().split('T')[0];
  return String(v);
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

function normLog(r,branch) {
  return { Branch:branch, Zone:String(fg(r,'Zone','zone','Area')),
    Date:excelDate(fg(r,'Date','date','Incident Date','Report Date')),
    Time:String(fg(r,'Time','time','Incident Time')),
    SolvedBy:String(fg(r,'SolvedBy','Solved By','Staff','Technician','Operator')),
    TimeTaken:String(fg(r,'TimeTaken','Time Taken','Duration')),
    ActionType:String(fg(r,'ActionType','Action Type','Method')),
    Category:String(fg(r,'Category','category','Issue Category')),
    IssueDetail:String(fg(r,'IssueDetail','Issue Detail','Issue','Problem','Description','Error')),
    ActionTaken:String(fg(r,'ActionTaken','Action Taken','Solution','Fix')),
    Difficulty:Math.min(5,Math.max(1,parseInt(fg(r,'Difficulty','Diff','Issue Difficulty','IssueDifficulty','Level','Priority'),10)||1)),
    HQ:String(fg(r,'HQ','HQ Comment','HQ Note','Tony Comment')) };
}

function normAsset(r) {
  return { Branch:String(fg(r,'Branch','branch','Site')), Zone:String(fg(r,'Zone','zone','Area')),
    Name:String(fg(r,'Name','name','Asset Name','Equipment','Device')),
    Model:String(fg(r,'Model','model','Model No')), Maker:String(fg(r,'Maker','maker','Manufacturer','Brand')),
    Spec:String(fg(r,'Spec','spec','Specification','Specs')),
    Status:String(fg(r,'Status','status','State')||'Active') };
}

function normHist(r) {
  return { date:excelDate(fg(r,'Date','date','Incident Date','Report Date')),
    zone:String(fg(r,'Zone','zone','Area')),
    cat:String(fg(r,'Issue Category','IssueCategory','Category','category','Type')),
    detail:String(fg(r,'Issue Details','IssueDetails','IssueDetail','Issue Detail','Issue','Description','Problem')),
    action:String(fg(r,'Action Taken','ActionTaken','Action','Solution','Fix')),
    hq:String(fg(r,'HQ Coment','HQ Coment ENG','HQ Comment','HQ','Tony Comment')),
    hqEng:String(fg(r,'HQ Coment ENG','HQ Comment ENG')) };
}

module.exports = { excelDate, fg, normLog, normAsset, normHist };
