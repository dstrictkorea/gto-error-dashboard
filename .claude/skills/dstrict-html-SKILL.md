---
name: dstrict-html
description: "d'strict 전용 인터랙티브 HTML 대시보드/시뮬레이터 서식 지침. HTML 파일로 대시보드, 시뮬레이터, 리포트, 데이터 시각화를 생성하거나 수정할 때 반드시 이 스킬을 참조하여 d'strict 디자인 시스템을 적용해야 합니다. 트리거: HTML 대시보드, 인터랙티브 시뮬레이터, Chart.js 차트, 데이터 시각화, KPI 대시보드, Cash Dashboard, 자금일보, Daily Sales, 리포트 HTML, 시뮬레이션 도구 등 HTML 기반 인터랙티브 파일 생성/수정 요청 시. React 아티팩트(.jsx)에는 적용하지 않으며, 독립 .html 파일 생성 시에만 적용합니다. Outlook 이메일 본문에 삽입할 HTML을 생성할 때에도 이 스킬의 '이메일 모드' 섹션을 적용합니다."
---

# d'strict HTML 제작 지침

이 스킬은 d'strict 내부용 HTML의 공통 디자인 시스템을 정의합니다. **두 가지 모드**를 포함합니다:

| 모드 | 용도 | 렌더링 환경 |
|------|------|-------------|
| **모드 A: 브라우저 대시보드** | 대시보드, 시뮬레이터, KPI, 리포트 HTML | Chrome/Edge 등 브라우저 |
| **모드 B: Outlook 이메일** | 이메일 본문에 삽입하는 HTML | Outlook 데스크톱/웹 |

**모드 판별 기준**: "이메일로 발송", "send_mail", "메일 본문", "Outlook" 등 이메일 발송 맥락이면 → **모드 B**. 그 외 HTML 파일 생성이면 → **모드 A**.

공통 규칙(파일명, 컬러, 수치 포맷, 수정 원칙)은 두 모드에 동일 적용됩니다.

---

# ━━━ 모드 A: 브라우저 대시보드 ━━━

---

## 1. 파일명 규칙

- `YYMMDD_제목.html` 형식 (예: `260319_dstrict_2025_KPI_Dashboard.html`)
- 회사명 포함 시 소문자 d: `dstrict` (파일명에서는 어퍼스트로피 제외)
- 문서 내부 표기: `d'strict` (소문자 d, 어퍼스트로피 포함)

---

## 2. 폰트 시스템

### 웹폰트 CDN 로딩 (필수)

모든 HTML 파일의 `<style>` 최상단에 반드시 포함:

```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
```

> PC에 Pretendard가 설치되지 않은 환경에서도 동일한 렌더링을 보장하기 위해 필수입니다.

### 기본 폰트 패밀리 (CSS 변수)

```css
:root {
  --font: 'Pretendard Variable', 'Pretendard', -apple-system, 
          BlinkMacSystemFont, 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
}
body { 
  font-family: var(--font); 
  font-weight: 300;  /* Pretendard Light 기본 */
}
```

### 폴백 순서

| 순서 | 폰트 | 역할 |
|------|------|------|
| 1순위 | Pretendard Variable | 가변폰트 (CDN 웹폰트로 로딩) |
| 2순위 | Pretendard | 일반 버전 폴백 |
| 3순위 | -apple-system / BlinkMacSystemFont | macOS 시스템 폰트 |
| 4순위 | Malgun Gothic / 맑은 고딕 | Windows 한글 폴백 |
| 5순위 | Arial | Windows 영문/숫자 폴백 |
| 최종 | sans-serif | 최종 폴백 |

### font-weight 체계

| Weight | 이름 | 용도 |
|--------|------|------|
| **300** | **Light** | **body 기본 본문 (기본값)** |
| 400 | Regular | 일반 텍스트, 보조 정보 |
| 500 | Medium | 탭, 라벨, 중간 강조 |
| 600 | SemiBold | 테이블 헤더, 라벨, 뱃지 |
| 700 | Bold | 로고, 핵심 수치, 섹션 헤더 |

