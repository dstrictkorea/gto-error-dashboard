'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   Auto-Translation Layer (EN → KO) — G-ATIS v5
   Exact-match dictionary only. No partial word replacement.
   If full text matches → Korean. Otherwise → original English as-is.
   ═══════════════════════════════════════════════════════════════════════ */

var _trDict = {
  // ── Time / Duration ──
  'under 5 min':'5분 이내','under 10 min':'10분 이내','under 15 min':'15분 이내',
  'under 20 min':'20분 이내','under 30 min':'30분 이내','under 45 min':'45분 이내',
  'under 1 hour':'1시간 이내','under 1 hr':'1시간 이내','under 2 hours':'2시간 이내',
  'over 15 min':'15분 이상','over 30 min':'30분 이상','over 1 hour':'1시간 이상',
  'over 2 hours':'2시간 이상',
  '5 min':'5분','10 min':'10분','15 min':'15분','20 min':'20분','25 min':'25분',
  '30 min':'30분','45 min':'45분','60 min':'60분','90 min':'90분',
  '1 hour':'1시간','1 hr':'1시간','1.5 hours':'1시간 30분',
  '2 hours':'2시간','2 hrs':'2시간','3 hours':'3시간',
  '4 hours':'4시간','5 hours':'5시간','half hour':'30분',
  'half day':'반나절','next day':'익일','same day':'당일','immediate':'즉시',

  // ── Action Types ──
  'on-site':'현장 대응','on site':'현장 대응','onsite':'현장 대응',
  'remote':'원격 지원','remote support':'원격 지원','remote fix':'원격 수정',

  // ── Common Actions (full sentence exact match) ──
  'restarted system':'시스템 재부팅','restarted the system':'시스템 재부팅 완료',
  'restarted pc':'PC 재시작','restarted pcs':'PC 재시작','restarted all pcs':'전체 PC 재시작',
  'restarted server':'서버 재시작','restarted the server':'서버 재시작 완료',
  'restarted media server':'미디어 서버 재시작','restarted the media server':'미디어 서버 재시작 완료',
  'restarted projector':'프로젝터 재시작','restarted the projector':'프로젝터 재시작 완료',
  'restarted the projectors':'프로젝터 재시작 완료',
  'restarted application':'애플리케이션 재시작','restarted app':'앱 재시작',
  'restarted software':'소프트웨어 재시작','restarted content':'콘텐츠 재시작',
  'restarted the content':'콘텐츠 재시작 완료',
  'restart all pcs using bms tool':'BMS 도구로 전체 PC 재시작',
  'restart both the projectors and pcs':'프로젝터 및 PC 전부 재시작',
  'restart it from the server room':'서버실에서 재시작',
  'restart from server room':'서버실에서 재시작',
  'rebooted':'재부팅','rebooted system':'시스템 재부팅','rebooted server':'서버 재부팅',
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
  'fixed':'수정 완료','fixed the issue':'장애 수정 완료','fixed remotely':'원격 수정 완료',
  'fixed from the echo touch controller':'Echo Touch 컨트롤러에서 수정',
  'used bms to make sure projector was turned on':'BMS로 프로젝터 정상 작동 확인',
  'after boot-up started, content audio playback returned':'부팅 후 콘텐츠 오디오 재생이 복구됨',
  'collect crash dumps if frequent':'빈번 시 크래시 덤프 수집',
  'escalated to vendor':'벤더에 에스컬레이션','escalated to hq':'본사에 에스컬레이션',
  'recovered via restart':'재시작으로 복구','recovered via power cycle':'전원 재시작으로 복구',
  'relaunched content':'콘텐츠 재실행','cleared cache':'캐시 삭제',

  // ── Common Issues (full sentence exact match) ──
  'no signal':'신호 없음','no input signal':'입력 신호 없음','signal lost':'신호 유실',
  'black screen':'블랙스크린','blank screen':'빈 화면','white screen':'화이트스크린',
  'flickering':'플리커링','screen flickering':'화면 플리커링',
  'output flickered intermittently':'출력이 간헐적으로 플리커링 발생',
  'intermittent flickering':'간헐적 플리커링',
  'freezing':'프리징','system freeze':'시스템 프리징','intermittent system freeze':'간헐적 시스템 멈춤',
  'overheating':'과열','projector overheating':'프로젝터 과열',
  'audio not working':'오디오 작동 불가','no audio':'오디오 없음','no sound':'소리 없음',
  'audio subscriptions':'오디오 서브스크립션',
  "subscriptions weren't recognized":"서브스크립션이 인식되지 않음",
  "weren't recognized":'인식되지 않음',"didn't recognize":'인식하지 못함',
  'network disconnected':'네트워크 연결 끊김','network down':'네트워크 다운',
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

  // ── Categories ──
  'software':'소프트웨어','hardware':'하드웨어','network':'네트워크','other':'기타',

  // ── Equipment ──
  'projector':'프로젝터','led panel':'LED 패널','led wall':'LED 월',
  'media server':'미디어 서버','display':'디스플레이','speaker':'스피커',
  'controller':'컨트롤러','sensor':'센서','router':'라우터',

  // ── HQ Comment patterns ──
  'inspect internal heat/filters':'내부 열/필터 점검',
  'report to hq if symptoms recur':'증상 재발 시 본사에 보고',
  'keep monitoring':'지속 모니터링','continue monitoring':'지속 모니터링',
  'check firmware version':'펌웨어 버전 확인',
  'check cable connections':'케이블 연결 상태 확인',
  'contact vendor':'벤더 연락','schedule vendor visit':'벤더 방문 예약',
  'needs further investigation':'추가 조사 필요','temporary fix':'임시 조치',
  'monitor':'모니터링','escalate':'에스컬레이션',

  // ── Status ──
  'outputs on':'에 대한 출력','content audio playback returned':'콘텐츠 오디오 재생 복구',
  'boot-up started':'부팅 완료','on dante network':'Dante 네트워크에서',
  'immersive display pro':'Immersive Display Pro','which were':'해당 장치:',
  'n/a':'해당 없음','tbd':'추후 결정','tbc':'추후 확인'
};

/**
 * autoTr(text) — Exact-match only translation (case-insensitive).
 * Full text matches → Korean. Otherwise → original English unchanged.
 */
function autoTr(text) {
  if (!text || _lang !== 'ko') return text;
  var trimmed = text.trim();
  var lo = trimmed.toLowerCase();
  // Try exact match first (preserving original case)
  if (_trDict[lo]) return _trDict[lo];
  // Try looking up in dictionary keys case-insensitively as fallback
  for (var key in _trDict) {
    if (key.toLowerCase() === lo) return _trDict[key];
  }
  return text;  // no match → return original, no partial replacement
}

function autoTrCat(cat) {
  if (!cat || _lang !== 'ko') return cat;
  var map = {Software:'소프트웨어', Hardware:'하드웨어', Network:'네트워크', Other:'기타'};
  return map[cat] || cat;
}

function autoTrAction(at) {
  if (!at || _lang !== 'ko') return at;
  if (at.indexOf('On') >= 0) return '현장 대응';
  if (at.indexOf('Remote') >= 0) return '원격 지원';
  return at;
}
