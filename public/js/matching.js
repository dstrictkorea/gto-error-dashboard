'use strict';

function matchAssets(branch,zone){
  var nz=function(z){return(z||'').toLowerCase().replace(/[\s_\-]/g,'')};
  var m=G.assets.filter(function(a){return a.Branch===branch&&nz(a.Zone)===nz(zone)});
  if(!m.length) m=G.assets.filter(function(a){return a.Branch===branch&&(nz(a.Zone).indexOf(nz(zone))>=0||nz(zone).indexOf(nz(a.Zone))>=0)});
  return m;
}

/* ═══════════════════════════════════════════════════════════════
   Similar Case Matching — 100-Point Scoring System
   ═══════════════════════════════════════════════════════════════
   40pt  — Equipment Category (speaker, PC, projector, cable…)
        → 같은 장비군이면 가장 높은 유사도 (핵심 지표)
   25pt  — Issue Category (Hardware, Software, Network)
        → 같은 장애 분류면 근본 원인 유사 가능성 높음
   15pt  — Symptom Keywords (증상 키워드 중복)
        → 실제 증상 설명에서 겹치는 단어 수 비례 배점
   10pt  — Same Zone (동일 Zone)
        → 같은 구역이면 환경/인프라 원인 가능성
   10pt  — Place Type (wall, floor, table, ceiling…)
        → 같은 설치 유형이면 구조적 문제 가능성
   ───────────────────────────────────────────────────────────────
   Max: 100pt  |  Threshold: >= 75pt
   ═══════════════════════════════════════════════════════════════ */

var EQUIP_GROUPS = {
  audio:      ['audio','sound','dante','soundcard','speaker','amp','amplifier','microphone','mic','volume','mute','subwoofer','tweeter','woofer','receiver','mixer','dsp'],
  projector:  ['projector','pj','projection','lens','lamp','throw','beamer','optoma','epson','panasonic','barco','christie','nec'],
  pc:         ['pc','computer','workstation','nuc','desktop','ndisplay','ndi','unreal','gpu','cpu','ram','motherboard','bios','driver','windows','os','boot','ssd','hdd'],
  led:        ['led','led wall','led panel','led module','pixel','novastar','brompton','processor'],
  display:    ['display','monitor','screen','lcd','oled','tv','signage','samsung','lg','kiosk'],
  network:    ['network','switch','router','ethernet','wifi','ip','dns','dhcp','lan','wan','vlan','fiber','optic','ping','latency','bandwidth','firewall','port'],
  media:      ['media server','media player','watchout','disguise','resolume','d3','notch','touchdesigner','madmapper','playback'],
  sensor:     ['sensor','lidar','kinect','tracking','camera','ir','depth','motion','gesture','interactive'],
  controller: ['controller','dmx','artnet','lighting','plc','crestron','extron','bms','automation','relay','rs232','serial'],
  server:     ['server','nas','raid','storage','backup','database'],
  power:      ['power','ups','pdu','breaker','outlet','surge','voltage','electrical','battery'],
  cable:      ['cable','hdmi','dp','displayport','sdi','usb','cat6','cat5','rj45','connector','adapter','splitter','extender','fiber','optical','patch','dvi','vga']
};

var PLACE_TYPES = {
  wall:    ['wall','벽','벽면','월'],
  floor:   ['floor','바닥','플로어','ground'],
  table:   ['table','테이블','탁자','desk'],
  ceiling: ['ceiling','천장','천정','상부'],
  lobby:   ['lobby','로비','entrance','입구'],
  stage:   ['stage','스테이지','무대'],
  booth:   ['booth','부스'],
  outdoor: ['outdoor','외부','야외','exterior'],
  hallway: ['hallway','복도','corridor','통로'],
  room:    ['room','룸','방','office']
};

/* ── Helper: tokenize text into meaningful words ── */
function _tok(t){
  return (t||'').toLowerCase().replace(/[^a-z0-9\uac00-\ud7a3]/g,' ').split(/\s+/).filter(function(w){return w.length>1});
}

/* ── Helper: detect equipment group from text ── */
function _getEquipGroup(txt){
  var lt=(txt||'').toLowerCase();
  var groups=Object.keys(EQUIP_GROUPS);
  for(var g=0;g<groups.length;g++){
    var keys=EQUIP_GROUPS[groups[g]];
    for(var k=0;k<keys.length;k++){
      if(lt.indexOf(keys[k])>=0) return groups[g];
    }
  }
  // Regex fallback for short abbreviations
  if(/\b(pc|pj)\b/i.test(lt)) return /pj/i.test(lt)?'projector':'pc';
  return null;
}