### 폰트 사이즈 체계

| 용도 | 크기 | 두께 | letter-spacing |
|------|------|------|----------------|
| 대시보드 타이틀 | 24px | 700 | -0.5px |
| 카드 메트릭 (큰 숫자) | 24px | 700 | -0.5px |
| 서브 메트릭 (중간 숫자) | 20px | 700 | 기본 |
| 소형 메트릭 (카드 내) | 14px | 700 | 기본 |
| 본문/테이블 셀 | 13px | 400 | 기본 |
| 레이블/라벨 | 13px | 500~600 | 0.2~0.3px |
| 힌트/부가 텍스트 | 12px | 400~600 | 0.3px |
| 뱃지/태그 | 11px | 600 | 0.3px |
| 최소 텍스트 | 10px | 400 | 기본 |

### letter-spacing 규칙 (크기별 자간)

**원칙: 큰 글씨는 좁게, 작은 글씨는 넓게**

| 분류 | font-size | letter-spacing | 예시 |
|------|-----------|----------------|------|
| 대형 (20px+) | 20~24px | **-0.5px** | .logo, .sv (핵심 수치) |
| 기본 (14~16px) | 14~16px | **0** (기본값) | body, .tab |
| 중형 (13px) | 13px | **+0.2px** | .sl (서브 라벨) |
| 소형 (11~12px) | 11~12px | **+0.3px** | .rpt-label, th, .bd |
| 극소 강조 (11px bold) | 11px, weight 700 | **+0.5px** | .cc-h (섹션 소제목) |

### 숫자 표기

- 테이블/차트 내 숫자는 `font-family: var(--font)` 그대로 사용 (Pretendard에 tabular-nums 내장)
- 숫자 정렬: `text-align: right` (`.n` 클래스)
- 금액 포맷: 억원 단위 (`10.64억원`), 괄호 달러 환산 (`($747K)`)
- 천 단위 콤마 필수, 음수는 괄호 표기 `(6.9M)`

---

## 3. 컬러 시스템

### CSS 변수 (필수 선언)

```css
:root {
  /* 배경 & 표면 */
  --bg: #f6f5f0;          /* 페이지 배경 (따뜻한 크림톤) */
  --card: #fff;            /* 카드/패널 배경 */
  --border: #e8e6df;       /* 보더 (따뜻한 회색) */

  /* 텍스트 */
  --text: #1a1a18;         /* 주 텍스트 (순흑색 아님) */
  --muted: #73726c;        /* 보조 텍스트/레이블 */
  --hint: #a3a29c;         /* 힌트/비활성 텍스트 */

  /* 시맨틱 컬러 (배경 + 전경 페어) */
  --blue: #185FA5;         --blue-bg: #E6F1FB;    /* 입금/유입 */
  --red: #A32D2D;          --red-bg: #FCEBEB;     /* 지급/유출/경고 */
  --green: #3B6D11;        --green-bg: #EAF3DE;   /* 긍정/달성 */
  --purple: #534AB7;       --purple-bg: #EEEDFE;  /* 주요 강조/액센트 */
  --teal: #0F6E56;         --teal-bg: #E1F5EE;    /* 보조 강조 */
  --coral: #993C1D;        --coral-bg: #FAECE7;   /* 법인/엔티티 B */
  --amber: #854F0B;        --amber-bg: #FAEEDA;   /* 주의 */

  /* 레이아웃 */
  --radius: 10px;          /* 카드 border-radius */
}
```

### 컬러 사용 원칙

- **입금/유입/증가**: `--blue` 계열
- **지급/유출/감소**: `--red` 계열
- **주요 액센트/CTA**: `--purple` 계열
- **보조 강조/달성**: `--teal` 또는 `--green` 계열
- **경고/주의**: `--amber` 또는 `--coral` 계열
- **엔티티/법인 구분 뱃지**: 각 법인별 `--{color}-bg` + `--{color}` 조합

### 지표/성과 컬러 (KPI, B2B 달성률 등)

