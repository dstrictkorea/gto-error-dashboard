---
name: dstrict-pptx-eng
description: "d'strict 전용 PowerPoint 영문 프레젠테이션(.pptx) 서식 지침. PPT를 생성하거나 편집할 때, 영문 Uniform 계열 폰트 체계, 폰트 크기별 자간 테이블, 슬라이드 레이아웃 배경 규칙, 제목 ALL CAPITALS, 배경 위 텍스트 반투명 박스, 테이블 정렬 규칙 등을 자동 적용합니다. pptx, 프레젠테이션, 슬라이드, 덱 파일을 만들거나 수정할 때 반드시 이 스킬을 함께 참조하세요. d'strict, 디스트릭트 관련 영문 PPT 작업 시 항상 트리거되어야 합니다."
---

# d'strict PowerPoint 영문 프레젠테이션 서식 표준

이 스킬은 기존 `pptx` 스킬의 기술적 방법론 위에 d'strict 고유의 영문 서식 규칙을 오버레이로 적용합니다. **기존 pptx 스킬의 SKILL.md를 먼저 읽은 뒤**, 아래 규칙을 추가 적용하세요.

> **[중요] 아래 모든 규칙은 `디스트릭트_문서템플릿_ENG_0724_폰트포함.pptx`의 XML을 직접 분석하여 도출한 실측값입니다.**

---

## 1. 파일 명명 규칙

모든 생성 파일은 반드시 아래 형식을 따릅니다:

```
YYMMDD_제목.pptx
```