/* ── Helper: detect place type from zone name or issue text ── */
function _getPlaceType(zone, detail){
  var combined = ((zone||'')+' '+(detail||'')).toLowerCase();
  var types = Object.keys(PLACE_TYPES);
  for(var i=0;i<types.length;i++){
    var keywords = PLACE_TYPES[types[i]];
    for(var k=0;k<keywords.length;k++){
      if(combined.indexOf(keywords[k])>=0) return types[i];
    }
  }
  return null;
}

/* ── Helper: count overlapping keywords between two texts ── */
function _countKeywordOverlap(textA, textB){
  var stopWords = ['the','a','an','is','was','are','were','and','or','but','in','on','at','to','for','of','not','no','with','from','by','it','this','that','has','had','have','been','be','do','does','did','will','would','can','could','should','may','might','shall','so','if','then','than','as','after','before','during','while','about','into','out','up','down','off','over','under','again','further','once','all','each','every','both','few','more','most','other','some','such','very','just','also','only'];
  var tokA = _tok(textA).filter(function(w){return w.length>2 && stopWords.indexOf(w)<0});
  var tokB = _tok(textB).filter(function(w){return w.length>2 && stopWords.indexOf(w)<0});
  var overlap = 0;
  var matched = {};
  tokA.forEach(function(wa){
    tokB.forEach(function(wb){
      if(!matched[wb] && (wa===wb || (wa.length>=4 && wb.length>=4 && (wa.indexOf(wb)>=0 || wb.indexOf(wa)>=0)))){
        overlap++;
        matched[wb]=true;
      }
    });
  });
  return overlap;
}

/* ══════════════════════════════════════════════════════
   searchSimilar() — 100-Point Scoring Engine
   ══════════════════════════════════════════════════════ */
function searchSimilar(branch, zone, cat, issue, excludeRecord){
  var THRESHOLD = 75;
  var issueEquip  = _getEquipGroup(issue);
  var issuePlace  = _getPlaceType(zone, issue);
  var issueZone   = (zone||'').toLowerCase().trim();

  var results = G.history.map(function(h){
    // Exclude the clicked incident itself
    if(excludeRecord){
      var sameDetail = (h.detail||'').toLowerCase() === (excludeRecord.IssueDetail||'').toLowerCase();
      var sameZone   = (h.zone||'').toLowerCase()   === (excludeRecord.Zone||'').toLowerCase();
      if(sameDetail && sameZone) return {h:h, score:-1, breakdown:null};
    }

    var score = 0;
    var breakdown = {equip:0, cat:0, keyword:0, zone:0, place:0};

    /* ── 40pt: Equipment Category Match ── */
    /* 같은 장비군(projector↔projector, pc↔pc 등)이면 핵심 유사 */
    var hEquip = _getEquipGroup(h.detail);
    if(issueEquip && hEquip && issueEquip === hEquip){
      breakdown.equip = 40;
      score += 40;
    }

    /* ── 25pt: Issue Category Match ── */
    /* Hardware/Software/Network 동일 분류 */
    if((h.cat||'').toLowerCase() === (cat||'').toLowerCase()){
      breakdown.cat = 25;
      score += 25;
    }

    /* ── 15pt: Symptom Keyword Overlap (비례 배점) ── */
    /* 증상 설명에서 겹치는 단어 수에 따라 0~15pt */
    var overlap = _countKeywordOverlap(issue, h.detail);
    if(overlap >= 4){
      breakdown.keyword = 15; score += 15;
    } else if(overlap === 3){
      breakdown.keyword = 12; score += 12;
    } else if(overlap === 2){
      breakdown.keyword = 8; score += 8;
    } else if(overlap === 1){
      breakdown.keyword = 4; score += 4;
    }

    /* ── 10pt: Same Zone ── */
    /* 동일 구역 = 환경/인프라 관련 원인 가능성 */
    if(issueZone && (h.zone||'').toLowerCase().trim() === issueZone){
      breakdown.zone = 10;
      score += 10;
    }

    /* ── 10pt: Place Type Match ── */
    /* wall/floor/table 등 같은 설치 유형 */
    var hPlace = _getPlaceType(h.zone, h.detail);
    if(issuePlace && hPlace && issuePlace === hPlace){
      breakdown.place = 10;
      score += 10;
    }

    return {h:h, score:score, breakdown:breakdown};
  });

  return results
    .filter(function(x){ return x.score >= THRESHOLD; })
    .sort(function(a,b){ return b.score - a.score; })
    .slice(0, 8)
    .map(function(x){ x.h._matchScore = x.score; x.h._matchBreakdown = x.breakdown; return x.h; });
}