| 컬러 | 코드 | 적용 기준 |
|------|------|-----------|
| Green | `#00B050` | 90% 이상 달성 / KPI 90+점 |
| Yellow | `#CC9900` | 70~90% 달성 / KPI 70~90점 |
| Red | `#FF0000` | 70% 미만 / KPI 70점 미만 |

---

## 4. 레이아웃 & 컴포넌트

### 페이지 구조

```css
.wrap { max-width: 1200px; margin: 0 auto; padding: 20px 24px; }
```

### 카드 (Summary Card)

```css
.sc {
  background: var(--card);
  border-radius: var(--radius);   /* 10px */
  padding: 16px 18px;
  border: 1px solid var(--border);
}
```

- 서머리 카드 그리드: `grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;`
- 법인/엔티티 카드: `repeat(3, minmax(0, 1fr)); gap: 10px;`

### 뱃지 (Badge)

```css
.bd {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
/* 예: .b-DSKR { background: var(--purple-bg); color: var(--purple); } */
```

### 탭 (Tab Navigation)

```css
.tabs { display: flex; border-bottom: 2px solid var(--border); overflow-x: auto; }
.tab {
  padding: 10px 18px;
  font-size: 14px; font-weight: 500;
  color: var(--muted);
  border: none; background: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer; transition: all .15s;
}
.tab.on { color: var(--text); border-bottom-color: var(--text); }
```

### 테이블

```css
table { width: 100%; border-collapse: collapse; }
th {
  text-align: left; padding: 9px 10px;
  font-size: 12px; color: var(--muted);
  font-weight: 600; letter-spacing: 0.3px;
  border-bottom: 2px solid var(--border);
  position: sticky; top: 0;
  background: var(--card); z-index: 1;
}
td { padding: 8px 10px; font-size: 13px; border-bottom: 1px solid var(--border); }
tr:hover td { background: #fafaf7; }
.n { text-align: right; font-size: 13px; }
```

### 프리셋 버튼 그룹

```css
.pre button {
  padding: 5px 12px; font-size: 12px;
  border: 1px solid var(--border); border-radius: 5px;
  background: var(--card); color: var(--muted);
  cursor: pointer; transition: all .15s;
}
.pre button:hover, .pre button.on {
  background: var(--text); color: #fff; border-color: var(--text);
}
```

### CTA 버튼

```css
.btn-search {
  padding: 5px 14px; font-size: 12px; font-weight: 600;
  border: 1px solid var(--purple); border-radius: 5px;
  background: var(--purple); color: #fff;
  cursor: pointer; transition: all .15s;
}
.btn-search:hover { background: #4239a0; }
```

### 프로그레스 바

```css
.eb { height: 4px; border-radius: 2px; background: var(--border); }
.ebf { height: 100%; border-radius: 2px; transition: width .3s; }
```

### 통화/메트릭 카드 그리드

```css
.ccg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.cc {
  background: var(--card); border-radius: 8px;
  padding: 6px 8px; border: 1px solid var(--border);
  text-align: center;
}
.cc-act { border-color: var(--purple); background: var(--purple-bg); }
.cc-h { font-size: 11px; color: var(--muted); font-weight: 700; letter-spacing: 0.5px; }
.cc-v { font-size: 14px; font-weight: 700; }
.cc-s { font-size: 10px; color: var(--muted); }
```

---

## 5. Chart.js 공통 설정

### 차트 컨테이너

```css
.cw { position: relative; height: 300px; }
```

### 차트 기본 옵션

```javascript
{
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      ticks: { font: { size: 10, family: "var(--font)" }, maxRotation: 50 },
      grid: { display: false }
    },
    y: {
      ticks: { font: { size: 11, family: "var(--font)" } },
      grid: { color: 'rgba(0,0,0,0.04)' }  /* 매우 연한 그리드 */
    }
  },
  plugins: {
    legend: {
      labels: { font: { size: 12, family: "var(--font)" }, padding: 12, usePointStyle: true }
    },
    tooltip: {
      titleFont: { family: "var(--font)" },
      bodyFont: { family: "var(--font)" }
    }
  }
}
```

