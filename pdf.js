'use strict';

const PDFDocument = require('pdfkit');
const path = require('path');
const { MONTHS_EN, BR_NAMES, BR_COLORS, KOREA_BRANCHES, GLOBAL_BRANCHES, ALL_BRANCHES } = require('./config');
const { normHist } = require('./normalize');

// Strip control characters from text destined for PDF rendering
function sanitizePdfText(str) {
  if (typeof str !== 'string') return '';
  // Remove control chars except newline/tab, and limit length
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 4000);
}

// PDF-safe text: strip emoji, decorative unicode, and glyphs outside NotoSansKR/Uniform coverage.
// Prevents tofu boxes in generated PDFs.
function pdfSafeText(str) {
  if (typeof str !== 'string') return '';
  let s = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Strip emoji (Emoticons, Misc Symbols & Pictographs, Transport, Supplemental Symbols, Flags)
  s = s.replace(/[\u{1F300}-\u{1FAFF}]/gu, '');
  s = s.replace(/[\u{2600}-\u{27BF}]/gu, ''); // Misc symbols, dingbats, arrows
  s = s.replace(/[\u{2300}-\u{23FF}]/gu, ''); // Misc technical
  s = s.replace(/[\u{1F000}-\u{1F2FF}]/gu, ''); // Mahjong/Domino/Playing cards
  // Strip variation selectors that can break glyph shaping
  s = s.replace(/[\uFE00-\uFE0F]/g, '');
  // Strip zero-width joiners (cause issues with family/profession emoji)
  s = s.replace(/[\u200B-\u200F\u2028-\u202F\u205F-\u206F]/g, '');
  // Collapse multiple whitespace from emoji removal
  s = s.replace(/ {2,}/g, ' ').trim();
  return s;
}

const FONT_DIR = path.join(__dirname, 'fonts');
const LOGO_WHITE = path.join(FONT_DIR, 'dstrict_CI_WHITE.png');
const LOGO_BLACK = path.join(FONT_DIR, 'dstrict_CI_BLACK.png');
const PDF_TIMEOUT = 20000; // 20s for AI translation fetch
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB safety limit

async function pdfFetch(url, opts) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), PDF_TIMEOUT);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let d; try { d = await r.json(); } catch(_) { throw new Error('Invalid JSON response'); }
    return d;
  } catch(e) {
    if (e.name === 'AbortError') throw new Error(`Timeout (>${PDF_TIMEOUT}ms)`);
    throw e;
  } finally { clearTimeout(id); }
}

// ── AI-powered Korean translation for free-text fields ──
async function translateFieldsToKorean(texts) {
  if(!texts.length) return {};
  // Try Gemini first, then Groq, then Mistral
  const GEMINI_KEY = process.env.GEMINI_KEY || '';
  const GROQ_KEY = process.env.GROQ_KEY || '';
  const MISTRAL_KEY = process.env.MISTRAL_KEY || '';

  // Deduplicate and prepare batch
  const unique = [...new Set(texts.filter(t=>t&&t.length>2))];
  if(!unique.length) return {};

  // Build numbered list for batch translation
  const numbered = unique.map((t,i)=>`${i+1}. ${t}`).join('\n');
  const prompt = `You are a professional Korean translator specializing in AV/IT technical operations for d'strict (immersive media company).

Translate the following English technical error log entries into professional Korean. These are from a technical operations error report.

Rules:
- Translate ONLY the descriptive text. Keep proper nouns, model numbers, technical codes (IP, PC.xxx, HDMI, LED, etc.) as-is.
- Use formal Korean technical writing style (기술 보고서체).
- Keep translations concise - similar length to the original.
- "reboot/restart" = "재부팅", "replace" = "교체", "update/upgrade" = "업데이트", "check/inspect" = "점검"
- "flickering" = "플리커링", "freezing" = "프리징", "black screen" = "블랙스크린", "no signal" = "신호 없음"
- Device naming conventions: keep as-is (e.g., "T-t-pc-006" stays "T-t-pc-006")
- Return ONLY the numbered translations, one per line, matching the input numbering exactly.
- Do NOT add explanations or notes.

Input:
${numbered}`;

  try {
    let result = '';
    if(GEMINI_KEY) {
      const data = await pdfFetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,maxOutputTokens:4096}})
      });
      result = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if(GROQ_KEY) {
      const data = await pdfFetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+GROQ_KEY},
        body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],temperature:0.2,max_tokens:4096})
      });
      result = data?.choices?.[0]?.message?.content || '';
    } else if(MISTRAL_KEY) {
      const data = await pdfFetch('https://api.mistral.ai/v1/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+MISTRAL_KEY},
        body:JSON.stringify({model:'mistral-small-latest',messages:[{role:'user',content:prompt}],temperature:0.2,max_tokens:4096})
      });
      result = data?.choices?.[0]?.message?.content || '';
    } else {
      console.log('No AI API key available for Korean translation');
      return {};
    }

    // Parse numbered results back into a map
    const map = {};
    const lines = result.split('\n').filter(l=>l.trim());
    lines.forEach(line=>{
      const m = line.match(/^(\d+)\.\s*(.+)/);
      if(m){
        const idx = parseInt(m[1])-1;
        if(idx>=0 && idx<unique.length) map[unique[idx]] = m[2].trim();
      }
    });
    console.log(`✅ AI Korean translation: ${Object.keys(map).length}/${unique.length} fields translated`);
    return map;
  } catch(e) {
    console.warn('AI translation failed:', e.message);
    return {};
  }
}

