'use strict';

const PDFDocument = require('pdfkit');
const path = require('path');
const { MONTHS_EN, BR_NAMES, BR_COLORS, KOREA_BRANCHES, GLOBAL_BRANCHES } = require('./config');

const FONT_DIR = path.join(__dirname, 'fonts');
const LOGO_WHITE = path.join(FONT_DIR, 'dstrict_CI_WHITE.png');
const LOGO_BLACK = path.join(FONT_DIR, 'dstrict_CI_BLACK.png');
const MAX_PDF_SIZE = 50 * 1024 * 1024;

function generateAnnualPDF(logs, year, lang, history, assets, region) {
  if (!Array.isArray(logs)) throw new Error('logs must be an array');
  year = Math.max(2000, Math.min(2100, parseInt(year, 10) || new Date().getFullYear()));
  lang = ['en','ko'].includes(lang) ? lang : 'en';
  history = Array.isArray(history) ? history : [];
  assets = Array.isArray(assets) ? assets : [];
  region = ['korea','global'].includes(region) ? region : 'global';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 0 }, bufferPages: true });
    const chunks = [];
    let totalSize = 0;
    doc.on('data', c => {
      totalSize += c.length;
      if (totalSize > MAX_PDF_SIZE) { doc.destroy(); reject(new Error('PDF exceeds size limit')); return; }
      chunks.push(c);
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Font registration ──
    try {
      doc.registerFont('UBlack', path.join(FONT_DIR, 'Uniform Black.otf'));
      doc.registerFont('UBold', path.join(FONT_DIR, 'Uniform Bold.otf'));
      doc.registerFont('UMedium', path.join(FONT_DIR, 'Uniform Medium.otf'));
      doc.registerFont('UReg', path.join(FONT_DIR, 'Uniform.otf'));
      doc.registerFont('ULight', path.join(FONT_DIR, 'Uniform Light.otf'));
    } catch(e) {
      doc.registerFont('UBlack', 'Helvetica-Bold');
      doc.registerFont('UBold', 'Helvetica-Bold');
      doc.registerFont('UMedium', 'Helvetica');
      doc.registerFont('UReg', 'Helvetica');
      doc.registerFont('ULight', 'Helvetica');
    }
    let hasKR = false;
    try {
      doc.registerFont('KRBold', path.join(FONT_DIR, 'NotoSansKR-Bold.otf'));
      doc.registerFont('KRMedium', path.join(FONT_DIR, 'NotoSansKR-Medium.otf'));
      doc.registerFont('KRLight', path.join(FONT_DIR, 'NotoSansKR-Light.otf'));
      doc.registerFont('KRBlack', path.join(FONT_DIR, 'NotoSansKR-Black.otf'));
      hasKR = true;
    } catch(e) { /* fallback */ }

    const PW = 515, ML = 40, MR = 555, BOT = 770;
    const isKo = lang === 'ko';
    const F = {
      black: (isKo && hasKR) ? 'KRBlack' : 'UBlack',
      bold:  (isKo && hasKR) ? 'KRBold'  : 'UBold',
      med:   (isKo && hasKR) ? 'KRMedium': 'UMedium',
      reg:   (isKo && hasKR) ? 'KRMedium': 'UReg',
      light: (isKo && hasKR) ? 'KRLight' : 'ULight',
    };

    // ── Colors ──
    const CP='#534AB7', CT='#1a1a18', CS='#73726c', COK='#3B6D11', CE='#A32D2D', CW='#854F0B', CL='#e8e6df';
    const CBG='#f6f5f0', CCARD='#ffffff';
    const CHIGHLIGHT = '#FDE68A';
    const catCols = ['#534AB7','#185FA5','#993C1D','#854F0B','#3B6D11','#A32D2D'];
    const diffCols = {1:'#a3a29c',2:'#185FA5',3:'#854F0B',4:'#993C1D',5:'#A32D2D'};

    // ── Labels ──
    const L = isKo ? {
      coverTitle: year + '년 연간 에러 리포트',
      coverSub: '글로벌 기술운영팀 연간 보고서',
      generated: '보고서 생성일',
      execSummary: '연간 요약 보고',
      branchPerf: '지점별 연간 성과',
      monthlyTrend: '월별 에러 트렌드',
      catDiff: '유형별 및 난이도 분석',
      topZones: '주요 영향 Zone (Top 10)',
      critIncidents: '주요 장애 심층 분석',
      yoy: '전년도(YoY) 대비 분석',
      equipmentLife: '장비 수명/교체 권고',
      staffPerf: '직원별 대응 통계',
      recommendations: '연간 종합 권고사항',
      total: '총 에러', critical: '위험 장애(4+)', avgDiff: '평균 난이도',
      avgRes: '평균 처리시간', incidents: '건',
      noData: '데이터 없음',
    } : {
      coverTitle: year + ' ANNUAL ERROR REPORT',
      coverSub: 'Global Technical Operations Team — Annual Report',
      generated: 'Generated',
      execSummary: 'Executive Summary',
      branchPerf: 'Branch Annual Performance',
      monthlyTrend: 'Monthly Error Trend',
      catDiff: 'Category & Difficulty Analysis',
      topZones: 'Top Affected Zones (Top 10)',
      critIncidents: 'Critical Incidents Deep Analysis',
      yoy: 'Year-over-Year (YoY) Comparison',
      equipmentLife: 'Equipment Lifecycle & Replacement Recommendations',
      staffPerf: 'Staff Performance Statistics',
      recommendations: 'Annual Recommendations & Action Plan',
      total: 'Total Errors', critical: 'Critical (4+)', avgDiff: 'Avg Difficulty',
      avgRes: 'Avg Resolution', incidents: 'errors',
      noData: 'No data available',
    };

    // ── Data Preparation ──
    const yd = logs.filter(r => { const p=(r.Date||'').split('-'); return parseInt(p[0])===year; });
    const prevYd = logs.filter(r => { const p=(r.Date||'').split('-'); return parseInt(p[0])===year-1; });
    const total = yd.length, prevTotal = prevYd.length;
    const critical = yd.filter(r => r.Difficulty >= 4);
    const prevCrit = prevYd.filter(r => r.Difficulty >= 4);

    // Per-month data
    const monthly = MONTHS_EN.map((_,mi) => yd.filter(r => { const p=(r.Date||'').split('-'); return parseInt(p[1])===mi+1; }));
    const prevMonthly = MONTHS_EN.map((_,mi) => prevYd.filter(r => { const p=(r.Date||'').split('-'); return parseInt(p[1])===mi+1; }));

    // Per-branch
    const branches = region === 'korea' ? KOREA_BRANCHES : GLOBAL_BRANCHES;
    const brCount = {}; yd.forEach(r => { brCount[r.Branch]=(brCount[r.Branch]||0)+1; });
    const prevBrCount = {}; prevYd.forEach(r => { prevBrCount[r.Branch]=(prevBrCount[r.Branch]||0)+1; });

    // Category
    const catCount = {}; yd.forEach(r => { catCount[r.Category||'Other']=(catCount[r.Category||'Other']||0)+1; });
    const prevCatCount = {}; prevYd.forEach(r => { prevCatCount[r.Category||'Other']=(prevCatCount[r.Category||'Other']||0)+1; });

    // Zone
    const zoneCount = {}; yd.forEach(r => { zoneCount[r.Zone]=(zoneCount[r.Zone]||0)+1; });

    // Difficulty
    const diffCount = {}; yd.forEach(r => { diffCount[r.Difficulty]=(diffCount[r.Difficulty]||0)+1; });
    const avgDiff = total ? (yd.reduce((s,r)=>s+(r.Difficulty||1),0)/total).toFixed(1) : '0.0';

    // Resolution time
    function parseMins(t) { if(!t)return 0; const h=t.match(/(\d+)\s*h/i),m=t.match(/(\d+)\s*m/i); let v=0; if(h)v+=parseInt(h[1])*60; if(m)v+=parseInt(m[1]); if(!v){const n=parseInt(t);if(n>0)v=n;} return v; }
    const withTime = yd.filter(r=>parseMins(r.TimeTaken)>0);
    const avgRes = withTime.length ? Math.round(withTime.reduce((s,r)=>s+parseMins(r.TimeTaken),0)/withTime.length) : 0;
    const maxRes = withTime.length ? Math.max(...withTime.map(r=>parseMins(r.TimeTaken))) : 0;

    // Staff performance
    const staffMap = {};
    yd.forEach(r => {
      const name = r.SolvedBy || 'Unknown';
      if(!staffMap[name]) staffMap[name] = {count:0, totalMins:0, diffs:[], minCount:0};
      staffMap[name].count++;
      staffMap[name].diffs.push(r.Difficulty||1);
      const mins = parseMins(r.TimeTaken);
      if(mins>0) { staffMap[name].totalMins += mins; staffMap[name].minCount++; }
    });

    // Equipment failure frequency
    const equipFail = {};
    yd.forEach(r => {
      const key = r.Zone + '|' + (r.Category||'');
      if(!equipFail[key]) equipFail[key] = {zone:r.Zone, cat:r.Category||'Other', count:0, issues:[]};
      equipFail[key].count++;
      if(equipFail[key].issues.length<3) equipFail[key].issues.push(r.IssueDetail);
    });
    // Match with assets
    const equipWithAssets = Object.values(equipFail).sort((a,b)=>b.count-a.count).slice(0,10).map(eq => {
      const matched = assets.filter(a => a.Branch && (a.Zone||'').toLowerCase().replace(/[\s_-]/g,'') === (eq.zone||'').toLowerCase().replace(/[\s_-]/g,''));
      return {...eq, assets: matched.slice(0,3)};
    });

    // ── Helpers ──
    const _contentPages = new Set();
    function _markPage() {
      const pgIdx = doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;
      if(doc.y > 80) _contentPages.add(pgIdx);
    }
    // ── d'strict watermark on every content page ──
    const _hasLogoBlack = require('fs').existsSync(LOGO_BLACK);
    function _drawPageBranding() {
      doc.save();
      try { if(_hasLogoBlack) doc.image(LOGO_BLACK, ML, 14, {width:60}); } catch(_) {}
      doc.fillColor(CS).fontSize(7).font(F.light).text("Error Report", ML+65, 18, {lineBreak:false});
      doc.moveTo(ML, 34).lineTo(MR, 34).strokeColor(CL).lineWidth(0.5).stroke();
      doc.save();
      doc.opacity(0.02);
      doc.translate(297, 421);
      doc.rotate(-35, {origin:[0,0]});
      try { if(_hasLogoBlack) doc.image(LOGO_BLACK, -160, -25, {width:320}); } catch(_) {}
      doc.restore();
      doc.restore();
      doc.y = 40;
    }
    function pc(need) { if(doc.y+(need||60)>BOT) { _markPage(); doc.addPage(); _drawPageBranding(); } }
    function trend(c,p) { if(!p&&!c)return '--'; if(!p)return '+'+c; const d=c-p,pct=Math.round(Math.abs(d)/p*100); return d>0?'+'+d+' (+'+pct+'%)':d<0?d+' (-'+pct+'%)':'0'; }

    function sect(n, title) {
      _markPage();
      if(doc.y > BOT - 200) { doc.addPage(); _drawPageBranding(); }
      else if(doc.y > 80) { doc.y = doc.y + 20; } else { doc.y = 40; }
      const y = doc.y;
      doc.save().rect(ML,y,PW,28).fill('#f0eff8').restore();
      doc.save().rect(ML,y,4,28).fill(CP).restore();
      doc.fillColor(CT).fontSize(isKo?14:15).font(F.bold).text(n+'. '+title.toUpperCase(), ML+14, y+6, {lineBreak:false});
      doc.y = y + 32;
      doc.moveTo(ML,doc.y-2).lineTo(MR,doc.y-2).strokeColor(CP).lineWidth(0.8).stroke();
      doc.moveDown(0.7);
      doc.x = ML;
      doc.font(F.reg).fillColor(CT);
    }

    function drawBar(x, y, maxW, pct, color, h) {
      h=h||12;
      doc.save().roundedRect(x,y,maxW,h,3).fill(CBG).restore();
      if(pct>0){ const w=Math.max(Math.round(maxW*pct/100),4); doc.save().roundedRect(x,y,w,h,3).fill(color).restore(); }
    }

    function _drawTblHeader(headers, widths, hH, pad) {
      let cx=ML; const hy=doc.y;
      doc.save().rect(ML,hy,PW,hH).fill(CT).restore();
      headers.forEach((h,i)=>{ doc.fillColor('#fff').fontSize(isKo?8.5:9).font(F.bold).text(h,cx+pad,hy+(isKo?8:7),{width:widths[i]-pad*2,align:'center',lineBreak:false}); cx+=widths[i]; });
      doc.moveTo(ML,hy+hH).lineTo(MR,hy+hH).strokeColor(CT).lineWidth(1.2).stroke();
      doc.y = hy+hH;
    }

    function tbl(headers, rows, widths, opts) {
      opts=opts||{}; const hH=isKo?26:24; const minRH=isKo?24:20; const pad=6; const cellPadY=isKo?7:6;
      pc(hH + minRH*Math.min(rows.length,2) + 10);
      _drawTblHeader(headers, widths, hH, pad);
      let visibleRowCount = 0;
      rows.forEach((row,ri)=>{
        const c0 = String(row[0]||'').toLowerCase();
        const isSummary = c0==='total' || c0.startsWith('avg') || c0.startsWith('total') || c0==='합계';
        const fw = isSummary ? F.bold : F.med;
        const fs = isKo?8:8.5;
        let maxCH = 0;
        row.forEach((cell,ci)=>{
          doc.font(fw).fontSize(fs);
          const ch = doc.heightOfString(String(cell||''), {width: widths[ci]-pad*2, lineBreak:true});
          if(ch > maxCH) maxCH = ch;
        });
        const rH = Math.max(minRH, Math.ceil(maxCH + cellPadY*2 + 4));
        // If row doesn't fit, start new page WITH header re-draw
        if(doc.y + rH + 2 > BOT) {
          _markPage(); doc.addPage();
          _drawTblHeader(headers, widths, hH, pad);
          visibleRowCount = 0;
        }
        let cx=ML; const ry=doc.y;
        const rowBg = isSummary ? CHIGHLIGHT : (visibleRowCount%2===0?CCARD:CBG);
        doc.save().rect(ML,ry,PW,rH).fill(rowBg).restore();
        if(isSummary) doc.moveTo(ML,ry).lineTo(MR,ry).strokeColor(CT).lineWidth(1.0).stroke();
        doc.moveTo(ML,ry+rH).lineTo(MR,ry+rH).strokeColor(CL).lineWidth(isSummary?0.8:0.3).stroke();
        const _lc = opts.leftCols||[];
        row.forEach((cell,ci)=>{
          const cc = opts.colColors&&opts.colColors[ci] ? opts.colColors[ci](cell) : CT;
          const cellStr = String(cell===0?'0':cell===''?'--':(cell||'--'));
          const cellAlign = _lc.includes(ci) ? 'left' : 'center';
          doc.fillColor(cc).fontSize(fs).font(fw).text(cellStr,cx+pad,ry+cellPadY,{width:widths[ci]-pad*2, height:rH, align:cellAlign, lineBreak:true});
          cx+=widths[ci];
        });
        doc.y=ry+rH;
        visibleRowCount++;
      });
      doc.x = ML;
    }

    // ══════════════════════════════════════════════
    //  COVER PAGE
    // ══════════════════════════════════════════════
    doc.save().rect(0,0,595,842).fill(CT).restore();
    // Purple accent bar
    doc.save().rect(0,0,595,6).fill(CP).restore();
    // d'strict logo area (official CI)
    try { doc.image(LOGO_WHITE, ML, 65, {width:130}); } catch(_) {
      doc.save().rect(ML,60,56,56).fill(CP).restore();
      doc.fillColor('#fff').fontSize(32).font(F.black).text("d'", ML+8, 70, {lineBreak:false});
    }
    doc.fillColor('#73726c').fontSize(8).font(F.light).text('Global Technical Operations', ML, 100, {lineBreak:false});

    // Year in large display
    doc.fillColor(CP).fontSize(120).font(F.black).text(String(year), ML, 200, {lineBreak:false});

    // Title
    doc.fillColor('#ffffff').fontSize(isKo?26:28).font(F.bold).text(isKo?'연간 에러 리포트':'ANNUAL ERROR REPORT', ML, 360, {width:PW});
    doc.fillColor('#a3a29c').fontSize(isKo?13:14).font(F.light).text(isKo?'글로벌 기술운영팀 연간 보고서':'Global Technical Operations Team — Annual Report', ML, isKo?400:395, {width:PW});

    // KPI boxes on cover
    const kpiY = 480;
    const kpiW = PW/4;
    const kpis = [
      {label: L.total, value: String(total), color: CP},
      {label: L.critical, value: String(critical.length), color: CE},
      {label: L.avgDiff, value: avgDiff, color: CW},
      {label: L.avgRes, value: avgRes+'min', color: '#185FA5'},
    ];
    kpis.forEach((k,i) => {
      const kx = ML + i*kpiW;
      doc.save().rect(kx+2, kpiY, kpiW-4, 60).fill('#2a2a28').restore();
      doc.save().rect(kx+2, kpiY, kpiW-4, 3).fill(k.color).restore();
      doc.fillColor('#a3a29c').fontSize(8).font(F.light).text(k.label, kx+10, kpiY+10, {width:kpiW-20, lineBreak:false});
      doc.fillColor('#fff').fontSize(22).font(F.bold).text(k.value, kx+10, kpiY+26, {width:kpiW-20, lineBreak:false});
    });

    // Generated date
    doc.fillColor('#73726c').fontSize(9).font(F.light).text(L.generated+': '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}), ML, 740);
    // Bottom accent
    doc.save().rect(0,836,595,6).fill(CP).restore();

    // ══════════════════════════════════════════════
    //  SECTION 1: EXECUTIVE SUMMARY
    // ══════════════════════════════════════════════
    doc.addPage();
    _drawPageBranding();
    sect(1, L.execSummary);

    // Key metrics summary text
    const maxBr = branches.reduce((mx,b) => (brCount[b]||0)>(brCount[mx]||0)?b:mx, branches[0]);
    const topZone = Object.entries(zoneCount).sort((a,b)=>b[1]-a[1])[0];
    const topCat = Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0];

    if(isKo) {
      doc.font(F.med).fontSize(9.5).fillColor(CT);
      doc.text(year+'년 글로벌 기술운영팀은 총 '+total+'건의 장애를 처리하였으며, 이 중 '+critical.length+'건이 위험 등급(Difficulty 4+)입니다.', ML, doc.y, {width:PW});
      doc.moveDown(0.3);
      doc.text('평균 난이도 '+avgDiff+', 평균 처리시간 '+avgRes+'분으로 집계되었습니다.', {width:PW});
      if(prevTotal) {
        const yoyD = total-prevTotal, yoyPct = Math.round(Math.abs(yoyD)/prevTotal*100);
        doc.moveDown(0.3);
        doc.text('전년도('+(year-1)+') 대비 '+(yoyD>0?yoyD+'건 증가(+'+yoyPct+'%)':yoyD<0?Math.abs(yoyD)+'건 감소(-'+yoyPct+'%)':'변동 없음')+'입니다.', {width:PW});
      }
    } else {
      doc.font(F.med).fontSize(9.5).fillColor(CT);
      doc.text('In '+year+', Global Technical Operations processed a total of '+total+' errors across all branches, with '+critical.length+' classified as critical (Difficulty 4+).', ML, doc.y, {width:PW});
      doc.moveDown(0.3);
      doc.text('Average difficulty: '+avgDiff+'/5 | Average resolution time: '+avgRes+' minutes.', {width:PW});
      if(prevTotal) {
        const yoyD = total-prevTotal, yoyPct = Math.round(Math.abs(yoyD)/prevTotal*100);
        doc.moveDown(0.3);
        doc.text('Year-over-year: '+(yoyD>0?'+'+yoyD+' (+'+yoyPct+'%) increase':yoyD<0?Math.abs(yoyD)+' (-'+yoyPct+'%) decrease':'No change')+' vs '+(year-1)+'.', {width:PW});
      }
    }
    doc.moveDown(0.5);

    // Key findings bullets
    doc.font(F.bold).fontSize(9).fillColor(CP).text(isKo?'핵심 발견사항':'KEY FINDINGS', {width:PW});
    doc.moveDown(0.3);
    doc.font(F.reg).fontSize(8.5).fillColor(CT);
    const findings = [];
    if(topZone) findings.push(isKo?
      '최다 발생 Zone: '+topZone[0]+' ('+topZone[1]+'건, '+(total?Math.round(topZone[1]/total*100):0)+'%)' :
      'Most affected zone: '+topZone[0]+' ('+topZone[1]+' errors, '+(total?Math.round(topZone[1]/total*100):0)+'%)');
    if(topCat) findings.push(isKo?
      '주요 유형: '+topCat[0]+' ('+topCat[1]+'건, '+(total?Math.round(topCat[1]/total*100):0)+'%)' :
      'Primary category: '+topCat[0]+' ('+topCat[1]+' errors, '+(total?Math.round(topCat[1]/total*100):0)+'%)');
    findings.push(isKo?
      '최다 발생 지점: '+(BR_NAMES[maxBr]||maxBr)+' ('+(brCount[maxBr]||0)+'건)' :
      'Highest volume branch: '+(BR_NAMES[maxBr]||maxBr)+' ('+(brCount[maxBr]||0)+' errors)');
    if(critical.length>0) findings.push(isKo?
      '위험 장애 '+critical.length+'건 — 즉각적인 경영진 확인 필요' :
      critical.length+' critical error(s) — management attention required');
    findings.forEach(f => { doc.text('  •  '+f, {width:PW, indent:4}); doc.moveDown(0.15); });

    // ══════════════════════════════════════════════
    //  SECTION 2: BRANCH ANNUAL PERFORMANCE
    // ══════════════════════════════════════════════
    sect(2, L.branchPerf);
    const brHeaders = isKo ?
      ['지점','당년','전년','YoY 증감','비율','위험(4+)','평균 난이도'] :
      ['Branch','This Year','Last Year','YoY Change','% Total','Crit(4+)','Avg Diff'];
    const brRows = branches.map(b => {
      const c=brCount[b]||0, p=prevBrCount[b]||0;
      const bCrit = yd.filter(r=>r.Branch===b&&r.Difficulty>=4).length;
      const bDiff = c ? (yd.filter(r=>r.Branch===b).reduce((s,r)=>s+(r.Difficulty||1),0)/c).toFixed(1) : '0.0';
      return [(BR_NAMES[b]||b)+' ('+b+')', c, p, trend(c,p), total?Math.round(c/total*100)+'%':'0%', bCrit, bDiff];
    });
    brRows.push([isKo?'합계':'TOTAL', total, prevTotal, trend(total,prevTotal), '100%', critical.length, avgDiff]);
    tbl(brHeaders, brRows, [110,65,65,85,60,65,65], {
      colColors: {3: v => { const s=String(v); return s.startsWith('+')?CE:s.startsWith('-')?COK:CT; }}
    });

    // ══════════════════════════════════════════════
    //  SECTION 3: MONTHLY TREND
    // ══════════════════════════════════════════════
    sect(3, L.monthlyTrend);
    doc.font(F.med).fontSize(8).fillColor(CS).text(isKo?'월별 에러 발생 추이 (현재 연도 vs 전년도)':'Monthly error count trend (current year vs previous year)', {width:PW});
    doc.moveDown(0.5);

    // Simple text-based bar chart for monthly trend
    const maxMonthly = Math.max(...monthly.map(m=>m.length), ...prevMonthly.map(m=>m.length), 1);
    const trendHeaders = isKo ?
      ['월', year+'년', (year-1)+'년', '증감', '추이'] :
      ['Month', String(year), String(year-1), 'Change', 'Trend'];
    const trendRows = MONTHS_EN.map((mn,mi) => {
      const c=monthly[mi].length, p=prevMonthly[mi].length;
      const d=c-p;
      const arrow = d>0?'+'+d : d<0?''+d : '--';
      return [mn.slice(0,3), c, p, trend(c,p), arrow];
    });
    trendRows.push([isKo?'합계':'TOTAL', total, prevTotal, trend(total,prevTotal), '--']);
    tbl(trendHeaders, trendRows, [55,70,70,115,205], {
      colColors: {4: v => { const n=parseInt(String(v)); return n>0?CE:n<0?COK:CS; }}
    });

    // Visual bar representation
    doc.moveDown(0.5);
    // 12 months × 20px each + title = ~260px. Ensure title stays with chart.
    pc(Math.min(260, BOT - 60));
    const barY = doc.y;
    const barMaxW = 200;
    doc.font(F.bold).fontSize(8).fillColor(CT).text(isKo?'월별 시각화':'Monthly Visualization', ML, barY);
    doc.moveDown(0.3);
    MONTHS_EN.forEach((mn,mi) => {
      if(doc.y > BOT - 22) { _markPage(); doc.addPage(); }
      const cy = doc.y;
      const c=monthly[mi].length, p=prevMonthly[mi].length;
      doc.font(F.med).fontSize(7.5).fillColor(CS).text(mn.slice(0,3), ML, cy, {width:30, lineBreak:false});
      // Current year bar
      const cPct = maxMonthly ? (c/maxMonthly*100) : 0;
      const pPct = maxMonthly ? (p/maxMonthly*100) : 0;
      drawBar(ML+35, cy, barMaxW, cPct, CP, 8);
      doc.font(F.med).fontSize(7).fillColor(CP).text(String(c), ML+35+barMaxW+4, cy, {lineBreak:false});
      // Previous year bar (lighter)
      drawBar(ML+35, cy+10, barMaxW, pPct, '#d1d0ca', 6);
      doc.font(F.med).fontSize(6).fillColor('#a3a29c').text(String(p), ML+35+barMaxW+4, cy+10, {lineBreak:false});
      doc.y = cy + 20;
    });

    // ══════════════════════════════════════════════
    //  SECTION 4: CATEGORY & DIFFICULTY
    // ══════════════════════════════════════════════
    sect(4, L.catDiff);

    // Category table
    doc.font(F.bold).fontSize(9).fillColor(CP).text(isKo?'유형별 분류':'CATEGORY BREAKDOWN', ML);
    doc.moveDown(0.3);
    const cats = ['Software','Hardware','Network','Other'];
    const catHeaders = isKo ? ['유형','당년','전년','증감','비율'] : ['Category','This Year','Last Year','Change','% Share'];
    const catRows = cats.filter(c=>catCount[c]||prevCatCount[c]).map(c => {
      const cur=catCount[c]||0, prev=prevCatCount[c]||0;
      return [c, cur, prev, trend(cur,prev), total?Math.round(cur/total*100)+'%':'0%'];
    });
    catRows.push([isKo?'합계':'TOTAL', total, prevTotal, trend(total,prevTotal), '100%']);
    tbl(catHeaders, catRows, [110,80,80,120,125], {
      colColors: {3: v => { const s=String(v); return s.startsWith('+')?CE:s.startsWith('-')?COK:CT; }}
    });

    doc.moveDown(0.8);
    // Ensure subtitle + at least first few rows + bar chart start together
    pc(220);

    // Difficulty distribution
    doc.font(F.bold).fontSize(9).fillColor(CP).text(isKo?'난이도 분포':'DIFFICULTY DISTRIBUTION', ML);
    doc.moveDown(0.3);
    const diffHeaders = isKo ? ['등급','건수','비율'] : ['Level','Count','% Share'];
    const diffPcts = [];
    const diffRows = [1,2,3,4,5].map(d => {
      const c=diffCount[d]||0;
      const pct = total?Math.round(c/total*100):0;
      diffPcts.push(pct);
      return ['Lv.'+d, c, pct+'%'];
    });
    diffRows.push([isKo?'합계':'TOTAL', total, '100%']);
    tbl(diffHeaders, diffRows, [170,170,175], {
      colColors: {0: v => diffCols[parseInt(String(v).replace('Lv.',''),10)]||CT}
    });

    // Visual bar chart for difficulty (drawn shapes, not unicode)
    doc.moveDown(0.5);
    pc(5 * 15 + 10); // ensure all 5 bars fit on same page
    const diffBarMaxW = 280;
    [1,2,3,4,5].forEach((d,di) => {
      const cy = doc.y;
      const pct = diffPcts[di]||0;
      const col = diffCols[d]||CS;
      doc.font(F.med).fontSize(7.5).fillColor(col).text('Lv.'+d, ML, cy, {width:32, lineBreak:false});
      drawBar(ML+36, cy, diffBarMaxW, pct, col, 10);
      doc.font(F.med).fontSize(7).fillColor(CT).text(pct+'%', ML+36+diffBarMaxW+6, cy+1, {lineBreak:false});
      doc.y = cy + 15;
    });

    // ══════════════════════════════════════════════
    //  SECTION 5: TOP ZONES
    // ══════════════════════════════════════════════
    sect(5, L.topZones);
    const topZones = Object.entries(zoneCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const zoneHeaders = isKo ? ['순위','Zone','건수','비율','주요 유형'] : ['#','Zone','Count','%','Primary Category'];
    const zonePcts = [];
    const zoneRows = topZones.map((z,i) => {
      const zoneCat = {};
      yd.filter(r=>r.Zone===z[0]).forEach(r=>{ zoneCat[r.Category||'Other']=(zoneCat[r.Category||'Other']||0)+1; });
      const topZoneCat = Object.entries(zoneCat).sort((a,b)=>b[1]-a[1])[0];
      const pct = total?Math.round(z[1]/total*100):0;
      zonePcts.push(pct);
      return [i+1, z[0], z[1], pct+'%', topZoneCat?topZoneCat[0]:'--'];
    });
    tbl(zoneHeaders, zoneRows, [35,175,60,55,190]);

    // Visual bar chart for top zones (drawn shapes)
    doc.moveDown(0.5);
    pc(topZones.length * 15 + 10);
    const zBarMaxW = 260;
    const maxZoneCount = topZones.length ? topZones[0][1] : 1;
    topZones.forEach((z,i) => {
      if(doc.y > BOT - 16) { _markPage(); doc.addPage(); }
      const cy = doc.y;
      const pct = maxZoneCount ? (z[1]/maxZoneCount*100) : 0;
      const col = catCols[i % catCols.length];
      doc.font(F.med).fontSize(7).fillColor(CS).text(z[0], ML, cy, {width:90, lineBreak:false});
      drawBar(ML+95, cy, zBarMaxW, pct, col, 10);
      doc.font(F.med).fontSize(7).fillColor(CT).text(String(z[1]), ML+95+zBarMaxW+6, cy+1, {lineBreak:false});
      doc.y = cy + 15;
    });

    // ══════════════════════════════════════════════
    //  SECTION 6: CRITICAL INCIDENTS
    // ══════════════════════════════════════════════
    sect(6, L.critIncidents);
    if(critical.length === 0) {
      doc.font(F.med).fontSize(9).fillColor(COK).text(isKo?'연간 위험 장애(Difficulty 4+) 발생 없음. 전 지점 안정적 운영.':'No critical incidents (Difficulty 4+) recorded. All branches operating stably.');
    } else {
      doc.font(F.med).fontSize(8.5).fillColor(CE).text(isKo?
        '총 '+critical.length+'건의 위험 장애가 발생했습니다. 아래 상세 내역을 확인하세요.' :
        critical.length+' critical incident(s) detected. Review details below.');
      doc.moveDown(0.5);
      const critHeaders = isKo ?
        ['일자','지점','Zone','유형','장애 내역','난이도','처리시간'] :
        ['Date','Branch','Zone','Category','Issue Detail','Diff','Duration'];
      const critRows = critical.slice(0,20).map(r => [
        r.Date, r.Branch, r.Zone, r.Category||'', (r.IssueDetail||'').slice(0,60), r.Difficulty, r.TimeTaken||'--'
      ]);
      tbl(critHeaders, critRows, [58,42,80,52,170,38,75], {leftCols:[4]});
    }

    // ══════════════════════════════════════════════
    //  SECTION 7: YoY COMPARISON
    // ══════════════════════════════════════════════
    sect(7, L.yoy);
    if(!prevTotal) {
      doc.font(F.med).fontSize(9).fillColor(CS).text(isKo?
        (year-1)+'년 데이터가 없어 전년 비교를 수행할 수 없습니다.' :
        'No '+(year-1)+' data available for year-over-year comparison.');
    } else {
      const yoyHeaders = isKo ?
        ['항목', (year-1)+'년', year+'년', '증감', '평가'] :
        ['Metric', String(year-1), String(year), 'Change', 'Assessment'];
      const yoyRows = [
        [isKo?'총 에러':'Total Errors', prevTotal, total, trend(total,prevTotal), total>prevTotal?(isKo?'악화':'WORSE'):(total<prevTotal?(isKo?'개선':'IMPROVED'):(isKo?'동일':'SAME'))],
        [isKo?'위험 장애(4+)':'Critical (4+)', prevCrit.length, critical.length, trend(critical.length,prevCrit.length), critical.length>prevCrit.length?(isKo?'악화':'WORSE'):(critical.length<prevCrit.length?(isKo?'개선':'IMPROVED'):(isKo?'동일':'SAME'))],
      ];
      // Per-branch YoY
      branches.forEach(b => {
        const c=brCount[b]||0, p=prevBrCount[b]||0;
        yoyRows.push([(BR_NAMES[b]||b), p, c, trend(c,p), c>p?(isKo?'악화':'WORSE'):(c<p?(isKo?'개선':'IMPROVED'):(isKo?'동일':'SAME'))]);
      });
      // Per-category YoY
      cats.filter(c=>catCount[c]||prevCatCount[c]).forEach(c => {
        const cur=catCount[c]||0, prev=prevCatCount[c]||0;
        yoyRows.push([c, prev, cur, trend(cur,prev), cur>prev?(isKo?'증가':'UP'):(cur<prev?(isKo?'감소':'DOWN'):(isKo?'동일':'SAME'))]);
      });
      tbl(yoyHeaders, yoyRows, [120,80,80,110,125], {
        colColors: {4: v => {
          const s=String(v).toLowerCase();
          return (s.includes('worse')||s.includes('악화')||s.includes('up')||s.includes('증가'))?CE:
                 (s.includes('improved')||s.includes('개선')||s.includes('down')||s.includes('감소'))?COK:CS;
        }}
      });
    }

    // ══════════════════════════════════════════════
    //  SECTION 8: EQUIPMENT LIFECYCLE
    // ══════════════════════════════════════════════
    sect(8, L.equipmentLife);
    if(equipWithAssets.length === 0) {
      doc.font(F.med).fontSize(9).fillColor(CS).text(isKo?'장비 관련 데이터가 부족합니다.':'Insufficient equipment data available.');
    } else {
      doc.font(F.med).fontSize(8.5).fillColor(CT).text(isKo?
        '아래는 연간 장애 빈도가 높은 Zone/장비 목록입니다. AI 예측 점수는 에러 빈도(40%) + 평균 수리시간(30%) + 고난이도 비율(30%)을 종합하여 0~100 점으로 산출합니다.' :
        'Below are zones/equipment with highest annual failure frequency. Replacement Priority Score combines error frequency (40%) + avg repair time (30%) + high-severity ratio (30%) on a 0-100 scale.');
      doc.moveDown(0.5);

      // ── AI Replacement Priority Score ──
      const maxEqCount = equipWithAssets.length ? Math.max(...equipWithAssets.map(e=>e.count)) : 1;
      equipWithAssets.forEach(eq => {
        // Frequency score (0-40): relative to max
        const freqScore = Math.round((eq.count / Math.max(maxEqCount, 1)) * 40 * 0.4);
        // Avg repair time score (0-30): from matching logs
        const eqLogs = yd.filter(r => r.Zone === eq.zone && (r.Category||'Other') === eq.cat);
        const eqTimes = eqLogs.map(r => parseMins(r.TimeTaken)).filter(t => t > 0);
        const avgTime = eqTimes.length ? eqTimes.reduce((a,b)=>a+b,0)/eqTimes.length : 0;
        const timeScore = Math.min(30, Math.round((avgTime / 450) * 30)); // 450min = max score
        // Severity score (0-30): % of difficulty 4+
        const crit = eqLogs.filter(r => (r.Difficulty||1) >= 4).length;
        const sevScore = eqLogs.length ? Math.round((crit / eqLogs.length) * 30 * 0.4) : 0;
        eq._score = freqScore + timeScore + sevScore;
        eq._freqScore = freqScore; eq._timeScore = timeScore; eq._sevScore = sevScore;
        eq._avgTime = Math.round(avgTime);
        eq._priority = eq._score >= 80 ? (isKo?'교체 권고':'REPLACE') :
                       eq._score >= 55 ? (isKo?'정밀 점검':'INSPECT') :
                       eq._score >= 30 ? (isKo?'모니터링':'MONITOR') : (isKo?'양호':'OK');
        eq._prioColor = eq._score >= 80 ? CE : eq._score >= 55 ? CW : eq._score >= 30 ? '#185FA5' : COK;
      });
      // Sort by score desc
      equipWithAssets.sort((a,b) => (b._score||0) - (a._score||0));

      const eqHeaders = isKo ?
        ['순위','Zone','유형','건수','평균수리','점수','판정'] :
        ['#','Zone','Category','Count','Avg Fix','Score','Priority'];
      const eqRows = equipWithAssets.map((eq,i) => [
        i+1, eq.zone, eq.cat, eq.count,
        eq._avgTime ? eq._avgTime+'min' : '--',
        eq._score+'/100',
        eq._priority
      ]);
      tbl(eqHeaders, eqRows, [30,110,70,45,60,55,145], {
        colColors:{5:v=>{const n=parseInt(v);return n>=80?CE:n>=55?CW:n>=30?'#185FA5':COK;},
                   6:v=>{const s=v;return(s.includes('REPLACE')||s.includes('교체'))?CE:(s.includes('INSPECT')||s.includes('점검'))?CW:(s.includes('MONITOR')||s.includes('모니터'))?'#185FA5':COK;}}
      });

      // Score breakdown visual
      doc.moveDown(0.4);
      doc.font(F.med).fontSize(7.5).fillColor(CS).text(isKo?'* 점수 산출: 에러빈도(40점) + 평균수리시간(30점) + 고난이도비율(30점) = 총 100점':'* Score = Frequency(40) + AvgRepairTime(30) + HighSeverityRatio(30) = 100', ML);
      doc.moveDown(0.2);
      doc.font(F.med).fontSize(7.5).fillColor(CS).text(isKo?'* 80+ 교체 권고 | 55-79 정밀 점검 | 30-54 모니터링 | <30 양호':'* 80+ Replace | 55-79 Inspect | 30-54 Monitor | <30 OK', ML);
    }

    // ══════════════════════════════════════════════
    //  SECTION 9: STAFF PERFORMANCE
    // ══════════════════════════════════════════════
    sect(9, L.staffPerf);
    const staffSorted = Object.entries(staffMap).sort((a,b) => b[1].count - a[1].count);
    if(staffSorted.length === 0) {
      doc.font(F.med).fontSize(9).fillColor(CS).text(isKo?'직원 데이터 없음':'No staff data available.');
    } else {
      const stHeaders = isKo ?
        ['순위','처리자','처리 건수','비율','평균 처리시간','평균 난이도','고난이도(4+)'] :
        ['#','Staff','Cases','% Share','Avg Resolution','Avg Diff','Critical(4+)'];
      const stRows = staffSorted.slice(0,15).map((s,i) => {
        const name=s[0], data=s[1];
        const avgM = data.minCount ? Math.round(data.totalMins/data.minCount) : 0;
        const avgD = data.diffs.length ? (data.diffs.reduce((a,b)=>a+b,0)/data.diffs.length).toFixed(1) : '0.0';
        const crit4 = data.diffs.filter(d=>d>=4).length;
        return [i+1, name, data.count, total?Math.round(data.count/total*100)+'%':'0%', avgM?avgM+'min':'--', avgD, crit4];
      });
      tbl(stHeaders, stRows, [30,110,55,50,80,65,125]);
    }

    // ══════════════════════════════════════════════
    //  SECTION 10: RECOMMENDATIONS
    // ══════════════════════════════════════════════
    sect(10, L.recommendations);

    const recs = [];
    // Trend-based recommendations
    if(prevTotal && total > prevTotal) {
      const d=total-prevTotal, pct=Math.round(d/prevTotal*100);
      recs.push({
        priority: isKo?'긴급':'URGENT',
        item: isKo?'전년 대비 '+d+'건 증가(+'+pct+'%). 증가 원인 조사 및 시정 조치 필요.':'Year-over-year increase of '+d+' (+'+pct+'%). Root cause investigation and corrective action required.'
      });
    }
    if(critical.length > 0) {
      recs.push({
        priority: isKo?'긴급':'URGENT',
        item: isKo?'위험 장애 '+critical.length+'건 발생. 5영업일 이내 근본 원인 분석 및 시정 조치 계획 수립 필요.':critical.length+' critical incidents detected. Root cause analysis and remediation plan required within 5 business days.'
      });
    }
    if(topZone && topZone[1] > total*0.2) {
      recs.push({
        priority: isKo?'주의':'WARNING',
        item: isKo?topZone[0]+' Zone에서 전체의 '+Math.round(topZone[1]/total*100)+'% 집중. 예방 정비 강화 권고.':topZone[0]+' accounts for '+Math.round(topZone[1]/total*100)+'% of all errors. Enhanced preventive maintenance recommended.'
      });
    }
    if(avgRes > 60) {
      recs.push({
        priority: isKo?'주의':'WARNING',
        item: isKo?'평균 처리시간 '+avgRes+'분으로 60분 목표 초과. 에스컬레이션 절차 검토 필요.':'Average resolution time '+avgRes+' min exceeds 60-min target. Escalation process review needed.'
      });
    }
    // Category-specific tips
    const topCatName = topCat ? topCat[0] : '';
    if(topCatName === 'Software') recs.push({priority:isKo?'권고':'INFO', item:isKo?'소프트웨어 유형이 최다. 펌웨어/SW 업데이트 주기 점검 권고.':'Software is the dominant category. Firmware/SW update schedule review recommended.'});
    if(topCatName === 'Hardware') recs.push({priority:isKo?'권고':'INFO', item:isKo?'하드웨어 유형이 최다. 장비 점검 일정 및 예비 부품 확인 권고.':'Hardware is the dominant category. Equipment inspection schedule and spare parts review recommended.'});
    if(topCatName === 'Network') recs.push({priority:isKo?'권고':'INFO', item:isKo?'네트워크 유형이 최다. 인프라 및 연결성 점검 권고.':'Network is the dominant category. Infrastructure and connectivity inspection recommended.'});

    // Equipment maintenance / replacement — very conservative approach
    // Monthly volume: 30-100 errors typical. Annual: 360-1200. Replacement only for extreme outliers.
    // Thresholds scaled to realistic operational volume:
    //   50+ same-zone failures/year → consider replacement (that's ~4+/month consistently)
    //   25-49 → enhanced maintenance (cables, cleaning, connectors)
    //   10-24 → routine preventive maintenance
    //   <10  → normal, no action needed
    if(equipWithAssets.length > 0) {
      const topEq = equipWithAssets[0];
      const pctOfTotal = total ? Math.round(topEq.count/total*100) : 0;
      if(topEq.count >= 80) {
        recs.push({
          priority: isKo?'긴급':'URGENT',
          item: isKo?topEq.zone+' Zone 연간 '+topEq.count+'건(전체 '+pctOfTotal+'%) 반복 장애. 동일 Zone 지속 집중 발생으로 근본 원인 조사 및 장비 교체 검토 필요.':topEq.zone+' zone had '+topEq.count+' failures ('+pctOfTotal+'% of total). Persistent concentration warrants root cause investigation and equipment replacement review.'
        });
      } else if(topEq.count >= 50) {
        recs.push({
          priority: isKo?'주의':'WARNING',
          item: isKo?topEq.zone+' Zone 연간 '+topEq.count+'건 장애. 케이블 정리, 커넥터 교체, 내부 청소 등 집중 예방 정비 권고.':topEq.zone+' zone had '+topEq.count+' failures. Focused preventive maintenance recommended: cable management, connector swap, internal cleaning.'
        });
      } else if(topEq.count >= 25) {
        recs.push({
          priority: isKo?'권고':'INFO',
          item: isKo?topEq.zone+' Zone 연간 '+topEq.count+'건 장애. 정기 청소 일정 확인 및 부품 상태 점검 권고.':topEq.zone+' zone had '+topEq.count+' failures. Verify routine cleaning schedule and inspect component condition.'
        });
      }
    }

    if(recs.length === 0) {
      recs.push({priority:isKo?'양호':'OK', item:isKo?'전반적으로 안정적 운영. 현행 절차 유지 권고.':'Overall stable operations. Continue current procedures.'});
    }

    const recHeaders = isKo ? ['#','우선순위','권고사항'] : ['#','Priority','Recommendation'];
    const recRows = recs.map((r,i) => [i+1, r.priority, r.item]);
    tbl(recHeaders, recRows, [30,70,415], {
      leftCols:[2],
      colColors: {1: v => {
        const s=String(v).toLowerCase();
        return (s.includes('urgent')||s.includes('긴급'))?CE:(s.includes('warn')||s.includes('주의'))?CW:COK;
      }}
    });

    // ── Next Year Action Plan (inspired by sales report structure) ──
    doc.moveDown(1.2);
    pc(100);
    doc.font(F.bold).fontSize(9).fillColor(CP).text(isKo?'차기 연도 액션 플랜':'NEXT YEAR ACTION PLAN');
    doc.moveDown(0.4);
    const actions = [];
    // Auto-generate action items based on data analysis
    if(prevTotal && total > prevTotal) {
      actions.push(isKo?
        '에러 증가 추세 대응: 분기별 예방 점검 일정 수립 및 이행':'Address increasing error trend: Establish and execute quarterly preventive inspection schedule');
    }
    if(critical.length > 3) {
      actions.push(isKo?
        '위험 장애 대응 체계 강화: 에스컬레이션 매트릭스 개정 및 교육':'Strengthen critical incident response: Revise escalation matrix and conduct training');
    }
    if(topZone && topZone[1] > total*0.15) {
      actions.push(isKo?
        topZone[0]+' Zone 집중 관리: 케이블 정리, 먼지 청소, 커넥터 점검 정기화':topZone[0]+' zone focused maintenance: Regularize cable management, dust cleaning, connector inspection');
    }
    if(avgRes > 45) {
      actions.push(isKo?
        '처리 시간 단축: 자주 발생하는 장애 유형별 표준 대응 절차(SOP) 정비':'Reduce resolution time: Develop Standard Operating Procedures (SOP) for frequent error types');
    }
    actions.push(isKo?
      '월간 리포트 기반 트렌드 모니터링 및 분기별 경영진 보고':'Monthly report-based trend monitoring and quarterly executive briefing');
    actions.push(isKo?
      '현장 스태프 정기 교육 및 장비 관리 체크리스트 업데이트':'Regular on-site staff training and equipment maintenance checklist update');

    doc.font(F.reg).fontSize(8.5).fillColor(CT);
    actions.forEach((a,i) => {
      doc.text('  '+(i+1)+'.  '+a, {width:PW, indent:4});
      doc.moveDown(0.25);
    });

    // ══════════════════════════════════════════════
    //  FOOTER ALL PAGES
    // ══════════════════════════════════════════════
    _markPage();
    const tp=doc.bufferedPageRange().count;
    const contentPageList = [];
    for(let i=1;i<tp;i++){
      if(_contentPages.has(i)) contentPageList.push(i);
    }
    const totalContent = contentPageList.length;
    for(let ci=0;ci<contentPageList.length;ci++){
      const i=contentPageList[ci];
      doc.switchToPage(i);
      doc.save().rect(0,818,595,24).fill(CT).restore();
      doc.fillColor('#a3a29c').fontSize(7.5).font(F.light);
      doc.text("d'strict Error  |  "+year+' Annual Error Report',ML,823,{width:PW-60,lineBreak:false});
      doc.text('Page '+(ci+1)+'/'+totalContent,MR-60,823,{width:60,align:'right',lineBreak:false});
      doc.save().rect(0,0,595,4).fill(CP).restore();
    }
    doc.switchToPage(0);
    doc.save().rect(0,0,595,6).fill(CP).restore();
    doc.switchToPage(tp - 1);

    doc.end();
  });
}

module.exports = { generateAnnualPDF };