### 차트 컬러 팔레트 (순서)

1. `#534AB7` (purple - 주요)
2. `#0F6E56` (teal - 보조)
3. `#D85A30` (coral - 세번째)
4. `#185FA5` (blue)
5. `#854F0B` (amber)
6. `#993C1D` (coral-dark)
7. `#A32D2D` (red)
8. `#3B6D11` (green)

### 범례 (Legend) 커스텀

```html
<div class="lg">
  <span><i style="background:var(--purple)"></i>항목1</span>
  <span><i style="background:var(--teal);opacity:.5"></i>항목2</span>
</div>
```

```css
.lg { display: flex; gap: 16px; font-size: 13px; color: var(--muted); }
.lg i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; vertical-align: middle; margin-right: 5px; }
```

---

## 6. 반응형 규칙

```css
@media (max-width: 768px) {
  .sg { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .eg { grid-template-columns: 1fr; }
  .sv { font-size: 20px; }
}
@media (max-width: 600px) {
  .ccg { grid-template-columns: repeat(2, 1fr); }
}
```

---

## 7. 인터랙션 패턴

### 날짜 필터

- flatpickr 사용 (CDN: `https://cdn.jsdelivr.net/npm/flatpickr`)
- 한국어 locale: `https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/ko.js`
- 프리셋 버튼: 1W / 1M / 3M / All

### 필터 + 셀렉트

```html
<div class="ft">
  <label>법인</label>
  <select id="fE" onchange="refresh()">
    <option value="a">전체</option>
    <option value="DSKR">DSKR</option>
  </select>
</div>
```

### Excel 다운로드

- CSV UTF-8 BOM (`\uFEFF`) 방식으로 브라우저에서 직접 다운로드
- 버튼: `📥 Excel` 형태

### 헤더 구조

```
[로고 타이틀]  [보고대상일 선택]  [프리셋 1W|1M|3M|All] [기간 시작~종료] [조회 버튼]
```

---

## 8. 수치 포맷 유틸리티

### 한국어 금액 포맷

```javascript
function fK(v) {
  if (Math.abs(v) >= 1e8) return (Math.round(v / 1e6) / 100).toFixed(2) + '억원';
  if (Math.abs(v) >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만원';
  return Math.round(v).toLocaleString() + '원';
}
```

### USD 환산 포맷

```javascript
function fU(v, rate) {
  var usd = Math.round(v / rate);
  if (Math.abs(usd) >= 1e6) return '($' + (Math.round(usd / 1e5) / 10) + 'M)';
  if (Math.abs(usd) >= 1e3) return '($' + Math.round(usd / 1e3) + 'K)';
  return '($' + usd.toLocaleString() + ')';
}
```

---

## 9. HTML 최소 템플릿 (새 대시보드 시작용)

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{대시보드_제목}}</title>
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.min.css');

:root {
    --bg:#f6f5f0; --card:#fff; --border:#e8e6df;
    --text:#1a1a18; --muted:#73726c; --hint:#a3a29c;
    --blue:#185FA5; --blue-bg:#E6F1FB;
    --red:#A32D2D; --red-bg:#FCEBEB;
    --green:#3B6D11; --green-bg:#EAF3DE;
    --purple:#534AB7; --purple-bg:#EEEDFE;
    --teal:#0F6E56; --teal-bg:#E1F5EE;
    --coral:#993C1D; --coral-bg:#FAECE7;
    --amber:#854F0B; --amber-bg:#FAEEDA;
    --radius:10px;
    --font:'Pretendard Variable','Pretendard',-apple-system,
           BlinkMacSystemFont,'Malgun Gothic','맑은 고딕',Arial,sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--font);background:var(--bg);color:var(--text);
     font-size:14px;font-weight:300;line-height:1.5}
.wrap{max-width:1200px;margin:0 auto;padding:20px 24px}