function generatePDF(logs, month, year, lang, history, assets, reportType, region, comment, branchFilter, customTitle) {
  if (!Array.isArray(logs)) throw new Error('logs must be an array');
  month = Math.max(0, Math.min(11, parseInt(month, 10) || 0));
  year = Math.max(2000, Math.min(2100, parseInt(year, 10) || new Date().getFullYear()));
  lang = ['en','ko'].includes(lang) ? lang : 'en';
  history = Array.isArray(history) ? history : [];
  assets = Array.isArray(assets) ? assets : [];
  reportType = reportType === 'annual' ? 'annual' : 'monthly'; // default monthly
  region = ['korea','global'].includes(region) ? region : 'global';
  // pdfSafeText removes emoji/decorative unicode in addition to control chars
  const safeComment = pdfSafeText(typeof comment === 'string' ? comment.trim() : '').slice(0, 2000);
  const safeTitle = pdfSafeText(typeof customTitle === 'string' ? customTitle.trim() : '').slice(0, 200);
  branchFilter = typeof branchFilter === 'string' ? branchFilter.trim().toUpperCase() : '';
  // Validate branchFilter against known branches
  if (branchFilter && !ALL_BRANCHES.includes(branchFilter)) branchFilter = '';
  // When single-branch report: restrict PDF_BRANCHES to just that branch
  const PDF_BRANCHES = branchFilter
    ? [branchFilter]
    : (region === 'korea' ? KOREA_BRANCHES : GLOBAL_BRANCHES);

  // If Korean, translate IssueDetail and ActionTaken via AI before PDF generation
  const translationReady = (lang === 'ko')
    ? (async () => {
        const md = logs.filter(r => { const p=(r.Date||'').split('-'); return parseInt(p[0])===year && parseInt(p[1])===month+1; });
        const textsToTranslate = [];
        md.forEach(r => {
          if(r.IssueDetail) textsToTranslate.push(r.IssueDetail);
          if(r.ActionTaken) textsToTranslate.push(r.ActionTaken);
        });
        return translateFieldsToKorean(textsToTranslate);
      })()
    : Promise.resolve({});

  return translationReady.then(koMap => new Promise((resolve, reject) => {
    // Korean text translator function (uses AI map with fallback to original)
    // ── Static Korean translation dictionary for common tech error terms ──
    const _koStatic = {
      // Actions
      'restarted system':'시스템 재부팅','restarted the system':'시스템 재부팅 완료',
      'restarted pc':'PC 재시작','restarted pcs':'PC 재시작','restarted all pcs':'전체 PC 재시작',
      'restarted server':'서버 재시작','restarted media server':'미디어 서버 재시작',
      'restarted the projector':'프로젝터 재시작 완료','restarted projector':'프로젝터 재시작',
      'restarted application':'애플리케이션 재시작','restarted content':'콘텐츠 재시작',
      'restart all pcs using bms tool':'BMS 도구로 전체 PC 재시작',
      'restart both the projectors and pcs':'프로젝터 및 PC 전부 재시작',
      'restart it from the server room':'서버실에서 재시작',
      'rebooted':'재부팅','rebooted system':'시스템 재부팅',
      'manually restart':'수동 재시작','manually restarted':'수동 재시작 완료',
      'manually relaunched':'수동 재실행','manual restart':'수동 재시작',
      'power cycled':'전원 재시작','power cycled pcs':'PC 전원 재시작',
      'power cycled the projector':'프로젝터 전원 재시작','power cycle':'전원 재시작',
      'temporary restart applied':'임시 재시작 적용','temporary restart':'임시 재시작',
      'replaced cable':'케이블 교체','replaced hdmi cable':'HDMI 케이블 교체',
      'replaced network cable':'네트워크 케이블 교체','replaced':'교체 완료',
      'replaced projector lamp':'프로젝터 램프 교체','replaced lamp':'램프 교체',
      'replaced filter':'필터 교체','replaced fan':'팬 교체',
      'firmware update':'펌웨어 업데이트','firmware updated':'펌웨어 업데이트 완료',
      'reinstalled':'재설치','reinstalled software':'소프트웨어 재설치',
      'reconfigured':'재설정','reconfigured network':'네트워크 재설정',
      'reset router':'라우터 초기화','reset switch':'스위치 초기화',
      'reset the projector':'프로젝터 리셋','factory reset':'공장 초기화',
      'reconnected':'재연결','reconnected cable':'케이블 재연결',
      'force closed':'강제 종료','force quit':'강제 종료',
      'closed the projector':'프로젝터 셔터 닫음',
      'fixed from the echo touch controller':'Echo Touch 컨트롤러에서 수정',
      'fixed':'수정 완료','fixed the issue':'장애 수정 완료','fixed remotely':'원격 수정 완료',
      'used bms to make sure projector was turned on':'BMS로 프로젝터 정상 작동 확인',
      'after boot-up started, content audio playback returned':'부팅 후 콘텐츠 오디오 재생이 복구됨',
      'collect crash dumps if frequent':'빈번 시 크래시 덤프 수집',
      'escalated to vendor':'벤더에 에스컬레이션','escalated to hq':'본사에 에스컬레이션',
      'recovered via restart':'재시작으로 복구','recovered via power cycle':'전원 재시작으로 복구',
      'relaunched content':'콘텐츠 재실행','cleared cache':'캐시 삭제',
      // Issues
      'no signal':'신호 없음','no input signal':'입력 신호 없음','signal lost':'신호 유실',
      'black screen':'블랙스크린','blank screen':'빈 화면','white screen':'화이트스크린',
      'flickering':'플리커링','screen flickering':'화면 플리커링',
      'output flickered intermittently':'출력이 간헐적으로 플리커링 발생',
      'intermittent flickering':'간헐적 플리커링',
      'freezing':'프리징','system freeze':'시스템 프리징','intermittent system freeze':'간헐적 시스템 멈춤',
      'audio not working':'오디오 작동 불가','no audio':'오디오 없음','no sound':'소리 없음',
      'audio subscriptions':'오디오 서브스크립션',
      "subscriptions weren't recognized":"서브스크립션이 인식되지 않음",
      "weren't recognized":'인식되지 않음',"didn't recognize":'인식하지 못함',
      'network disconnected':'네트워크 연결 끊김','network down':'네트워크 다운',
      'overheating':'과열','projector overheating':'프로젝터 과열',
      'was having issues projecting':'프로젝션 장애 발생',
      'was not projecting content':'콘텐츠 프로젝션 불가',
      'having issues connecting to content':'콘텐츠 연결 장애',
      'only a black screen was shown':'블랙스크린만 표시됨',
      'content was green':'콘텐츠가 녹색으로 표시됨',
      'went out':'작동 중단','panel went out':'패널 작동 중단',
      'led panel went out':'LED 패널 작동 중단',
      'projector malfunction':'프로젝터 오작동','projector not working':'프로젝터 작동 불가',
      'content not working':'콘텐츠 작동 불가','content not showing':'콘텐츠 표시 불가',
      "contents didn't show":"콘텐츠가 표시되지 않음",
      "the content is not working":"콘텐츠가 작동하지 않음",
      'was glitching':'글리치 발생','glitching':'글리치 발생','glitch':'글리치',
      'app crash/glitch':'앱 크래시/글리치','app crash':'앱 크래시',
      'from bms is off and can not turn on':'BMS에서 꺼져 있으며 켤 수 없음',
      'can not turn on':'전원 켤 수 없음','not turning on':'전원 켜지지 않음',
      // Equipment
      'projector':'프로젝터','led panel':'LED 패널','led wall':'LED 월',
      'media server':'미디어 서버','display':'디스플레이','speaker':'스피커',
      'controller':'컨트롤러','sensor':'센서','router':'라우터','switch':'스위치',
      'server room':'서버실','in server room':'서버실에서','from server room':'서버실에서',
      // Status / HQ
      'outputs on':'에 대한 출력','content audio playback returned':'콘텐츠 오디오 재생 복구',
      'boot-up started':'부팅 완료','on dante network':'Dante 네트워크에서',
      'immersive display pro':'Immersive Display Pro','which were':'해당 장치:',
      'inspect internal heat/filters':'내부 열/필터 점검',
      'report to hq if symptoms recur':'증상 재발 시 본사에 보고',
      'keep monitoring':'지속 모니터링','continue monitoring':'지속 모니터링',
      'check firmware version':'펌웨어 버전 확인','check cable connections':'케이블 연결 상태 확인',
      'contact vendor':'벤더 연락','schedule vendor visit':'벤더 방문 예약',
      'needs further investigation':'추가 조사 필요','temporary fix':'임시 조치',
      'working normally':'정상 작동','back to normal':'정상 복귀',
      'intermittent':'간헐적','intermittently':'간헐적으로',
      'café counter wall':'카페 카운터 월','counter wall':'카운터 월',
    };
    function _trStatic(text) {
      if(!text || !isKo) return text;
      let r = text;
      const lo = text.toLowerCase().trim();
      for(const [en, ko] of Object.entries(_koStatic)) { if(lo === en.toLowerCase()) return ko; }
      for(const [en, ko] of Object.entries(_koStatic)) {
        const re = new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        r = r.replace(re, ko);
      }
      return r;
    }
    const trText = (v) => (lang==='ko' && koMap[v]) ? koMap[v] : _trStatic(v);
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

    // ── Register d'strict Uniform fonts ──
    try {
      doc.registerFont('UBlack', path.join(FONT_DIR, 'Uniform Black.otf'));
      doc.registerFont('UBold', path.join(FONT_DIR, 'Uniform Bold.otf'));
      doc.registerFont('UMedium', path.join(FONT_DIR, 'Uniform Medium.otf'));
      doc.registerFont('UReg', path.join(FONT_DIR, 'Uniform.otf'));
      doc.registerFont('ULight', path.join(FONT_DIR, 'Uniform Light.otf'));
    } catch(e) {
      console.warn('Font registration fallback to Helvetica:', e.message);
      doc.registerFont('UBlack', 'Helvetica-Bold');
      doc.registerFont('UBold', 'Helvetica-Bold');
      doc.registerFont('UMedium', 'Helvetica');
      doc.registerFont('UReg', 'Helvetica');
      doc.registerFont('ULight', 'Helvetica');
    }

    // ── Register Korean font (NotoSansKR) — MUST succeed for bilingual safety ──
    let hasKR = false;
    try {
      doc.registerFont('KRBold', path.join(FONT_DIR, 'NotoSansKR-Bold.otf'));
      doc.registerFont('KRMedium', path.join(FONT_DIR, 'NotoSansKR-Medium.otf'));
      doc.registerFont('KRLight', path.join(FONT_DIR, 'NotoSansKR-Light.otf'));
      doc.registerFont('KRBlack', path.join(FONT_DIR, 'NotoSansKR-Black.otf'));
      hasKR = true;
    } catch(e) {
      console.error('[PDF] Korean font registration failed:', e.message);
    }

    // Landscape A4: 841.89 × 595.28 pt. Margins left/right 22, top 20.
    const PW = 797, ML = 22, MR = 819, BOT = 558;

    const isKo = lang === 'ko';

    // CRITICAL: NotoSansKR has full Latin + Korean coverage.
    // Uniform has ONLY Latin glyphs → renders tofu on any Korean char.
    // Strategy:
    //   - Body text (reg/med/light) → ALWAYS NotoSansKR (safe for both languages)
    //   - Display/bold/black → NotoSansKR when lang=ko OR data may contain Korean
    //     (branch names, zone names, user comments can be Korean even in lang=en reports)
    //   - Uniform reserved for English-only brand elements (KPI digits, d'strict ID)
    const F = {
      black:    hasKR ? 'KRBlack'  : 'UBlack',
      bold:     hasKR ? 'KRBold'   : 'UBold',
      med:      hasKR ? 'KRMedium' : 'UMedium',
      reg:      hasKR ? 'KRMedium' : 'UReg',
      light:    hasKR ? 'KRLight'  : 'ULight',
      // English-only brand fonts (use only when content is guaranteed ASCII)
      brandBlk: 'UBlack',
      brandBld: 'UBold',
      brandReg: 'UReg',
      // Legacy aliases for compatibility — still use safe Korean-capable fonts
      _brandBlack: (isKo && hasKR) ? 'KRBlack' : 'UBlack',
      _brandBold:  (isKo && hasKR) ? 'KRBold'  : 'UBold',
      _brandMed:   (isKo && hasKR) ? 'KRMedium': 'UMedium',
      _brandReg:   (isKo && hasKR) ? 'KRMedium': 'UReg',
      _brandLight: (isKo && hasKR) ? 'KRLight' : 'ULight',
    };

    // Bilingual labels
    const L = isKo ? {
      title: 'MONTHLY ERROR REPORT', subtitle: 'SUMMARY',
      coverTitle: '',
      coverSub: '',
      generated: '보고서 생성일',
      execSummary: '요약 보고', branchPerf: '지점별 성과',
      catDiff: '유형별 및 난이도 분석', topZones: '주요 영향 Zone',
      critIncidents: '주요 장애 심층 분석', recommendations: '권고 사항 및 조치 계획',
      total: 'TOTAL', critical: 'CRITICAL', incidents: '건',
      noIncidents: '해당 월 장애 발생 없음. 전 지점 시스템 정상 운영 중.',
      branchBreakdown: '지점별 현황',
      keyFindings: '핵심 발견 사항',
      critAlert: '건의 중대 장애 발생 -- 즉각적인 경영진 확인 필요.',
      noCrit: '크리티컬 장애 미발생. 전 지점 정상 운영 파악됨.',
      resolution: '처리 성과', avgMin: '평균', maxMin: '최대', avgDiff: '평균 난이도',
      slowWarn: '평균 처리 시간이 60분 목표를 초과했습니다. 에스컬레이션 프로세스 검토가 필요합니다.',
      catChanges: '전월 대비 유형별 변화',
      momUp: '전월 대비 증가', momDown: '전월 대비 감소', momFlat: '전월 대비 변동 없음',
      mostAffected: '최다 발생 Zone', primaryCat: '주요 유형',
      highestVolume: '최다 발생 지점',
      noData: '데이터 없음.', incidentCategories: '장애 유형별 분류',
      diffDistribution: '난이도 분포',
      unit: '', branchDetail: '지점별 상세 분석 및 추이',
      errorTrend: '에러 추이', zoneDetail: 'Zone별 상세 현황',
      actionTaken: '조치 내역', causeAnalysis: '원인 분석',
      troubleshooting: '트러블슈팅', hqComment: '본사 코멘트',
      noIncMonth: '해당 월 장애 발생 없음.',
      ytdTitle: '연간 누적 에러 현황',
    } : {
      title: 'MONTHLY ERROR REPORT', subtitle: 'SUMMARY',
      coverTitle: '',
      coverSub: '',
      generated: 'Generated',
      execSummary: 'Executive Summary', branchPerf: 'Branch Performance',
      catDiff: 'Category & Difficulty Analysis', topZones: 'Top Affected Zones',
      critIncidents: 'Critical Errors -- Deep Analysis', recommendations: 'Recommendations & Action Items',
      total: 'TOTAL', critical: 'CRITICAL', incidents: 'errors',
      noIncidents: 'No errors recorded. All systems operational across 3 branches.',
      branchBreakdown: 'Branch Breakdown',
      keyFindings: 'Key Findings',
      critAlert: 'critical error(s) detected -- immediate management attention required.',
      noCrit: 'No critical errors. Operational stability maintained across all branches.',
      resolution: 'Resolution Performance', avgMin: 'Avg', maxMin: 'Max', avgDiff: 'Avg Difficulty',
      slowWarn: 'Average resolution time exceeds 60-minute target. Escalation process review recommended.',
      catChanges: 'Category Changes vs Last Month',
      momUp: 'increase vs previous month', momDown: 'decrease vs previous month', momFlat: 'Unchanged vs previous month',
      mostAffected: 'Most Affected Zone', primaryCat: 'Primary Category',
      highestVolume: 'highest volume branch',
      noData: 'No data available.', incidentCategories: 'ERROR CATEGORIES',
      diffDistribution: 'DIFFICULTY DISTRIBUTION',
      unit: '', branchDetail: 'Branch Details & Trends',
      errorTrend: 'Error Trends', zoneDetail: 'Details -- Errors by Zone',
      actionTaken: 'Action Taken', causeAnalysis: 'Cause Analysis',
      troubleshooting: 'Troubleshooting', hqComment: 'HQ Comment',
      noIncMonth: 'No errors this month.',
      ytdTitle: 'YTD Error Count',
    };

    // Korean table headers and labels (only used when isKo is true)
    const H = isKo ? {
      branch: '지점', thisMonth: '당월', lastMonth: '전월', change: '증감', pctTotal: '비율',
      metric: '항목', value: '수치', status: '상태',
      category: '유형', pctShare: '비율', trend: '추이',
      rank: '순위', zone: 'Zone', count: '건수', pct: '비율', primaryCat: '주요 유형',
      total: '합계', hardware: '하드웨어', software: '소프트웨어', network: '네트워크', other: '기타',
      primaryIssue: '주요 장애 내용', actionTaken: '조치 내용',
      distribution: '분포', mom: '전월비', level: '등급', severity: '심각도',
      topCat: '주요 유형', avgDiff: '평균 난이도',
      date: '일자', difficulty: '난이도', duration: '소요시간', solvedBy: '처리자',
      overview: '주요 장애 현황', detailedAnalysis: '상세 분석',
      priority: '우선순위', recommendation: '권고사항',
      prevYrAvg: '전년 월평균', curYrAvg: '당년 월평균', curYrTotal: '당년 누적',
      sev: {1: '경미', 2: '보통', 3: '주의', 4: '위험', 5: '심각'},
      avgResTime: '평균 처리시간', maxResTime: '최대 처리시간', avgDiffLabel: '평균 난이도', critLabel: '위험 장애(Lv.4+)',
      overTarget: '목표 초과', high: '높음', normal: '정상', elevated: '주의', attention: '주의 필요', clear: '양호', ok: '양호',
      up: '증가', down: '감소', flat: '동일',
      critAlertText: ' 건의 위험 장애가 감지되었습니다. 즉각적인 경영진 확인이 필요합니다.',
      noCritText: '금월 크리티컬(Lv.4+) 장애 미발생 — 전 지점 정상 운영 파악됨.',
      errAtDiff: '건의 Difficulty 4+ 장애가 발생하여 경영진의 주의가 필요합니다.',
      noCritMonth: '이번 달 위험 장애 없음. 시스템 안정성이 유지되고 있습니다.',
      recZone: ' 에서 총 {cnt}건({pct}%)의 장애가 발생했습니다. 집중 예방 정비 및 근본 원인 조사를 권고합니다.',
      recCritical: ' 건의 Difficulty 4+ 장애 발생. 5영업일 이내 근본 원인 분석 및 시정 조치 계획 수립이 필요합니다.',
      recNoCrit: '위험 장애 없음. 현행 운영 절차가 효과적으로 작동 중입니다.',
      recTrendUp: '전월 대비 {d}건 증가(+{pct}%). 증가 원인에 대한 조사가 필요합니다.',
      recTrendDown: '전월 대비 {d}건 감소(-{pct}%). 긍정적 추이입니다.',
      recResponse: '평균 처리시간 {avg}분으로 60분 목표를 초과하고 있습니다. 에스컬레이션 절차 점검이 필요합니다.',
      tipSW: '펌웨어/소프트웨어 업데이트 주기 및 버전 점검을 권고합니다.',
      tipHW: '하드웨어 점검 일정 및 예비 부품 확인을 권고합니다.',
      tipNet: '네트워크 인프라 및 연결성 점검을 권고합니다.',
      catPctText: ' 유형이 전체의 {pct}%를 차지합니다. ',
      branchPerfSummary: '지점별 성과 요약',
      resolutionPerf: '처리 성과',
      catComparison: '유형별 전월 대비 비교',
      topAffectedZones: '주요 장애 발생 Zone',
      incidentCategories: '장애 유형별 분류',
      diffDistribution: '난이도 분포',
      errorTrends: '에러 추이',
      categoryBreakdown: '유형별 분류',
      causeAnalysis: '원인 분석',
      troubleshooting: '트러블슈팅',
      synthesizedAnalysis: '종합 분석 (이력 + 본사)',
      critErrorsOverview: '위험 장애 현황',
      detailedAnalysisTitle: '상세 분석',
      noCriticalMonth: '이번 달 위험 장애 없음. 시스템이 안정적으로 운영 중입니다.',
    } : {
      branch: 'Branch', thisMonth: 'This Month', lastMonth: 'Last Month', change: 'Change', pctTotal: '% of Total',
      metric: 'Metric', value: 'Value', status: 'Status',
      category: 'Category', pctShare: '% Share', trend: 'Trend',
      rank: '#', zone: 'Zone', count: 'Count', pct: '%', primaryCat: 'Primary Category',
      total: 'TOTAL', hardware: 'HARDWARE', software: 'SOFTWARE', network: 'NETWORK', other: 'OTHER',
      primaryIssue: 'Primary Issue', actionTaken: 'Action Taken',
      distribution: 'Distribution', mom: 'MoM', level: 'Level', severity: 'Severity',
      topCat: 'Top Category', avgDiff: 'Avg Diff',
      date: 'Date', difficulty: 'Difficulty', duration: 'Duration', solvedBy: 'Solved By',
      overview: 'CRITICAL ERRORS OVERVIEW', detailedAnalysis: 'DETAILED ANALYSIS',
      priority: 'Priority', recommendation: 'Recommendation',
      prevYrAvg: null, curYrAvg: null, curYrTotal: null,
      sev: {1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical', 5: 'Severe'},
      avgResTime: 'Avg Resolution Time', maxResTime: 'Max Resolution Time', avgDiffLabel: 'Avg Difficulty', critLabel: 'Critical (Diff 4+)',
      overTarget: 'OVER TARGET', high: 'HIGH', normal: 'NORMAL', elevated: 'ELEVATED', attention: 'ATTENTION', clear: 'CLEAR', ok: 'OK',
      up: 'UP', down: 'DOWN', flat: 'FLAT',
      critAlertText: ' critical error(s) detected -- immediate management attention required.',
      noCritText: 'No critical errors. Operational stability maintained across all branches.',
      errAtDiff: ' Difficulty 4+ error(s) detected. Management attention required.',
      noCritMonth: 'No critical errors this month.',
      recZone: ' accounts for {cnt} ({pct}%) of errors. Preventive maintenance recommended.',
      recCritical: ' Difficulty 4+ error(s) detected. Root cause analysis and remediation plan required within 5 business days.',
      recNoCrit: 'No critical errors. Current operational procedures are operating effectively.',
      recTrendUp: 'Increase of {d} ({pct}%) vs. previous month. Investigation of the cause is needed.',
      recTrendDown: 'Decrease of {d} ({pct}%) vs. previous month. Positive trend.',
      recResponse: 'Average resolution time of {avg} minutes exceeds the 60-minute target. Escalation process review is needed.',
      tipSW: 'Firmware/software update schedule and version verification recommended.',
      tipHW: 'Hardware inspection schedule and spare parts verification recommended.',
      tipNet: 'Network infrastructure and connectivity inspection recommended.',
      catPctText: ' category accounts for {pct}% of errors. ',
      branchPerfSummary: 'BRANCH PERFORMANCE SUMMARY',
      resolutionPerf: 'RESOLUTION PERFORMANCE',
      catComparison: 'CATEGORY COMPARISON (MoM)',
      topAffectedZones: 'TOP AFFECTED ZONES',
      incidentCategories: 'ERROR CATEGORIES',
      diffDistribution: 'DIFFICULTY DISTRIBUTION',
      errorTrends: 'Error Trends',
      categoryBreakdown: 'Category Breakdown',
      causeAnalysis: 'Cause Analysis',
      troubleshooting: 'Troubleshooting',
      synthesizedAnalysis: 'SYNTHESIZED ANALYSIS (History + HQ)',
      critErrorsOverview: 'CRITICAL ERRORS OVERVIEW',
      detailedAnalysisTitle: 'DETAILED ANALYSIS',
      noCriticalMonth: 'No critical errors this month. System operating reliably.',
    };

    // ── Korean translation helper for Table_HQ data values ──
    const koCategory = {'Software':'소프트웨어','Hardware':'하드웨어','Network':'네트워크','Other':'기타','etc':'기타'};
    const koActionType = {'On-Site':'현장 대응','On-site':'현장 대응','Remote':'원격 지원','remote':'원격 지원','on-site':'현장 대응'};
    const koTimeTaken = (t) => {
      if(!t) return '--';
      const h=t.match(/(\d+)\s*h/i), m=t.match(/(\d+)\s*m/i);
      let parts=[];
      if(h) parts.push(h[1]+'시간');
      if(m) parts.push(m[1]+'분');
      if(parts.length) return parts.join(' ');
      const n=parseInt(t);
      return n>0 ? n+'분' : t;
    };
    function trCat(v) { return isKo ? (koCategory[(v||'').trim()] || v) : v; }
    function trAction(v) { return isKo ? (koActionType[(v||'').trim()] || v) : v; }
    function trTime(v) { return isKo ? koTimeTaken(v) : v; }

    const monName = MONTHS_EN[month], monShort = monName.slice(0,3), yrShort = String(year).slice(2);

    // ── DATA ──
    const md = logs.filter(r => { const p=(r.Date||'').split('-'); return parseInt(p[0])===year && parseInt(p[1])===month+1; });

    // ── Data normalization: unify Zone/Category labels (Garden vs GARDEN, etc.) ──
    function normLbl(s) {
      if(!s) return '';
      s = s.trim().replace(/\s+/g,' ');
      // All-caps words → Title Case (GARDEN→Garden, FLOWER→Flower, TEABAR→Teabar)
      if(/^[A-Z0-9][A-Z0-9\s()\-\/\.]+$/.test(s)) {
        s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
              .replace(/\b([a-z])/g, (_,c) => c.toUpperCase());
      }
      return s;
    }
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
    // Normalize raw data in place
    md.forEach(r=>{
      if(r.Zone)     r.Zone     = normLbl(r.Zone);
      if(r.Category) r.Category = normLbl(r.Category);
    });

    const total = md.length;
    const brCount = {}; md.forEach(r => { brCount[r.Branch]=(brCount[r.Branch]||0)+1; });
    const catCount  = buildFolded(md, r=>r.Category, 'Other');
    const zoneCount = buildFolded(md, r=>r.Zone,     'Unknown');
    const critical = md.filter(r => r.Difficulty >= 4);
    const diffCount = {}; md.forEach(r => { diffCount[r.Difficulty]=(diffCount[r.Difficulty]||0)+1; });
    const avgDiff = total ? (md.reduce((s,r)=>s+(r.Difficulty||1),0)/total).toFixed(1) : '0.0';
    function parseMins(t) { if(!t)return 0; const h=t.match(/(\d+)\s*h/i),m=t.match(/(\d+)\s*m/i); let v=0; if(h)v+=parseInt(h[1])*60; if(m)v+=parseInt(m[1]); if(!v){const n=parseInt(t);if(n>0)v=n;} return v; }
    const withTime = md.filter(r=>parseMins(r.TimeTaken)>0);
    const avgRes = withTime.length ? Math.round(withTime.reduce((s,r)=>s+parseMins(r.TimeTaken),0)/withTime.length) : 0;
    const maxRes = withTime.length ? Math.max(...withTime.map(r=>parseMins(r.TimeTaken))) : 0;
    const prevMo = month===0?11:month-1, prevYr = month===0?year-1:year;
    const prevMd = logs.filter(r => { const p=(r.Date||'').split('-'); return parseInt(p[0])===prevYr && parseInt(p[1])===prevMo+1; });
    const prevTotal = prevMd.length, prevCrit = prevMd.filter(r=>r.Difficulty>=4).length;
    // Previous month category/zone for comparison
    const prevCatCount = {}; prevMd.forEach(r=>{prevCatCount[normLbl(r.Category)||'Other']=(prevCatCount[normLbl(r.Category)||'Other']||0)+1;});
    const prevBrCount = {}; prevMd.forEach(r=>{prevBrCount[r.Branch]=(prevBrCount[r.Branch]||0)+1;});

    // ── Similar history finder (equipment GROUP + keyword matching) ──
    function findSimilar(zone, cat, issue) {
      // Equipment groups: map specific keywords -> group name
      const devGroups = {
        audio:     ['audio','sound','dante','soundcard','speaker','amp','amplifier','microphone','mic','volume','mute'],
        projector: ['projector','pj','projection','lens','lamp','throw'],
        pc:        ['pc','computer','workstation','nuc','desktop','ndisplay','ndi','unreal'],
        led:       ['led','led wall','led panel','led module','pixel'],
        display:   ['display','monitor','screen','lcd','oled','tv'],
        network:   ['network','switch','router','ethernet','wifi','ip','dns','dhcp','lan','wan','vlan','fiber'],
        media:     ['media server','media player','watchout','disguise','resolume','d3','notch'],
        sensor:    ['sensor','lidar','kinect','tracking','camera','ir'],
        controller:['controller','dmx','artnet','lighting','plc','crestron','extron','bms'],
        server:    ['server','nas','raid','storage','backup'],
        power:     ['power','ups','pdu','breaker','outlet','surge'],
      };
      function getGroup(txt) {
        const lt=(txt||'').toLowerCase();
        for(const [grp,keys] of Object.entries(devGroups)) {
          for(const k of keys) { if(lt.includes(k)) return grp; }
        }
        if(/\b(pc|pj)\b/i.test(lt)) return /pj/i.test(lt)?'projector':'pc';
        return null;
      }
      const issueGrp = getGroup(issue);
      const tok = (t) => (t||'').toLowerCase().replace(/[^a-z0-9]/g,' ').split(/\s+/).filter(w=>w.length>2);
      const it = tok(issue);
      return history.map(h => {
        let s=0;
        // Equipment group match (highest priority)
        const hGrp=getGroup(h.detail);
        if(issueGrp && hGrp && issueGrp===hGrp) s+=5;
        // Category match (broad, lower weight)
        if((h.cat||'').toLowerCase()===(cat||'').toLowerCase()) s+=2;
        // Keyword overlap (symptom/detail matching)
        const ht=tok(h.detail);
        it.forEach(t=>{if(ht.some(w=>w.includes(t)||t.includes(w)))s+=2;});
        return {h,score:s};
      }).filter(x=>x.score>=4).sort((a,b)=>b.score-a.score).slice(0,5).map(x=>x.h);
    }

    // ── d'strict COLORS ──
    const CP='#534AB7', CT='#1a1a18', CS='#73726c', COK='#3B6D11', CE='#A32D2D', CW='#854F0B', CL='#e8e6df';
    const CBG='#f6f5f0', CCARD='#ffffff';
    const catCols = ['#534AB7','#185FA5','#993C1D','#854F0B','#3B6D11','#A32D2D','#0F6E56','#0891b2'];
    const diffCols = {1:'#a3a29c',2:'#185FA5',3:'#854F0B',4:'#993C1D',5:'#A32D2D'};

    // ── HELPERS ──
    // Track which pages have real content (for footer rendering)
    const _contentPages = new Set();
    function _markPage() {
      const pgIdx = doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;
      if(doc.y > 80) _contentPages.add(pgIdx);
    }
    // ── d'strict watermark on every content page ──
    const _hasLogoBlack = require('fs').existsSync(LOGO_BLACK);
    const _hasLogoWhite = require('fs').existsSync(LOGO_WHITE);
    function _drawPageBranding() {
      doc.save();
      // Top-left mini CI logo
      try { if(_hasLogoBlack) doc.image(LOGO_BLACK, ML, 10, {width:56}); } catch(_) {}
      doc.fillColor(CS).fontSize(7).font(F.light).text("Error Report", ML+62, 14, {lineBreak:false});
      // Top accent line
      doc.moveTo(ML, 28).lineTo(MR, 28).strokeColor(CL).lineWidth(0.5).stroke();
      // Diagonal watermark — centre of landscape A4 (421, 297)
      doc.save();
      doc.opacity(0.02);
      doc.translate(421, 297);
      doc.rotate(-35, {origin:[0,0]});
      try { if(_hasLogoBlack) doc.image(LOGO_BLACK, -160, -25, {width:320}); } catch(_) {}
      doc.restore();
      doc.restore();
      doc.y = 32;
    }
    function pc(need) {
      if(doc.y+(need||60)>BOT) {
        _markPage(); // mark current page before leaving
        doc.addPage();
        _drawPageBranding();
      }
    }
    function trend(c,p) { if(!p&&!c)return '--'; if(!p)return '+'+c; const d=c-p,pct=Math.round(Math.abs(d)/p*100); return d>0?'+'+d+' (+'+pct+'%)':d<0?d+' (-'+pct+'%)':'0'; }
    function trendDir(c,p) { if(!p)return 'new'; const d=c-p; return d>0?'up':d<0?'down':'flat'; }

    function sect(n, title) {
      _markPage();
      // New page only when truly out of space (less than 160pt left)
      if(doc.y > BOT - 160) {
        doc.addPage();
        _drawPageBranding();
      } else if(doc.y > 80) {
        doc.y = doc.y + 8;
      } else {
        doc.y = 32;
      }
      const y = doc.y;
      // Compact section header — 14pt band
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

    // ── GRID ──
    const GAP=7;
    // W2: two halves (395+7+395=797) W23: 2/3+1/3 (530+7+260=797) W4: quarter (194*4+7*3=797)
    const W2=395, W23=530, W23R=260, W4=194;
    const CHIGHLIGHT='#FDE68A';

    // ── SECTION BAND (compact 14pt, numbered) ──
    // KEEP the existing sect() function at line 634 — do not duplicate it

    // ── DRAW HELPERS (NEW) ──

    // Title block (always shown; custom title or generated ID)
    function drawTitleBlock(title, sub) {
      const H=36; const y=doc.y;
      doc.save().rect(ML,y,PW,H).fill('#f6f5f0').restore();
      doc.save().rect(ML,y,PW,3).fill(CP).restore();
      doc.fillColor(CP).fontSize(isKo?12:13).font(F.bold)
         .text(title,ML,y+8,{width:PW,align:'center',lineBreak:false});
      if(sub) doc.fillColor(CS).fontSize(isKo?8:8.5).font(F.med)
         .text(sub,ML,y+24,{width:PW,align:'center',lineBreak:false});
      doc.y=y+H+6; doc.x=ML;
    }

    // 4-up KPI strip
    function drawKPIStrip(items) {
      const n=items.length;
      const colW=Math.floor((PW-GAP*(n-1))/n);
      const kH=isKo?62:58; const y=doc.y;
      items.forEach((item,i)=>{
        const cx=ML+i*(colW+GAP);
        doc.save().roundedRect(cx,y,colW,kH,5).fill(CBG).restore();
        if(item.accent) doc.save().rect(cx,y,3,kH).fill(item.accent).restore();
        doc.fillColor(CS).fontSize(isKo?7.5:8).font(F.med)
           .text(item.label||'',cx+10,y+10,{width:colW-14,align:'center',lineBreak:false});
        const vStr=String(item.value!==undefined?item.value:'–');
        const vFS=vStr.length>5?(isKo?15:16):vStr.length>3?(isKo?18:20):(isKo?22:24);
        doc.fillColor(item.color||CT).fontSize(vFS).font(F.bold)
           .text(vStr,cx+8,y+22,{width:colW-14,align:'center',lineBreak:false});
        if(item.sub!==undefined) doc.fillColor(item.subColor||CS).fontSize(isKo?7:7.5).font(F.med)
           .text(String(item.sub),cx+8,y+kH-13,{width:colW-14,align:'center',lineBreak:false});
      });
      doc.y=y+kH+6; doc.x=ML;
    }

    // Horizontal bar row — returns new Y
    function drawHBar(x,y,colW,label,value,maxValue,color,opts) {
      opts=opts||{};
      const labelW=opts.labelW||55, countW=opts.countW||28, bGap=5;
      const pctW=opts.showPct?24:0;
      const barAreaW=colW-labelW-bGap-countW-(pctW?bGap+pctW:0);
      const rowH=13, barH=9;
      const barY=y+(rowH-barH)/2;
      const fillW=maxValue>0?Math.max(0,Math.round(barAreaW*Math.min(value,maxValue)/maxValue)):0;
      const lbl=(label||'').length>(isKo?13:16)?(label||'').slice(0,isKo?12:15)+'…':(label||'');
      doc.fillColor(CT).fontSize(isKo?7.5:8).font(F.reg)
         .text(lbl,x,y+2,{width:labelW-2,lineBreak:false});
      doc.save().roundedRect(x+labelW+bGap,barY,barAreaW,barH,2).fill(CL).restore();
      if(fillW>0) doc.save().roundedRect(x+labelW+bGap,barY,Math.max(fillW,3),barH,2).fill(color||CP).restore();
      doc.fillColor(CT).fontSize(isKo?7.5:8).font(F.bold)
         .text(String(value),x+labelW+bGap+barAreaW+bGap,y+2,{width:countW,align:'right',lineBreak:false});
      if(opts.showPct&&opts.total>0){
        const pct=Math.round(value/opts.total*100);
        doc.fillColor(CS).fontSize(7).font(F.reg)
           .text(pct+'%',x+labelW+bGap+barAreaW+bGap+countW+3,y+3,{width:pctW-3,lineBreak:false});
      }
      if(opts.delta!==undefined){
        const ds=String(opts.delta);const dc=ds.startsWith('+')?CE:ds.startsWith('-')?COK:CS;
        const dX=x+labelW+bGap+barAreaW+bGap+countW+(pctW?bGap+pctW+4:4);
        doc.fillColor(dc).fontSize(6.5).font(F.med).text(ds,dX,y+3,{lineBreak:false});
      }
      return y+rowH;
    }

    // Horizontal bar group — returns height consumed
    function drawHBarGroup(x,y,colW,items,opts){
      opts=opts||{};
      const maxVal=Math.max(...items.map(i=>i.value),1);
      let cy=y;
      if(opts.title){
        doc.fillColor(CP).fontSize(isKo?8:8.5).font(F.bold).text(opts.title,x,cy,{width:colW,lineBreak:false});
        cy+=13;
      }
      items.forEach(item=>{
        cy=drawHBar(x,cy,colW,item.label,item.value,maxVal,item.color,
                    {labelW:opts.labelW,countW:opts.countW,showPct:opts.showPct,total:opts.total,delta:item.delta});
        cy+=1;
      });
      return cy-y;
    }

    // Vertical trend bar chart — returns height consumed
    function drawVTrend(x,y,w,h,data,opts){
      opts=opts||{};
      let cy=y;
      if(opts.title){
        doc.fillColor(CP).fontSize(isKo?8:8.5).font(F.bold).text(opts.title,x,cy,{width:w,lineBreak:false});
        cy+=13;
      }
      const n=data.length; if(!n){doc.y=y+h;return h;}
      const chartH=h-(opts.title?13:0)-14;
      const maxVal=Math.max(...data,1);
      const slotW=w/n;
      const barW=Math.max(Math.floor(slotW*0.72),3);
      const chartY=cy;
      doc.save().moveTo(x,chartY+chartH+0.5).lineTo(x+w,chartY+chartH+0.5)
         .strokeColor(CL).lineWidth(0.5).stroke().restore();
      data.forEach((val,i)=>{
        const barFillH=Math.max(0,Math.round(chartH*val/maxVal));
        const bx=x+Math.round(i*slotW+(slotW-barW)/2);
        const by=chartY+chartH-barFillH;
        const isHL=opts.highlightIdx!==undefined&&i===opts.highlightIdx;
        if(barFillH>0) doc.save().roundedRect(bx,by,barW,barFillH,2).fill(isHL?CE:(val>0?CP:CL)).restore();
        if(val>0){
          if(barFillH>=14) doc.fillColor('#fff').fontSize(6.5).font(F.bold).text(String(val),bx,by+barFillH/2-4,{width:barW,align:'center',lineBreak:false});
          else if(barFillH>=2) doc.fillColor(CT).fontSize(6.5).font(F.bold).text(String(val),bx-2,by-11,{width:barW+4,align:'center',lineBreak:false});
        }
        if(opts.labels&&opts.labels[i]&&(n<=12||(i%5===0)||i===n-1)){
          doc.fillColor(CS).fontSize(6).font(F.reg).text(String(opts.labels[i]),bx-2,chartY+chartH+3,{width:barW+4,align:'center',lineBreak:false});
        }
      });
      cy=chartY+chartH+14;
      doc.y=cy; return cy-y;
    }

    // Comment block — adaptive height
    function drawCommentBlock(x,y,w,comment){
      const maxChars=420;
      const body=comment.length>maxChars?comment.slice(0,maxChars)+'…':comment;
      const lineEst=Math.ceil(body.length/(isKo?55:70));
      const bodyLineH=isKo?14:13;
      const noticeH=16,padT=10,padB=10;
      const bodyH=Math.max(1,lineEst)*bodyLineH;
      const totalH=Math.min(noticeH+padT+bodyH+padB,108);
      doc.save().roundedRect(x,y,w,totalH,5).fillAndStroke('#FFFBEB','#FDE68A').restore();
      doc.save().rect(x,y,w,noticeH).fill('#FEF3C7').restore();
      doc.save().rect(x,y,4,noticeH).fill('#D97706').restore();
      const ntx=isKo?'※ 담당자가 직접 작성한 코멘트입니다.':'※ This comment was written by the branch manager.';
      doc.fillColor('#92400E').fontSize(7.5).font(F.med).text(ntx,x+10,y+4,{width:w-20,lineBreak:false});
      doc.fillColor('#78350F').fontSize(isKo?9.5:9).font(F.med)
         .text(body,x+12,y+noticeH+padT,{width:w-24,lineBreak:true,height:totalH-noticeH-padT-padB});
      doc.y=y+totalH+6; doc.x=ML; return totalH+6;
    }

    // Critical incident card — returns height consumed
    function drawIncidentCard(x,y,w,incident,idx,totalCards){
      const cardH=74;
      const badgeCol=incident.Difficulty>=5?'#7B0000':CE;
      const brCol=BR_COLORS[incident.Branch]||CP;
      doc.save().roundedRect(x,y,w,cardH,5).fill(CCARD).restore();
      doc.save().rect(x,y,4,cardH).fill(badgeCol).restore();
      doc.save().roundedRect(x,y,w,cardH,5).stroke(CE).restore();
      // Header row
      const badge=incident.Difficulty>=5?(isKo?'심각':'SEVERE'):(isKo?'위험':'CRITICAL');
      let hx=x+10;
      doc.save().roundedRect(hx,y+8,52,14,3).fill(badgeCol).restore();
      doc.fillColor('#fff').fontSize(7).font(F.bold).text(badge,hx,y+11,{width:52,align:'center',lineBreak:false});
      hx+=58;
      doc.save().roundedRect(hx,y+8,50,14,3).fill(brCol).restore();
      doc.fillColor('#fff').fontSize(7).font(F.bold).text(incident.Branch||'',hx,y+11,{width:50,align:'center',lineBreak:false});
      hx+=56;
      doc.fillColor(CS).fontSize(7).font(F.med).text('Zone: ',hx,y+11,{lineBreak:false});
      doc.fillColor(CT).fontSize(7).font(F.bold).text((incident.Zone||'–').slice(0,20),hx+28,y+11,{width:120,lineBreak:false});
      doc.fillColor(CS).fontSize(7).font(F.med).text(incident.Date||'',x+w-80,y+11,{width:72,align:'right',lineBreak:false});
      // Row 2: category + diff + duration
      const catStr=(incident.Category||'Other')+'  ·  Lv.'+(incident.Difficulty||'?');
      doc.fillColor(CS).fontSize(7).font(F.med).text(catStr,x+10,y+28,{lineBreak:false});
      if(incident.TimeTaken) doc.fillColor(CS).fontSize(7).font(F.med)
         .text((isKo?'처리시간:':'Duration: ')+incident.TimeTaken,x+w-100,y+28,{width:92,align:'right',lineBreak:false});
      // Row 3: issue detail
      const detail=pdfSafeText(trText(incident.IssueDetail||'')).slice(0,90);
      doc.fillColor(CT).fontSize(isKo?8:8.5).font(F.med)
         .text(detail,x+10,y+44,{width:w-18-(incident.SolvedBy?90:0),lineBreak:false});
      if(incident.SolvedBy) doc.fillColor(CS).fontSize(7).font(F.med)
         .text((isKo?'처리자:':'By: ')+incident.SolvedBy,x+w-95,y+44,{width:87,align:'right',lineBreak:false});
      if(totalCards>1) doc.fillColor(CS).fontSize(6.5).font(F.reg).text((idx+1)+'/'+totalCards,x+w-22,y+5,{lineBreak:false});
      doc.y=y+cardH; return cardH;
    }

    // Status banner (ok/warn/crit)
    function drawStatusBanner(x,y,w,type,message){
      const h=20;
      const cfg={ok:{bg:'#F0FDF4',border:'#86EFAC',txt:COK,icon:'✓'},
                 warn:{bg:'#FEF9C3',border:'#FDE047',txt:CW,icon:'⚠'},
                 crit:{bg:'#FEF2F2',border:'#FECACA',txt:CE,icon:'!'}};
      const c=cfg[type]||cfg.ok;
      doc.save().roundedRect(x,y,w,h,4).fillAndStroke(c.bg,c.border).restore();
      doc.fillColor(c.txt).fontSize(8.5).font(F.med)
         .text(c.icon+'  '+message,x+10,y+5,{width:w-20,lineBreak:false});
      doc.y=y+h+4; doc.x=ML; return h+4;
    }

    // No-data placeholder
    function drawNoData(x,y,w,message){
      const h=26;
      doc.save().roundedRect(x,y,w,h,4).fill(CBG).restore();
      doc.fillColor(CS).fontSize(isKo?8:8.5).font(F.med)
         .text(message||(isKo?'데이터 없음.':'No data available.'),x+10,y+8,{width:w-20,lineBreak:false});
      doc.y=y+h+4; doc.x=ML; return h+4;
    }

    // Inline subsection label
    function subLabel(title){
      doc.fillColor(CP).fontSize(isKo?8:8.5).font(F.bold).text(title,ML,doc.y,{width:PW,lineBreak:false});
      doc.y+=13; doc.x=ML;
    }

    // ── STAFF DATA ──
    const staffMap={};
    md.forEach(r=>{
      const nm=r.SolvedBy||'Unknown';
      if(!staffMap[nm]) staffMap[nm]={count:0,diffs:[],totalMins:0,minCount:0};
      staffMap[nm].count++;
      staffMap[nm].diffs.push(r.Difficulty||1);
      const mn=parseMins(r.TimeTaken);
      if(mn>0){staffMap[nm].totalMins+=mn;staffMap[nm].minCount++;}
    });
    const staffSorted=Object.entries(staffMap).sort((a,b)=>b[1].count-a[1].count);
    const staffTopList=staffSorted.slice(0,8).map(([nm,d])=>({name:nm,count:d.count,avgDiff:(d.diffs.reduce((s,v)=>s+v,0)/d.diffs.length).toFixed(1),avgMin:d.minCount?Math.round(d.totalMins/d.minCount):0}));

    // ── COLOR MAP: branch, category ──
    const catColors={'Software':CP,'Hardware':'#ef4444','Network':'#f59e0b','Other':'#a3a29c','Unknown':'#a3a29c'};

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
        const isLastAndSummary = isSummary || (ri===rows.length-1 && row.some(c=>String(c||'').toLowerCase().includes('total')||String(c||'').toLowerCase().startsWith('avg:')||String(c||'').includes('합계')));
        const fw = isLastAndSummary ? F.bold : F.med;
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
        const rowBg = isLastAndSummary ? CHIGHLIGHT : (visibleRowCount%2===0?CCARD:CBG);
        doc.save().rect(ML,ry,PW,rH).fill(rowBg).restore();
        if(isLastAndSummary){
          doc.moveTo(ML,ry).lineTo(MR,ry).strokeColor(CT).lineWidth(1.0).stroke();
        }
        doc.moveTo(ML,ry+rH).lineTo(MR,ry+rH).strokeColor(CL).lineWidth(isLastAndSummary?0.8:0.3).stroke();
        const _lc = opts.leftCols||[];
        row.forEach((cell,ci)=>{
          const cc = opts.colColors&&opts.colColors[ci] ? opts.colColors[ci](cell) : CT;
          const cellStr = String(cell===0?'0':(cell===''||cell===null||cell===undefined)?'--':cell);
          const cellAlign = _lc.includes(ci) ? 'left' : 'center';
          doc.fillColor(cc).fontSize(fs).font(fw).text(cellStr,cx+pad,ry+cellPadY,{width:widths[ci]-pad*2, height:rH, align:cellAlign, lineBreak:true});
          cx+=widths[ci];
        });
        doc.y=ry+rH;
        visibleRowCount++;
      });
      doc.moveDown(0.3);
      _markPage();
    }

    // ══════════════════════════════════════════════
    //  PAGE 1: DASHBOARD
    // ══════════════════════════════════════════════
    _drawPageBranding();

    // ══════════ REPORT TITLE HEADER (admin / all-branch) ══════════
    if (!branchFilter) {
      const titleY = doc.y;
      // d'strict official identity: DSKR-GTO-Monthly Error Report_MMMYY
      const monthShortHdr = (MONTHS_EN[month]||'').slice(0,3).toUpperCase();
      const yearShortHdr = String(year).slice(2);
      const dstrictId = 'DSKR-GTO-Monthly Error Report_' + monthShortHdr + yearShortHdr;
      const mainTitle = safeTitle || dstrictId;
      doc.save().rect(ML, titleY, PW, 38).fill('#f6f5f0').restore();
      doc.save().rect(ML, titleY, PW, 3).fill(CP).restore();
      // Main title
      doc.fillColor(CP).fontSize(14).font(F.bold)
        .text(mainTitle, ML, titleY + 8, { width: PW, align: 'center', lineBreak: false });
      // Subtitle: period + region (no "scope" label)
      const regionLabel = region === 'korea' ? (isKo ? 'Korea (국내 4지점)' : 'Korea (4 branches)') : (isKo ? 'Global (해외 3지점)' : 'Global (3 branches)');
      const periodLabel = MONTHS_EN[month] + ' ' + year;
      doc.fillColor(CS).fontSize(9).font(F.reg)
        .text(periodLabel + '  ·  ' + regionLabel, ML, titleY + 26, { width: PW, align: 'center', lineBreak: false });
      doc.y = titleY + 44;
      doc.x = ML;
      _markPage();
    }

    // ══════════ BRANCH REPORT TITLE (single-branch reports only) ══════════
    if (branchFilter) {
      const brName = BR_NAMES[branchFilter] || branchFilter;
      const titleY = doc.y;
      const brColor = BR_COLORS[branchFilter] || CP;
      // d'strict identity: [Branch]-Monthly Error Report_MMMYY
      const dstrictIdBr = branchFilter + '-Monthly Error Report_' +
        (MONTHS_EN[month]||'').slice(0,3).toUpperCase() + String(year).slice(2);
      doc.save().rect(ML, titleY, PW, 38).fill('#f6f5f0').restore();
      doc.save().rect(ML, titleY, PW, 3).fill(brColor).restore();
      // Main title: d'strict identity format (compact, not oversized)
      doc.fillColor(brColor).fontSize(14).font(F.bold)
        .text(dstrictIdBr, ML, titleY + 8, { width: PW, align: 'center', lineBreak: false });
      // Subtitle: branch name only — scope label removed per d'strict spec
      const scopeLabel = isKo ? ('지점: ' + brName) : brName;
      doc.fillColor(CS).fontSize(9).font(F.reg)
        .text(scopeLabel, ML, titleY + 26, { width: PW, align: 'center', lineBreak: false });
      doc.y = titleY + 44;
      doc.x = ML;
      _markPage();
    }

    // ══════════ MANAGER COMMENT (if provided) ══════════
    // Inserted on first content page, before Executive Summary
    if (safeComment) {
      _markPage();
      if(doc.y > BOT - 200) {
        doc.addPage();
        _drawPageBranding();
      } else if(doc.y > 80) {
        doc.y = doc.y + 12;
      } else {
        doc.y = 32;
      }
      const headerY = doc.y;
      // Section header with background band — compact
      doc.save().rect(ML, headerY, PW, 22).fill('#f0eff8').restore();
      doc.save().rect(ML, headerY, 4, 22).fill(CP).restore();
      // d'strict comment rules: branch report → Tech-op Comment; all-branch → GSKR-GTO Comment
      const headerTitle = branchFilter
        ? (isKo ? '현장 코멘트 (Tech-op Comment)' : 'Tech-op Comment')
        : (isKo ? '본사 코멘트 (GSKR-GTO Comment)' : 'GSKR-GTO Comment');
      doc.fillColor(CT).fontSize(isKo ? 12 : 13).font(F.bold)
        .text(headerTitle.toUpperCase(), ML, headerY + 5, { width: PW, align: 'center', lineBreak: false });
      doc.y = headerY + 26;
      doc.moveTo(ML, doc.y - 2).lineTo(MR, doc.y - 2).strokeColor(CP).lineWidth(0.8).stroke();
      doc.moveDown(0.7);
      doc.x = ML;
      doc.font(F.reg).fillColor(CT);

      const cmtY = doc.y;
      // Highlight box
      doc.save().roundedRect(ML, cmtY, PW, 16).fill('#FEF3C7').restore();
      doc.save().rect(ML, cmtY, 4, 16).fill('#D97706').restore();
      doc.fillColor('#92400E').fontSize(isKo ? 9 : 8.5).font(F.bold)
        .text(isKo ? '※ 이 코멘트는 담당자가 직접 작성한 내용입니다.' : '※ This comment was written directly by the branch manager.',
          ML + 10, cmtY + 4, { width: PW - 20, lineBreak: false });
      doc.y = cmtY + 20;
      // Comment body box — remove bullet points from content
      let cleanComment = safeComment;
      // Remove bullet points (• or ◦ or ★ or ✓ and similar characters)
      cleanComment = cleanComment.replace(/[•◦★✓▪︎▫︎◼︎☐☑︎☒✗✘]/g, '');
      // Remove markdown list markers (-, *, +) at line start
      cleanComment = cleanComment.replace(/^\s*[-*+]\s+/gm, '');
      const cmtLines = cleanComment.split('\n');
      const cmtHeight = Math.max(50, cmtLines.length * (isKo ? 14 : 13) + 14);
      pc(cmtHeight + 20);
      const cmtBodyY = doc.y;
      doc.save().roundedRect(ML, cmtBodyY, PW, cmtHeight + 12, 6).fill('#FFFBEB').stroke('#FDE68A').restore();
      doc.fillColor('#78350F').fontSize(isKo ? 10 : 9.5).font(F.med)
        .text(cleanComment, ML + 12, cmtBodyY + 10, { width: PW - 24, align: 'left', lineBreak: true });
      doc.y = cmtBodyY + cmtHeight + 20;
    }

    // ══════════ 1. EXECUTIVE SUMMARY ══════════
    sect('1', L.execSummary);

    // ═══ HERO KPI: Total + Trend (standalone, clearly separate from branches) ═══
    const ky=doc.y;
    // Hero: Total Errors
    const heroW=150, heroH=isKo?66:60;
    doc.save().roundedRect(ML,ky,heroW,heroH,8).fill(CP).restore();
    doc.fillColor('#fff').fontSize(isKo?7:7.5).font(F.bold).text(isKo?'이번 달 총 장애':'TOTAL ERRORS THIS MONTH',ML,ky+6,{width:heroW,align:'center',lineBreak:false});
    doc.fillColor('#fff').fontSize(20).font(F.black).text(String(total),ML,ky+18,{width:heroW,align:'center',lineBreak:false});
    doc.fillColor('rgba(255,255,255,0.7)').fontSize(7).font(F.med).text(trend(total,prevTotal),ML,ky+(isKo?48:44),{width:heroW,align:'center',lineBreak:false});

    // Branch cards
    const bkw=Math.floor((PW-heroW-50)/PDF_BRANCHES.length), bkx0=ML+heroW+10;
    PDF_BRANCHES.forEach((b,i)=>{
      const bx=bkx0+i*(bkw+6), bc=brCount[b]||0;
      doc.save().roundedRect(bx,ky,bkw,heroH,6).fillAndStroke(CCARD,CL).restore();
      doc.save().rect(bx,ky,bkw,3).fill(BR_COLORS[b]).restore();
      doc.fillColor(CS).fontSize(7).font(F.bold).text(b,bx,ky+6,{width:bkw,align:'center',lineBreak:false});
      doc.fillColor(BR_COLORS[b]).fontSize(16).font(F.black).text(String(bc),bx,ky+20,{width:bkw,align:'center',lineBreak:false});
      doc.fillColor(CS).fontSize(6).font(F.light).text(BR_NAMES[b]||'',bx,ky+(isKo?46:42),{width:bkw,align:'center',lineBreak:false});
    });

    // Critical alert badge (right-aligned, visually distinct)
    const critY=ky+heroH+6, critH=22;
    if(critical.length>0){
      doc.save().roundedRect(ML,critY,PW,critH,4).fill('#FCEBEB').restore();
      doc.save().rect(ML,critY,4,critH).fill(CE).restore();
      doc.fillColor(CE).fontSize(9.5).font(F.bold).text('[!] CRITICAL: '+critical.length+(isKo?H.critAlertText:' '+L.critAlert),ML+12,critY+5,{width:PW-20,lineBreak:false});
    } else {
      doc.save().roundedRect(ML,critY,PW,critH,4).fill('#EAF3DE').restore();
      doc.save().rect(ML,critY,4,critH).fill(COK).restore();
      doc.fillColor(COK).fontSize(9.5).font(F.bold).text('[OK] '+(isKo?H.noCritText:L.noCrit),ML+12,critY+5,{width:PW-20,lineBreak:false});
    }
    doc.y = critY+critH+12; doc.x=ML;
    _markPage();

    // ── Executive Summary: 2-Column Dashboard (dense, no donuts) ──

    if(total===0){
      const noIncText = branchFilter
        ? (isKo ? monName+' '+year+': 해당 월 장애 발생 없음. '+branchFilter+'지점 시스템 정상 운영 중.' : monName+' '+year+': No errors recorded. '+branchFilter+' operating normally.')
        : L.noIncidents;
      doc.fillColor(CS).fontSize(11).font(F.reg).text(noIncText, ML);
    } else {
      const momDiff = total-prevTotal;
      // ── 2-Column Dashboard: Branch+Category (left) | Zones+Difficulty (right) ──
      // Column geometry: PW=797, lw=372, gap=10, rw=415
      const _lw=372, _gap=10, _rw=PW-372-10; // rw=415
      const _lx=ML, _rx=ML+_lw+_gap; // rx=ML+382=404
      pc(180);
      const dashY=doc.y;
      let _ly=dashY, _ry=dashY;

      // ─── LEFT: Branch bars with count + pct + MoM delta ───
      doc.fillColor(CT).fontSize(8.5).font(F.bold).text(isKo?'지점별 현황':'BRANCH DISTRIBUTION', _lx, _ly, {lineBreak:false});
      doc.moveTo(_lx, _ly+12).lineTo(_lx+70, _ly+12).strokeColor(CP).lineWidth(0.8).stroke();
      _ly += 17;
      const _brBarMax=234; // lx+44+234+4+26+4+30+4+26 = 372 fits
      const _mxBr=Math.max(...PDF_BRANCHES.map(b=>brCount[b]||0), 1);
      PDF_BRANCHES.forEach(b=>{
        const c=brCount[b]||0, p=prevBrCount[b]||0, d=c-p;
        const bw=c>0?Math.max(4,Math.round((c/_mxBr)*_brBarMax)):0;
        const dStr=d>0?'+'+d:d<0?String(d):'=';
        const dCol=d>0?CE:d<0?COK:CS;
        doc.fillColor(CT).fontSize(7.5).font(F.med).text(b, _lx, _ly+1, {width:40,lineBreak:false});
        doc.save().roundedRect(_lx+44, _ly, _brBarMax, 12, 3).fill(CBG).restore();
        if(bw>0) doc.save().roundedRect(_lx+44, _ly, bw, 12, 3).fill(BR_COLORS[b]||CP).restore();
        const pct=total?Math.round(c/total*100):0;
        doc.fillColor(CT).fontSize(7.5).font(F.bold).text(String(c), _lx+44+_brBarMax+4, _ly+1, {width:26,align:'right',lineBreak:false});
        doc.fillColor(CS).fontSize(7).font(F.light).text('('+pct+'%)', _lx+44+_brBarMax+34, _ly+1, {width:30,lineBreak:false});
        doc.fillColor(dCol).fontSize(7).font(F.bold).text(dStr, _lx+44+_brBarMax+68, _ly+1, {width:26,align:'right',lineBreak:false});
        _ly += 15;
      });
      doc.moveTo(_lx, _ly).lineTo(_lx+_lw, _ly).strokeColor(CL).lineWidth(0.3).stroke();
      _ly += 5;
      const _momCol=momDiff>0?CE:momDiff<0?COK:CS;
      doc.fillColor(CT).fontSize(7.5).font(F.bold).text(isKo?'합계':'TOTAL', _lx, _ly+1, {width:40,lineBreak:false});
      doc.fillColor(CP).fontSize(7.5).font(F.black).text(String(total), _lx+44+_brBarMax+4, _ly+1, {width:26,align:'right',lineBreak:false});
      doc.fillColor(_momCol).fontSize(7).font(F.bold).text(momDiff>0?'+'+momDiff:momDiff<0?String(momDiff):'=', _lx+44+_brBarMax+68, _ly+1, {width:26,align:'right',lineBreak:false});
      _ly += 18;

      // ─── LEFT: Category bars ───
      _ly += 5;
      doc.fillColor(CT).fontSize(8.5).font(F.bold).text(isKo?'유형별':'CATEGORY', _lx, _ly, {lineBreak:false});
      doc.moveTo(_lx, _ly+12).lineTo(_lx+55, _ly+12).strokeColor(CP).lineWidth(0.8).stroke();
      _ly += 17;
      const _catEnt=Object.entries(catCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const _mxCat=_catEnt.length?_catEnt[0][1]:1;
      const _catBarMax=237; // 72+4+237+5+24+4+26=372 fits
      _catEnt.forEach((ce,i)=>{
        const cbw=ce[1]>0?Math.max(4,Math.round((ce[1]/_mxCat)*_catBarMax)):0;
        const ccol=catCols[i%catCols.length];
        doc.fillColor(CS).fontSize(7).font(F.med).text(trCat(ce[0]).slice(0,16), _lx, _ly+1, {width:72,lineBreak:false});
        doc.save().roundedRect(_lx+76, _ly, _catBarMax, 10, 3).fill(CBG).restore();
        if(cbw>0) doc.save().roundedRect(_lx+76, _ly, cbw, 10, 3).fill(ccol).restore();
        const cpct=total?Math.round(ce[1]/total*100):0;
        doc.fillColor(CT).fontSize(7).font(F.bold).text(String(ce[1]), _lx+76+_catBarMax+5, _ly+1, {width:24,align:'right',lineBreak:false});
        doc.fillColor(CS).fontSize(7).font(F.light).text('('+cpct+'%)', _lx+76+_catBarMax+31, _ly+1, {width:26,lineBreak:false});
        _ly += 13;
      });

      // ─── RIGHT: Top Zones ───
      const _topZonesArr=Object.entries(zoneCount).sort((a,b)=>b[1]-a[1]).slice(0,7);
      doc.fillColor(CT).fontSize(8.5).font(F.bold).text(isKo?'주요 Zone (Top 7)':'TOP ZONES', _rx, _ry, {lineBreak:false});
      doc.moveTo(_rx, _ry+12).lineTo(_rx+70, _ry+12).strokeColor(CP).lineWidth(0.8).stroke();
      _ry += 17;
      const _mxZone=_topZonesArr.length?_topZonesArr[0][1]:1;
      const _zBarMax=272; // 80+4+272+5+24+4+30=419 ≤ rw=415... adjust: 267
      // rw=415: label80+gap4+bar+gap5+cnt24+gap4+pct26 → bar=415-143=272 ✓ (rx+rw=MR=819)
      _topZonesArr.forEach((ze,i)=>{
        const zbw=ze[1]>0?Math.max(4,Math.round((ze[1]/_mxZone)*_zBarMax)):0;
        const zcol=catCols[i%catCols.length];
        const zLbl=ze[0].length>17?ze[0].slice(0,16)+'\u2026':ze[0];
        doc.fillColor(CS).fontSize(7.5).font(F.med).text(zLbl, _rx, _ry+1, {width:80,lineBreak:false});
        doc.save().roundedRect(_rx+84, _ry, _zBarMax, 11, 3).fill(CBG).restore();
        if(zbw>0) doc.save().roundedRect(_rx+84, _ry, zbw, 11, 3).fill(zcol).restore();
        const zpct=total?Math.round(ze[1]/total*100):0;
        doc.fillColor(CT).fontSize(7.5).font(F.bold).text(String(ze[1]), _rx+84+_zBarMax+5, _ry+1, {width:24,align:'right',lineBreak:false});
        doc.fillColor(CS).fontSize(7).font(F.light).text('('+zpct+'%)', _rx+84+_zBarMax+31, _ry+1, {width:26,lineBreak:false});
        _ry += 14;
      });

      // ─── RIGHT: Difficulty distribution ───
      _ry += 5;
      doc.fillColor(CT).fontSize(8.5).font(F.bold).text(isKo?'난이도 분포':'DIFFICULTY', _rx, _ry, {lineBreak:false});
      doc.moveTo(_rx, _ry+12).lineTo(_rx+55, _ry+12).strokeColor(CP).lineWidth(0.8).stroke();
      _ry += 17;
      const _dColors=['#22c55e','#84cc16','#eab308','#ef4444','#be123c'];
      const _dNames=isKo?['Lv.1 경미','Lv.2 보통','Lv.3 주의','Lv.4 위험','Lv.5 심각']:['Lv.1 Minor','Lv.2 Low','Lv.3 Moderate','Lv.4 High','Lv.5 Critical'];
      const _mxDiff=Math.max(...[1,2,3,4,5].map(d=>diffCount[d]||0), 1);
      const _dBarMax=264; // 88+4+264+5+24+4+26=415 ✓
      [1,2,3,4,5].forEach((d,i)=>{
        const dc=diffCount[d]||0;
        const dbw=dc>0?Math.max(4,Math.round((dc/_mxDiff)*_dBarMax)):0;
        doc.fillColor(_dColors[i]).fontSize(7.5).font(F.med).text(_dNames[i], _rx, _ry+1, {width:88,lineBreak:false});
        doc.save().roundedRect(_rx+92, _ry, _dBarMax, 11, 3).fill(CBG).restore();
        if(dbw>0) doc.save().roundedRect(_rx+92, _ry, dbw, 11, 3).fill(_dColors[i]).restore();
        const dpct=total?Math.round(dc/total*100):0;
        doc.fillColor(CT).fontSize(7.5).font(F.bold).text(String(dc), _rx+92+_dBarMax+5, _ry+1, {width:24,align:'right',lineBreak:false});
        doc.fillColor(CS).fontSize(7).font(F.light).text('('+dpct+'%)', _rx+92+_dBarMax+31, _ry+1, {width:26,lineBreak:false});
        _ry += 14;
      });

      // Advance past both columns
      doc.y = Math.max(_ly, _ry) + 6;
      doc.x = ML;
      _markPage();

      // ── Key Issues (high difficulty errors, brief summary) ──
      const highDiff=md.filter(r=>r.Difficulty>=3).sort((a,b)=>(b.Difficulty||0)-(a.Difficulty||0)).slice(0,5);
      if(highDiff.length>0){
        pc(80);
        const kiY=doc.y;
        doc.fillColor(CT).fontSize(9).font(F.bold).text(isKo?'주요 장애 이슈 (난이도 3+)':'KEY ISSUES (Difficulty 3+)',ML,kiY,{lineBreak:false});
        doc.moveTo(ML,kiY+13).lineTo(ML+90,kiY+13).strokeColor(CE).lineWidth(1).stroke();
        let iiY=kiY+20;
        highDiff.forEach((r,i)=>{
          pc(22);
          const bg=i%2===0?CCARD:CBG;
          doc.save().rect(ML,iiY,PW,18).fill(bg).restore();
          const dBadgeC=r.Difficulty>=4?CE:CW;
          doc.save().roundedRect(ML+2,iiY+2,28,14,3).fill(dBadgeC).restore();
          doc.fillColor('#fff').fontSize(7.5).font(F.bold).text('Lv.'+r.Difficulty,ML+3,iiY+4,{width:26,align:'center',lineBreak:false});
          doc.fillColor(CT).fontSize(8).font(F.bold).text((r.Zone||'--')+' | '+trCat(r.Category||''),ML+36,iiY+4,{width:140,lineBreak:false});
          doc.fillColor(CS).fontSize(7.5).font(F.reg).text(trText(r.IssueDetail||'').substring(0,55),ML+180,iiY+4,{width:PW-186,lineBreak:false});
          iiY+=18;
        });
        doc.y=iiY+6;
      }

      // ── Status alert (moved here, after all visual content) ──
    }
    doc.moveDown(0.3);

    // ══════════ SECTIONS 2-4: ANNUAL REPORT ONLY ══════════
    // Monthly report skips detailed branch/category/zone analysis
    // and goes straight to Critical Errors + Recommendations
    let _nextSectNum = 2; // dynamic section counter

    // ══════════ BRANCH-SPECIFIC SUMMARY (if single branch selected) ══════════
    if(branchFilter && reportType === 'monthly'){
      // branchFilter already uppercased and validated. logs already filtered server-side.
      const branchLogs = md; // md is already filtered to this month + this branch (server filtered logs)
      const branchCritical = branchLogs.filter(r => r.Difficulty >= 4);
      const branchCatCount = {};
      branchLogs.forEach(r => { branchCatCount[r.Category||'Other'] = (branchCatCount[r.Category||'Other'] || 0) + 1; });
      const topCategories = Object.entries(branchCatCount).sort((a,b) => b[1] - a[1]).slice(0, 5);
      const dynMonth = MONTHS_EN[month] + ' ' + year;

      sect('2', isKo ? '지점 상세 현황' : 'Branch Detail');

      // ── Status badge (page-break safe: pc before setting Y) ──
      pc(100);
      const sumY = doc.y;
      doc.x = ML;

      if(branchCritical.length === 0){
        const statusText = isKo
          ? '[OK] 금월 크리티컬(Lv.4+) 장애 미발생 — ' + branchFilter + '지점 정상 운영중.'
          : '[OK] No critical (Lv.4+) incidents this month — ' + branchFilter + ' branch operating normally.';
        doc.save().roundedRect(ML, sumY, PW, 26, 4).fill('#EAF3DE').restore();
        doc.save().rect(ML, sumY, 4, 26).fill(COK).restore();
        doc.fillColor(COK).fontSize(10).font(F.bold)
          .text(statusText, ML + 12, sumY + 7, { width: PW - 20, lineBreak: false });
        doc.y = sumY + 32;
        doc.x = ML;
        const noErrDetail = isKo
          ? dynMonth + ': 해당 월 장애 발생 없음. ' + branchFilter + '지점 시스템 정상 운영 중.'
          : dynMonth + ': No incidents recorded. ' + branchFilter + ' systems operating normally.';
        doc.fillColor(CS).fontSize(9).font(F.med)
          .text(noErrDetail, ML + 12, doc.y, { width: PW - 24, lineBreak: false });
        doc.y += 18;
      } else {
        const statusText = isKo
          ? '[!] ' + dynMonth + ' — 심각 장애 ' + branchCritical.length + '건 발생. 즉각 확인 필요.'
          : '[!] ' + dynMonth + ' — ' + branchCritical.length + ' critical incident(s). Immediate attention required.';
        doc.save().roundedRect(ML, sumY, PW, 26, 4).fill('#FCEBEB').restore();
        doc.save().rect(ML, sumY, 4, 26).fill(CE).restore();
        doc.fillColor(CE).fontSize(10).font(F.bold)
          .text(statusText, ML + 12, sumY + 7, { width: PW - 20, lineBreak: false });
        doc.y = sumY + 32;
        doc.x = ML;
      }

      // ── Top Categories ──
      if(topCategories.length > 0){
        pc(50);
        doc.x = ML;
        doc.fillColor(CT).fontSize(10).font(F.bold)
          .text(isKo ? '주요 장애 유형' : 'Top Issue Categories', ML, doc.y);
        doc.moveDown(0.3);
        topCategories.forEach((cat) => {
          pc(16);
          doc.x = ML;
          const catName = cat[0], catCnt = cat[1];
          const pct = branchLogs.length ? Math.round(catCnt / branchLogs.length * 100) : 0;
          const catLabel = (isKo ? trCat(catName) : catName) + ': ' + catCnt + ' (' + pct + '%)';
          doc.fillColor(CS).fontSize(9).font(F.med)
            .text('• ' + catLabel, ML + 10, doc.y, { width: PW - 20, lineBreak: false });
          doc.moveDown(0.5);
        });
        doc.moveDown(0.3);
      }

      // ── Critical Issues Listing (Lv.4+) ──
      if(branchCritical.length > 0){
        pc(50);
        doc.x = ML;
        doc.fillColor(CT).fontSize(10).font(F.bold)
          .text(isKo ? '심각 장애 목록 (Lv.4+)' : 'Critical Issues (Difficulty 4+)', ML, doc.y);
        doc.moveDown(0.3);
        branchCritical.slice(0, 10).forEach((r) => {
          pc(28);
          doc.x = ML;
          const dateStr = (r.Date||'').split('T')[0];
          const diff = r.Difficulty||0;
          const issueText = trText(r.IssueDetail||'--').slice(0, 90);
          const label = '[Lv.' + diff + '] ' + (r.Zone||'--') + ' — ' + issueText + ' (' + dateStr + ')';
          doc.save().roundedRect(ML, doc.y, PW, 22, 3)
            .fill(diff >= 5 ? '#FFF0F0' : '#FFF5E6').restore();
          doc.save().rect(ML, doc.y, 3, 22).fill(diff >= 5 ? CE : CW).restore();
          doc.fillColor(diff >= 5 ? CE : CW).fontSize(8.5).font(F.med)
            .text(label, ML + 9, doc.y + 5, { width: PW - 16, lineBreak: false });
          doc.y += 26;
          doc.x = ML;
        });
        doc.moveDown(0.3);
      }

      // ── Most Frequent Issues ──
      const issueFreq = {};
      branchLogs.forEach(r => {
        const key = (r.IssueDetail||'unknown').toLowerCase().trim().slice(0, 100);
        issueFreq[key] = (issueFreq[key]||0) + 1;
      });
      const topFreqIssues = Object.entries(issueFreq).sort((a,b)=>b[1]-a[1]).slice(0,5).filter(e=>e[1]>1);
      if(topFreqIssues.length > 0){
        pc(50);
        doc.x = ML;
        doc.fillColor(CT).fontSize(10).font(F.bold)
          .text(isKo ? '가장 빈번한 이슈' : 'Most Frequent Issues', ML, doc.y);
        doc.moveDown(0.3);
        topFreqIssues.forEach((entry, idx) => {
          pc(16);
          doc.x = ML;
          const freqLabel = (idx+1)+'. '+entry[0].slice(0,80)+' — '+entry[1]+(isKo?'건':' cases');
          doc.fillColor(CS).fontSize(9).font(F.med)
            .text(freqLabel, ML + 10, doc.y, { width: PW - 20, lineBreak: true });
          doc.moveDown(0.5);
        });
      }

      doc.moveDown(0.5);
      doc.x = ML;
      _markPage();
    }

    if(reportType === 'annual'){

    // ══════════ 2. BRANCH DETAILS & TRENDS ══════════
    sect('2', L.branchDetail);

    PDF_BRANCHES.forEach((b,bi)=>{
      const bl=md.filter(r=>r.Branch===b), cnt=bl.length;
      const pbl=prevMd.filter(r=>r.Branch===b), pcnt=pbl.length;
      const col=BR_COLORS[b];
      const pct=total?Math.round(cnt/total*100):0;

      // ── Branch header ──
      pc(160);
      const bhy=doc.y;
      doc.save().roundedRect(ML,bhy,PW,24,6).fill(col).restore();
      doc.fillColor('#fff').fontSize(12).font(F.bold).text('2-'+(bi+1)+'  '+b+' ('+BR_NAMES[b]+')',ML+10,bhy+5,{width:PW-20,lineBreak:false});
      doc.y=bhy+30;

      if(cnt===0 && pcnt===0){
        doc.fillColor(CS).fontSize(10).font(F.reg).text(L.noIncMonth,ML+8);
        doc.moveDown(0.6);
        return;
      }

      // ── (1) Error Trend --clean mini-table format ──
      // Sub-section header with light background band
      const sh1y=doc.y;
      doc.save().rect(ML+4,sh1y,PW-8,18).fill('#f0eff8').restore();
      doc.save().rect(ML+4,sh1y,2,18).fill(CP).restore();
      doc.fillColor(CT).fontSize(10).font(F.bold).text('(1) '+L.errorTrend,ML+12,sh1y+3,{lineBreak:false});
      doc.y=sh1y+22;
      doc.moveDown(0.2);
      const momD=cnt-pcnt;
      const trendLabel = momD>0?(isKo?'증가':'Increase'):momD<0?(isKo?'감소':'Decrease'):(isKo?'동일':'Stable');
      const trendColor = momD>0?CE:momD<0?COK:CS;
      // Compact comparison: Previous Month vs Current Month in a mini table row
      const ety=doc.y;
      const eTblW = PW; // full page width
      const eColW = [Math.floor(eTblW/3), Math.floor(eTblW/3), PW - Math.floor(eTblW/3)*2];
      // Header row
      doc.save().rect(ML,ety,PW,16).fill('#e8e6df').restore();
      doc.fillColor(CT).fontSize(8).font(F.bold);
      doc.text(MONTHS_EN[prevMo]+' '+prevYr,ML+6,ety+4,{width:eColW[0]-12,align:'center',lineBreak:false});
      doc.text(MONTHS_EN[month]+' '+year,ML+eColW[0]+6,ety+4,{width:eColW[1]-12,align:'center',lineBreak:false});
      doc.text(isKo ? H.mom : 'MoM Change',ML+eColW[0]+eColW[1]+6,ety+4,{width:eColW[2]-12,align:'center',lineBreak:false});
      // Value row
      const evy=ety+16;
      doc.save().rect(ML,evy,PW,20).fill(CCARD).restore();
      doc.moveTo(ML,evy+20).lineTo(MR,evy+20).strokeColor(CL).lineWidth(0.3).stroke();
      const caseUnit = isKo ? '건' : 'cases';
      doc.fillColor(CT).fontSize(11).font(F.bold).text(String(pcnt)+' '+caseUnit,ML+6,evy+4,{width:eColW[0]-12,align:'center',lineBreak:false});
      doc.fillColor(CT).fontSize(11).font(F.bold).text(String(cnt)+' '+caseUnit,ML+eColW[0]+6,evy+4,{width:eColW[1]-12,align:'center',lineBreak:false});
      const momSign = momD>0?'+'+momD:String(momD);
      const momPctBr = pcnt>0?' ('+Math.round(Math.abs(momD)/pcnt*100)+'%)':'';
      doc.fillColor(trendColor).fontSize(11).font(F.bold).text(momSign+momPctBr+' '+trendLabel,ML+eColW[0]+eColW[1]+6,evy+4,{width:eColW[2]-12,align:'center',lineBreak:false});
      doc.y=evy+24;
      doc.moveDown(0.35);

      // ── Category breakdown table (HW / SW / NET / OTHER) ──
      const bCats={Hardware:0,Software:0,Network:0,Other:0};
      bl.forEach(r=>{
        const c=(r.Category||'').toLowerCase();
        if(c.includes('hardware')) bCats.Hardware++;
        else if(c.includes('software')) bCats.Software++;
        else if(c.includes('network')) bCats.Network++;
        else bCats.Other++;
      });
      pc(30);
      const cty=doc.y;
      const cw=Math.floor(PW/5);
      const catHeaders = isKo ? [H.total, H.hardware, H.software, H.network, H.other] : ['TOTAL','HARDWARE','SOFTWARE','NETWORK','OTHER'];
      const catVals = [cnt, bCats.Hardware, bCats.Software, bCats.Network, bCats.Other];
      // Header row
      doc.save().rect(ML,cty,PW,18).fill(CT).restore();
      catHeaders.forEach((h,i)=>{
        doc.fillColor('#fff').fontSize(isKo?7.5:8.5).font(F.bold).text(h,ML+i*cw,cty+4,{width:cw,align:'center',lineBreak:false});
      });
      // Value row
      doc.save().rect(ML,cty+18,PW,18).fill(CCARD).restore();
      doc.moveTo(ML,cty+36).lineTo(MR,cty+36).strokeColor(CL).lineWidth(0.3).stroke();
      catVals.forEach((v,i)=>{
        doc.fillColor(v>0?CT:CS).fontSize(10).font(F.bold).text(String(v),ML+i*cw,cty+22,{width:cw,align:'center',lineBreak:false});
      });
      doc.y=cty+40;

      // ── (2) Zone breakdown (top zones for this branch) ──
      const bZones={}; bl.forEach(r=>{bZones[r.Zone]=(bZones[r.Zone]||0)+1;});
      const topZ=Object.entries(bZones).sort((a,b)=>b[1]-a[1]).slice(0,5);
      if(topZ.length>0){
        pc(20+topZ.length*16);
        doc.moveDown(0.15);
        // Sub-section header with light background band
        const sh2y=doc.y;
        doc.save().rect(ML+4,sh2y,PW-8,18).fill('#f0eff8').restore();
        doc.save().rect(ML+4,sh2y,2,18).fill(CP).restore();
        doc.fillColor(CT).fontSize(10).font(F.bold).text('(2) '+L.zoneDetail,ML+12,sh2y+3,{lineBreak:false});
        doc.y=sh2y+22;
        topZ.forEach(([z,c])=>{
          const zy=doc.y;
          const zPct=cnt?Math.round(c/cnt*100):0;
          const zNameW = isKo ? 150 : 130;
          const barX = ML + zNameW + 20;
          doc.fillColor(CT).fontSize(isKo?8.5:9).font(F.med).text(z.length>32?z.slice(0,31)+'..':z,ML+16,zy,{width:zNameW,align:'center',lineBreak:false});
          drawBar(barX,zy+1,200,zPct,col,10);
          doc.fillColor(CT).fontSize(8.5).font(F.med).text(c+' ('+zPct+'%)',barX+210,zy+1,{align:'center'});
          doc.y=zy+15;
        });
      }
      doc.moveDown(0.2);

      // ── (3) Action Taken --Cause Analysis + Troubleshooting ──
      pc(60);
      // Sub-section header with light background band
      const sh3y=doc.y;
      doc.save().rect(ML+4,sh3y,PW-8,18).fill('#f0eff8').restore();
      doc.save().rect(ML+4,sh3y,2,18).fill(CP).restore();
      doc.fillColor(CT).fontSize(10).font(F.bold).text('(3) '+L.actionTaken,ML+12,sh3y+3,{lineBreak:false});
      doc.y=sh3y+22;

      // Cause Analysis sub-header with subtle background
      const shCAy=doc.y;
      doc.save().rect(ML+12,shCAy,PW-24,15).fill('#f5f4f0').restore();
      doc.save().rect(ML+12,shCAy,1.5,15).fill('#8a8a84').restore();
      doc.fillColor(CT).fontSize(9).font(F.bold).text(L.causeAnalysis,ML+20,shCAy+3,{lineBreak:false});
      doc.y=shCAy+18;
      const caRows = topZ.slice(0,3).map(([z,c])=>{
        const zLogs=bl.filter(r=>r.Zone===z);
        const issueCnt={}, issueOrig={};
        zLogs.forEach(r=>{
          const key=(r.IssueDetail||'').slice(0,60).toLowerCase();
          issueCnt[key]=(issueCnt[key]||0)+1;
          if(!issueOrig[key]) issueOrig[key]=r.IssueDetail||'';
        });
        const topIssue=Object.entries(issueCnt).sort((a,b)=>b[1]-a[1])[0];
        const pct=cnt?Math.round(c/cnt*100):0;
        const issueDisplay = topIssue ? trText(issueOrig[topIssue[0]]||topIssue[0]) : '--';
        return [z.length>18?z.slice(0,17)+'..':z, String(c), pct+'%', issueDisplay];
      }).filter(r=>r);
      if(caRows.length>0){
        const caHY=doc.y;
        const caW=[110,45,40,PW-195];
        doc.save().rect(ML+8,caHY,PW-16,16).fill('#e8e6df').restore();
        doc.fillColor(CT).fontSize(8).font(F.bold);
        let cax=ML+12;
        const caHeaders = [H.zone, H.count, H.pct, H.primaryIssue];
        caHeaders.forEach((h,i)=>{doc.text(h,cax,caHY+4,{width:caW[i],align:'center',lineBreak:false});cax+=caW[i];});
        doc.y=caHY+16;
        caRows.forEach((row,ri)=>{
          // Measure dynamic row height
          let maxCH=0;
          row.forEach((cell,ci)=>{
            doc.font(ci===0?F.med:F.reg).fontSize(8);
            const ch=doc.heightOfString(String(cell||''),{width:caW[ci]-4});
            if(ch>maxCH) maxCH=ch;
          });
          const caRH=Math.max(16, Math.ceil(maxCH+12));
          pc(caRH);
          const ry=doc.y;
          doc.save().rect(ML+8,ry,PW-16,caRH).fill(ri%2===0?CCARD:CBG).restore();
          doc.moveTo(ML+8,ry+caRH).lineTo(MR-8,ry+caRH).strokeColor(CL).lineWidth(0.2).stroke();
          let rx=ML+12;
          row.forEach((cell,ci)=>{
            const cs=String(cell||'');
            const ca=ci===3?'left':'center';
            doc.fillColor(CT).fontSize(8).font(ci===0?F.med:F.reg).text(cs,rx,ry+4,{width:caW[ci]-4,height:caRH,align:ca,lineBreak:true});
            rx+=caW[ci];
          });
          doc.y=ry+caRH;
        });
      }
      doc.moveDown(0.2);

      // Troubleshooting sub-header with subtle background
      const shTSy=doc.y;
      doc.save().rect(ML+12,shTSy,PW-24,15).fill('#f5f4f0').restore();
      doc.save().rect(ML+12,shTSy,1.5,15).fill('#8a8a84').restore();
      doc.fillColor(CT).fontSize(9).font(F.bold).text(L.troubleshooting,ML+20,shTSy+3,{lineBreak:false});
      doc.y=shTSy+18;
      doc.moveDown(0.15);
      const actionPats={}, actionOrig={};
      bl.forEach(r=>{
        const a=(r.ActionTaken||'').slice(0,80).toLowerCase();
        if(a) { actionPats[a]=(actionPats[a]||0)+1; if(!actionOrig[a]) actionOrig[a]=r.ActionTaken||''; }
      });
      const topActions=Object.entries(actionPats).sort((a,b)=>b[1]-a[1]).slice(0,3);
      if(topActions.length>0){
        const tsHY=doc.y;
        const tsW=[35,PW-35-35-16,35];
        doc.save().rect(ML+8,tsHY,PW-16,16).fill('#e8e6df').restore();
        doc.fillColor(CT).fontSize(8).font(F.bold);
        let tsx=ML+12;
        const tsHeaders = [H.rank, H.actionTaken, H.count];
        tsHeaders.forEach((h,i)=>{doc.text(h,tsx,tsHY+4,{width:tsW[i],align:'center',lineBreak:false});tsx+=tsW[i];});
        doc.y=tsHY+16;
        topActions.forEach(([a,c],ti)=>{
          const aDisp = trText(actionOrig[a]||a);
          // Measure dynamic row height
          doc.font(F.reg).fontSize(8);
          const tsTextH=doc.heightOfString(aDisp,{width:tsW[1]-4});
          const tsRH=Math.max(16, Math.ceil(tsTextH+12));
          pc(tsRH);
          const ry=doc.y;
          doc.save().rect(ML+8,ry,PW-16,tsRH).fill(ti%2===0?CCARD:CBG).restore();
          doc.moveTo(ML+8,ry+tsRH).lineTo(MR-8,ry+tsRH).strokeColor(CL).lineWidth(0.2).stroke();
          doc.fillColor(CT).fontSize(8).font(F.med).text(String(ti+1),ML+12,ry+4,{width:tsW[0],align:'center',lineBreak:false});
          doc.fillColor(CT).fontSize(8).font(F.reg).text(aDisp,ML+12+tsW[0],ry+4,{width:tsW[1]-4,height:tsRH,align:'left',lineBreak:true});
          doc.fillColor(CT).fontSize(8).font(F.bold).text(String(c)+(isKo?'건':'x'),ML+12+tsW[0]+tsW[1],ry+4,{width:tsW[2],align:'center',lineBreak:false});
          doc.y=ry+tsRH;
        });
      }

      // HQ insight if available
      const hqComments = bl.filter(r=>r.HQ && r.HQ!=='undefined' && r.HQ!=='null' && r.HQ.length>5).map(r=>r.HQ);
      if(hqComments.length>0){
        doc.moveDown(0.1);
        doc.fillColor(CP).fontSize(8.5).font(F.bold).text('     - '+L.hqComment,ML+8);
        doc.fillColor(CP).fontSize(8).font(F.reg).text('     '+hqComments[0],ML+8,doc.y,{width:PW-24,lineBreak:true});
      }

      doc.moveDown(0.8);
      if(bi<2){
        // Separator line between branches
        doc.moveTo(ML,doc.y).lineTo(MR,doc.y).strokeColor(CL).lineWidth(0.5).stroke();
        doc.moveDown(0.6);
      }
    });

    // ── YTD Error Count comparison ──
    if(total>0){
      pc(80);
      doc.moveDown(0.3);
      doc.fillColor(CT).fontSize(10).font(F.bold).text(L.ytdTitle,ML);
      doc.moveDown(0.25);
      // Calculate YTD data
      const curYear=year;
      const prevYear=curYear-1;
      const ytdLogs=logs.filter(r=>{const p=(r.Date||'').split('-');return parseInt(p[0])===curYear;});
      const prevYrLogs=logs.filter(r=>{const p=(r.Date||'').split('-');return parseInt(p[0])===prevYear;});
      const curMonths=month+1; // How many months of data this year
      const ytdHeaders = isKo ?
        ['', H.prevYrAvg, H.curYrAvg, H.curYrTotal] :
        ['', prevYear+' Monthly Avg', curYear+' Monthly Avg', curYear+' Total Errors'];
      const ytdW = [124, 224, 224, 225];
      const ytdRows = PDF_BRANCHES.map(b=>{
        const prevC=prevYrLogs.filter(r=>r.Branch===b).length;
        const curC=ytdLogs.filter(r=>r.Branch===b).length;
        const prevAvg=prevC>0?Math.round(prevC/12):0;
        const curAvg=curMonths>0?Math.round(curC/curMonths):0;
        return [b, String(prevAvg), String(curAvg), String(curC)];
      });
      // Add total row
      const prevTot=prevYrLogs.length, curTot=ytdLogs.length;
      ytdRows.push([
        isKo ? H.total : 'Total',
        isKo ? (Math.round(prevTot/12)+'') : 'Avg: '+Math.round(prevTot/12),
        isKo ? (Math.round(curTot/Math.max(curMonths,1))+'') : 'Avg: '+Math.round(curTot/Math.max(curMonths,1)),
        isKo ? (curTot+'') : 'Total: '+curTot
      ]);
      tbl(ytdHeaders, ytdRows, ytdW);
    }

    // ══════════ 3. CATEGORY & DIFFICULTY ══════════
    if(total>0){
    sect('3', L.catDiff);
      // ── Category Table with Inline Bar Chart ──
      doc.x = ML;
      doc.fillColor(CT).fontSize(10).font(F.bold).text(L.incidentCategories,ML);
      doc.moveDown(0.3);
      const catE=Object.entries(catCount).sort((a,b)=>b[1]-a[1]);
      const catMax = catE.length>0 ? catE[0][1] : 1;
      // Table header
      const cthY=doc.y;
      doc.save().rect(ML,cthY,PW,20).fill(CT).restore();
      doc.fillColor('#fff').fontSize(9).font(F.bold);
      const catColX = isKo ? [12,186,271,348,689] : [12,170,255,333,673];
      const catColW = isKo ? [170,77,70,325,101] : [155,77,62,325,108];
      doc.text(H.category,ML+catColX[0],cthY+5,{width:catColW[0],align:'center',lineBreak:false});
      doc.text(H.count,ML+catColX[1],cthY+5,{width:catColW[1],align:'center',lineBreak:false});
      doc.text(H.pct,ML+catColX[2],cthY+5,{width:catColW[2],align:'center',lineBreak:false});
      doc.text(H.distribution,ML+catColX[3],cthY+5,{width:catColW[3],align:'center',lineBreak:false});
      doc.text(H.mom,ML+catColX[4],cthY+5,{width:catColW[4],align:'center',lineBreak:false});
      doc.y=cthY+20;
      catE.forEach(([c,n],idx)=>{
        pc(22);
        const pct=Math.round(n/total*100);
        const ry=doc.y;
        const prevN=prevCatCount[c]||0;
        const d=n-prevN;
        const chg=d>0?'+'+d:String(d);
        // Alternate row bg
        doc.save().rect(ML,ry,PW,20).fill(idx%2===0?CCARD:CBG).restore();
        doc.moveTo(ML,ry+20).lineTo(MR,ry+20).strokeColor(CL).lineWidth(0.3).stroke();
        doc.fillColor(CT).fontSize(isKo?8.5:9).font(F.med).text(trCat(c),ML+catColX[0],ry+5,{width:catColW[0],align:'center',lineBreak:false});
        doc.fillColor(CT).fontSize(10).font(F.bold).text(String(n),ML+catColX[1],ry+4,{width:catColW[1],align:'center',lineBreak:false});
        doc.fillColor(CT).fontSize(9).font(F.med).text(pct+'%',ML+catColX[2],ry+5,{width:catColW[2],align:'center',lineBreak:false});
        // Inline bar
        drawBar(ML+catColX[3],ry+4,catColW[3],Math.round(n/catMax*100),catCols[idx%catCols.length],12);
        // MoM change
        const chgColor = d>0?CE:d<0?COK:CT;
        doc.fillColor(chgColor).fontSize(9).font(F.bold).text(chg,ML+catColX[4],ry+5,{width:catColW[4],align:'center',lineBreak:false});
        doc.y=ry+20;
      });
      doc.moveDown(0.8);

      // ── Difficulty Distribution Table with Inline Bar ──
      pc(150);
      doc.x = ML;
      doc.fillColor(CT).fontSize(10).font(F.bold).text(L.diffDistribution,ML);
      doc.moveDown(0.3);
      const diffMax = Math.max(...[1,2,3,4,5].map(d=>diffCount[d]||0),1);
      // Table header
      const dthY=doc.y;
      doc.save().rect(ML,dthY,PW,20).fill(CT).restore();
      doc.fillColor('#fff').fontSize(9).font(F.bold);
      doc.text(H.level,ML+12,dthY+5,{width:93,align:'center',lineBreak:false});
      doc.text(H.count,ML+116,dthY+5,{width:85,align:'center',lineBreak:false});
      doc.text(H.pct,ML+209,dthY+5,{width:70,align:'center',lineBreak:false});
      doc.text(H.distribution,ML+286,dthY+5,{width:372,align:'center',lineBreak:false});
      doc.text(H.severity,ML+665,dthY+5,{width:131,align:'center',lineBreak:false});
      doc.y=dthY+20;
      [1,2,3,4,5].forEach((d,di)=>{
        const n=diffCount[d]||0;
        pc(22);
        const pct=total?Math.round(n/total*100):0;
        const ry=doc.y;
        doc.save().rect(ML,ry,PW,20).fill(di%2===0?CCARD:CBG).restore();
        doc.moveTo(ML,ry+20).lineTo(MR,ry+20).strokeColor(CL).lineWidth(0.3).stroke();
        doc.fillColor(CT).fontSize(9).font(F.med).text('Lv.'+d,ML+12,ry+5,{width:93,align:'center',lineBreak:false});
        doc.fillColor(CT).fontSize(10).font(F.bold).text(String(n),ML+116,ry+4,{width:85,align:'center',lineBreak:false});
        doc.fillColor(CT).fontSize(9).font(F.med).text(pct+'%',ML+209,ry+5,{width:70,align:'center',lineBreak:false});
        // Inline bar
        drawBar(ML+286,ry+4,372,diffMax>0?Math.round(n/diffMax*100):0,diffCols[d]||CT,12);
        // Severity label
        const sevLabels=H.sev;
        const sevColors={1:'#a3a29c',2:'#185FA5',3:CW,4:'#993C1D',5:CE};
        doc.fillColor(sevColors[d]||CS).fontSize(8).font(F.bold).text(sevLabels[d]||'',ML+665,ry+5,{width:131,align:'center',lineBreak:false});
        doc.y=ry+20;
      });
    } // end section 3 if(total>0)

    // ══════════ 4. TOP ZONES ══════════
    if(total>0){
    sect('4', L.topZones);
      const tz=Object.entries(zoneCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
      tbl([H.rank, H.zone, H.count, H.pct, H.branch, H.topCat, H.avgDiff],
        tz.map(([z,cnt],i)=>{
          const zl=md.filter(r=>r.Zone===z);
          const zBr={}; zl.forEach(r=>{zBr[r.Branch]=(zBr[r.Branch]||0)+1;});
          const mb=Object.entries(zBr).sort((a,b)=>b[1]-a[1])[0]?.[0]||'?';
          const zCat={}; zl.forEach(r=>{zCat[r.Category||'Other']=(zCat[r.Category||'Other']||0)+1;});
          const tc=Object.entries(zCat).sort((a,b)=>b[1]-a[1])[0]?.[0]||'?';
          const tcDisp = trCat(tc);
          return [i+1, z, cnt, Math.round(cnt/total*100)+'%', mb, tcDisp, (zl.reduce((s,r)=>s+(r.Difficulty||1),0)/zl.length).toFixed(1)];
        }),
        [43,217,77,70,101,201,88],
        {colColors:{6:v=>parseFloat(v)>=4?CE:parseFloat(v)>=3?CW:COK}}
      );
    } // end section 4 if(total>0)

    _nextSectNum = 5; // after sections 2,3,4
    } // end if(reportType === 'annual') — sections 2-4 skipped for monthly

    // ══════════ CRITICAL ERRORS — DEEP ANALYSIS ══════════
    if(critical.length>0){
      const critSectNum = String(_nextSectNum); _nextSectNum++;
      sect(critSectNum, L.critIncidents);
      doc.fontSize(9.5).fillColor(CT).font(F.reg);
      const critIntro = isKo
        ? critical.length+'건의 난이도 4+ 장애가 발생하여 경영진의 확인이 필요합니다.'
        : critical.length+' error(s) at Difficulty 4+ require management attention.';
      doc.text(critIntro, ML, doc.y, {width:PW,lineBreak:false});
      doc.moveDown(0.4);

      // ── Critical Errors Summary Table ──
      doc.fillColor(CT).fontSize(10).font(F.bold).text(H.overview,ML);
      doc.moveDown(0.25);
      const ciHeaders = [H.rank, H.branch, H.zone, H.date, H.difficulty, H.duration, H.solvedBy];
      const ciWidths = [39,85,186,101,93,101,192];
      const ciRows = critical.sort((a,b)=>(b.Difficulty||0)-(a.Difficulty||0)).map((r,i)=>[
        i+1,
        r.Branch||'?',
        (r.Zone||'N/A').length>20?(r.Zone||'').slice(0,19)+'..':r.Zone||'N/A',
        r.Date||'--',
        'Lv.'+r.Difficulty,
        trTime(r.TimeTaken)||'--',
        (r.SolvedBy||'N/A').length>22?(r.SolvedBy||'').slice(0,21)+'..':r.SolvedBy||'N/A'
      ]);
      tbl(ciHeaders, ciRows, ciWidths, {
        colColors:{4:()=>CE}
      });
      doc.moveDown(0.3);

      doc.fillColor(CT).fontSize(10).font(F.bold).text(H.detailedAnalysis,ML);
      doc.moveDown(0.25);

      critical.forEach((r,i)=>{
        // Find similar history for this incident
        const simHist = findSimilar(r.Zone, r.Category, r.IssueDetail);
        const hqComment = r.HQ && r.HQ!=='undefined' && r.HQ!=='null' ? r.HQ : '';

        // Build synthesized analysis
        let analysis = '';
        if(simHist.length>0){
          const pastActions = simHist.map(h=>h.action).filter(a=>a&&a!=='undefined').slice(0,2);
          const pastHQ = simHist.map(h=>h.hq||h.hqEng).filter(h=>h&&h!=='undefined'&&h!=='null').slice(0,2);
          if(pastActions.length>0) analysis += (isKo?'과거 해결 방법: ':'Past Resolution: ')+pastActions[0].slice(0,120)+'. ';
          if(pastHQ.length>0) analysis += (isKo?'본사 지침: ':'HQ Guidance: ')+pastHQ[0].slice(0,120)+'. ';
        }
        if(hqComment) analysis += (isKo?'현재 본사 의견: ':'Current HQ Note: ')+hqComment.slice(0,120)+'. ';
        if(!analysis) analysis = isKo ? '일치하는 과거 데이터가 없습니다. 현장 조사 및 근본 원인 문서화를 권장합니다.' : 'No matching historical data. Recommend field investigation and root cause documentation.';

        // Measure actual text heights for dynamic card sizing
        const issueLabel = isKo ? '장애: ' : 'Issue: ';
        const actionLabel = isKo ? '조치: ' : 'Action Taken: ';
        doc.font(F.reg).fontSize(9.5);
        const issueH = doc.heightOfString(issueLabel+trText(r.IssueDetail||'N/A'), {width:PW-28});
        const actionH = doc.heightOfString(actionLabel+trText(r.ActionTaken||'N/A'), {width:PW-28});
        doc.font(F.reg).fontSize(9);
        const analysisH = doc.heightOfString(analysis, {width:PW-32});
        const cardH = 48 + issueH + actionH + analysisH + (simHist.length>0?16:0) + 30;
        pc(cardH+8);

        const cy=doc.y;
        doc.save().roundedRect(ML,cy,PW,cardH,6).fillAndStroke('#FCEBEB',CL).restore();
        doc.save().rect(ML,cy,4,cardH).fill(CE).restore();

        let ty=cy+6;
        const diffLabel = isKo ? '난이도 ' : 'Difficulty ';
        doc.fillColor(CE).fontSize(10).font(F.bold).text('#'+(i+1)+'  ['+r.Branch+']  '+(r.Zone||'N/A')+'  --  '+diffLabel+r.Difficulty,ML+14,ty,{width:PW-28,lineBreak:false});
        ty+=15;
        doc.fillColor(CT).fontSize(9.5).font(F.reg).text(issueLabel+trText(r.IssueDetail||'N/A'),ML+14,ty,{width:PW-28,height:issueH+6,lineBreak:true});
        ty+=issueH+4;
        doc.fillColor(COK).font(F.reg).text(actionLabel+trText(r.ActionTaken||'N/A'),ML+14,ty,{width:PW-28,height:actionH+6,lineBreak:true});
        ty+=actionH+4;
        const byLabel = isKo ? '처리자: ' : 'By: ';
        const durationLabel = isKo ? '소요시간: ' : 'Duration: ';
        const dateLabel = isKo ? '일자: ' : 'Date: ';
        doc.fillColor(CS).fontSize(8.5).font(F.light).text(byLabel+(r.SolvedBy||'N/A')+'  |  '+durationLabel+(trTime(r.TimeTaken)||'N/A')+'  |  '+dateLabel+(r.Date||'N/A'),ML+14,ty,{width:PW-28,lineBreak:false});
        ty+=14;

        // Analysis section
        doc.moveTo(ML+14,ty).lineTo(MR-14,ty).strokeColor('#e8c6c6').lineWidth(0.4).stroke();
        ty+=5;
        const analysisTitle = isKo ? '종합 분석 (이력 + 본사)' : 'SYNTHESIZED ANALYSIS (History + HQ)';
        doc.fillColor('#7c2d2d').fontSize(8.5).font(F.bold).text(analysisTitle,ML+14,ty,{width:PW-28,lineBreak:false});
        ty+=12;
        doc.fillColor(CT).fontSize(9).font(F.reg).text(analysis,ML+14,ty,{width:PW-32,height:analysisH+6,lineBreak:true});
        ty+=analysisH+2;

        if(simHist.length>0){
          const simText = isKo
            ? r.Zone+' / '+trCat(r.Category)+' 영역에서 '+simHist.length+'건의 유사 과거 사례를 기반으로 분석'
            : 'Based on '+simHist.length+' similar past case(s) in '+r.Zone+' / '+r.Category;
          doc.fillColor(CS).fontSize(8).font(F.light).text(simText,ML+14,ty,{width:PW-28,lineBreak:false});
        }

        doc.y=cy+cardH+6;
      });
    } // end critical errors section (only if critical errors exist)

    // ══════════ RECOMMENDATIONS & ACTION ITEMS ══════════
    if(total>0){
      const recSectNum = String(_nextSectNum); _nextSectNum++;
      sect(recSectNum, L.recommendations);
      doc.fontSize(10).fillColor(CT).font(F.reg);

      const recs=[];
      const topZ=Object.entries(zoneCount).sort((a,b)=>b[1]-a[1])[0];
      if(topZ){
        const zoneText = isKo ? topZ[0]+H.recZone.replace('{cnt}',topZ[1]).replace('{pct}',Math.round(topZ[1]/total*100)) : topZ[0]+' recorded '+topZ[1]+' errors ('+Math.round(topZ[1]/total*100)+'%). Recommend focused preventive maintenance and root cause investigation.';
        recs.push({tag:'ZONE',color:'#185FA5',text:zoneText});
      }
      const topC=Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0];
      if(topC){
        const tip = isKo ?
          (topC[0]==='Software'||topC[0].includes('소프트')?H.tipSW:topC[0]==='Hardware'||topC[0].includes('하드')?H.tipHW:H.tipNet) :
          (topC[0]==='Software'?'Consider firmware/software update cycle and version audit.':topC[0]==='Hardware'?'Consider hardware inspection schedule and spare parts check.':'Review network infrastructure and connectivity.');
        const catText = isKo ? trCat(topC[0])+H.catPctText.replace('{pct}',Math.round(topC[1]/total*100))+tip : topC[0]+' accounts for '+Math.round(topC[1]/total*100)+'% of errors. '+tip;
        recs.push({tag:'CATEGORY',color:'#993C1D',text:catText});
      }
      if(critical.length>0){
        const critText = isKo ? critical.length+H.recCritical : critical.length+' errors at Difficulty 4+. Root cause analysis and corrective action plan required within 5 business days.';
        recs.push({tag:'CRITICAL',color:CE,text:critText});
      } else {
        const stabText = isKo ? H.recNoCrit : 'No critical errors. Current procedures are effective.';
        recs.push({tag:'STABILITY',color:COK,text:stabText});
      }
      if(prevTotal>0){
        const d=total-prevTotal;
        if(d>0){
          const trendText = isKo ? H.recTrendUp.replace('{d}',d).replace('{pct}',Math.round(d/prevTotal*100)) : 'Errors increased by '+d+' (+'+Math.round(d/prevTotal*100)+'%) vs previous month. Investigate contributing factors.';
          recs.push({tag:'TREND',color:CW,text:trendText});
        } else if(d<0){
          const trendText = isKo ? H.recTrendDown.replace('{d}',Math.abs(d)).replace('{pct}',Math.round(Math.abs(d)/prevTotal*100)) : 'Errors decreased by '+Math.abs(d)+' (-'+Math.round(Math.abs(d)/prevTotal*100)+'%) vs previous month. Positive trend.';
          recs.push({tag:'TREND',color:COK,text:trendText});
        }
      }
      if(avgRes>60){
        const respText = isKo ? H.recResponse.replace('{avg}',avgRes) : 'Avg resolution time '+avgRes+' min exceeds 60 min target. Review escalation procedures.';
        recs.push({tag:'RESPONSE',color:CW,text:respText});
      }

      // Recommendations table
      const recHeaders = [H.priority, H.category, H.recommendation, H.status];
      const recWidths = isKo ? [77, 85, 549, 86] : [77, 108, 519, 93];
      const koTag = {ZONE:'Zone',CATEGORY:'유형',CRITICAL:'위험',STABILITY:'안정',TREND:'추이',RESPONSE:'대응'};
      const recRows = recs.map((rec,i)=>{
        const status = rec.color===CE?(isKo?'긴급':'URGENT'):rec.color===CW?(isKo?'주의':'WARNING'):(isKo?'양호':'OK');
        return [
          '#'+(i+1),
          isKo?(koTag[rec.tag]||rec.tag):rec.tag,
          rec.text,
          status
        ];
      });
      tbl(recHeaders, recRows, recWidths, {
        leftCols:[2],
        colColors:{3:v=>{const s=String(v).toLowerCase();return(s.includes('urgent')||s.includes('긴급'))?CE:(s.includes('warn')||s.includes('주의'))?CW:COK;}}
      });
    } // end if(total>0) — recommendations section

    // ══════════════════════════════════════════════
    //  FOOTER ALL PAGES
    // ══════════════════════════════════════════════
    _markPage();
    const tp=doc.bufferedPageRange().count;
    const contentPageList=[];
    for(let i=0;i<tp;i++){
      if(_contentPages.has(i)) contentPageList.push(i);
    }
    const totalContent=contentPageList.length;
    const monthLabel=MONTHS_EN[month]||('Month '+(month+1));
    // d'strict title format: DSKR-GTO-Monthly Error Report_MMMYY or [Branch]-Monthly Error Report_MMMYY
    const monthShort = (monthLabel||'').slice(0,3).toUpperCase();
    const yearShort = String(year).slice(2);
    const dstrictId = branchFilter
      ? (branchFilter + '-Monthly Error Report_' + monthShort + yearShort)
      : ('DSKR-GTO-Monthly Error Report_' + monthShort + yearShort);
    const footerTitle = safeTitle ? ("d'strict  |  " + safeTitle) : ("d'strict  |  " + dstrictId);
    for(let ci=0;ci<contentPageList.length;ci++){
      const i=contentPageList[ci];
      doc.switchToPage(i);
      doc.save().rect(0,571,841,24).fill(CT).restore();
      doc.fillColor('#a3a29c').fontSize(7.5).font(F.light);
      doc.text(footerTitle,ML,576,{width:PW-60,lineBreak:false});
      doc.text('Page '+(ci+1)+'/'+totalContent,MR-60,576,{width:60,align:'right',lineBreak:false});
    }
    // Add top purple bar to all pages
    for(let pi=0;pi<tp;pi++){
      doc.switchToPage(pi);
      doc.save().rect(0,0,841,6).fill(CP).restore();
    }
    doc.switchToPage(tp-1);

    doc.end();
  }));
}

module.exports = { generatePDF };