- 예시: `260318_ARTE_MUSEUM_Garden_Australia_Proposal.pptx`
- 날짜는 작성일 기준 (KST)
- 파일명에는 어퍼스트로피(') 제외: `dstrict`로 표기 (본문에서는 `d'strict`)

---

## 2. 폰트 규칙

### 2.1 내장 폰트 목록 (embeddedFontLst 실측)

템플릿에 내장된 폰트는 다음과 같습니다. **반드시 아래 typeface 명칭을 그대로 사용합니다.**

| typeface 명칭 | 용도 |
|:---|:---|
| `Uniform-Black` | 메인 제목 / 최상위 강조 |
| `Uniform-Bold` | 섹션 번호 / 본문 소제목 / 테이블 헤더 |
| `Uniform` | 본문 / 일반 텍스트 / 날짜 |
| `Uniform-Medium` | 테이블 본문 |
| `Uniform Regular` | 테이블 셀 변형 |
| `Uniform Medium Medium` | 테이블 셀 변형 |
| `Uniform-Light` | 보조 / 캡션 |

### 2.2 폰트 역할 배정 (실측)

모든 텍스트는 **Uniform 계열만** 사용합니다.

| 역할 | typeface | 사용처 (실측) |
|:---|:---|:---|
| 메인 제목 | `Uniform-Black` | 표지 제목(sz=7000), 섹션 타이틀(sz=5500), CONTENTS 번호(sz=3800) |
| 섹션 번호 / 소제목 | `Uniform-Bold` | 섹션 넘버링(sz=4500), 본문 소제목(sz=inherit) |
| 본문 / 일반 | `Uniform` | 본문(sz=1200), 부연 설명(sz=1050), 날짜(sz=1500) |
| 보조 / 캡션 | `Uniform-Light` | 페이지 상단 타이틀 표기(sz=1000) |
| 테이블 헤더 | `Uniform-Bold` | 테이블 소제목 |
| 테이블 본문 | `Uniform-Medium` / `Uniform Regular` | 테이블 셀 내용 |

**절대 하지 말 것:** 메인 제목에 `Uniform-Bold` 사용, 본문에 `Uniform-Black` 사용.

### 2.3 XML 구현 패턴

`<a:ea>` 태그(동아시아 폰트)는 사용하지 않습니다. `<a:latin>`만 사용합니다.

```xml
<!-- 표지 메인 제목 (sz=7000, Uniform-Black, spc=-20) -->
<a:r>
  <a:rPr lang="en-US" altLang="ko-KR" sz="7000" spc="-20" dirty="0">
    <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
    <a:latin typeface="Uniform-Black" panose="02000000000000000000" pitchFamily="50" charset="0"/>
  </a:rPr>
  <a:t>LOREM IPSUM</a:t>
</a:r>

<!-- 섹션 타이틀 (sz=5500, Uniform-Black, spc=-20) -->
<a:r>
  <a:rPr lang="en-US" altLang="ko-KR" sz="5500" spc="-20" dirty="0">
    <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
    <a:latin typeface="Uniform-Black" panose="02000000000000000000" pitchFamily="50" charset="0"/>
  </a:rPr>
  <a:t>SECTION TITLE</a:t>
</a:r>

<!-- 섹션 번호 (sz=4500, Uniform-Bold, spc 미지정) -->
<a:r>
  <a:rPr lang="en-US" altLang="ko-KR" sz="4500" dirty="0">
    <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
    <a:latin typeface="Uniform-Bold" panose="02000000000000000000" pitchFamily="50" charset="0"/>
  </a:rPr>
  <a:t>1.</a:t>
</a:r>

<!-- 본문 텍스트 (sz=1200, Uniform, spc=-20) -->
<a:r>
  <a:rPr lang="en-US" altLang="ko-KR" sz="1200" spc="-20" dirty="0">
    <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
    <a:latin typeface="Uniform" panose="02000000000000000000" pitchFamily="50" charset="0"/>
  </a:rPr>
  <a:t>Body text content here.</a:t>
</a:r>

<!-- 페이지 상단 타이틀 표기 (sz=1000, Uniform-Light, spc=-20) -->
<a:r>
  <a:rPr lang="en-US" altLang="ko-KR" sz="1000" spc="-20" dirty="0">
    <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
    <a:latin typeface="Uniform-Light" panose="02000000000000000000" pitchFamily="50" charset="0"/>
  </a:rPr>
  <a:t>1. 4P TITLE</a:t>
</a:r>

<!-- 본문 소제목 (sz=inherit, Uniform-Bold, spc=-20) -->
<a:r>
  <a:rPr lang="en-US" altLang="ko-KR" spc="-20" dirty="0">
    <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
    <a:latin typeface="Uniform-Bold" panose="02000000000000000000" pitchFamily="50" charset="0"/>
  </a:rPr>
  <a:t>1. Lorem Ipsum</a:t>
</a:r>
```

### 2.4 자간 (Character Spacing) 규칙

OOXML `spc` 속성은 **1/100pt 단위**입니다. (`spc="-20"` = -0.20pt)

#### 자간 실측 테이블

| 폰트 크기 (pt) | OOXML sz 값 | spc 값 | 폰트 | 사용처 |
|:---|:---|:---|:---|:---|
| 70pt | sz="7000" | spc="-20" | `Uniform-Black` | 표지 메인 제목 |
| 55pt | sz="5500" | spc="-20" | `Uniform-Black` | 섹션 타이틀 |
| 45pt | sz="4500" | (미지정) | `Uniform-Bold` | 섹션 번호 |
| 38pt | sz="3800" | spc="-20" | `Uniform-Black` | CONTENTS 제목 번호 |
| 33pt | sz="3300" | (미지정) | `Uniform-Black` | CONTENTS 항목명 (5개) |
| 30pt | sz="3000" | (미지정) | `Uniform-Black` | CONTENTS 항목명 (10개) |
| 13pt | sz="1300" | spc="-20" | `Uniform` | CONTENTS 부연 텍스트 |
| 12pt | sz="1200" | spc="-20" | `Uniform` / `Uniform-Bold` | 본문 / 소제목 |
| 10pt | sz="1000" | spc="-20" | `Uniform-Light` | 페이지 타이틀·캡션 |
| 10.5pt | sz="1050" | (미지정) | `Uniform` | 주석·부연 설명 |
| 15pt | sz="1500" | (미지정) | `Uniform` | 날짜 |
| 차트 수치 | sz="1200" | spc="+40" | `Uniform` | 차트 축 레이블 (예외) |

**요약 원칙:** `spc="-20"`이 기본값입니다. sz=1050 이하, CONTENTS 항목명(sz=3300·3000), 섹션 번호(sz=4500), 날짜(sz=1500)는 spc를 생략(보통)합니다.

---

## 3. 제목 표기

**메인 제목은 항상 ALL CAPITALS(대문자)로** 표기합니다.

```xml
<!-- 올바른 예시 -->
<a:t>ARTE MUSEUM GARDEN AUSTRALIA</a:t>

<!-- 잘못된 예시 -->
<a:t>Arte Museum Garden Australia</a:t>  <!-- ❌ Title Case 금지 -->
```

단, 본문 소제목(예: `1. Lorem Ipsum` 형식)은 Sentence case를 사용합니다.

---

## 4. 슬라이드 레이아웃 & 배경 규칙

### 4.1 레이아웃 유형 (실측)

| 레이아웃 파일 | 배경 | 용도 |
|:---|:---|:---|
| `slideLayout1.xml` | 사진 배경 (어두운 이미지 오버레이) | 표지 커버 |
| `slideLayout2.xml` | 검정 (`schemeClr val="tx1"` = `#000000`) | CONTENTS, 섹션 구분, 본문 슬라이드 |
| `slideLayout3.xml` | 흰색 (`schemeClr val="bg1"` = `#FFFFFF`) | 엔딩 / 백커버 |

### 4.2 슬라이드 구조

- **표지**: slideLayout1 (사진 배경)
- **CONTENTS / 섹션 / 본문**: slideLayout2 (검정 배경) → 텍스트는 흰색
- **백커버**: slideLayout3 (흰색 배경) → 텍스트는 검정

### 4.3 배경 위 텍스트 가독성

사진 배경(표지 등) 위에 텍스트를 배치할 경우, **반드시 반투명 검정 박스**를 깔아 가독성을 확보합니다.

```xml
<p:sp>
  <p:spPr>
    <a:xfrm><a:off x="342900" y="2743200"/><a:ext cx="8534400" cy="1828800"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:solidFill>
      <a:srgbClr val="000000">
        <a:alpha val="50000"/>  <!-- 50% 불투명 = 50% 투명 -->
      </a:srgbClr>
    </a:solidFill>
  </p:spPr>
</p:sp>
```

투명도 범위: **alpha val="40000"~"60000"** (상황에 따라 조정)

---

## 5. 색상 규칙

| 배경 유형 | 사용 텍스트 색상 |
|:---|:---|
| 어두운 배경 (검정) | `FFFFFF` (흰색), `FFC000` (금색 강조, accent4) |
| 밝은 배경 (흰색) | `000000` (검정) |

테마 accent4 = `#FFC000` (금색) — 강조 요소에 사용.

---

## 6. 로고 규칙

### 6.1 슬라이드 마스터 적용 원칙

- 로고는 **슬라이드 마스터(slideMaster1.xml)에만** 배치합니다
- 개별 슬라이드에 로고를 직접 삽입하지 않습니다
- 편집 작업 시 마스터에 배치된 로고를 개별 슬라이드에서 복제하지 않습니다

### 6.2 로고 파일 선택

| 배경 | 파일명 |
|:---|:---|
| 밝은 배경 | `dstrict_CI_BLACK.png` |
| 어두운 배경 | `dstrict_CI_WHITE.png` |

---

## 7. 텍스트 박스 통일성

**같은 유형의 슬라이드는 텍스트 박스 위치(x, y, w, h)를 통일합니다.**

예: 본문 슬라이드가 5장이면, 제목 박스와 본문 박스 좌표가 5장 모두 동일해야 합니다.

---

## 8. 테이블 규칙

| 영역 | 정렬 |
|:---|:---|
| 헤더 행 | 가운데 정렬 (center) |
| 좌측 첫 컬럼 (항목명) | 왼쪽 정렬 (left) |
| 숫자 데이터 | 오른쪽 정렬 (right) |
| 음수 | 괄호 표기: `(6.9M)` |
| 날짜/단위 | 테이블 상단 또는 하단에 기준 명시 필수 |

---

## 9. 회사 명칭 표기 규칙

| 맥락 | 표기 |
|:---|:---|
| 슬라이드 본문 (영문) | d'strict (소문자 d, 어퍼스트로피 포함) |
| 파일명 | dstrict (어퍼스트로피 제외) |
| 로고 필요 시 | CI 이미지 파일 사용 (텍스트 대체 금지) |

---

## 10. 수정 작업 시 주의사항

- 추가 수정 요청 시, **기존에 확정(컨펌)된 내용은 임의로 변경하지 않습니다**
- 별도 언급이 없었던 부분은 이전 버전을 유지합니다
- 수정 요청된 항목만 정확히 반영합니다

---

## 11. IR 자료 별도 규칙

- IR 포맷 및 색상-수치 매뉴얼 PPT 파일이 별도 등록될 예정입니다
- 등록 시 해당 파일의 규칙이 본 스킬보다 우선 적용됩니다

---

## 12. 구현 체크리스트

PPT 생성/편집 완료 후 아래 항목을 자체 검증합니다:

- [ ] 파일명이 `YYMMDD_제목.pptx` 형식인가?
- [ ] 모든 텍스트에 Uniform 계열 폰트가 적용되었는가?
- [ ] 메인 제목에 `Uniform-Black`이 적용되었는가?
- [ ] 본문 소제목·섹션 번호에 `Uniform-Bold`가 적용되었는가?
- [ ] 본문 텍스트에 `Uniform`이 적용되었는가?
- [ ] `<a:ea>` 태그가 사용되지 않았는가?
- [ ] 기본 자간이 `spc="-20"`으로 적용되었는가?
- [ ] sz=1050 이하, sz=4500, sz=3300·3000, sz=1500에 spc가 생략(보통)되었는가?
- [ ] 메인 제목이 ALL CAPITALS인가?
- [ ] 슬라이드 레이아웃이 용도에 맞게 지정되었는가? (표지=layout1, 본문=layout2, 백커버=layout3)
- [ ] 로고가 슬라이드 마스터에만 배치되었는가?
- [ ] 사진 배경 위 텍스트에 반투명 박스(`alpha val`)가 있는가?
- [ ] 같은 유형 슬라이드의 텍스트 박스 위치가 통일되었는가?
- [ ] 테이블 정렬 규칙이 지켜졌는가?
- [ ] 회사명이 d'strict (소문자 d, 어퍼스트로피 포함)로 표기되었는가?