/* 이하 대시보드별 스타일 추가 */
</style>
</head>
<body>
<div class="wrap">
    <!-- 대시보드 콘텐츠 -->
</div>
</body>
</html>
```

---

## 10. 수정 작업 원칙

- 기존 대시보드에서 별도 언급 없는 부분은 **컨펌된 것**으로 간주합니다.
- 추가 수정 요청 시 요청 부분**만** 수정하고, 나머지 스타일/데이터는 변경하지 않습니다.
- 반복 생성하는 대시보드는 **확정된 포맷/스타일을 동일하게 유지**합니다.

---

## 11. 체크리스트

HTML 대시보드 생성/수정 완료 시 확인:

- [ ] 파일명이 `YYMMDD_제목.html` 형식인가?
- [ ] `@import url(...)` 웹폰트 CDN이 `<style>` 최상단에 포함되었는가?
- [ ] CSS 변수 `:root` 블록에 컬러 시스템이 선언되었는가?
- [ ] 폰트 스택이 Pretendard Variable → Pretendard → 시스템 → 맑은 고딕 → Arial → sans-serif 순인가?
- [ ] body font-weight가 300 (Pretendard Light)으로 설정되었는가?
- [ ] 배경색이 `#f6f5f0` (따뜻한 크림톤)인가?
- [ ] 카드 border-radius가 10px인가?
- [ ] 보더 색상이 `#e8e6df`인가?
- [ ] 테이블 헤더가 sticky이고 font-weight: 600인가?
- [ ] 숫자가 우측 정렬이고 천 단위 콤마가 적용되었는가?
- [ ] letter-spacing이 크기별 규칙에 맞는가? (큰 글씨 -0.5px, 작은 글씨 +0.3~0.5px)
- [ ] Chart.js 그리드가 `rgba(0,0,0,0.04)`로 매우 연하게 설정되었는가?
- [ ] 차트 범례가 HTML 커스텀 방식으로 구현되었는가?
- [ ] 입금/증가는 blue 계열, 지급/감소는 red 계열로 표현되었는가?
- [ ] 주요 액센트가 purple(`#534AB7`)인가?
- [ ] 지표 컬러가 Green=#00B050 / Yellow=#CC9900 / Red=#FF0000으로 적용되었는가?
- [ ] 회사명이 `d'strict` (소문자 d)로 표기되었는가?
- [ ] 반응형 미디어쿼리가 768px/600px 기준으로 적용되었는가?

---

# ━━━ 모드 B: Outlook 이메일 HTML ━━━

Outlook 데스크톱은 CSS 지원이 제한적이므로, 브라우저용 HTML과 다른 규칙을 적용합니다.

---

## B1. Outlook HTML 제약사항

| 기능 | 브라우저 | Outlook |
|------|----------|---------|
| CSS 변수 `var()` | ✅ | ❌ 미지원 |
| `@import` 웹폰트 | ✅ | ❌ 차단됨 |
| Flexbox / Grid | ✅ | ❌ 미지원 |
| `<div>` 레이아웃 | ✅ | ⚠️ 불안정 |
| `<table>` 레이아웃 | ✅ | ✅ 안정 |
| 인라인 스타일 | ✅ | ✅ 필수 |
| `<style>` 블록 | ✅ | ⚠️ 일부만 지원 |

**핵심 원칙: Outlook 이메일 HTML은 반드시 `<table>` 기반 레이아웃 + 인라인 스타일로 작성합니다.**

---

## B2. 이메일용 폰트 규칙

### 폰트 스택

Pretendard를 1순위로 선언하되, Outlook에서 웹폰트 CDN이 차단되므로 **PC에 Pretendard가 설치된 수신자에게는 Pretendard로, 없는 수신자에게는 맑은 고딕/Arial로 자동 폴백**됩니다:

- **국문(한글)**: `font-family:'Pretendard','맑은 고딕','Malgun Gothic',sans-serif;`
- **영문/숫자**: `font-family:'Pretendard',Arial,'맑은 고딕',sans-serif;`

### 폴백 동작

