'use strict';

const PDFDocument = require('pdfkit');
const path = require('path');
const { MONTHS_EN, BR_NAMES, BR_COLORS, KOREA_BRANCHES, GLOBAL_BRANCHES, ALL_BRANCHES } = require('./config');
const { canonLabel } = require('./normalize');

// Strip control characters from text destined for PDF rendering
function sanitizePdfText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 4000);
}

// PDF-safe text: strip emoji and decorative unicode (prevents tofu boxes)
function pdfSafeText(str) {
  if (typeof str !== 'string') return '';
  let s = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  s = s.replace(/[\u{1F300}-\u{1FAFF}]/gu, '');
  s = s.replace(/[\u{2600}-\u{27BF}]/gu, '');
  s = s.replace(/[\u{2300}-\u{23FF}]/gu, '');
  s = s.replace(/[\u{1F000}-\u{1F2FF}]/gu, '');
  s = s.replace(/[\uFE00-\uFE0F]/g, '');
  s = s.replace(/[\u200B-\u200F\u2028-\u202F\u205F-\u206F]/g, '');
  s = s.replace(/ {2,}/g, ' ').trim();
  return s;
}

const FONT_DIR = path.join(__dirname, 'fonts');
const LOGO_WHITE = path.join(FONT_DIR, 'dstrict_CI_WHITE.png');
const LOGO_BLACK = path.join(FONT_DIR, 'dstrict_CI_BLACK.png');
const MAX_PDF_SIZE = 50 * 1024 * 1024;

