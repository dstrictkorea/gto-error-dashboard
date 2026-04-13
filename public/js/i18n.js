/* ═══════════════════════════════════════════
   i18n — Korean / English Toggle (v4.2)
   Complete site-wide localization
   ═══════════════════════════════════════════ */
// URL locale takes priority: /kr → Korean, /en → English, otherwise localStorage
var _lang = (function(){
  var p = location.pathname.toLowerCase();
  if (p === '/kr') return 'ko';
  if (p === '/en') return 'en';
  return localStorage.getItem('lang') || 'en';
})();

var I18N = {
  en: {
    // Navigation
    daily: 'Daily', monthly: 'Monthly', errorLog: 'Error Log', branches: 'Branches', search: 'Search',
    // KPI
    total: 'Total', critical: 'CRITICAL', avgDiff: 'AVG DIFF', sync: 'Sync',
    // Daily page
    dailyOverview: 'Daily Overview',
    today: 'Today', all: 'All',
    today_total: 'Today Total', vs_yesterday: 'vs Yesterday', vs_last_week: 'vs Last Week',
    compared_yesterday: 'Compared to previous day', compared_last_week: 'Compared to same day last week',
    most_affected: 'Most Affected', daily_errors: 'Daily Errors', error_count: 'Error Count',
    no_errors: 'No Errors Reported', no_errors_sub: 'All Clear For This Date',
    view_all_errors: 'View All In Error Log',
    weeklyTrend: 'Weekly Error Trend (7 Days)', fiveDayTrend: '5-Day Trend', categoryBreakdown: 'Error Category (SW / HW / Network)', branchComparison: 'Errors by Branch', recentErrors: 'Recent Errors (This Week)',
    topZone: 'Top Zone (Most Errors)', topCategory: 'Top Category',
    thisWeek: 'This Week (7 Days)', kpiToday: 'Today', vsPrevWeek: 'Vs Prev Week', avgPerDay: 'Avg / Day', errorsPerDay: 'Errors Per Day',
    monthlyTrend: 'Monthly Error Trend', zoneHeatmap: 'Errors by Zone', difficultyChart: 'Error Severity Level', actionType: 'Resolution Method',
    submitError: 'Submit Error',
    // Monthly page
    monthlyOverview: 'Monthly Overview',
    annualTrend: 'Monthly Error Trend', issueCategory: 'Error Category (SW / HW / Network)',
    topRecurring: 'Top Recurring Issues',
    errors: 'errors', noErrors: 'No errors',
    // Monthly table headers
    thRank: '#', thBranch: 'Branch', thZone: 'Zone', thCategory: 'Category', thIssue: 'Issue', thCount: 'Count',
    // Error Log page
    errorLogTitle: 'Error Log',
    errorLogSub: 'Click any row for equipment matching, similar cases, and AI-powered analysis',
    period: 'Period', filter: 'Filter',
    allMonths: 'All Months', allBranches: 'All Branches', allZones: 'All Zones',
    allCategories: 'All Categories', allDiff: 'All Diff',
    searchPlaceholder: 'Search...', reset: 'Reset', export: 'Export',
    showing: 'Showing', of: 'of',
    noMatchingRecords: 'No matching records',
    noMatchingSub: 'Try adjusting your filters or search terms',
    resetFilters: 'Reset Filters',
    // Error Log table headers
    thDate: 'Date', thSolvedBy: 'Solved By', thIssueDetail: 'Issue Detail',
    thAction: 'Action', thDuration: 'Duration', thDiff: 'Diff',
    // Region toggle
    korea: 'Korea', global: 'Global',
    regionKorea: '🇰🇷 Korea', regionGlobal: '🌍 Global',
    // Branches page
    branchDetail: 'Branch Detail',
    perBranchAnalysis: 'Per-branch analysis',
    live: 'Live', online: 'Online',
    allBranchesLabel: 'All Branches',
    gangneung: 'Gangneung', yeosu: 'Yeosu', busan: 'Busan', jeju: 'Jeju',
    newYork: 'New York', lasVegas: 'Las Vegas', dubai: 'Dubai',
    gangneungFull: 'Gangneung, Korea', yeosuFull: 'Yeosu, Korea', busanFull: 'Busan, Korea', jejuFull: 'Jeju, Korea',
    newYorkFull: 'New York, USA', lasVegasFull: 'Las Vegas, USA', dubaiFull: 'Dubai, UAE',
    totalErrors: 'Total Errors', swErrors: 'Software', hwErrors: 'Hardware', criticalErrors: 'Critical',
    zoneBreakdown: 'Zone Breakdown', recentErrors: 'Recent Errors',
    noErrorsRecorded: 'No errors recorded for this period.',
    errorDistBranch: 'Error Distribution by Branch',
    // Branches table headers
    thActionType: 'Action Type', thDetail: 'Detail',
    // Search page
    searchTitle: 'Search',
    searchSub: 'Past_History — Resolved cases archive',
    searchResolved: 'Search resolved cases...',
    noFound: 'No cases found', tryDiffSearch: 'Try different search terms or filters',
    // Search result labels
    resolvedBy: 'Resolved by', cat: 'Cat', diff: 'Diff',
    pastAction: 'Action', hqNote: 'HQ Note',
    // AI page
    aiAnalysis: 'AI Analysis',
    aiSubtitle: 'Gemini 2.5 Flash / Llama 3.3 70B (Groq) / Mistral Small — All Free',
    aiTitle: 'AI Analysis — Free API Keys Required',
    howItWorks: 'How it works:',
    aiStep1: '1. Click a <b>Difficulty 4+</b> error in Error Log',
    aiStep2: '2. 3 free AIs comprehensively analyze: past history, equipment specs, manufacturer manuals, industry best practices',
    aiStep3: '3. Selects the best response and presents expert-level analysis',
    aiStep4: '4. Output: <b>Root Cause / Immediate Action / Prevention / Equipment Note / Pattern Alert</b>',
    freeApiSetup: 'Free API Key Setup (~1 min each):',
    addToEnv: 'Add to .env file:',
    copyBtn: 'Copy',
    worksWithOne: '* Works with just 1 key. Best-of analysis activates with 2+ keys.',
    // Detail modal
    equipmentMatch: 'Equipment Matching', similarCases: 'Similar Past Cases',
    relatedAssets: 'Related Assets', pastCases: 'Past Similar Cases',
    requestAI: 'Request AI Analysis', aiReady: 'AI Ready',
    // Report buttons
    download: 'Download', preview: 'Preview', email: 'Email',
    monthlyLabel: 'MONTHLY',
    monthlyTitle: 'Monthly Error Report',
    monthlySub: 'Selected month summary',
    engMonthlyTitle: 'Monthly Error Report (ENG)',
    engMonthlySub: 'Generate a PDF summary report for the selected month',
    korMonthlyTitle: '월간 에러 리포트 (KOR)',
    korMonthlySub: '선택된 월의 PDF 요약 리포트를 생성합니다',
    annualLabel: 'ANNUAL',
    annualTitle: 'Annual Error Report',
    annualSub: 'Selected year full-year summary',
    engAnnualTitle: 'Annual Error Report (ENG)',
    engAnnualSub: 'Generate a full-year PDF summary report',
    korAnnualTitle: '연간 에러 리포트 (KOR)',
    korAnnualSub: '선택된 연도의 연간 PDF 요약 리포트를 생성합니다',
    // Footer
    footer1: 'Enterprise Edition', footer2: 'Last sync:', footer3: 'Built by',
    // Misc
    liveSync: 'Live', connecting: 'Connecting...',
    logoSub: 'Global Tech Ops',
    vs: 'vs', page: 'Page', prev: 'Prev', next: 'Next',
    onSite: 'On-Site', remote: 'Remote',
    // Loading
    loadingSteps: 'Connecting → Authenticating → Loading data',
    // Detail panel
    issueContext: 'Issue Context', resolution: 'Resolution',
    branch: 'Branch', zone: 'Zone', category: 'Category', date: 'Date',
    solvedBy: 'Solved By', action: 'Action', duration: 'Duration',
    hqLabel: 'HQ', similarCasesCount: 'Similar Cases',
    noSimilarCases: 'No similar cases found',
    highDiffDetected: 'High-difficulty case detected.',
    highDiffSub: 'Click the button below for Root Cause Analysis, Immediate Actions, and Prevention Strategies.',
    aiReadySub: 'Get troubleshooting guidance, similar solutions, and best practices.',
    aiReadyLabel: 'AI-powered support ready.',
    incident: 'Incident',
    // Branches extras
    perPage: 'Per Page:', lastUpdate: 'Last Update:',
    records: 'records', allErrors: 'All Errors',
    globalOverview: 'Global Branches Overview',
    allBranchErrors: 'All Branches — Errors',
    navigateHint: '← → to navigate pages',
    // AI Analysis section headers
    aiRootCause: 'ROOT CAUSE', aiAction: 'IMMEDIATE ACTION',
    aiPrevention: 'PREVENTION', aiEquipment: 'EQUIPMENT NOTE',
    aiPattern: 'PATTERN ALERT', aiAnalysisResult: 'AI Analysis',
    aiModels: 'Models', aiBest: 'Best',
    aiRegenerate: 'Regenerate', aiCopyAll: 'Copy All',
    aiNotConfigured: 'AI API Keys Not Configured',
    aiNoResponse: 'No AI response received. Try regenerating.',
    aiAnalyzing: 'Analyzing… Step 1/3: Checking history',
    aiFailed: 'Analysis Failed', aiRetry: 'Retry',
    aiAnalysisComplete: 'AI analysis complete',
    aiAnalysisFailed: 'AI analysis failed',
    copied: 'Copied!', analysisCopied: 'Analysis copied!',
    // Pull-to-refresh
    pullToRefresh: 'Pull to refresh', releaseToRefresh: 'Release to refresh', refreshing: 'Refreshing...',
    // Export & clipboard
    copiedToClipboard: 'Copied to clipboard!', noDataExport: 'No data available to export',
    exported: 'exported',
    // Mobile empty states
    noErrorsFound: 'No errors found', adjustFilters: 'Adjust filters or pull down to refresh',
    totalErrorsLabel: 'Total Errors', categoryLabel: 'Category', difficultyLabel: 'Difficulty',
    topZonesLabel: 'Top Zones', criticalErrors: 'Critical Errors', recentErrorsLabel: 'Recent Errors',
    ofLabel: 'of', noDetail: 'No detail',
    // Daily inline fallbacks
    noCategoryData: 'No category data to display', noZoneData: 'No Zone Data', noCatData: 'No Category Data',
    noErrorsThisWeek: 'No errors reported this week',
    // CSV headers
    csvBranch: 'Branch', csvZone: 'Zone', csvDate: 'Date', csvSolvedBy: 'Solved By',
    csvCategory: 'Category', csvIssue: 'Issue Detail', csvAction: 'Action', csvDuration: 'Duration', csvDiff: 'Difficulty',
  },
  ko: {
    // Navigation
    daily: '일일', monthly: '월간', errorLog: '에러 로그', branches: '지점별', search: '검색',
    // KPI
    total: '전체', critical: '위험', avgDiff: '평균 난이도', sync: '동기화',
    // Daily page
    dailyOverview: '일일 현황',
    today: '오늘', all: '전체',
    today_total: '오늘 합계', vs_yesterday: '전일 대비', vs_last_week: '전주 대비',
    compared_yesterday: '전일 대비', compared_last_week: '전주 동일 요일 대비',
    most_affected: '최다 발생', daily_errors: '일일 에러', error_count: '에러 수',
    no_errors: '에러 없음', no_errors_sub: '해당 날짜에 보고된 에러가 없습니다',
    view_all_errors: '에러 로그에서 전체 보기',
    weeklyTrend: '주간 에러 추이 (7일)', fiveDayTrend: '5일 추이', categoryBreakdown: '에러 유형 (SW / HW / Network)', branchComparison: '지점별 에러', recentErrors: '최근 에러 (이번 주)',
    topZone: '최다 에러 구역', topCategory: '주요 에러 유형',
    thisWeek: '이번 주 (7일)', kpiToday: '오늘', vsPrevWeek: '전주 대비', avgPerDay: '일평균', errorsPerDay: '일일 평균 에러',
    monthlyTrend: '월간 에러 추이', zoneHeatmap: 'Zone별 에러', difficultyChart: '에러 심각도', actionType: '처리 방법',
    submitError: '에러 제출하기',
    // Monthly page
    monthlyOverview: '월간 현황',
    annualTrend: '월간 에러 추이', issueCategory: '에러 유형 (SW / HW / Network)',
    topRecurring: '주요 반복 장애',
    errors: '건', noErrors: '에러 없음',
    // Monthly table headers
    thRank: '#', thBranch: '지점', thZone: 'Zone', thCategory: '유형', thIssue: '장애 내역', thCount: '건수',
    // Error Log page
    errorLogTitle: '에러 로그',
    errorLogSub: '행 클릭 시 장비 매칭, 유사 사례, AI 분석 확인 가능',
    period: '기간', filter: '필터',
    allMonths: '전체 월', allBranches: '전체 지점', allZones: '전체 Zone',
    allCategories: '전체 유형', allDiff: '전체 난이도',
    searchPlaceholder: '검색...',  reset: '초기화', export: '내보내기',
    showing: '', of: '/',
    noMatchingRecords: '일치하는 기록 없음',
    noMatchingSub: '필터 또는 검색어를 조정해 보세요',
    resetFilters: '필터 초기화',
    // Error Log table headers
    thDate: '일자', thSolvedBy: '처리자', thIssueDetail: '장애 내역',
    thAction: '조치', thDuration: '소요시간', thDiff: '난이도',
    // Region toggle
    korea: '국내', global: '글로벌',
    regionKorea: '🇰🇷 국내', regionGlobal: '🌍 글로벌',
    // Branches page
    branchDetail: '지점별 상세',
    perBranchAnalysis: '지점별 분석',
    live: '실시간', online: '연결됨',
    allBranchesLabel: '전체 지점',
    gangneung: '강릉', yeosu: '여수', busan: '부산', jeju: '제주',
    newYork: '뉴욕', lasVegas: '라스베가스', dubai: '두바이',
    gangneungFull: '강릉', yeosuFull: '여수', busanFull: '부산', jejuFull: '제주',
    newYorkFull: '미국 뉴욕', lasVegasFull: '미국 라스베가스', dubaiFull: 'UAE 두바이',
    totalErrors: '총 에러', swErrors: '소프트웨어', hwErrors: '하드웨어', criticalErrors: '위험 장애',
    zoneBreakdown: 'Zone별 현황', recentErrors: '최근 에러',
    noErrorsRecorded: '해당 기간 에러 기록 없음.',
    errorDistBranch: '지점별 에러 분포',
    // Branches table headers
    thActionType: '조치 유형', thDetail: '상세 내역',
    // Search page
    searchTitle: '검색',
    searchSub: 'Past_History — 해결 사례 아카이브',
    searchResolved: '해결 사례 검색...',
    noFound: '검색 결과 없음', tryDiffSearch: '다른 검색어 또는 필터를 사용해 보세요',
    // Search result labels
    resolvedBy: '처리자', cat: '유형', diff: '난이도',
    pastAction: '조치', hqNote: '본사 의견',
    // AI page
    aiAnalysis: 'AI 분석',
    aiSubtitle: 'Gemini 2.5 Flash / Llama 3.3 70B (Groq) / Mistral Small — 모두 무료',
    aiTitle: 'AI 분석 — 무료 API 키 필요',
    howItWorks: '작동 방식:',
    aiStep1: '1. 에러 로그에서 <b>난이도 4+</b> 에러 클릭',
    aiStep2: '2. 3개 무료 AI가 종합 분석: 과거 이력, 장비 사양, 제조사 매뉴얼, 산업 모범 사례',
    aiStep3: '3. 최적 응답 선정 후 전문가 수준 분석 제시',
    aiStep4: '4. 출력: <b>근본 원인 / 즉시 조치 / 예방책 / 장비 노트 / 패턴 알림</b>',
    freeApiSetup: '무료 API 키 설정 (~각 1분):',
    addToEnv: '.env 파일에 추가:',
    copyBtn: '복사',
    worksWithOne: '* 키 1개만으로 작동. 2개 이상 시 최적 분석 활성화.',
    // Detail modal
    equipmentMatch: '장비 매칭', similarCases: '유사 과거 사례',
    relatedAssets: '관련 장비', pastCases: '유사 사례',
    requestAI: 'AI 분석 요청', aiReady: 'AI 준비',
    // Report buttons
    download: '다운로드', preview: '미리보기', email: '이메일',
    monthlyLabel: '월간',
    monthlyTitle: '월간 에러 리포트',
    monthlySub: '선택된 월의 요약',
    engMonthlyTitle: 'Monthly Error Report (ENG)',
    engMonthlySub: 'Generate a PDF summary report for the selected month',
    korMonthlyTitle: '월간 에러 리포트 (KOR)',
    korMonthlySub: '선택된 월의 PDF 요약 리포트를 생성합니다',
    annualLabel: '연간',
    annualTitle: '연간 에러 리포트',
    annualSub: '선택된 연도의 연간 요약',
    engAnnualTitle: 'Annual Error Report (ENG)',
    engAnnualSub: 'Generate a full-year PDF summary report',
    korAnnualTitle: '연간 에러 리포트 (KOR)',
    korAnnualSub: '선택된 연도의 연간 PDF 요약 리포트를 생성합니다',
    // Footer
    footer1: '엔터프라이즈', footer2: '최종 동기화:', footer3: '제작',
    // Misc
    liveSync: '실시간', connecting: '연결 중...',
    logoSub: '글로벌 기술운영',
    vs: '대비', page: '페이지', prev: '이전', next: '다음',
    onSite: '현장 대응', remote: '원격 지원',
    // Loading
    loadingSteps: '연결 중 → 인증 중 → 데이터 로딩',
    // Detail panel
    issueContext: '장애 상세', resolution: '처리 내역',
    branch: '지점', zone: 'Zone', category: '유형', date: '일자',
    solvedBy: '처리자', action: '조치', duration: '소요시간',
    hqLabel: '본사', similarCasesCount: '유사 사례',
    noSimilarCases: '유사 사례 없음',
    highDiffDetected: '고난이도 장애가 감지되었습니다.',
    highDiffSub: '아래 버튼을 클릭하여 근본 원인 분석, 즉시 조치, 예방 전략을 확인하세요.',
    aiReadySub: '트러블슈팅 가이드, 유사 솔루션, 모범 사례를 확인하세요.',
    aiReadyLabel: 'AI 지원 준비 완료.',
    incident: '인시던트',
    // Branches extras
    perPage: '페이지당:', lastUpdate: '최종 업데이트:',
    records: '건', allErrors: '전체 에러',
    globalOverview: '글로벌 지점 현황',
    allBranchErrors: '전체 지점 에러',
    navigateHint: '← → 페이지 이동',
    // AI Analysis section headers
    aiRootCause: '근본 원인', aiAction: '즉시 조치',
    aiPrevention: '예방 대책', aiEquipment: '장비 참고',
    aiPattern: '패턴 알림', aiAnalysisResult: 'AI 분석',
    aiModels: '모델', aiBest: '최적',
    aiRegenerate: '재분석', aiCopyAll: '전체 복사',
    aiNotConfigured: 'AI API 키 미설정',
    aiNoResponse: 'AI 응답 없음. 재분석을 시도하세요.',
    aiAnalyzing: '분석 중… 1/3단계: 이력 확인',
    aiFailed: '분석 실패', aiRetry: '재시도',
    aiAnalysisComplete: 'AI 분석 완료',
    aiAnalysisFailed: 'AI 분석 실패',
    copied: '복사됨!', analysisCopied: '분석 결과 복사됨!',
    // Pull-to-refresh
    pullToRefresh: '당겨서 새로고침', releaseToRefresh: '놓으면 새로고침', refreshing: '새로고침 중...',
    // Export & clipboard
    copiedToClipboard: '클립보드에 복사됨!', noDataExport: '내보낼 데이터가 없습니다',
    exported: '건 내보내기 완료',
    // Mobile empty states
    noErrorsFound: '에러 없음', adjustFilters: '필터를 조정하거나 당겨서 새로고침하세요',
    totalErrorsLabel: '총 에러', categoryLabel: '유형', difficultyLabel: '난이도',
    topZonesLabel: '주요 Zone', criticalErrors: '위험 에러', recentErrorsLabel: '최근 에러',
    ofLabel: '/', noDetail: '상세 내역 없음',
    // Daily inline fallbacks
    noCategoryData: '에러 카테고리 데이터 없음', noZoneData: 'Zone 데이터 없음', noCatData: '카테고리 데이터 없음',
    noErrorsThisWeek: '이번 주 에러가 없습니다',
    // CSV headers
    csvBranch: '지점', csvZone: 'Zone', csvDate: '일자', csvSolvedBy: '처리자',
    csvCategory: '유형', csvIssue: '장애 내역', csvAction: '조치', csvDuration: '소요시간', csvDiff: '난이도',
  }
};