| 수신자 PC 환경 | 표시 폰트 |
|----------------|-----------|
| Pretendard 설치됨 | Pretendard (국문/영문 모두) |
| Pretendard 미설치 (Windows) | 국문 → 맑은 고딕 / 영문 → Arial |
| Pretendard 미설치 (Mac) | 시스템 기본 산세리프 |

### 자간 (letter-spacing)

- **국문**: `letter-spacing:-0.6pt;` (고정)
- **영문/숫자**: `letter-spacing:normal;` (고정)

### 기본 크기

- `font-size:10pt;` (이메일 기본 크기)

### 국영문 혼합 처리

한글과 영문/숫자가 같은 문장에 있을 때 `<span>`으로 분리하여 폰트를 각각 적용합니다:

```html
<td>
  <span style="font-family:'Pretendard','맑은 고딕','Malgun Gothic',sans-serif; letter-spacing:-0.6pt;">
    디스트릭트는
  </span>
  <span style="font-family:'Pretendard',Arial,'맑은 고딕',sans-serif; letter-spacing:normal;">
    d'strict Holdings
  </span>
  <span style="font-family:'Pretendard','맑은 고딕','Malgun Gothic',sans-serif; letter-spacing:-0.6pt;">
    의 한국법인입니다.
  </span>
</td>
```

---

## B3. 이메일 레이아웃

### 기본 구조

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" 
       style="background-color:#333333;">
  <tr>
    <td align="center">
      <table width="680" cellpadding="0" cellspacing="0" border="0">
        <!-- 헤더 -->
        <tr>
          <td style="padding:20px 24px; background-color:#333333;">
            <span style="font-family:'Pretendard',Arial,sans-serif; font-size:18pt; 
                         font-weight:700; color:#FFC000; letter-spacing:-0.5pt;">
              이메일 제목
            </span>
          </td>
        </tr>
        <!-- 본문 -->
        <tr>
          <td style="padding:16px 24px; background-color:#333333;">
            <!-- 콘텐츠 테이블 -->
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

### 이메일 컬러 체계 (다크 배경)

| 요소 | 색상 | 코드 |
|------|------|------|
| 배경 | 다크 | `#333333` |
| 타이틀 | 골드 | `#FFC000` |
| 본문 텍스트 | 흰색 | `#FFFFFF` |
| 보조 텍스트 | 연한 회색 | `#B0B0B0` |
| 구분선 | 어두운 회색 | `#555555` |
| 긴급 강조 | 빨간색 | `#FF6B6B` |
| 링크/액션 | 파란색 | `#6BB3FF` |

### 콘텐츠 카드 (테이블 내 카드)

```html
<table width="100%" cellpadding="12" cellspacing="0" border="0"
       style="background-color:#2A2A2A; border-radius:8px; margin-bottom:8px;">
  <tr>
    <td style="font-family:'Pretendard','맑은 고딕','Malgun Gothic',sans-serif; font-size:10pt; 
               color:#FFFFFF; letter-spacing:-0.6pt;">
      카드 내용
    </td>
  </tr>
</table>
```

---

## B4. 이메일 데이터 테이블

```html
<table width="100%" cellpadding="8" cellspacing="0" border="0"
       style="border-collapse:collapse;">
  <!-- 헤더 -->
  <tr style="background-color:#444444;">
    <td style="font-family:'Pretendard','맑은 고딕','Malgun Gothic',sans-serif; font-size:9pt; 
               font-weight:600; color:#FFC000; letter-spacing:0.3pt;
               border-bottom:2px solid #555555; text-align:center;">
      항목
    </td>
    <td style="font-family:'Pretendard',Arial,sans-serif; font-size:9pt; 
               font-weight:600; color:#FFC000; letter-spacing:normal;
               border-bottom:2px solid #555555; text-align:right;">
      금액
    </td>
  </tr>
  <!-- 데이터 행 -->
  <tr>
    <td style="font-family:'Pretendard','맑은 고딕','Malgun Gothic',sans-serif; font-size:10pt; 
               color:#FFFFFF; letter-spacing:-0.6pt;
               border-bottom:1px solid #444444;">
      국내운영본부
    </td>
    <td style="font-family:'Pretendard',Arial,sans-serif; font-size:10pt; 
               color:#FFFFFF; letter-spacing:normal;
               border-bottom:1px solid #444444; text-align:right;">
      1,234,567
    </td>
  </tr>
</table>
```