function generateAnnualPDF(logs, year, lang, history, assets, region, comment, customTitle) {
  if (!Array.isArray(logs)) throw new Error('logs must be an array');
  year = Math.max(2000, Math.min(2100, parseInt(year, 10) || new Date().getFullYear()));
  lang = ['en','ko'].includes(lang) ? lang : 'en';
  history = Array.isArray(history) ? history : [];
  assets = Array.isArray(assets) ? assets : [];
  region = ['korea','global'].includes(region) ? region : 'global';
  // pdfSafeText removes emoji/decorative unicode in addition to control chars
  const safeComment = pdfSafeText(typeof comment === 'string' ? comment.trim() : '').slice(0, 2000);
  const safeTitle = pdfSafeText(typeof customTitle === 'string' ? customTitle.trim() : '').slice(0, 200);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 20, left: 22, right: 22, bottom: 0 }, bufferPages: true });
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
    } catch(e) {
      console.error('[PDF-Annual] Korean font registration failed:', e.message);
    }

    // Landscape A4: 841.89 × 595.28 pt. Margins left/right 22, top 20.
    const PW = 797, ML = 22, MR = 819, BOT = 558;
    const isKo = lang === 'ko';
    // Always use NotoSansKR for body text — has full Latin + Korean coverage.
    // Uniform has no Korean glyphs → would render tofu boxes on any Korean branch/zone name.
    const F = {
      black: hasKR ? 'KRBlack'  : 'UBlack',
      bold:  hasKR ? 'KRBold'   : 'UBold',
      med:   hasKR ? 'KRMedium' : 'UMedium',
      reg:   hasKR ? 'KRMedium' : 'UReg',
      light: hasKR ? 'KRLight'  : 'ULight',
      // Brand-only (ASCII-safe display text like d'strict logo)
      brandBlk: 'UBlack',
      brandBld: 'UBold',
      brandReg: 'UReg',
    };

    // ── Colors ──
    const CP='#534AB7', CT='#1a1a18', CS='#73726c', COK='#3B6D11', CE='#A32D2D', CW='#854F0B', CL='#e8e6df';
    const CBG='#f6f5f0', CCARD='#ffffff';
    const CHIGHLIGHT = '#FDE68A';
    const catCols = ['#534AB7','#185FA5','#993C1D','#854F0B','#3B6D11','#A32D2D'];
    const diffCols = {1:'#a3a29c',2:'#185FA5',3:'#854F0B',4:'#993C1D',5:'#A32D2D'};

    // ── Labels ──
    const L = isKo ? {
      coverTitle: '',
      coverSub: '',
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
      coverTitle: '',
      coverSub: '',
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

    // ── Data normalization: delegate to shared canonLabel (handles TEabar→Teabar,
    // SOftware→Software, GARDEN→Garden while preserving tech acronyms PC/LED/HDMI)
    const normLbl = canonLabel;
    function buildFolded(arr, keyFn, def) {
      const upper={}, disp={};
      arr.forEach(r=>{
        const raw=(keyFn(r)||def||'').trim().replace(/\s+/g,' ');
        if(!raw) return;
        const k=raw.toUpperCase();
        upper[k]=(upper[k]||0)+1;
        if(!disp[k]) disp[k]=normLbl(raw);
      });
      const out={};
      Object.keys(upper).forEach(k=>{ out[disp[k]||k]=upper[k]; });
      return out;
    }
    yd.forEach(r=>{ if(r.Zone) r.Zone=normLbl(r.Zone); if(r.Category) r.Category=normLbl(r.Category); });
    prevYd.forEach(r=>{ if(r.Zone) r.Zone=normLbl(r.Zone); if(r.Category) r.Category=normLbl(r.Category); });

    // Category
    const catCount     = buildFolded(yd,     r=>r.Category, 'Other');
    const prevCatCount = buildFolded(prevYd,  r=>r.Category, 'Other');

    // Zone
    const zoneCount = buildFolded(yd, r=>r.Zone, 'Unknown');

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
      try { if(_hasLogoBlack) doc.image(LOGO_BLACK, ML, 10, {width:56}); } catch(_) {}
      doc.fillColor(CS).fontSize(7).font(F.light).text("Error Report", ML+62, 14, {lineBreak:false});
      doc.moveTo(ML, 28).lineTo(MR, 28).strokeColor(CL).lineWidth(0.5).stroke();
      doc.save();
      doc.opacity(0.02);
      doc.translate(421, 297);
      doc.rotate(-35, {origin:[0,0]});
      try { if(_hasLogoBlack) doc.image(LOGO_BLACK, -160, -25, {width:320}); } catch(_) {}
      doc.restore();
      doc.restore();
      doc.y = 32;
    }
    function pc(need) { if(doc.y+(need||60)>BOT) { _markPage(); doc.addPage(); _drawPageBranding(); } }
    function trend(c,p) { if(!p&&!c)return '--'; if(!p)return '+'+c; const d=c-p,pct=Math.round(Math.abs(d)/p*100); return d>0?'+'+d+' (+'+pct+'%)':d<0?d+' (-'+pct+'%)':'0'; }

    function sect(n, title) {
      _markPage();
      if(doc.y > BOT - 160) { doc.addPage(); _drawPageBranding(); }
      else if(doc.y > 80) { doc.y = doc.y + 8; } else { doc.y = 32; }
      const y = doc.y;
      doc.save().rect(ML,y,PW,14).fill('#f0eff8').restore();
      doc.save().rect(ML,y,4,14).fill(CP).restore();
      doc.fillColor(CT).fontSize(isKo?10:11).font(F.bold).text(n+'. '+title.toUpperCase(), ML+8, y+2, {lineBreak:false});
      doc.y = y + 17;
      doc.moveTo(ML,doc.y-1).lineTo(MR,doc.y-1).strokeColor(CP).lineWidth(0.6).stroke();
      doc.moveDown(0.3);
      doc.x = ML;
      doc.font(F.reg).fillColor(CT);
    }

    function drawBar(x, y, maxW, pct, color, h) {
      h=h||12;
      doc.save().roundedRect(x,y,maxW,h,3).fill(CBG).restore();
      if(pct>0){ const w=Math.max(Math.round(maxW*pct/100),4); doc.save().roundedRect(x,y,w,h,3).fill(color).restore(); }
    }

    // ── Data-condition classifier: drives layout decisions ──
    // zero: no incidents | low: ≤25 | normal: 26–200 | high: 201+
    function dataCondition(tot, crit) {
      if (tot <= 0) return 'zero';
      if (tot <= 25) return 'low';
      if (tot <= 200) return 'normal';
      return 'high';
    }

    // ── KPI strip (hero row) ──
    // items: [{label, value, sub?, accent?, color?}]
    function drawKPIStrip(items) {
      const n = items.length;
      const GAP = 7;
      const colW = Math.floor((PW - GAP * (n - 1)) / n);
      const kH = isKo ? 58 : 54;
      const y = doc.y;
      items.forEach((item, i) => {
        const cx = ML + i * (colW + GAP);
        doc.save().roundedRect(cx, y, colW, kH, 5).fill(CBG).restore();
        if (item.accent) doc.save().rect(cx, y, 3, kH).fill(item.accent).restore();
        doc.fillColor(CS).fontSize(isKo ? 7.5 : 8).font(F.med)
          .text(item.label || '', cx + 10, y + 8, { width: colW - 14, align: 'center', lineBreak: false });
        const vStr = String(item.value !== undefined ? item.value : '–');
        const vFS = vStr.length > 7 ? (isKo ? 14 : 15) : vStr.length > 4 ? (isKo ? 17 : 19) : (isKo ? 21 : 23);
        doc.fillColor(item.color || CT).fontSize(vFS).font(F.bold)
          .text(vStr, cx + 8, y + 20, { width: colW - 14, align: 'center', lineBreak: false });
        if (item.sub !== undefined) doc.fillColor(item.subColor || CS).fontSize(isKo ? 7 : 7.5).font(F.med)
          .text(String(item.sub), cx + 8, y + kH - 13, { width: colW - 14, align: 'center', lineBreak: false });
      });
      doc.y = y + kH + 8;
      doc.x = ML;
    }

    // ── Vertical bar chart: 12-month trend with optional prev-year comparison ──
    function drawVTrend(values, labels, compareValues, opts) {
      opts = opts || {};
      const chartH = opts.h || 100;
      const topPad = 10, botPad = 18;
      const barAreaH = chartH - topPad - botPad;
      const y0 = doc.y, x0 = ML;
      const n = values.length;
      const slotW = Math.floor(PW / n);
      const hasCmp = Array.isArray(compareValues) && compareValues.length === n;
      const maxV = Math.max(1, ...values, ...(hasCmp ? compareValues : []));
      // Axis baseline
      doc.moveTo(x0, y0 + topPad + barAreaH).lineTo(x0 + PW, y0 + topPad + barAreaH).strokeColor(CL).lineWidth(0.5).stroke();
      // Bars
      values.forEach((v, i) => {
        const cx = x0 + i * slotW + slotW / 2;
        const barW = hasCmp ? 9 : 14;
        const fillH = Math.round(barAreaH * v / maxV);
        const cmpFillH = hasCmp ? Math.round(barAreaH * (compareValues[i] || 0) / maxV) : 0;
        const by = y0 + topPad + barAreaH - fillH;
        const cby = y0 + topPad + barAreaH - cmpFillH;
        if (hasCmp) {
          // prev year (light gray, behind)
          doc.save().rect(cx - barW - 1, cby, barW, cmpFillH).fill(CL).restore();
          // current year (purple)
          doc.save().rect(cx + 1, by, barW, fillH).fill(CP).restore();
          // value label
          if (v > 0) doc.fillColor(CT).fontSize(7).font(F.bold)
            .text(String(v), cx + 1 - 2, by - 9, { width: barW + 4, align: 'center', lineBreak: false });
        } else {
          doc.save().rect(cx - barW / 2, by, barW, fillH).fill(CP).restore();
          if (v > 0) doc.fillColor(CT).fontSize(7).font(F.bold)
            .text(String(v), cx - barW, by - 9, { width: barW * 2, align: 'center', lineBreak: false });
        }
        // x label
        doc.fillColor(CS).fontSize(isKo ? 7 : 7.5).font(F.med)
          .text(labels[i] || '', cx - slotW / 2, y0 + topPad + barAreaH + 4, { width: slotW, align: 'center', lineBreak: false });
      });
      // Legend
      if (hasCmp) {
        const legY = y0 + 1;
        doc.save().rect(x0 + PW - 135, legY, 6, 6).fill(CP).restore();
        doc.fillColor(CS).fontSize(7).font(F.med).text(opts.curLabel || 'Current', x0 + PW - 125, legY, { width: 55, lineBreak: false });
        doc.save().rect(x0 + PW - 65, legY, 6, 6).fill(CL).restore();
        doc.fillColor(CS).fontSize(7).font(F.med).text(opts.cmpLabel || 'Previous', x0 + PW - 55, legY, { width: 55, lineBreak: false });
      }
      doc.y = y0 + chartH + 6;
      doc.x = x0;
    }

    // ── Compact horizontal bar ranking list ──
    // items: [{label, value, color?, pct?}]; total for % calculation
    function drawHBarList(items, totalN, opts) {
      opts = opts || {};
      const rowH = opts.rowH || 16;
      const n = items.length;
      const labelW = opts.labelW || 140;
      const countW = 40, pctW = 36;
      const barW = PW - labelW - countW - pctW - 12;
      const maxV = Math.max(1, ...items.map(it => it.value || 0));
      const y0 = doc.y;
      items.forEach((it, i) => {
        const ry = y0 + i * rowH;
        if (i % 2 === 0) doc.save().rect(ML, ry, PW, rowH).fill(CBG).restore();
        const lbl = (it.label || '').length > 26 ? (it.label || '').slice(0, 25) + '…' : (it.label || '');
        doc.fillColor(CT).fontSize(isKo ? 8 : 8.5).font(F.med)
          .text((opts.showRank ? (i + 1) + '.  ' : '') + lbl, ML + 6, ry + 4, { width: labelW - 10, lineBreak: false });
        const fillW = Math.max(2, Math.round(barW * (it.value || 0) / maxV));
        const bx = ML + labelW;
        doc.save().roundedRect(bx, ry + 4, barW, 8, 2).fill(CL).restore();
        doc.save().roundedRect(bx, ry + 4, fillW, 8, 2).fill(it.color || CP).restore();
        doc.fillColor(CT).fontSize(isKo ? 8 : 8.5).font(F.bold)
          .text(String(it.value || 0), bx + barW + 6, ry + 4, { width: countW - 8, align: 'right', lineBreak: false });
        const pctStr = totalN ? Math.round((it.value || 0) / totalN * 100) + '%' : '0%';
        doc.fillColor(CS).fontSize(isKo ? 7.5 : 8).font(F.med)
          .text(pctStr, bx + barW + countW, ry + 4, { width: pctW - 2, align: 'right', lineBreak: false });
      });
      doc.y = y0 + n * rowH + 6;
      doc.x = ML;
    }

    // ── Defensive page-break guard: if remaining space would leave weak final page, force new page ──
    function fitsOrAdvance(need) {
      const remaining = BOT - doc.y;
      if (remaining < need) { _markPage(); doc.addPage(); _drawPageBranding(); }
    }

    function _drawTblHeader(headers, widths, hH, pad) {
      let cx=ML; const hy=doc.y;
      doc.save().rect(ML,hy,PW,hH).fill(CT).restore();
      headers.forEach((h,i)=>{ doc.fillColor('#fff').fontSize(isKo?8.5:9).font(F.bold).text(h,cx+pad,hy+(isKo?8:7),{width:widths[i]-pad*2,align:'center',lineBreak:false}); cx+=widths[i]; });
      doc.moveTo(ML,hy+hH).lineTo(MR,hy+hH).strokeColor(CT).lineWidth(1.2).stroke();
      doc.y = hy+hH;
    }

    function tbl(headers, rows, widths, opts) {
      opts=opts||{}; const hH=isKo?20:18; const minRH=isKo?18:16; const pad=5; const cellPadY=isKo?5:4;
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
    //  FIRST CONTENT PAGE (cover removed)
    // ══════════════════════════════════════════════
    _drawPageBranding();

    // ══════════════════════════════════════════════
    //  REPORT TITLE HEADER (if custom title provided)
    // ══════════════════════════════════════════════
    if (safeTitle) {
      const titleY = doc.y;
      doc.save().rect(ML, titleY, PW, 38).fill('#f6f5f0').restore();
      doc.save().rect(ML, titleY, PW, 4).fill(CP).restore();
      doc.fillColor(CP).fontSize(14).font(F.bold)
        .text(safeTitle, ML, titleY + 8, { width: PW, align: 'center', lineBreak: false });
      const regionLabel = region === 'korea' ? (isKo ? '국내' : 'Korea') : (isKo ? '글로벌' : 'Global');
      doc.fillColor(CT).fontSize(9).font(F.med)
        .text(regionLabel + '  ·  ' + year + ' Annual', ML, titleY + 26, { width: PW, align: 'center', lineBreak: false });
      doc.y = titleY + 44;
      doc.x = ML;
      _markPage();
    }

    // ══════════════════════════════════════════════
    //  COMMENT (if provided)
    // ══════════════════════════════════════════════
    if (safeComment) {
      // Strip bullet markers/markdown list prefixes
      const cleanComment = safeComment
        .replace(/[•◦★✓▪︎▫︎◼︎☐☑︎☒✗✘]/g, '')
        .replace(/^\s*[-*+]\s+/gm, '');
      // Section header band
      const cmtSecY = doc.y;
      doc.save().rect(ML, cmtSecY, PW, 22).fill('#f0eff8').restore();
      doc.save().rect(ML, cmtSecY, 4, 22).fill(CP).restore();
      doc.fillColor(CT).fontSize(isKo ? 12 : 13).font(F.bold)
        .text(isKo ? '본사 코멘트 (GSKR-GTO Comment)' : 'GSKR-GTO Comment',
          ML + 10, cmtSecY + 5, { lineBreak: false });
      doc.y = cmtSecY + 28;
      // Notice strip — token-aligned, no amber
      const ntcY = doc.y;
      doc.save().roundedRect(ML, ntcY, PW, 16, 3).fill('#f0eff8').restore();
      doc.save().rect(ML, ntcY, 4, 16).fill(CP).restore();
      doc.fillColor(CS).fontSize(isKo ? 8.5 : 8).font(F.med)
        .text(isKo
          ? '이 코멘트는 담당자가 직접 작성한 내용입니다.'
          : 'This comment was written directly by the branch manager.',
          ML + 10, ntcY + 4, { width: PW - 20, lineBreak: false });
      doc.y = ntcY + 20;
      // Adaptive height body — measure actual wrapped text
      const cmtFS = isKo ? 10 : 9.5;
      doc.font(F.med).fontSize(cmtFS);
      const cmtBodyH = Math.max(
        isKo ? 22 : 20,
        doc.heightOfString(cleanComment, { width: PW - 24, lineBreak: true }) + 14
      );
      const cmtBodyY = doc.y;
      doc.save().roundedRect(ML, cmtBodyY, PW, cmtBodyH, 4).fill(CBG).stroke(CL).restore();
      doc.save().rect(ML, cmtBodyY, 3, cmtBodyH).fill(CP).restore();
      doc.fillColor(CT).fontSize(cmtFS).font(F.med)
        .text(cleanComment, ML + 12, cmtBodyY + 7, { width: PW - 24, lineBreak: true });
      doc.y = cmtBodyY + cmtBodyH + 14;
    }

    // ══════════════════════════════════════════════
    //  SECTION 1: EXECUTIVE SUMMARY (KPI hero + narrative)
    // ══════════════════════════════════════════════
    sect(1, L.execSummary);

    // Classify data condition — drives downstream layout
    const cond = dataCondition(total, critical.length);

    // Key metrics summary text (derive first so KPI strip can use them)
    const maxBr = branches.reduce((mx,b) => (brCount[b]||0)>(brCount[mx]||0)?b:mx, branches[0]);
    const topZone = Object.entries(zoneCount).sort((a,b)=>b[1]-a[1])[0];
    const topCat = Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0];

    // Hero KPI strip (premium executive dashboard on page 1)
    const yoyD = prevTotal ? (total - prevTotal) : 0;
    const yoyPct = prevTotal ? Math.round(Math.abs(yoyD) / prevTotal * 100) : 0;
    const yoyColor = !prevTotal ? CS : (yoyD > 0 ? CE : yoyD < 0 ? COK : CS);
    const yoySub = !prevTotal ? (isKo ? '전년 데이터 없음' : 'No prior data')
                              : (yoyD > 0 ? '+' + yoyD + ' (+' + yoyPct + '%)'
                              : yoyD < 0 ? yoyD + ' (-' + yoyPct + '%)'
                              : (isKo ? '변동 없음' : 'Unchanged'));
    drawKPIStrip([
      { label: isKo ? '총 장애' : 'TOTAL ERRORS', value: total, accent: CP,
        sub: (isKo ? '전년 ' + prevTotal + '건' : 'Prev ' + prevTotal), color: CT },
      { label: isKo ? '위험 장애 (Lv.4+)' : 'CRITICAL (Lv.4+)', value: critical.length,
        accent: critical.length > 0 ? CE : COK,
        sub: total ? Math.round(critical.length / total * 100) + '%' : '–',
        color: critical.length > 0 ? CE : COK },
      { label: isKo ? '평균 난이도' : 'AVG DIFFICULTY', value: avgDiff + '/5', accent: '#185FA5',
        sub: (isKo ? '위험 기준 4.0' : 'Critical ≥ 4.0'), color: CT },
      { label: isKo ? '평균 처리시간' : 'AVG RESOLUTION', value: avgRes ? avgRes + 'm' : '–',
        accent: avgRes > 60 ? CW : COK,
        sub: avgRes > 60 ? (isKo ? '목표 60분 초과' : '> 60-min target')
                         : (isKo ? '목표 내' : 'On target'),
        color: avgRes > 60 ? CW : CT },
      { label: isKo ? '전년 대비' : 'YEAR-OVER-YEAR', value: yoySub, accent: yoyColor,
        sub: prevTotal ? ((year - 1) + ' → ' + year) : '', color: yoyColor }
    ]);

    // Narrative line (compact — KPIs carry the weight)
    doc.font(F.med).fontSize(isKo ? 9 : 9.5).fillColor(CT);
    if (cond === 'zero') {
      doc.text(isKo ? year + '년 장애 발생 없음. 전 지점 시스템 정상 운영 중.'
                   : 'No errors recorded in ' + year + '. All branches operating normally.',
        ML, doc.y, { width: PW });
    } else if (isKo) {
      doc.text(year + '년 글로벌 기술운영팀은 총 ' + total + '건의 장애를 처리하였으며, 이 중 ' + critical.length + '건이 위험 등급(Difficulty 4+)입니다. ' +
        '평균 난이도 ' + avgDiff + ', 평균 처리시간 ' + avgRes + '분.',
        ML, doc.y, { width: PW });
    } else {
      doc.text('In ' + year + ', Global Technical Operations processed ' + total + ' errors across all branches — ' +
        critical.length + ' critical (Difficulty 4+). Avg difficulty ' + avgDiff + '/5, avg resolution ' + avgRes + ' min.',
        ML, doc.y, { width: PW });
    }
    doc.moveDown(0.5);

    // Key findings — only when data warrants
    if (cond !== 'zero') {
      doc.font(F.bold).fontSize(9).fillColor(CP).text(isKo ? '핵심 발견사항' : 'KEY FINDINGS', ML, doc.y, { width: PW });
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
      findings.forEach(f => { doc.text('  •  '+f, ML, doc.y, { width: PW, indent: 4 }); doc.moveDown(0.15); });
    }

    // ══════════════════════════════════════════════
    //  SECTION 2: BRANCH ANNUAL PERFORMANCE
    //  (skip entirely for zero-data — no meaningful comparison)
    // ══════════════════════════════════════════════
    if (cond !== 'zero' || prevTotal > 0) {
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
      tbl(brHeaders, brRows, [170,101,101,132,93,101,99], {
        colColors: {3: v => { const s=String(v); return s.startsWith('+')?CE:s.startsWith('-')?COK:CT; }}
      });
    }

    // ══════════════════════════════════════════════
    //  SECTION 3: MONTHLY TREND (visual V-bar chart)
    // ══════════════════════════════════════════════
    if (cond !== 'zero') {
      sect(3, L.monthlyTrend);
      doc.font(F.med).fontSize(8).fillColor(CS).text(isKo?'월별 에러 발생 추이 (당년 vs 전년)':'Monthly error count trend (current year vs previous year)', ML, doc.y, {width:PW});
      doc.moveDown(0.4);

      const monthCounts = monthly.map(m => m.length);
      const prevMonthCounts = prevMonthly.map(m => m.length);
      const monthLabels = MONTHS_EN.map(mn => mn.slice(0,3));
      fitsOrAdvance(130);
      drawVTrend(monthCounts, monthLabels, prevTotal ? prevMonthCounts : null, {
        h: 110,
        curLabel: String(year),
        cmpLabel: String(year - 1)
      });

      // Compact under-chart micro-stats: peak month, quiet month, MoM volatility
      const peakMi = monthCounts.indexOf(Math.max(...monthCounts));
      const quietMi = monthCounts.reduce((mi, v, i) => v < monthCounts[mi] ? i : mi, 0);
      const monthAvg = total ? Math.round(total / 12) : 0;
      const deltaTxt = prevTotal ? trend(total, prevTotal) : (isKo ? '전년 데이터 없음' : 'No prior data');
      doc.font(F.med).fontSize(isKo ? 8 : 8.5).fillColor(CS);
      doc.text(
        (isKo
          ? '최다 월: ' + monthLabels[peakMi] + ' (' + monthCounts[peakMi] + '건)   |   최소 월: ' + monthLabels[quietMi] + ' (' + monthCounts[quietMi] + '건)   |   월평균: ' + monthAvg + '건   |   전년비: ' + deltaTxt
          : 'Peak: ' + monthLabels[peakMi] + ' (' + monthCounts[peakMi] + ')  |  Quiet: ' + monthLabels[quietMi] + ' (' + monthCounts[quietMi] + ')  |  Monthly avg: ' + monthAvg + '  |  YoY: ' + deltaTxt),
        ML, doc.y, { width: PW }
      );
    }

    // ══════════════════════════════════════════════
    //  SECTION 4: CATEGORY & DIFFICULTY (H-bar visual)
    //  Hoisted cats array — also used by Sec 7 (YoY) and Sec 10 (recs)
    // ══════════════════════════════════════════════
    const cats = ['Software','Hardware','Network','Other'];
    if (cond !== 'zero') {
      sect(4, L.catDiff);
      const catColorMap = ['#534AB7','#185FA5','#993C1D','#3B6D11'];
      doc.font(F.bold).fontSize(9).fillColor(CP).text(isKo?'유형별 분류':'CATEGORY BREAKDOWN', ML, doc.y, { width: PW });
      doc.moveDown(0.3);
      const activeCats = cats.filter(c => (catCount[c]||0) > 0 || (prevCatCount[c]||0) > 0);
      if (activeCats.length === 0) {
        doc.font(F.med).fontSize(9).fillColor(CS)
          .text(isKo ? '유형 데이터 없음.' : 'No category data available.', ML, doc.y, { width: PW });
      } else {
        fitsOrAdvance(activeCats.length * 16 + 16);
        drawHBarList(activeCats.map((c, i) => {
          const cur = catCount[c] || 0;
          const prev = prevCatCount[c] || 0;
          const delta = prev ? (cur > prev ? ' ↑' : cur < prev ? ' ↓' : ' =') : '';
          return {
            label: c + (prev ? '  (prev ' + prev + delta + ')' : ''),
            value: cur,
            color: catColorMap[i] || CP
          };
        }), total, { labelW: 230 });
      }

      doc.moveDown(0.4);
      fitsOrAdvance(110);

      // Difficulty distribution — compact H-bar list (replaces table)
      doc.font(F.bold).fontSize(9).fillColor(CP).text(isKo?'난이도 분포':'DIFFICULTY DISTRIBUTION', ML, doc.y, { width: PW });
      doc.moveDown(0.3);
      const diffLabels = {1: isKo?'Lv.1 경미':'Lv.1 Minor', 2: isKo?'Lv.2 보통':'Lv.2 Normal',
                         3: isKo?'Lv.3 주의':'Lv.3 Elevated', 4: isKo?'Lv.4 위험':'Lv.4 Critical', 5: isKo?'Lv.5 심각':'Lv.5 Severe'};
      const diffItems = [1,2,3,4,5].map(d => ({
        label: diffLabels[d],
        value: diffCount[d] || 0,
        color: diffCols[d] || CS
      }));
      drawHBarList(diffItems, total, { labelW: 160 });
    }

    // ══════════════════════════════════════════════
    //  SECTION 5: TOP ZONES (H-bar ranking list)
    // ══════════════════════════════════════════════
    if (cond !== 'zero') {
      sect(5, L.topZones);
      const topZonesArr = Object.entries(zoneCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
      if (topZonesArr.length === 0) {
        doc.font(F.med).fontSize(9).fillColor(CS)
          .text(isKo ? 'Zone 데이터 없음.' : 'No zone data available.', ML, doc.y, { width: PW });
      } else {
        // Build items with primary-category subtext; use purple for top, cascading colors
        fitsOrAdvance(topZonesArr.length * 16 + 18);
        const items = topZonesArr.map((z, i) => {
          const zoneCat = {};
          yd.filter(r=>r.Zone===z[0]).forEach(r=>{ zoneCat[r.Category||'Other']=(zoneCat[r.Category||'Other']||0)+1; });
          const primary = Object.entries(zoneCat).sort((a,b)=>b[1]-a[1])[0];
          const primaryTxt = primary ? ' · ' + primary[0] : '';
          const labelWithCat = z[0] + primaryTxt;
          return {
            label: labelWithCat,
            value: z[1],
            color: i === 0 ? CP : (i < 3 ? '#185FA5' : CS)
          };
        });
        drawHBarList(items, total, { showRank: true, labelW: 260 });
      }
    }

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
      // Controlled wrap — let meaningful text through (up to ~140 chars with 2-line safe wrap)
      const critRows = critical.slice(0,20).map(r => {
        const iss = (r.IssueDetail||'').trim();
        const safe = iss.length > 140 ? iss.slice(0, 137).replace(/\s+\S*$/, '') + '…' : iss;
        return [r.Date, r.Branch, r.Zone, r.Category||'', safe, r.Difficulty, r.TimeTaken||'--'];
      });
      tbl(critHeaders, critRows, [90,65,124,81,263,59,115], {leftCols:[4]});
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
      tbl(yoyHeaders, yoyRows, [186,124,124,170,193], {
        colColors: {4: v => {
          const s=String(v).toLowerCase();
          return (s.includes('worse')||s.includes('악화')||s.includes('up')||s.includes('증가'))?CE:
                 (s.includes('improved')||s.includes('개선')||s.includes('down')||s.includes('감소'))?COK:CS;
        }}
      });
    }

    // ══════════════════════════════════════════════
    //  SECTION 8: EQUIPMENT LIFECYCLE (gated by data condition)
    // ══════════════════════════════════════════════
    if (cond !== 'zero' && equipWithAssets.length > 0) {
      sect(8, L.equipmentLife);
    if(false) {
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
      tbl(eqHeaders, eqRows, [46,170,108,70,93,85,225], {
        colColors:{5:v=>{const n=parseInt(v);return n>=80?CE:n>=55?CW:n>=30?'#185FA5':COK;},
                   6:v=>{const s=v;return(s.includes('REPLACE')||s.includes('교체'))?CE:(s.includes('INSPECT')||s.includes('점검'))?CW:(s.includes('MONITOR')||s.includes('모니터'))?'#185FA5':COK;}}
      });

      // Score breakdown visual
      doc.moveDown(0.4);
      doc.font(F.med).fontSize(7.5).fillColor(CS).text(isKo?'* 점수 산출: 에러빈도(40점) + 평균수리시간(30점) + 고난이도비율(30점) = 총 100점':'* Score = Frequency(40) + AvgRepairTime(30) + HighSeverityRatio(30) = 100', ML);
      doc.moveDown(0.2);
      doc.font(F.med).fontSize(7.5).fillColor(CS).text(isKo?'* 80+ 교체 권고 | 55-79 정밀 점검 | 30-54 모니터링 | <30 양호':'* 80+ Replace | 55-79 Inspect | 30-54 Monitor | <30 OK', ML);
    }
    } // end Section 8 gate

    // ══════════════════════════════════════════════
    //  SECTION 9: STAFF PERFORMANCE (gated — skip if no data)
    // ══════════════════════════════════════════════
    const staffSorted = Object.entries(staffMap).sort((a,b) => b[1].count - a[1].count);
    if (cond !== 'zero' && staffSorted.length > 0) {
      sect(9, L.staffPerf);
    if(false) {
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
      tbl(stHeaders, stRows, [46,170,85,77,124,101,194]);
    }
    } // end Section 9 gate

    // ══════════════════════════════════════════════
    //  RECOMMENDATIONS (always render — consolidates insight)
    // ══════════════════════════════════════════════
    // Section number adapts to condition: for zero-data this is section 2
    // (after Exec Summary); for normal data it remains section 10.
    const recSecN = (cond === 'zero') ? 2 : 10;
    sect(recSecN, L.recommendations);

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
    for(let i=0;i<tp;i++){
      if(_contentPages.has(i)) contentPageList.push(i);
    }
    const totalContent = contentPageList.length;
    for(let ci=0;ci<contentPageList.length;ci++){
      const i=contentPageList[ci];
      doc.switchToPage(i);
      doc.save().rect(0,571,841,24).fill(CT).restore();
      doc.fillColor('#a3a29c').fontSize(7.5).font(F.light);
      const annualId = 'DSKR-GTO-Annual Error Report_' + String(year).slice(2);
      const annualFooterTitle = safeTitle ? ("d'strict  |  " + safeTitle) : ("d'strict  |  " + annualId);
      doc.text(annualFooterTitle,ML,576,{width:PW-60,lineBreak:false});
      doc.text('Page '+(ci+1)+'/'+totalContent,MR-60,576,{width:60,align:'right',lineBreak:false});
      doc.save().rect(0,0,841,4).fill(CP).restore();
    }
    // Add top purple bar to all pages
    for(let pi=0;pi<tp;pi++){
      doc.switchToPage(pi);
      doc.save().rect(0,0,841,6).fill(CP).restore();
    }
    doc.switchToPage(tp - 1);

    doc.end();
  });
}

module.exports = { generateAnnualPDF };
