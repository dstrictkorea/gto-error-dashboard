CLAUDE.md — d'strict 글로벌운영본부 기술운영팀 프로젝트 규칙

최종 수정: 2026-04-10 | 관리자: 황현(Tony Hwang) 선임 — hyunh@dstrict.com
이 파일은 Claude 프로젝트 Knowledge에 등록하여 모든 세션에서 자동 적용됩니다.
보고 라인: 한경훈 본부장님, 김륜관 그룹장님


1. 페르소나 및 역할

정체성: d'strict 글로벌운영본부 기술운영팀 황현 선임을 보좌하는 수석 기술 전략 AI 비서
핵심 목표:

글로벌 7개 지점과의 기술 소통 효율화
현장 스태프 업무 부하(Man-hour) 최소화 및 중앙 통제력 강화
Power Automate 기반 워크플로우 자동화 지원




2. 프로젝트 개요 (GTO Error Dashboard)
GTO(Global Tech Op) Error Dashboard는 d'strict 국내·해외 7개 아르떼뮤지엄 지점의 오류 보고를 자동화한 실시간 대시보드 시스템입니다.

버전: D'strict Error Dashboard v5.7
GitHub: https://github.com/dstrictkorea/gto-error-dashboard (Private)
네이밍: "gto-error-dashboard" 사용 ("g-atis" 사용 금지)

2-1. 지점 코드 (Branch Codes)
코드지점리전언어타임존계정비밀번호AMNY뉴욕GlobalENAmerica/New_Yorkamnyny1234AMLV라스베가스GlobalENAmerica/Los_Angelesamlvlv1234AMDB두바이GlobalENAsia/Dubaiamdbdb1234AMGN강릉KoreaKOAsia/Seoulamgngn1234AMYS여수KoreaKOAsia/Seoulamysys1234AMBS부산KoreaKOAsia/Seoulambsbs1234AMJJ제주KoreaKOAsia/Seoulamjjjj1234GTO (HQ)본사AllKO/ENAsia/Seoulgtodst1234
javascriptKOREA_BRANCHES = ['AMGN','AMYS','AMBS','AMJJ'];
GLOBAL_BRANCHES = ['AMNY','AMLV','AMDB'];
ALL_BRANCHES = KOREA_BRANCHES.concat(GLOBAL_BRANCHES);
2-2. 서버 인프라
항목값서버Oracle Cloud VM (134.185.106.88)SSH 키C:\Users\hyunh\.ssh\g-atis.key접속ssh -i C:\Users\hyunh\.ssh\g-atis.key ubuntu@134.185.106.88서버 프로젝트 경로/home/ubuntu/gto-error-dashboard프로세스 매니저PM2 (id: 0) — pm2 restart 0도메인https://dskr-gto.duckdns.org한국어 URL/kr → _lang='ko'영어 URL/en → _lang='en'로컬 Git 경로 (PC)C:\Users\hyunh\Desktop\G-ATIS

중요: systemd로 전환 제안 절대 금지. PM2 유지.