function t(key) { return (I18N[_lang] || I18N.en)[key] || (I18N.en)[key] || key; }

function toggleLang() {
  _lang = _lang === 'en' ? 'ko' : 'en';
  localStorage.setItem('lang', _lang);
  applyLang();
  // Re-render active page
  var activePage = document.querySelector('.page.active');
  if(activePage) {
    var pageId = activePage.id;
    if(pageId === 'pd' && typeof renderDaily==='function') renderDaily();
    else if(pageId === 'p0') renderP0();
    else if(pageId === 'p1') renderP1();
    else if(pageId === 'p2') renderBranchPage();
    else if(pageId === 'p3') renderHist();
  }
}

function applyLang() {
  var btn = document.getElementById('langToggle');
  if (btn) btn.textContent = _lang === 'en' ? 'EN' : 'KO';
  var mBtn = document.getElementById('m-lang-btn');
  if (mBtn) mBtn.textContent = _lang === 'en' ? 'EN' : 'KO';

  // Nav tabs
  var tabs = document.querySelectorAll('.ntab');
  var tabKeys = ['daily', 'monthly', 'errorLog', 'branches', 'search'];
  tabs.forEach(function(tab, i) { if (tabKeys[i]) tab.textContent = t(tabKeys[i]); });

  // Logo subtitle
  var sub = document.querySelector('.logo-sub');
  if (sub) sub.textContent = t('logoSub');

  // Sync pill
  var syncPill = document.querySelector('.pill.live');
  if (syncPill) {
    var dot = syncPill.querySelector('.ldot');
    syncPill.textContent = '';
    if (dot) syncPill.appendChild(dot);
    syncPill.appendChild(document.createTextNode(t('liveSync')));
  }

  // Loading screen text
  var loadS = document.getElementById('load-s');
  if (loadS) loadS.textContent = t('loadingSteps');

  // Sync button — icon only, no text

  // Mobile header subtitle (i18n)
  var mahLabel = document.getElementById('mah-page-label');
  if (mahLabel) {
    var activePage = document.querySelector('.page.active');
    var pageKeys = { pd: 'dailyOverview', p0: 'monthlyOverview', p1: 'errorLogTitle', p2: 'branchDetail', p3: 'searchTitle' };
    var key = activePage ? pageKeys[activePage.id] : 'dailyOverview';
    mahLabel.textContent = t(key || 'dailyOverview');
  }

  // Page titles
  var pdTitle = document.querySelector('#pd .ph-title');
  if (pdTitle) pdTitle.textContent = t('dailyOverview');

  var p0Title = document.querySelector('#p0 .ph-title');
  if (p0Title) p0Title.textContent = t('monthlyOverview');

  var p1Title = document.querySelector('#p1 .ph-title');
  if (p1Title) p1Title.textContent = t('errorLogTitle');
  var p1Sub = document.querySelector('#p1 .ph-sub');
  if (p1Sub) p1Sub.textContent = t('errorLogSub');

  var p2Title = document.querySelector('#p2 .ph-title');
  if (p2Title) p2Title.textContent = t('branchDetail');
  var p2Sub = document.querySelector('.branch-subtitle span:first-child');
  if (p2Sub) p2Sub.textContent = t('perBranchAnalysis');

  var p3Title = document.querySelector('#p3 .ph-title');
  if (p3Title) p3Title.textContent = t('searchTitle');
  var p3Sub = document.querySelector('#p3 .ph-sub');
  if (p3Sub) p3Sub.textContent = t('searchSub');

  var p4Title = document.querySelector('#p4 .ph-title');
  if (p4Title) p4Title.textContent = t('aiAnalysis');
  var p4Sub = document.querySelector('#p4 .ph-sub');
  if (p4Sub) p4Sub.textContent = t('aiSubtitle');

  // Filter labels (Period / Filter)
  var flbls = document.querySelectorAll('.flbl');
  var flblKeys = ['period', 'filter'];
  flbls.forEach(function(lbl, i) { if (flblKeys[i]) lbl.textContent = t(flblKeys[i]); });

  // Filter select defaults
  var filterDefaults = {
    'f1-yr': '', 'f1-mn': 'allMonths', 'f1-br': 'allBranches', 'f1-zn': 'allZones',
    'f1-ca': 'allCategories', 'f1-df': 'allDiff',
    'b-yr': '', 'b-mn': 'allMonths'
  };
  Object.keys(filterDefaults).forEach(function(id) {
    var sel = document.getElementById(id);
    if (sel && sel.options && sel.options[0] && filterDefaults[id]) {
      sel.options[0].text = t(filterDefaults[id]);
    }
  });

  // Search inputs
  var f1s = document.getElementById('f1-s');
  if (f1s) f1s.placeholder = t('searchPlaceholder');
  var histMain = document.getElementById('hist-s-main');
  if (histMain) histMain.placeholder = t('searchResolved');

  // Reset button
  var resetBtn = document.querySelector('[onclick*="Reset"]');
  // Export button
  var exportBtn = document.querySelector('[onclick="exportErrorsCSV()"]');
  if (exportBtn) exportBtn.innerHTML = '⬇ ' + t('export');

  // Chart titles — page-scoped mapping (not global index)
  var chartMap = {
    'daily-trend-chart': 'weeklyTrend',
    'daily-cat-chart': 'categoryBreakdown',
    'annual-trend': 'monthlyTrend',
    'cat-chart': 'issueCategory',
    'diff-chart': 'difficultyChart',
    'action-chart': 'actionType'
  };
  // Daily page ctitles (by parent canvas id)
  Object.keys(chartMap).forEach(function(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (canvas) {
      var card = canvas.closest('.card');
      if (card) {
        var ctitle = card.querySelector('.ctitle');
        if (ctitle) ctitle.textContent = t(chartMap[canvasId]);
      }
    }
  });
  // Top Zone / Top Category titles (by container id)
  var containerMap = {
    'daily-topzone': 'topZone',
    'daily-topcat': 'topCategory'
  };
  Object.keys(containerMap).forEach(function(containerId) {
    var container = document.getElementById(containerId);
    if (container) {
      var card = container.closest('.card');
      if (card) {
        var ctitle = card.querySelector('.ctitle');
        if (ctitle) ctitle.textContent = t(containerMap[containerId]);
      }
    }
  });
  // Zone heatmap title
  var zoneHmEl = document.getElementById('zone-hm');
  if (zoneHmEl) {
    var zoneCard = zoneHmEl.closest('.card');
    if (zoneCard) { var zt = zoneCard.querySelector('.ctitle'); if (zt) zt.textContent = t('zoneHeatmap'); }
  }
  // Daily list title
  var dailyListEl = document.getElementById('daily-list');
  if (dailyListEl) {
    var dlCard = dailyListEl.closest('.card');
    if (dlCard) { var dlt = dlCard.querySelector('.ctitle'); if (dlt) dlt.textContent = t('recentErrors'); }
  }

  // Top recurring title
  var tblTitle = document.querySelector('.tbl-title');
  if (tblTitle) tblTitle.textContent = t('topRecurring');

  // Error Log table headers
  var p1Headers = document.querySelectorAll('#p1 thead th');
  var p1HdrKeys = ['thRank','thBranch','thZone','thDate','thSolvedBy','thCategory','thIssueDetail','thAction','thDuration','thDiff'];
  p1Headers.forEach(function(th, i) {
    if (p1HdrKeys[i]) {
      // Preserve sort arrows
      var arrow = th.querySelector('.sort-arrow');
      var sortText = t(p1HdrKeys[i]);
      if (arrow) {
        th.childNodes[0].textContent = sortText + ' ';
      } else {
        th.textContent = sortText;
      }
    }
  });

  // Monthly table headers
  var monHeaders = document.querySelectorAll('#p0 thead th');
  var monHdrKeys = ['thRank', 'thBranch', 'thZone', 'thCategory', 'thIssue', 'thCount'];
  monHeaders.forEach(function(th, i) { if (monHdrKeys[i]) th.textContent = t(monHdrKeys[i]); });

  // Empty states
  var emptyTitle1 = document.querySelector('#p1-empty .empty-state-title');
  if (emptyTitle1) emptyTitle1.textContent = t('noMatchingRecords');
  var emptySub1 = document.querySelector('#p1-empty .empty-state-subtitle');
  if (emptySub1) emptySub1.textContent = t('noMatchingSub');

  var emptyTitle3 = document.querySelector('#hist-empty .empty-state-title');
  if (emptyTitle3) emptyTitle3.textContent = t('noFound');
  var emptySub3 = document.querySelector('#hist-empty .empty-state-subtitle');
  if (emptySub3) emptySub3.textContent = t('tryDiffSearch');

  // Report section headers
  var mLabel=document.getElementById('monthly-label');if(mLabel)mLabel.innerHTML='📋 '+t('monthlyLabel');
  var mTitle=document.getElementById('monthly-title');if(mTitle)mTitle.textContent=t('monthlyTitle');
  var mSub=document.getElementById('monthly-sub');if(mSub)mSub.textContent=t('monthlySub');
  var aLabel=document.getElementById('annual-label');if(aLabel)aLabel.innerHTML='📊 '+t('annualLabel');
  var aTitle=document.getElementById('annual-title');if(aTitle)aTitle.textContent=t('annualTitle');
  var aSub=document.getElementById('annual-sub');if(aSub)aSub.textContent=t('annualSub');

  // Footer
  var footerDivs = document.querySelectorAll('footer > div > div');
  if (footerDivs.length >= 3) {
    footerDivs[0].innerHTML = "<strong style=\"color:var(--t2)\">D'strict Error Dashboard</strong> v5.4 — 2026 " + t('footer1');
    footerDivs[1].innerHTML = t('footer2') + ' <span id="footer-sync-time">--</span>';
    footerDivs[2].innerHTML = '<a href="#" style="color:var(--purple);text-decoration:none;font-weight:500">d\'strict</a> © 2026 · ' + t('footer3') + ' <span style="color:var(--t2);font-weight:600">Tony Hwang</span>';
  }

  // Mobile bottom nav labels
  var mobileBottomBtns = document.querySelectorAll('.mobile-bottom-nav > button:not(#mobileAdminTab)');
  var mobileNavKeys = ['daily', 'monthly', 'errorLog', 'branches', 'search'];
  var mobileNavIcons = ['📅', '📊', '📋', '🏢', '🔍'];
  mobileBottomBtns.forEach(function(btn, i) {
    if (mobileNavKeys[i]) {
      var iconEl = btn.querySelector('.bnav-icon');
      var iconText = iconEl ? '' : mobileNavIcons[i];
      btn.childNodes.forEach(function(n) { if (n.nodeType === 3) n.textContent = t(mobileNavKeys[i]); });
    }
  });

  // Mobile sidebar nav labels
  var mobileSideItems = document.querySelectorAll('.mobile-nav-item');
  mobileSideItems.forEach(function(btn, i) {
    if (mobileNavKeys[i]) {
      var iconEl = btn.querySelector('.nav-icon');
      btn.childNodes.forEach(function(n) { if (n.nodeType === 3) n.textContent = t(mobileNavKeys[i]); });
    }
  });

  // Mobile lang toggle button text
  var mobileLangToggle = document.getElementById('mobileLangToggle');
  if (mobileLangToggle) mobileLangToggle.textContent = _lang === 'en' ? 'EN' : 'KO';

  // Search zone/category filter labels
  var histZn = document.getElementById('hist-zn');
  if (histZn && histZn.options && histZn.options[0]) histZn.options[0].text = t('allZones');
  var histCa = document.getElementById('hist-ca');
  if (histCa && histCa.options && histCa.options[0]) histCa.options[0].text = t('allCategories');
}

// Auto-apply on load
(function() {
  function init() {
    applyLang();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