---

## B5. 이메일용 지표 컬러

브라우저 대시보드와 동일한 기준이지만, 다크 배경에서 가독성을 위해 약간 밝은 톤을 사용합니다:

| 지표 | 브라우저 (모드 A) | 이메일 (모드 B, 다크 배경) |
|------|-------------------|---------------------------|
| 양호 (90%+) | `#00B050` | `#4CAF50` |
| 주의 (70~90%) | `#CC9900` | `#FFC000` |
| 위험 (70% 미만) | `#FF0000` | `#FF6B6B` |

---

## B6. 이메일 최소 템플릿

```html
<!-- Outlook 호환 이메일 HTML 템플릿 -->
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#333333; font-family:'Pretendard','맑은 고딕','Malgun Gothic',Arial,sans-serif;">
  <tr>
    <td align="center">
      <table width="680" cellpadding="0" cellspacing="0" border="0">
        
        <!-- 헤더 -->
        <tr>
          <td style="padding:20px 24px;">
            <span style="font-family:'Pretendard',Arial,sans-serif; font-size:16pt; 
                         font-weight:700; color:#FFC000; letter-spacing:-0.5pt;">
              {{리포트_제목}}
            </span>
            <br/>
            <span style="font-family:'Pretendard',Arial,sans-serif; font-size:9pt; 
                         color:#B0B0B0;">
              {{날짜}} | {{부가정보}}
            </span>
          </td>
        </tr>

        <!-- 구분선 -->
        <tr>
          <td style="padding:0 24px;">
            <hr style="border:none; border-top:1px solid #555555; margin:0;"/>
          </td>
        </tr>

        <!-- 본문 -->
        <tr>
          <td style="padding:16px 24px; font-size:10pt; color:#FFFFFF; 
                     letter-spacing:-0.6pt; line-height:1.6;">
            {{본문_내용}}
          </td>
        </tr>

        <!-- 푸터 -->
        <tr>
          <td style="padding:16px 24px;">
            <span style="font-family:'Pretendard',Arial,sans-serif; font-size:8pt; color:#888888;">
              Sent via Claude Cowork | d'strict
            </span>
          </td>
        </tr>
        
      </table>
    </td>
  </tr>
</table>
```

---

## B7. 이메일 체크리스트

이메일 HTML 생성/수정 완료 시 확인:

- [ ] `<table>` 기반 레이아웃인가? (div/flexbox/grid 사용 안 했는가?)
- [ ] 모든 스타일이 인라인(`style=""`)으로 적용되었는가?
- [ ] CSS 변수 `var()` 를 사용하지 않았는가?
- [ ] 웹폰트 `@import`를 포함하지 않았는가?
- [ ] 국문 폰트가 `'Pretendard','맑은 고딕','Malgun Gothic',sans-serif`인가?
- [ ] 영문 폰트가 `'Pretendard',Arial,'맑은 고딕',sans-serif`인가?
- [ ] 국문 자간이 `-0.6pt`, 영문 자간이 `normal`인가?
- [ ] 기본 크기가 `10pt`인가?
- [ ] 국영문 혼합 시 `<span>`으로 분리하여 폰트를 각각 적용했는가?
- [ ] 배경색이 `#333333`이고 타이틀이 `#FFC000`인가?
- [ ] 숫자가 우측 정렬이고 천 단위 콤마가 적용되었는가?
- [ ] 지표 컬러가 다크 배경용 (Green=#4CAF50 / Yellow=#FFC000 / Red=#FF6B6B)인가?
- [ ] 테이블 너비가 `width="680"` 이하인가?
- [ ] 회사명이 `d'strict` (소문자 d)로 표기되었는가?