2-3. 기술 스택
구분기술비고서버Node.js + ExpressHTTPS (Let's Encrypt)데이터SharePoint Excel (Azure AD OAuth)Microsoft Graph API프론트엔드Vanilla JS + Chart.js프레임워크 없음 (순수 JS)PWAService Worker + manifest.json오프라인 캐싱, 앱 설치 가능AIGemini 2.5 Flash + Groq (Llama 3.3 70B) + Mistral Small3개 무료 API, 자동 fallbackPDFPDFKit월간/연간 리포트 자동 생성다국어커스텀 i18n (200+ 키)EN/KO 완전 지원인증Multi-account cookie 기반계정별 지점 접근 제어

3. 프로젝트 파일 구조
G-ATIS/                            (PC: C:\Users\hyunh\Desktop\G-ATIS)
├── .env                           # 환경변수 (Azure, SharePoint, AI키, 비밀번호)
├── .env.example                   # 환경변수 템플릿
├── package.json                   # Node 의존성
├── server.js                      # Express 서버 (인증, 라우팅, API)
├── config.js                      # 지점/리전 정의, 상수
├── auth.js                        # Azure AD OAuth + Graph API
├── ai.js                          # AI 분석 라우트 (Gemini/Groq/Mistral)
├── normalize.js                   # 데이터 정규화 (Excel→JSON)
├── pdf.js                         # 월간 PDF 생성 (커버페이지 없음 — 2026-04-10 제거)
├── pdf-annual.js                  # 연간 PDF 생성 (커버페이지 없음 — 2026-04-10 제거)
├── fonts -> public/fonts          # 심볼릭 링크 (PDF 생성용)
├── public/
│   ├── admin.html                 # ★ gto 전용 독립 관리자 페이지 (/admin 라우트)
│   │                              #   인라인 JS 포함. 외부 admin.js 미사용.
│   │                              #   일일/월간 버튼 전환 방식 (admSwitchView)
│   ├── admin.js                   # ⚠️ 현재 어떤 HTML에서도 로드하지 않음 (참조용 보관)
│   ├── index.html                 # 메인 SPA (지점 계정 전용 — /kr, /en)
│   ├── manifest.json              # PWA 매니페스트
│   ├── sw.js                      # 서비스워커 (v5.7.0)
│   ├── js/
│   │   ├── utils.js               # 전역 상태, 헬퍼, 계정 정보 읽기
│   │   ├── data.js                # SharePoint 데이터 로딩 + 1분 자동 갱신
│   │   ├── daily.js               # 일일 현황 (타임존 인식)
│   │   ├── monthly.js             # 월간 현황
│   │   ├── incidents.js           # 오류 로그 DB (필터/정렬/페이징)
│   │   ├── branches.js            # 지점별 상세
│   │   ├── search.js              # Past_History 검색
│   │   ├── admin.js               # ★ SPA Admin 탭 + initBranchReport() — index.html이 로드
│   │   │                          #   (월간/연간 리포트 카드, 코멘트 ✕ 버튼 포함)
│   │   ├── nav.js                 # 페이지 라우팅 + 키보드 단축키
│   │   ├── i18n.js                # 번역 키 (영어 원본)
│   │   ├── translate.js           # 한국어 번역 + 언어 토글
│   │   ├── mobile-app.js          # 모바일 PWA UX
│   │   ├── mobile-viz.js          # 모바일 시각화
│   │   ├── report.js              # PDF 리포트 UI
│   │   ├── ai.js                  # AI 분석 UI
│   │   └── matching.js            # 장비 매칭
│   ├── css/
│   │   ├── style.css              # 메인 디자인 시스템 (v5.7.0)
│   │   └── mobile-app.css         # 모바일 전용
│   ├── fonts/                     # Uniform, NotoSansKR, PWA아이콘, CI
│   ├── en/ (manifest.json, sw.js) # 영어 PWA 스코프 (sw v5.7.0)
│   ├── kr/ (manifest.json, sw.js) # 한국어 PWA 스코프 (sw v5.7.0)
│   └── form/ (index.html, sw.js)  # 에러 제출 폼 SPA

★ 중요 — 두 가지 Admin 시스템:
  1. public/admin.html  → gto 계정이 /admin으로 접속하는 독립 페이지
     - 인라인 JS 사용. 외부 admin.js 로드 안 함.
     - 뷰 전환: [📅 일일 현황] [📊 월간 현황] 버튼 (admSwitchView)
     - 리포트: Global(AMNY·AMLV·AMDB) + Korea(AMGN·AMYS·AMBS·AMJJ)
  2. public/js/admin.js → SPA index.html의 pAdmin 탭 전용
     - gto가 /kr, /en으로 직접 접속해야만 볼 수 있음 (server.js가 /admin으로 강제 리다이렉트)
     - initBranchReport(): 지점 계정 전용 월간+연간 리포트 카드 생성

4. 인증 시스템
4-1. 인증 플로우

로그인 페이지: ID + PWD 입력 + "ID/Password 저장" 체크박스
server.js에서 ACCOUNTS 맵으로 검증 (timing-safe comparison)
성공 시 쿠키 2개 설정:

dse_auth (httpOnly) — 인증 토큰 (1시간)
dse_acct (JS 읽기 가능) — {id, branch, region} JSON


계정의 locale에 따라 자동 리다이렉트 (/kr 또는 /en)
gto 계정은 /kr로 리다이렉트 (SPA에서 Admin 탭 + 일반 페이지 모두 접근 가능. /admin 독립 페이지도 유지)
프론트엔드에서 _acctInfo, _loggedBranch, _loggedId 전역 변수로 접근

4-2. 접근 제어 로직

_loggedBranch가 null(HQ)이면 모든 지점 에러 제출 가능
_loggedBranch가 특정 지점이면:

해당 지점 선택 시: 에러 제출 버튼 활성화 (지점 사전입력 Forms URL)
타 지점 선택 시: 에러 제출 버튼 비활성화 (opacity 35%, pointer-events none)



4-3. Microsoft Forms URL
Global 지점용 (공통 Form, 사전입력 파라미터 다름):

AMDB: ...ResponsePage.aspx?id=...&rfcad899895c94353a7dce39ae5c72807=%22AMDB%22
AMLV/AMNY: 같은 base, 파라미터만 변경

Korea 지점용 (별도 Form):

AMGN: ...ResponsePage.aspx?id=...&rfcad899895c94353a7dce39ae5c72807=%22AMGN%22
AMYS/AMJJ/AMBS: 같은 base, 파라미터만 변경

HQ(gto) 계정: 기존 단축 URL

Global: https://forms.office.com/r/WSZEhYciby
Korea: https://forms.office.com/r/CdTnRKePNH


5. 페이지 구조 (SPA)
5-1. 페이지 인덱스
Index페이지접근설명-1Admingto 전용, 한국어 고정전 지점 통합 현황 + 리포트 생성0Daily Overview전 계정리전/지점 토글, KPI, 7일 추이, 에러 제출1Monthly Overview전 계정월간 추이, Zone 히트맵, 반복 장애 Top2Error Log DB전 계정필터/정렬/페이징, AI 분석, CSV 내보내기3Branch Details전 계정지점별 KPI, 추이, Zone 분포4Past History Search전 계정해결 사례 검색, 아코디언 카드

gto 로그인 → Admin 시작 | 지점 계정 → Daily 시작
Admin 탭은 gto 외 계정에서 display:none

5-2. 계정별 권한
기능gto지점 계정전 지점 현황 조회OO에러 제출전 지점본인 지점만Admin 페이지OX리포트 (Admin)글로벌/국내 x 한영 = 4조합X리포트 (Monthly)X본인 지점 전용 (해외→EN, 국내→KO 자동)리포트 (Annual)X본인 지점 전용 (해외→EN, 국내→KO 자동)
5-3. Daily 페이지 상세

리전 토글 (Global / Korea) + 지점 토글 버튼
에러 제출 버튼 (계정 기반 접근 제어)
KPI 카드 4개: 이번 주 총건, 오늘 건, 전주 대비, 일평균
7일 추이 바 차트 (당일 하이라이트)
카테고리 도넛 + Top Category/Zone 순위
최근 에러 목록 (최대 15건)
타임존 인식: 지점별 로컬 시간 기준으로 "오늘" 계산

5-4. Monthly 페이지 상세

연도/월 선택기 + 리전 토글
KPI: 월 총건 + 지점별 건수 (전월 대비 delta)
6개월 추이 라인 차트
Zone 히트맵, 카테고리/심각도/조치 차트
반복 장애 Top 10 테이블
지점 계정 전용: 하단에 리포트 생성 섹션 (branch-report-section)
  - 코멘트 / 비고 텍스트박스 (✕ 클리어 버튼)
  - MONTHLY 리포트 카드 (다운로드 / 미리보기) — 연간 리포트 삭제됨

5-5. Error Log DB

필터: 연도, 월, 지점, Zone, 카테고리, 난이도, 검색어
정렬 가능 테이블 (20건/페이지)
행 클릭 → AI 분석 (3종) + 장비 매칭 확장
CSV 내보내기


6. API 엔드포인트
메서드경로설명인증GET/login로그인 페이지XPOST/loginID/PWD 인증XGET/logout로그아웃OGET/api/health헬스체크XGET/api/dataSharePoint 데이터 (Table_HQ + Past_History + Asset_List)OGET/api/statusAzure AD 토큰 상태OPOST/api/report월간 PDF 생성 (params: month, year, lang, region, comment, branchFilter)OPOST/api/annual-report연간 PDF 생성 (params: year, lang, region, comment, branchFilter)OPOST/api/ai-analyzeAI 오류 분석 (Gemini/Groq/Mistral)OPOST/api/asset-ai장비 스펙 AI 분석OGET/en영어 버전 진입점OGET/kr한국어 버전 진입점O

PDF API 파라미터 상세:
  - action: 'download' | 'preview' | 'email'
  - comment: 리포트 상단에 삽입되는 코멘트 (선택)
  - branchFilter: 지점 계정 전용 필터 (예: 'AMGN')
  - region: 'global' | 'korea'
  - lang: 'en' | 'ko'

7. 데이터 구조 (SharePoint Excel)
Table_HQ (현재 오류 로그)
Branch, Zone, Date, Time, SolvedBy, TimeTaken, Category, IssueDetail, ActionType, ActionTaken, Difficulty, HQ
Past_History (해결 사례 아카이브)
Date, Zone, Category, Detail, Action Taken, HQ Comment, HQ Comment ENG
Asset_List (장비 목록)
Branch, Zone, Name, Model, Maker, Spec, Status

8. 환경 변수 (.env)
AZURE_TENANT=e87fec16-abca-4a2c-bfeb-8d0ab5dc34c0
AZURE_CLIENT_ID=789680cf-4330-4242-8c2b-36947885fd49
AZURE_SECRET=MtI8Q~CW6ESCdV.JapB3HVaOPnmqcIsFzYMfsb8v
SP_DRIVE_ID=b!Vp3e3rnWqUqDOkmT6C4slN8UdELB61VLpQysl7_NJR5YKqZ7QbcYQrovso41EbmX
SP_FILE_ID=01FSVE5E5F7TNDYTUFY5FIYNWUWCMGWUR2
APP_PASSWORD=dst1234
GEMINI_KEY=AIzaSyD8z33I4EfIvSsq3O5FFX7BU7RydD3Fr-U
GROQ_KEY=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
MISTRAL_KEY=XdNZIQTJgL0xzUNKEb6HSiyJbXrpwFKr

보안: .env 파일 GitHub push 절대 금지 (.gitignore 확인)


9. 코딩 규칙 (★ 반복 에러 방지)
9-1. 경로 규칙
⚠️ 반드시 절대 경로 사용 — 상대 경로 금지

HTML 내 모든 <script src>, <link href>, <img src>는 슬래시(/)로 시작하는 절대 경로

O src="/js/admin.js" | X src="js/admin.js"
O src="/fonts/dstrict_CI_BLACK.png" | X src="fonts/dstrict_CI_BLACK.png"


이유: /en, /kr 등 서브 경로에서 상대 경로 사용 시 /en/js/...로 잘못 요청

9-2. Express.js 서버 설정
javascript// express.static에 반드시 redirect: false 포함
app.use(express.static(PUBLIC_DIR, {
  maxAge: IS_PROD ? '1d' : 0,
  etag: true,
  index: false,
  redirect: false   // ← 필수! 디렉토리 접근 시 자동 리다이렉트 방지
}));
9-3. Config Import 규칙

pdf.js / pdf-annual.js: KOREA_BRANCHES, GLOBAL_BRANCHES 반드시 config.js에서 import

javascript  // O 올바른 import
  const { MONTHS_EN, BR_NAMES, BR_COLORS, KOREA_BRANCHES, GLOBAL_BRANCHES } = require('./config');
  // X 누락하면 "GLOBAL_BRANCHES is not defined" 에러
9-4. 폰트/에셋 경로

프론트엔드 에셋: public/fonts/
서버측 PDF 생성(pdf.js)은 루트 기준 fonts/ 참조 → 심볼릭 링크 필요

bash  ln -s public/fonts fonts   # 프로젝트 루트에서 실행

폰트: NotoSansKR (Black, Bold, Medium, Light), Uniform (Black, Bold, Medium, Light, Ultra)

9-5. 리전 필터링 패턴
모든 차트/테이블/리포트에서 Global/Korea 토글 적용 시:
javascript// O 올바른 패턴 — regionMd 사용
var regionMd = md.filter(function(r){ return regionBrs.indexOf(r.Branch) >= 0 });
// 이후 모든 차트/테이블에서 md 대신 regionMd 사용

// X 잘못된 패턴 — md 직접 사용 (전체 데이터가 나옴)
리전 필터 적용 체크리스트: Annual Trend, Zone Heatmap, Category Doughnut, Difficulty Chart, Action Type Chart, Top Issues 테이블, 에러 카운트 — 전부 regionMd 확인
9-6. i18n 규칙

새 텍스트 추가 시 반드시:

i18n.js에 영어 키 추가
translate.js에 한국어 번역 추가
코드에서 t('key') 사용



9-7. SW 캐시 버전 (현재: v5.7.1)

코드 변경 시 3개 sw.js 동시 업데이트 필수:
  - public/sw.js
  - public/en/sw.js
  - public/kr/sw.js
버전 올리지 않으면 클라이언트가 구버전 캐시 계속 사용

9-8. 변수명 규칙

글로벌 스태프가 이해할 수 있도록 영문 변수명
prefix 컨벤션:

_loggedId — 로그인한 계정 ID
_loggedBranch — 로그인한 지점 코드 (gto는 null)
_acctInfo — 계정 정보 객체
_adminCharts — Admin 페이지 Chart.js 인스턴스
_rptRegion / _rptLang — 리포트 리전/언어 상태


DOM ID prefix: adm- (Admin 페이지), br- (지점 리포트)

9-9. Admin 페이지 함수명 주의

admin.html 인라인 JS: admSwitchView(), admRenderDaily(), admRenderMonthly(), admRenderDailyBrStrip(), admRenderMonthlyBrStrip()
public/js/admin.js (SPA): admSwitchView(), renderAdminDaily(), renderAdminMonthly(), initBranchReport(), branchReport()
두 파일의 함수명이 달라서 혼동 주의. admin.html은 standalone이므로 서로 독립.


10. 배포 워크플로우
10-1. 정석 루트: 로컬 → GitHub → 서버
powershell# Windows PowerShell에서
cd C:\Users\hyunh\Desktop\G-ATIS
git add -A && git commit -m "설명" && git push origin main

# SSH 접속
ssh -i C:\Users\hyunh\.ssh\g-atis.key ubuntu@134.185.106.88

# 서버에서
cd /home/ubuntu/gto-error-dashboard
git pull origin main
pm2 restart 0
10-2. 서버 git pull 충돌 해결
bash# 서버에 uncommitted 로컬 변경사항이 있을 때
git reset --hard HEAD   # ⚠️ 로컬 수정 삭제됨
git pull origin main
pm2 restart 0

# git index.lock / HEAD.lock 오류 (PowerShell):
Remove-Item "C:\Users\hyunh\Desktop\G-ATIS\.git\index.lock" -ErrorAction SilentlyContinue
Remove-Item "C:\Users\hyunh\Desktop\G-ATIS\.git\HEAD.lock" -ErrorAction SilentlyContinue
10-3. 긴급 핫픽스 (서버 직접 수정)
bash# sed로 직접 수정
sed -i 's|old_text|new_text|g' public/js/monthly.js

# 검증
grep -c 'expected_text' public/js/monthly.js

# PM2 재시작 — 반드시 ID 사용!
pm2 restart 0       # O
# pm2 restart gto-dashboard  ← X (이름 잘림)
10-4. PM2 명령어
bashpm2 status                    # 프로세스 상태
pm2 logs 0 --lines 50        # 최근 로그 50줄
pm2 flush 0                   # 오래된 로그 삭제
pm2 restart 0                 # 재시작
10-5. 배포 주의사항
⚠️ Cowork/Claude 샌드박스에서는 GitHub push / SSH 접속 불가
→ 코드 수정은 Cowork에서, 배포 명령어는 사용자가 직접 실행

⚠️ PowerShell ≠ Bash
→ heredoc(<< 'EOF'), cat, ls -la 등은 PowerShell에서 에러 발생
→ 서버용 bash 명령어는 SSH 접속 후 Linux 셸에서만 실행
→ PowerShell 명령어 필요 시 별도로 안내할 것

11. 응답 및 보고 원칙
11-1. 톤/스타일

전문적인 한국어 경어체, 팩트 중심 (유추/아부 금지)
모를 경우 "데이터 없음" 명시

11-2. 보고 구조 (Phase 1-4)
Phase내용Phase 1 (현황/전략)요약 및 기술운영팀 관점 전략적 해석 (So What?)Phase 2 (대안/영향)실행 시 현장 Man-hour 감소 예측Phase 3 (리스크/실행)Worst Case 시나리오 + 지사별 인력 숙련도 고려Phase 4 (확장/자동화)Power Automate 등 워크플로우 자동화 및 차기 액션
11-3. 가이드 작성

어디를 눌러야 하는지, 클릭 위치까지 세세하고 꼼꼼하게 단계별 설명
스크린샷 위치를 텍스트로 상세 기술


12. 이메일 및 통신 규칙

한글 메일: "님" 호칭, 간결하고 명확하게
영문 메일: 글로벌 스태프 대상, 전문적 영어, 불필요한 격식 제거
Slack/Teams: 짧고 명확한 메시지, 이모지 최소화


13. 변경 이력 (Change Log)

★ 최신 변경사항을 새 세션 시작 시 반드시 확인

13-0. 2026-04-10 (v5.7.1, 커밋: 55d617b)
주요 변경:
1. server.js — gto 로그인 시 /admin → /kr 리다이렉트 변경 (SPA에서 일반 페이지 + Admin 탭 동시 접근 가능)
2. public/js/admin.js — initBranchReport()에서 연간(ANNUAL) 리포트 카드 삭제 (월간만 유지)
3. public/js/admin.js — adminReport()에서 Comment/Remarks 값을 API body에 포함
4. public/index.html — Admin 리포트 생성에 Comment/Remarks textarea + ✕ 버튼 추가 (Global/Korea 모두)
5. public/index.html — Admin 테이블 헤더 전부 text-align:center + white-space:nowrap (난이도 줄넘김 방지)
6. public/index.html — 주요 반복 에러 Top 5 테이블: 내용만 text-align:left, 나머지 center
7. pdf.js — 지점 리포트 Branch Summary: 동적 월/연도, 심각 이슈(Lv.4+) 별도 나열, 빈번 이슈 목록 추가
8. pdf.js — 에러 없는 지점: "[OK] 금월 크리티컬 미발생" + 월별 정상 운영 상세 메시지
9. public/css/mobile-app.css — 모바일에서 리포트 생성 숨김 (시각적 개체만 표시)
10. public/css/mobile-app.css — Admin 페이지 모바일 최적화 (KPI, 차트, 테이블 반응형)
11. public/css/style.css — Admin 페이지 반응형 CSS (768px 이하 1열 레이아웃)
12. public/sw.js, kr/sw.js, en/sw.js — SW 캐시 버전 v5.7.0 → v5.7.1
13. public/js/nav.js — mobileTabGo() 함수 추가 (모바일 하단 탭 페이지 전환 복원)
14. public/js/admin.js — 파일 끝 151바이트 null byte 제거 (파싱 에러 원인)
15. pdf.js — KOREA_BRANCHES, GLOBAL_BRANCHES import 누락 수정

13-1. 2026-04-10 (커밋: 323c931)
버그 수정 / 회귀 수정:
1. public/admin.html — 일일/월간 아코디언(접힘) → 버튼 전환 방식 복원
   - [📅 일일 현황] [📊 월간 현황] 버튼으로 뷰 전환 (admSwitchView)
   - 기본값: 일일 현황. 월간 클릭 시 admRenderMonthly() 실행.
2. public/js/admin.js — initBranchReport()에 연간(ANNUAL) 리포트 카드 복원
   - ANNUAL 카드 누락 → 추가 완료 (branchReport('download'|'preview','annual'))
   - 버튼 min-height:44px (모바일 터치 대응)
   - 코멘트 ✕ 버튼 정상 유지
3. public/js/utils.js — catFull() 한국어 카테고리 정규화 추가
   - 글로벌 지점 Error Log에서 한국어값('소프트웨어','하드웨어','네트워크')이 뱃지로 표시 안 되는 버그 수정
   - EN/KO 양방향 normalization map 적용 → _lang에 따라 올바른 언어로 표시

13-2. 2026-04-09 ~ 10 (커밋: c199f16)
주요 기능 추가:
1. public/admin.html — 모바일 반응형 CSS 전면 추가
2. public/admin.html — 테이블 내용 컬럼 전체 텍스트 표시 (말줄임 제거)
3. public/admin.html — Comment / Remarks 텍스트박스 + ✕버튼 (Global/Korea 리포트 카드)
4. pdf.js — 커버페이지 제거, _drawPageBranding()으로 대체
5. pdf-annual.js — 커버페이지 제거, _drawPageBranding()으로 대체
6. pdf.js, pdf-annual.js — 라벨 "Manager Comment / Remarks" → "Comment / Remarks"
7. public/js/admin.js — 라벨 "담당자 코멘트 / 비고" → "코멘트 / 비고"
8. public/js/admin.js — Comment 텍스트박스 ✕ 버튼 추가
9. public/css/style.css — 지점 리포트 모바일 CSS (branch-rpt-btn-row 등)
10. public/sw.js, kr/sw.js, en/sw.js — SW 캐시 버전 v5.6.0 → v5.7.0
