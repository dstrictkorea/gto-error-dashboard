'use strict';
/**
 * admin.js v4 — Daily/Monthly 페이지와 동일한 컴포넌트 사용
 * gto 전용 Admin 페이지
 */

/* ── 전역 상태 ── */
var _adminView          = 'daily';
var _admDailyBranch     = 'ALL';
var _admDailyRegion     = 'all';
var _admMonthlyBranch   = 'ALL';
var _admMonthlyRegion   = 'all';
var _adminRptGlobalLang = 'en';
var _adminRptKoreaLang  = 'ko';
var _admCharts          = {};

/* ── 페이지네이션 상태 ── */
var _admDailyPage   = 0;
var _admDailyPS     = 20; // page size
var _admDailyData   = []; // 정렬된 전체 데이터
var _admMonthlyPage = 0;
var _admMonthlyPS   = 20;
var _admMonthlyData = [];


/* ── Category 한글 변환 ── */
function _catKo(c){
  if(c==='Software'||c==='소프트웨어') return '소프트웨어';
  if(c==='Hardware'||c==='하드웨어') return '하드웨어';
  if(c==='Network'||c==='네트워크') return '네트워크';
  return c||'기타';
}
/* ── 지점 메타 ── */
var _AI={AMNY:'🗽',AMLV:'🎰',AMDB:'🏜️',AMGN:'🏔',AMYS:'🌊',AMBS:'⚓',AMJJ:'🍊'};
var _AN={AMGN:'강릉',AMYS:'여수',AMBS:'부산',AMJJ:'제주',AMNY:'뉴욕',AMLV:'라스베가스',AMDB:'두바이'};
var _AC={AMGN:'#0891b2',AMYS:'#059669',AMBS:'#2563eb',AMJJ:'#7c3aed',AMNY:'#185FA5',AMLV:'#993C1D',AMDB:'#534AB7'};
var _AG=['AMNY','AMLV','AMDB'],_AK=['AMGN','AMYS','AMBS','AMJJ'],_AA=_AG.concat(_AK);
function _brs(r){return r==='global'?_AG:r==='korea'?_AK:_AA;}

/* ── 타임존 ── */
var _ATZ={AMNY:'America/New_York',AMLV:'America/Los_Angeles',AMDB:'Asia/Dubai',
  AMGN:'Asia/Seoul',AMYS:'Asia/Seoul',AMBS:'Asia/Seoul',AMJJ:'Asia/Seoul'};
function _atDay(br,ago){
  var d=new Date(); if(ago) d.setDate(d.getDate()-ago);
  return d.toLocaleDateString('en-CA',{timeZone:_ATZ[br]||'Asia/Seoul'});
}

/* ════════════════════════════════
   뷰 전환
   ════════════════════════════════ */
function admSwitchView(view){
  _adminView=view;
  // 뷰 전환시 각각 전체로 초기화
  if(view==='daily'){ _admDailyRegion='all'; _admDailyBranch='ALL';
    document.querySelectorAll('#adm-daily-region-toggle .region-btn').forEach(function(b){b.classList.toggle('active',b.dataset.region==='all');});
  }
  if(view==='monthly'){ _admMonthlyRegion='all'; _admMonthlyBranch='ALL';
    document.querySelectorAll('#adm-monthly-region-toggle .region-btn').forEach(function(b){b.classList.toggle('active',b.dataset.region==='all');});
  }
  var vd=document.getElementById('adm-view-daily');
  var vm=document.getElementById('adm-view-monthly');
  var bd=document.getElementById('adm-btn-daily');
  var bm=document.getElementById('adm-btn-monthly');
  if(vd) vd.style.display=view==='daily'?'':'none';
  if(vm) vm.style.display=view==='monthly'?'':'none';
  if(bd){bd.style.background=view==='daily'?'#534AB7':'var(--card)';bd.style.color=view==='daily'?'#fff':'var(--t1)';bd.style.border=view==='daily'?'none':'1px solid var(--border)';}
  if(bm){bm.style.background=view==='monthly'?'#534AB7':'var(--card)';bm.style.color=view==='monthly'?'#fff':'var(--t1)';bm.style.border=view==='monthly'?'none':'1px solid var(--border)';}
  if(view==='daily'){_admDailyStrip();renderAdminDaily();}
  if(view==='monthly'){_populateAdminSelects();_admMonthlyStrip();renderAdminMonthly();}
}

/* ════════════════════════════════
   리포트 생성
   ════════════════════════════════ */
function setAdminRptLang(region,lang,btn){
  if(region==='global') _adminRptGlobalLang=lang;
  else _adminRptKoreaLang=lang;
  // region-btn 스타일 (기존 CSS 활용)
  var enId=region==='global'?'adm-g-en':'adm-k-en';
  var koId=region==='global'?'adm-g-ko':'adm-k-ko';
  var enBtn=document.getElementById(enId), koBtn=document.getElementById(koId);
  if(enBtn){enBtn.classList.toggle('active',lang==='en');}
  if(koBtn){koBtn.classList.toggle('active',lang==='ko');}
}

async function adminReport(region,action){
  var lang=region==='global'?_adminRptGlobalLang:_adminRptKoreaLang;
  var yearEl=document.getElementById(region==='global'?'adm-g-year':'adm-k-year');
  var monthEl=document.getElementById(region==='global'?'adm-g-month':'adm-k-month');
  var statusEl=document.getElementById(region==='global'?'adm-g-status':'adm-k-status');
  if(!yearEl||!monthEl||!statusEl) return;
  var year=parseInt(yearEl.value), monthVal=parseInt(monthEl.value);
  var isAnnual=isNaN(monthVal)||monthVal===-1;
  var endpoint=isAnnual?'/api/annual-report':'/api/report';
  var body=isAnnual?{year:year,action:action,lang:lang,region:region}
    :{month:monthVal,year:year,action:action,lang:lang,reportType:'monthly',region:region};
  statusEl.style.cssText='display:block;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;background:var(--bg);border:1px solid var(--border);margin-top:8px;color:var(--t2)';
  statusEl.innerHTML='<div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;border:2px solid var(--border);border-top-color:#534AB7;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>PDF 생성 중...</div>';
  try{
    var resp=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await resp.json(); if(!d.ok) throw new Error(d.error||'생성 실패');
    statusEl.style.cssText='display:block;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;background:#f0fdf4;border:1px solid #86efac;margin-top:8px;color:#166534';
    statusEl.textContent='✅ '+d.message;
    if(action==='download'||action==='preview'){
      var bin=atob(d.pdfBase64),arr=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      var blob=new Blob([arr],{type:'application/pdf'}),url=URL.createObjectURL(blob);
      if(action==='download'){var a=document.createElement('a');a.href=url;a.download=d.fileName;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},3000);}
      else{window.open(url,'_blank');setTimeout(function(){URL.revokeObjectURL(url);},120000);}
    }
    if(typeof toast==='function') toast(d.fileName+' 생성 완료','success');
  }catch(e){
    statusEl.style.cssText='display:block;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;background:#fef2f2;border:1px solid #fca5a5;margin-top:8px;color:#991b1b';
    statusEl.textContent='❌ '+e.message;
    if(typeof toast==='function') toast('리포트 생성 실패','error');
  }
}

/* ════════════════════════════════
   일일 현황 — Daily 페이지와 동일한 로직/스타일
   ════════════════════════════════ */
function admSetDailyRegion(r,btn){
  _admDailyRegion=r; _admDailyBranch='ALL';
  document.querySelectorAll('#adm-daily-region-toggle .region-btn').forEach(function(b){
    b.classList.toggle('active',b===btn);
  });
  _admDailyStrip(); renderAdminDaily();
}

function _admDailyStrip(){
  var strip=document.getElementById('adm-daily-br-strip'); if(!strip) return;
  // 전체 선택시 지점 버튼 숨김
  if(_admDailyRegion==='all'){
    strip.style.display='none';
    strip.innerHTML='';
    return;
  }
  strip.style.display='flex';
  var brs=_brs(_admDailyRegion), br=_admDailyBranch;
  // 국내 순서: AMJJ,AMYS,AMGN,AMBS
  if(_admDailyRegion==='korea') brs=['AMJJ','AMYS','AMGN','AMBS'];
  var icons=_AI, BC=_AC;
  // ALL 버튼
  var allActive=(br==='ALL');
  var html='<button class="branch-seg-btn'+(allActive?' branch-seg-active':'')+'" onclick="admSelDailyBr(\'ALL\')" style="'+(allActive?'background:#1e293b;color:#fff;border:none':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+';padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .2s">'
    +'<span>🌐</span><span>전체</span></button>';
  brs.forEach(function(b){
    var isA=br===b, col=BC[b]||'#534AB7';
    html+='<button class="branch-seg-btn'+(isA?' branch-seg-active':'')+'" onclick="admSelDailyBr(\''+b+'\')" style="'+(isA?'background:'+col+';color:#fff;border:none':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+';padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .2s">'
      +'<span>'+(icons[b]||'📍')+'</span>'
      +'<span>'+b+'</span>'
      +'</button>';
  });
  strip.innerHTML=html;
}

function admSelDailyBr(b){
  _admDailyBranch=(_admDailyBranch===b)?'ALL':b;
  _admDailyStrip(); renderAdminDaily();
}

function renderAdminDaily(){
  if(!G||!G.logs){
    // G 아직 로딩 중 — 로드 완료 후 재호출
    window._admDailyPendingRender=true;
    return;
  }
  window._admDailyPendingRender=false;
  var brs=_brs(_admDailyRegion), br=_admDailyBranch;
  var isDark=document.documentElement.classList.contains('dark-mode');

  // 7일 데이터 수집 (지점별 타임존)
  var weekLogs=[], todayLogs=[];
  brs.forEach(function(b){
    if(br!=='ALL'&&b!==br) return;
    var today=_atDay(b,0), weekAgo=_atDay(b,7);
    G.logs.forEach(function(r){
      if(r.Branch!==b) return;
      var rd=(r.Date||'').split('T')[0];
      if(rd>=weekAgo&&rd<=today){
        weekLogs.push(r);
        if(rd===today) todayLogs.push(r);
      }
    });
  });

  // ── KPI 카드 ──
  var kpiEl=document.getElementById('adm-daily-kpi');
  if(kpiEl){
    var weekCrit=weekLogs.filter(function(r){return(r.Difficulty||0)>=4;}).length;
    var prevWeekLogs=[];
    brs.forEach(function(b){
      if(br!=='ALL'&&b!==br) return;
      var weekAgo2=_atDay(b,7), twoWeeksAgo=_atDay(b,14);
      G.logs.forEach(function(r){
        if(r.Branch!==b) return;
        var rd=(r.Date||'').split('T')[0];
        if(rd>=twoWeeksAgo&&rd<weekAgo2) prevWeekLogs.push(r);
      });
    });
    var dw=weekLogs.length-prevWeekLogs.length;
    var avgDay=(weekLogs.length/7).toFixed(1);

    function mcCard(label,val,delta,sub,color){
      var ds=delta!==null?(delta>0?'up':delta<0?'dn':'eq'):'eq';
      var dc=ds==='up'?'#ef4444':ds==='dn'?'#22c55e':'#8a8a84';
      var arrow=ds==='up'?'↑':ds==='dn'?'↓':'→';
      return '<div class="card mc" style="--mc-c:'+color+'">'
        +'<div class="mc-lbl">'+label+'</div>'
        +'<div class="mc-val" style="color:'+color+';font-family:var(--f-display)">'+val+'</div>'
        +(sub?'<div class="mc-delta" style="background:none;font-size:11px;color:var(--t3)">'+sub+'</div>':'')
        +(delta!==null?'<div class="mc-delta '+ds+'" style="color:'+dc+';font-size:11px;font-weight:600">'+arrow+' '+(delta>=0?'+':'')+delta+' vs 전주</div>':'')
        +'</div>';
    }

    // 요약 카드 4개 (항상 표시)
    var summaryHtml='<div style="display:contents">'
      +mcCard('이번 주 에러',weekLogs.length,dw,'최근 7일','#534AB7')
      +mcCard('오늘 에러',todayLogs.length,null,new Date().toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}),'#2563eb')
      +mcCard('위험 Lv.4+',weekCrit,null,'이번 주','#dc2626')
      +mcCard('일평균',avgDay,null,'건/일','#8b5cf6')
      +'</div>';

    // 지점별 카드: 전체일때만 표시, 구분선으로 분리
    var brHtml='';
    if(br==='ALL'){
      var brCards='';
      brs.forEach(function(b){
        var col=_AC[b]||'#534AB7';
        var cnt=weekLogs.filter(function(r){return r.Branch===b;}).length;
        var tCnt=todayLogs.filter(function(r){return r.Branch===b;}).length;
        brCards+='<div class="card mc" style="--mc-c:'+col+';border-top:3px solid '+col+'">'
          +'<div class="mc-lbl"><span style="font-size:15px;line-height:1;vertical-align:middle">'+(_AI[b]||'')+'</span><span style="vertical-align:middle;margin-left:4px">'+b+'</span></div>'
          +'<div class="mc-val" style="color:'+col+';font-family:var(--f-display)">'+cnt+'</div>'
          +'<div class="mc-delta" style="background:none;font-size:11px;color:var(--t3)">'+(_AN[b]||'')+' · 오늘 '+tCnt+'건</div>'
          +'</div>';
      });
      brHtml='<div style="grid-column:1/-1;border-top:2px dashed var(--border);margin:4px 0 0"></div>'
        +'<div style="display:contents">'+brCards+'</div>';
    }
    kpiEl.innerHTML=summaryHtml+brHtml;
  }

  var noData=weekLogs.length===0;

  // ── 7일 추이 차트 ──
  var cv=document.getElementById('adm-daily-trend');
  if(cv){
    if(_admCharts.dT){_admCharts.dT.destroy();_admCharts.dT=null;}
    // canvas 항상 표시 (empty state div 제거)
    cv.style.display='';
    var oldTrE=cv.parentElement.querySelector('.adm-empty');
    if(oldTrE) oldTrE.remove();

    var labels=[],trendData=[],colors=[];
    // 지점별 타임존 기준으로 날짜 범위 생성
    // br=특정지점이면 그 지점 tz, br=ALL이면 서울 기준
    var tzBr=(br!=='ALL')?br:(brs.indexOf('AMGN')>=0?'AMGN':'AMNY');
    for(var i=6;i>=0;i--){
      var ds=_atDay(tzBr,i);
      labels.push(ds.slice(5));
      // weekLogs는 이미 brs+br로 필터됨 → 날짜만 매칭
      var cnt2=weekLogs.filter(function(r){return (r.Date||'').split('T')[0]===ds;}).length;
      trendData.push(cnt2);
      colors.push(i===0?'#534AB7':'rgba(83,74,183,0.4)');
    }

    var gc=isDark?'#2e2e2e':'#e8e7e3', tc=isDark?'#ededed':'#111110';

    if(noData){
      // 빈 차트 대신 empty state
      var eDiv=document.createElement('div');
      eDiv.className='adm-empty';
      eDiv.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;height:220px;gap:8px';
      eDiv.innerHTML='<div style="font-size:40px">📊</div><div style="font-size:13px;font-weight:700;color:var(--t2)">데이터 없음</div><div style="font-size:11px;color:var(--t3)">최근 7일 에러 없음</div>';
      cv.style.display='none';
      cv.parentElement.appendChild(eDiv);
    } else {
      _admCharts.dT=new Chart(cv,{
        type:'bar',
        data:{labels:labels,datasets:[{data:trendData,backgroundColor:colors,borderRadius:8,borderSkipped:false}]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(26,26,24,0.95)',cornerRadius:10,padding:10,
            callbacks:{label:function(ctx){return ' '+ctx.raw+'건';}}}},
          scales:{y:{beginAtZero:true,ticks:{stepSize:1,precision:0,color:tc,font:{size:12,weight:'600'}},grid:{color:gc}},
            x:{ticks:{color:tc,font:{size:12}},grid:{display:false}}}},
        plugins:[{id:'admDailyLabels',afterDatasetsDraw:function(chart){
          var ctx2=chart.ctx,meta=chart.getDatasetMeta(0);
          if(!meta||!meta.data) return;
          meta.data.forEach(function(bar,idx){
            var val=trendData[idx]; if(val===0) return;
            ctx2.save();ctx2.font='bold 12px Pretendard,sans-serif';ctx2.textAlign='center';
            var barH=chart.chartArea.bottom-bar.y;
            // 항상 검정색 (밝은 모드), 다크모드면 흰색
            if(barH>28){ctx2.fillStyle='#fff';ctx2.textBaseline='middle';ctx2.fillText(val,bar.x,bar.y+barH/2);}
            else{ctx2.fillStyle=isDark?'#e5e5e5':'#111110';ctx2.textBaseline='bottom';ctx2.fillText(val,bar.x,bar.y-4);}
            ctx2.restore();
          });
        }}]
      });
    }
  }

  // ── Top Zone ──
  var tzEl=document.getElementById('adm-daily-topzone');
  if(tzEl){
    if(noData){
      tzEl.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:160px;gap:8px"><div style="font-size:40px">📊</div><div style="font-size:13px;font-weight:700;color:var(--t2)">데이터 없음</div></div>';
    } else {
      var zc={};weekLogs.forEach(function(r){var k=r.Zone||'Unknown';zc[k]=(zc[k]||0)+1;});
      var ztop=Object.keys(zc).map(function(k){return{zone:k,cnt:zc[k]};}).sort(function(a,b){return b.cnt-a.cnt;}).slice(0,5);
      var ztotal=weekLogs.length||1;
      var zcols=['#534AB7','#60a5fa','#f59e0b','#ef4444','#10b981'];
      tzEl.innerHTML=ztop.map(function(item,i){
        var pct=Math.round(item.cnt/ztotal*100);
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;'+(i<ztop.length-1?'border-bottom:1px solid var(--border)':'')+'">'
          +'<div style="min-width:22px;font-size:12px;font-weight:700;color:var(--t1)">#'+(i+1)+'</div>'
          +'<div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:4px">'
          +'<span style="font-size:13px;font-weight:600;color:var(--t0)">'+esc(item.zone)+'</span>'
          +'<span style="font-size:12px;font-weight:700;color:'+zcols[i]+'">'+pct+'%</span></div>'
          +'<div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden">'
          +'<div style="background:'+zcols[i]+';height:100%;border-radius:4px;width:'+pct+'%;min-width:4px"></div></div>'
          +'</div></div>';
      }).join('');
    }
  }

  // ── Category chart ──
  var cc=document.getElementById('adm-daily-cat');
  if(cc){
    if(_admCharts.dC){_admCharts.dC.destroy();_admCharts.dC=null;}
    cc.style.display='';
    var oldCatE=cc.parentElement.querySelector('.adm-empty');
    if(oldCatE) oldCatE.remove();

    if(noData){
      var eCat=document.createElement('div');eCat.className='adm-empty';
      eCat.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;height:220px;gap:8px';
      eCat.innerHTML='<div style="font-size:40px">📊</div><div style="font-size:13px;font-weight:700;color:var(--t2)">데이터 없음</div>';
      cc.style.display='none'; cc.parentElement.appendChild(eCat);
    } else {
    var catMap={};weekLogs.forEach(function(r){var k=_catKo(r.Category||'기타');catMap[k]=(catMap[k]||0)+1;});
    var catLabels=Object.keys(catMap), catVals=catLabels.map(function(k){return catMap[k];});
    var catColors=['#ca8a04','#2563eb','#7c3aed','#ef4444','#10b981','#8b5cf6'];
    var catTotal=catVals.reduce(function(a,b){return a+b;},0)||1;
    var catLabelsFull=catLabels.map(function(l,i){
      return l+' '+catVals[i]+'건 ('+Math.round(catVals[i]/catTotal*100)+'%)';
    });
    _admCharts.dC=new Chart(cc,{
      type:'doughnut',
      data:{labels:catLabelsFull,datasets:[{data:catVals,backgroundColor:catColors.slice(0,catLabels.length),borderWidth:2,borderColor:isDark?'#1a1a18':'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
        plugins:{legend:{position:'bottom',labels:{boxWidth:12,padding:12,font:{size:12,weight:'600'},color:isDark?'#ededed':'#111110',usePointStyle:true,pointStyle:'circle'}},
          tooltip:{backgroundColor:'rgba(26,26,24,0.95)',cornerRadius:10,padding:10,callbacks:{label:function(ctx){return ' '+ctx.label;}}}}},
      plugins:[{id:'admCatCenter',afterDatasetsDraw:function(chart){
        var meta=chart.getDatasetMeta(0);
        if(!meta||!meta.data||!meta.data[0]) return;
        var cx=meta.data[0].x, cy=meta.data[0].y;
        var ctx3=chart.ctx; ctx3.save();
        ctx3.font='900 24px Pretendard,sans-serif'; ctx3.textAlign='center'; ctx3.textBaseline='middle';
        ctx3.fillStyle=isDark?'#f5f5f4':'#111110'; ctx3.fillText(String(catTotal),cx,cy-8);
        ctx3.font='500 11px Pretendard,sans-serif';
        ctx3.fillStyle=isDark?'#aaa':'#666'; ctx3.fillText('총 에러',cx,cy+10);
        ctx3.restore();
      }}]
    });
    } // end else noData
  }

  // ── Top Category ──
  var tcEl=document.getElementById('adm-daily-topcat');
  if(tcEl){
    if(noData){
      tcEl.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:180px;gap:8px"><div style="font-size:40px">📊</div><div style="font-size:13px;font-weight:700;color:var(--t2)">데이터 없음</div></div>';
    } else {
      var catMap2={};weekLogs.forEach(function(r){var k=_catKo(r.Category||'기타');catMap2[k]=(catMap2[k]||0)+1;});
      var catSorted=Object.keys(catMap2).map(function(k){return{cat:k,cnt:catMap2[k]};}).sort(function(a,b){return b.cnt-a.cnt;});
      var catTotalTC=weekLogs.length||1;
      var catCols2=['#ca8a04','#2563eb','#7c3aed','#ef4444','#10b981'];
      if(!catSorted.length){
        tcEl.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:180px;gap:8px"><div style="font-size:40px">📊</div><div style="font-size:13px;font-weight:700;color:var(--t2)">데이터 없음</div></div>';
      } else {
        tcEl.innerHTML=catSorted.map(function(item,i){
          var pct=Math.round(item.cnt/catTotalTC*100);
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;'+(i<catSorted.length-1?'border-bottom:1px solid var(--border)':'')+'">'
            +'<div style="min-width:22px;font-size:12px;font-weight:700;color:var(--t1)">#'+(i+1)+'</div>'
            +'<div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:13px;font-weight:600;color:var(--t0)">'+esc(item.cat)+'</span><span style="font-size:12px;font-weight:700;color:'+(catCols2[i]||'#534AB7')+'">'+item.cnt+'건 ('+pct+'%)</span></div>'
            +'<div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden"><div style="background:'+(catCols2[i]||'#534AB7')+';height:100%;border-radius:4px;width:'+pct+'%;min-width:4px"></div></div>'
            +'</div></div>';
        }).join('');
      }
    }
  }



  // ── 에러 목록 (페이지네이션) ──
  var cntEl=document.getElementById('adm-daily-cnt');
  _admDailyData=weekLogs.slice().sort(function(a,b){return new Date(b.Date)-new Date(a.Date);});
  if(cntEl) cntEl.textContent=_admDailyData.length+'건';
  _admDailyPage=0;
  _renderAdmDailyTable();
}

function _renderAdmDailyTable(){
  var tbody=document.getElementById('adm-daily-tbody');
  var pgWrap=document.getElementById('adm-daily-pg');
  if(!tbody) return;
  if(!_admDailyData.length){
    tbody.innerHTML='<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">최근 7일 에러 없음</div><div class="empty-state-subtitle">전 지점 시스템 정상 운영 중</div></div></td></tr>';
    if(pgWrap) pgWrap.innerHTML='';
    return;
  }
  var ps=_admDailyPS, total=_admDailyData.length;
  var totalPages=Math.ceil(total/ps);
  if(_admDailyPage>=totalPages) _admDailyPage=totalPages-1;
  var start=_admDailyPage*ps, end=Math.min(start+ps,total);
  tbody.innerHTML=_admDailyData.slice(start,end).map(function(r,i){
    var detail=r.IssueDetail||'--';
    var shortDetail=detail.length>40?detail.slice(0,40)+'…':detail;
    return '<tr>'
      +'<td style="text-align:center;color:var(--t3);white-space:nowrap">'+(start+i+1)+'</td>'
      +'<td style="white-space:nowrap">'+brBadge(r.Branch)+'</td>'
      +'<td style="white-space:nowrap"><span class="zp">'+esc(r.Zone||'--')+'</span></td>'
      +'<td style="font-size:12px;color:var(--t2);white-space:nowrap">'+esc(r.Date||'')+'</td>'
      +'<td style="white-space:nowrap">'+catBadge(r.Category||'')+'</td>'
      +'<td style="color:var(--t2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left" title="'+esc(detail)+'">'+esc(shortDetail)+'</td>'
      +'<td style="font-size:12px;color:var(--t2);white-space:nowrap">'+esc(r.ActionType||'--')+'</td>'
      +'<td style="text-align:center;white-space:nowrap">'+stars(r.Difficulty||1)+'</td>'
      +'</tr>';
  }).join('');
  // 페이지네이션 UI
  if(pgWrap) pgWrap.innerHTML=_admPgHtml(total,ps,_admDailyPage,totalPages,'admDailyGo','admDailyPS');
}

/* ════════════════════════════════
   월간 현황 — Monthly 페이지와 동일한 로직/스타일
   ════════════════════════════════ */
function admSetMonthlyRegion(r,btn){
  _admMonthlyRegion=r; _admMonthlyBranch='ALL';
  document.querySelectorAll('#adm-monthly-region-toggle .region-btn').forEach(function(b){
    b.classList.toggle('active',b===btn);
  });
  _admMonthlyStrip(); renderAdminMonthly();
}

function _admMonthlyStrip(){
  var strip=document.getElementById('adm-monthly-br-strip'); if(!strip) return;
  if(_admMonthlyRegion==='all'){
    strip.style.display='none';
    strip.innerHTML='';
    return;
  }
  strip.style.display='flex';
  var brs=_brs(_admMonthlyRegion), br=_admMonthlyBranch;
  if(_admMonthlyRegion==='korea') brs=['AMJJ','AMYS','AMGN','AMBS'];
  var allActive=(br==='ALL');
  var html='<button class="branch-seg-btn'+(allActive?' branch-seg-active':'')+'" onclick="admSelMonthlyBr(\'ALL\')" style="'+(allActive?'background:#1e293b;color:#fff;border:none':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+';padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .2s">'
    +'<span>🌐</span><span>전체</span></button>';
  brs.forEach(function(b){
    var isA=br===b,col=_AC[b]||'#534AB7';
    html+='<button class="branch-seg-btn'+(isA?' branch-seg-active':'')+'" onclick="admSelMonthlyBr(\''+b+'\')" style="'+(isA?'background:'+col+';color:#fff;border:none':'background:var(--card);color:var(--t1);border:1px solid var(--border)')+';padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .2s">'
      +'<span>'+(_AI[b]||'📍')+'</span>'
      +'<span>'+b+'</span>'
      +'</button>';
  });
  strip.innerHTML=html;
}

function admSelMonthlyBr(b){
  _admMonthlyBranch=(_admMonthlyBranch===b)?'ALL':b;
  _admMonthlyStrip(); renderAdminMonthly();
}

function renderAdminMonthly(){
  if(!G||!G.logs) return;
  var isDark=document.documentElement.classList.contains('dark-mode');
  var gridC=isDark?'#2e2e2e':'#e5e4df', tickC=isDark?'#ededed':'#111110';
  var ySel=document.getElementById('adm-m-year'), mSel=document.getElementById('adm-m-month');
  if(!ySel||!mSel) return;
  var y=parseInt(ySel.value)||CY, m=parseInt(mSel.value);
  if(isNaN(m)) m=CM;
  var brs=_brs(_admMonthlyRegion), br=_admMonthlyBranch;

  // 부제목 업데이트
  var dateEl=document.getElementById('adm-monthly-date');
  if(dateEl){
    var MKO=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    dateEl.textContent=y+'년 '+MKO[m];
  }

  // 데이터 필터
  var md=G.logs.filter(function(r){
    var d=new Date(r.Date);
    return d.getMonth()===m&&d.getFullYear()===y&&brs.indexOf(r.Branch)>=0&&(br==='ALL'||r.Branch===br);
  });
  var prevM=m===0?11:m-1, prevY=m===0?y-1:y;
  var lm=G.logs.filter(function(r){
    var d=new Date(r.Date);
    return d.getMonth()===prevM&&d.getFullYear()===prevY&&brs.indexOf(r.Branch)>=0&&(br==='ALL'||r.Branch===br);
  });

  // ── KPI: Monthly의 .mc 카드 + sparkline ──
  var kpiEl=document.getElementById('adm-monthly-kpi');
  if(kpiEl){
    var MKO2=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    function lastSix(filterBr){
      var result=[];
      for(var i=5;i>=0;i--){
        var cm=m-i, cy=y; if(cm<0){cm+=12;cy--;}
        var mData=G.logs.filter(function(r){
          var d=new Date(r.Date);
          return d.getMonth()===cm&&d.getFullYear()===cy&&brs.indexOf(r.Branch)>=0&&(filterBr?r.Branch===filterBr:true);
        });
        result.push(mData.length);
      }
      var max=Math.max.apply(null,result)||1;
      return result.map(function(v){return v/max;});
    }
    function sparkSvg(data,color){
      return '<svg width="48" height="18" style="margin-top:4px;vertical-align:text-top"><polyline points="'
        +data.map(function(x,i){return i*(48/5)+','+Math.round(18-x*18);}).join(' ')
        +'" fill="none" stroke="'+color+'" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>';
    }
    function mcKpi(label,v,p,color,sparkData){
      var d2=v-p, pct=p?Math.round(Math.abs(d2)/p*1000)/10:(v>0?100:0);
      var ds=d2>0?'up':d2<0?'dn':'eq';
      var dc=ds==='up'?'#ef4444':ds==='dn'?'#22c55e':'#8a8a84';
      var arrow=ds==='up'?'↑':ds==='dn'?'↓':'→';
      return '<div class="card mc" style="--mc-c:'+color+'">'
        +'<div class="mc-lbl">'+label+'</div>'
        +'<div style="display:flex;align-items:baseline;gap:8px">'
        +'<div class="mc-val" style="font-family:var(--f-display)">'+v+'</div>'
        +'<div style="font-size:11px;color:var(--t3);font-weight:500">'+sparkSvg(sparkData,color)+'</div></div>'
        +'<div class="mc-delta '+ds+'" style="color:'+dc+';font-size:12px;font-weight:600">'+arrow+' '+Math.abs(pct).toFixed(1)+'% ('+(d2>=0?'+':'')+d2+'건)</div>'
        +'</div>';
    }

    // 요약 카드 (항상 표시)
    var totalLabel=br==='ALL'?(_admMonthlyRegion==='global'?'글로벌 합계':_admMonthlyRegion==='korea'?'국내 합계':'전체 합계'):(_AI[br]||'')+' '+br;
    var summaryHtml='<div style="display:contents">'
      +mcKpi(totalLabel,md.length,lm.length,'#64748b',lastSix(br==='ALL'?null:br))
      +'</div>';

    // 지점별 카드: 전체일때만 구분선 후 표시
    var brHtml2='';
    if(br==='ALL'){
      var brCards2='';
      brs.forEach(function(b){
        var col=_AC[b]||'#534AB7';
        var cnt=md.filter(function(r){return r.Branch===b;}).length;
        var lcnt=lm.filter(function(r){return r.Branch===b;}).length;
        var lbl='<span style="font-size:15px;line-height:1;vertical-align:middle">'+(_AI[b]||'')+'</span>'
          +'<span style="vertical-align:middle;margin-left:4px">'+b+'</span>';
        brCards2+=mcKpi(lbl,cnt,lcnt,col,lastSix(b));
      });
      brHtml2='<div style="grid-column:1/-1;border-top:2px dashed var(--border);margin:4px 0 0"></div>'
        +'<div style="display:contents">'+brCards2+'</div>';
    }
    kpiEl.innerHTML=summaryHtml+brHtml2;
  }

  // empty state for monthly charts
  var noMData=md.length===0;
  ['adm-monthly-trend','adm-monthly-cat','adm-monthly-diff','adm-monthly-action'].forEach(function(id){
    var cv=document.getElementById(id); if(!cv) return;
    var wrap=cv.parentElement;
    var old=wrap.querySelector('.adm-empty');
    if(noMData){
      cv.style.display='none';
      if(!old){var d=document.createElement('div');d.className='adm-empty';
        d.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:6px;opacity:0.7"><div style="font-size:36px">📊</div><div style="font-size:13px;font-weight:700;color:var(--t2)">데이터 없음</div></div>';
        wrap.appendChild(d);}
    } else {
      cv.style.display='';
      if(old) old.remove();
    }
  });
  var zmEl2=document.getElementById('adm-monthly-zone-hm');
  if(zmEl2&&noMData) zmEl2.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:160px;gap:6px;opacity:0.7"><div style="font-size:36px">📊</div><div style="font-size:13px;font-weight:700;color:var(--t2)">데이터 없음</div></div>';

  // ── 추이 차트: Monthly와 동일 ──
  var tv=document.getElementById('adm-monthly-trend');
  if(tv){
    if(_admCharts.mT){_admCharts.mT.destroy();_admCharts.mT=null;}
    var MKO3=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    var trendData=MKO3.map(function(_,mi){
      return G.logs.filter(function(r){
        var d=new Date(r.Date);
        return d.getMonth()===mi&&d.getFullYear()===y&&brs.indexOf(r.Branch)>=0&&(br==='ALL'||r.Branch===br);
      }).length;
    });
    var prevYrData=MKO3.map(function(_,mi){
      return G.logs.filter(function(r){
        var d=new Date(r.Date);
        return d.getMonth()===mi&&d.getFullYear()===y-1&&brs.indexOf(r.Branch)>=0&&(br==='ALL'||r.Branch===br);
      }).length;
    });
    var ctx3=tv.getContext('2d');
    var gradient=ctx3.createLinearGradient(0,0,0,280);
    gradient.addColorStop(0,isDark?'rgba(83,74,183,0.25)':'rgba(83,74,183,0.12)');
    gradient.addColorStop(1,isDark?'rgba(83,74,183,0.02)':'rgba(83,74,183,0)');
    _admCharts.mT=new Chart(tv,{
      type:'line',
      data:{labels:MKO3,datasets:[
        {label:String(y),data:trendData,borderColor:'#534AB7',backgroundColor:gradient,fill:true,tension:0.35,pointRadius:3,pointBackgroundColor:'#534AB7',borderWidth:2.5,pointHoverRadius:6},
        {label:String(y-1),data:prevYrData,borderColor:'#d1d0ca',backgroundColor:'transparent',fill:false,tension:0.35,pointRadius:3,pointBackgroundColor:'#8a8a84',borderWidth:1.5,borderDash:[4,3]}
      ]},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:800,easing:'easeOutQuart'},
        plugins:{legend:{position:'top',align:'end',labels:{boxWidth:12,padding:8,font:{size:12,family:"'Pretendard',sans-serif"},color:tickC}},
          tooltip:{backgroundColor:'#111110',cornerRadius:8,padding:10,mode:'index',intersect:false,titleFont:{family:"'Pretendard',sans-serif"},bodyFont:{family:"'Pretendard',sans-serif"}}},
        scales:{x:{grid:{color:gridC},ticks:{font:{size:12,family:"'Pretendard',sans-serif"},color:tickC}},
          y:{grid:{color:gridC},ticks:{stepSize:1,precision:0,font:{size:12,family:"'Pretendard',sans-serif"},color:tickC},beginAtZero:true}},
        interaction:{mode:'nearest',axis:'x',intersect:false}},
      plugins:[{id:'admMonthlyLabels',afterDatasetsDraw:function(chart){
        var ctx4=chart.ctx,meta=chart.getDatasetMeta(0);
        if(!meta||!meta.data) return;
        meta.data.forEach(function(pt,idx){
          var val=trendData[idx]; if(val===0) return;
          ctx4.save();ctx4.font='bold 11px Pretendard,sans-serif';ctx4.textAlign='center';ctx4.textBaseline='bottom';
          ctx4.fillStyle=isDark?'#e5e5e5':'#534AB7';ctx4.fillText(val,pt.x,pt.y-6);ctx4.restore();
        });
      }}]
    });
  }

  // ── Zone Heatmap: Monthly와 동일 ──
  var zmEl=document.getElementById('adm-monthly-zone-hm');
  if(zmEl){
    var zones=[];G.logs.forEach(function(r){if(zones.indexOf(r.Zone)<0)zones.push(r.Zone);});zones.sort();
    var zc2={};zones.forEach(function(z){zc2[z]=md.filter(function(r){return r.Zone===z;}).length;});
    var maxZ=Math.max.apply(null,Object.values(zc2).concat([1]));
    var sortedZ=zones.sort(function(a,b){return(zc2[b]||0)-(zc2[a]||0);});
    zmEl.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:6px">'
      +sortedZ.map(function(z){var v=zc2[z]||0,op=.05+v/maxZ*.85;
        return '<div style="background:rgba(37,99,235,'+op+');color:'+(v>maxZ*.5?'#fff':'#1d4ed8')+';border-radius:10px;padding:8px;cursor:pointer;transition:all 0.3s;text-align:center">'
          +'<div style="font-size:15px;font-weight:800">'+v+'</div>'
          +'<div style="font-size:9px;margin-top:2px;font-weight:600;word-break:break-word">'+(z.length>10?z.slice(0,9)+'…':z)+'</div></div>';
      }).join('')+'</div>';
  }

  // ── Category 도넛: Monthly와 동일 ──
  var cc2=document.getElementById('adm-monthly-cat');
  if(cc2){
    if(_admCharts.mC){_admCharts.mC.destroy();_admCharts.mC=null;}
    var catLabels2=['소프트웨어','하드웨어','네트워크'];
    var catData2=[
      md.filter(function(r){return r.Category==='Software'||r.Category==='소프트웨어';}).length,
      md.filter(function(r){return r.Category==='Hardware'||r.Category==='하드웨어';}).length,
      md.filter(function(r){return r.Category==='Network'||r.Category==='네트워크';}).length
    ];
    var catColors2=['#ca8a04','#2563eb','#7c3aed'];
    var catTotal2=catData2.reduce(function(a,b){return a+b;},0);
    // 범례에 건수+% 직접 표시
    var catPctLabels=catLabels2.map(function(l,i){
      return l+' '+catData2[i]+'건 ('+(catTotal2?Math.round(catData2[i]/catTotal2*100):0)+'%)';
    });
    _admCharts.mC=new Chart(cc2,{
      type:'doughnut',
      data:{labels:catPctLabels,datasets:[{data:catData2,backgroundColor:catColors2,borderWidth:2,borderColor:isDark?'#1a1a18':'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
        plugins:{legend:{position:'bottom',labels:{boxWidth:12,padding:12,font:{size:12,weight:'600',family:"'Pretendard',sans-serif"},color:tickC,usePointStyle:true,pointStyle:'circle'}},
          tooltip:{backgroundColor:'#111110',cornerRadius:8,padding:10,callbacks:{label:function(ctx){return ' '+ctx.label;}}}},
      },
      plugins:[{id:'admMCatCenter',afterDatasetsDraw:function(chart){
        var meta=chart.getDatasetMeta(0);
        if(!meta||!meta.data||!meta.data[0]) return;
        var cx=meta.data[0].x, cy=meta.data[0].y;
        var ctx5=chart.ctx; ctx5.save();
        ctx5.font='900 22px Pretendard,sans-serif'; ctx5.textAlign='center'; ctx5.textBaseline='middle';
        ctx5.fillStyle=isDark?'#f5f5f4':'#111110'; ctx5.fillText(String(catTotal2),cx,cy-8);
        ctx5.font='500 11px Pretendard,sans-serif';
        ctx5.fillStyle=isDark?'#aaa':'#666'; ctx5.fillText('총 에러',cx,cy+10);
        ctx5.restore();
      }}]
    });
  }

  // ── Difficulty 차트: Monthly와 동일 ──
  var dc3=document.getElementById('adm-monthly-diff');
  if(dc3){
    if(_admCharts.mD){_admCharts.mD.destroy();_admCharts.mD=null;}
    var diffLabels=['Lv.1','Lv.2','Lv.3','Lv.4','Lv.5'];
    var diffData=[md.filter(function(r){return r.Difficulty<=1;}).length,md.filter(function(r){return r.Difficulty===2;}).length,md.filter(function(r){return r.Difficulty===3;}).length,md.filter(function(r){return r.Difficulty===4;}).length,md.filter(function(r){return r.Difficulty>=5;}).length];
    var diffColors=['#22c55e','#eab308','#ef4444','#be123c','#7f1d1d'];
    var diffMax=Math.max.apply(null,diffData.concat([1]));
    _admCharts.mD=new Chart(dc3,{
      type:'bar',
      data:{labels:diffLabels,datasets:[
        {label:'Max',data:Array(5).fill(diffMax),backgroundColor:'rgba(200,200,200,0.1)',borderWidth:0,borderRadius:8,barThickness:22,order:2},
        {label:'Count',data:diffData,backgroundColor:diffColors,borderWidth:0,borderRadius:8,barThickness:22,order:1}
      ]},
      options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#111110',cornerRadius:8,padding:10,titleFont:{family:"'Pretendard',sans-serif"},bodyFont:{family:"'Pretendard',sans-serif"}}},
        scales:{x:{grid:{color:gridC},ticks:{stepSize:1,precision:0,font:{size:11,family:"'Pretendard',sans-serif"},color:tickC},max:diffMax},
          y:{grid:{display:false},ticks:{font:{size:12,weight:'bold',family:"'Pretendard',sans-serif"},color:tickC}}}},
      plugins:[{id:'admDiffLabels',afterDatasetsDraw:function(chart){
        var ctx6=chart.ctx,meta=chart.getDatasetMeta(1);
        if(!meta||!meta.data) return;
        meta.data.forEach(function(bar,idx){
          var val=diffData[idx]; if(val===0) return;
          ctx6.save();ctx6.font='bold 12px Pretendard,sans-serif';ctx6.textBaseline='middle';
          var barW=bar.x-chart.chartArea.left;
          if(barW>30){ctx6.fillStyle='#fff';ctx6.textAlign='center';ctx6.fillText(val,chart.chartArea.left+(barW/2),bar.y);}
          else{ctx6.fillStyle=isDark?'#e5e5e5':'#111110';ctx6.textAlign='left';ctx6.fillText(val,bar.x+6,bar.y);}
          ctx6.restore();
        });
      }}]
    });
  }

  // ── Action Type 차트: Monthly와 동일 ──
  var ac3=document.getElementById('adm-monthly-action');
  if(ac3){
    if(_admCharts.mA){_admCharts.mA.destroy();_admCharts.mA=null;}
    var actLabels=['🏢 현장','📡 원격'];
    var actData=[md.filter(function(r){return(r.ActionType||'').indexOf('On')>=0;}).length,md.filter(function(r){return(r.ActionType||'').indexOf('Remote')>=0;}).length];
    var actColors=['#3b82f6','#8b5cf6'];
    var actMax=Math.max.apply(null,actData.concat([1]));
    _admCharts.mA=new Chart(ac3,{
      type:'bar',
      data:{labels:actLabels,datasets:[
        {label:'Max',data:Array(2).fill(actMax),backgroundColor:'rgba(200,200,200,0.1)',borderWidth:0,borderRadius:8,barThickness:24,order:2},
        {label:'Count',data:actData,backgroundColor:actColors,borderWidth:0,borderRadius:8,barThickness:24,order:1}
      ]},
      options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#111110',cornerRadius:8,padding:10,titleFont:{family:"'Pretendard',sans-serif"},bodyFont:{family:"'Pretendard',sans-serif"}}},
        scales:{x:{grid:{color:gridC},ticks:{stepSize:1,precision:0,font:{size:11,family:"'Pretendard',sans-serif"},color:tickC},max:actMax},
          y:{grid:{display:false},ticks:{font:{size:11,family:"'Pretendard',sans-serif"},color:tickC}}}}
    });
  }

  // ── Top Issues: top 5개 ──
  var cntEl2=document.getElementById('adm-monthly-cnt');
  if(cntEl2) cntEl2.textContent=md.length+'건';
  var tbody2=document.getElementById('adm-monthly-tbody');
  if(tbody2){
    if(!md.length){tbody2.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">해당 기간 에러 없음</div><div class="empty-state-subtitle">전 지점 시스템 정상 운영 중</div></div></td></tr>';
    } else {
      var map2={};
      md.forEach(function(r){
        var k=r.Zone+'|'+r.Category;
        if(!map2[k])map2[k]={zone:r.Zone,cat:r.Category,br:r.Branch,cnt:0,s:r.IssueDetail};
        map2[k].cnt++;
      });
      var top=Object.values(map2).sort(function(a,b){return b.cnt-a.cnt;}).slice(0,5);
      var medals=['🥇','🥈','🥉'];
      tbody2.innerHTML=top.map(function(v,i){
        var rank=i<3?'<span style="font-size:16px">'+medals[i]+'</span>':'<span style="color:var(--t3);font-weight:700">'+(i+1)+'</span>';
        return '<tr>'
          +'<td style="white-space:nowrap;text-align:center">'+rank+'</td>'
          +'<td style="white-space:nowrap">'+brBadge(v.br)+'</td>'
          +'<td style="white-space:nowrap"><span class="zp">'+esc(v.zone)+'</span></td>'
          +'<td style="white-space:nowrap">'+catFull(v.cat)+'</td>'
          +'<td style="color:var(--t2);word-break:break-word">'+esc(v.s)+'</td>'
          +'<td style="font-size:18px;font-weight:800;color:var(--t0);white-space:nowrap;text-align:center">'+v.cnt+'</td>'
          +'</tr>';
      }).join('');
    }
  }

  // ── 당월 전체 이슈 목록 (페이지네이션) ──
  _admMonthlyData=md.slice().sort(function(a,b){return new Date(b.Date)-new Date(a.Date);});
  _admMonthlyPage=0;
  _renderAdmMonthlyTable();
}

function _renderAdmMonthlyTable(){
  var tbody=document.getElementById('adm-monthly-issue-tbody');
  var pgWrap=document.getElementById('adm-monthly-pg');
  if(!tbody) return;
  if(!_admMonthlyData.length){
    tbody.innerHTML='<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">해당 기간 에러 없음</div></div></td></tr>';
    if(pgWrap) pgWrap.innerHTML='';
    return;
  }
  var ps=_admMonthlyPS, total=_admMonthlyData.length;
  var totalPages=Math.ceil(total/ps);
  if(_admMonthlyPage>=totalPages) _admMonthlyPage=totalPages-1;
  var start=_admMonthlyPage*ps, end=Math.min(start+ps,total);
  tbody.innerHTML=_admMonthlyData.slice(start,end).map(function(r,i){
    var detail=r.IssueDetail||'--';
    var shortDetail=detail.length>40?detail.slice(0,40)+'…':detail;
    return '<tr>'
      +'<td style="text-align:center;color:var(--t3);white-space:nowrap">'+(start+i+1)+'</td>'
      +'<td style="white-space:nowrap">'+brBadge(r.Branch)+'</td>'
      +'<td style="white-space:nowrap"><span class="zp">'+esc(r.Zone||'--')+'</span></td>'
      +'<td style="font-size:12px;color:var(--t2);white-space:nowrap">'+esc(r.Date||'')+'</td>'
      +'<td style="white-space:nowrap">'+catBadge(r.Category||'')+'</td>'
      +'<td style="color:var(--t2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left" title="'+esc(detail)+'">'+esc(shortDetail)+'</td>'
      +'<td style="font-size:12px;color:var(--t2);white-space:nowrap">'+esc(r.ActionType||'--')+'</td>'
      +'<td style="text-align:center;white-space:nowrap">'+stars(r.Difficulty||1)+'</td>'
      +'</tr>';
  }).join('');
  if(pgWrap) pgWrap.innerHTML=_admPgHtml(total,ps,_admMonthlyPage,totalPages,'admMonthlyGo','admMonthlyPS');
}

/* ── 페이지네이션 공통 헬퍼 ── */
function _admPgHtml(total,ps,page,totalPages,goFn,psFn){
  var start=page*ps+1, end=Math.min((page+1)*ps,total);
  var html='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:8px">';
  // 좌측: 페이지 크기 선택
  html+='<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--t2)">'
    +'페이지당 '
    +'<select onchange="'+psFn+'(parseInt(this.value))" style="padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--t0);font-size:12px">'
    +'<option value="20"'+(ps===20?' selected':'')+'>20</option>'
    +'<option value="50"'+(ps===50?' selected':'')+'>50</option>'
    +'<option value="100"'+(ps===100?' selected':'')+'>100</option>'
    +'</select>개 · 총 <b>'+total+'</b>건 · '+start+'–'+end+'</div>';
  // 우측: 페이지 버튼
  html+='<div style="display:flex;align-items:center;gap:4px">';
  html+='<button onclick="'+goFn+'(0)" style="'+_admPgBtnStyle(page===0)+'" '+(page===0?'disabled':'')+'>«</button>';
  html+='<button onclick="'+goFn+'('+(page-1)+')" style="'+_admPgBtnStyle(page===0)+'" '+(page===0?'disabled':'')+'>‹</button>';
  // 페이지 번호 (최대 5개)
  var rangeStart=Math.max(0,page-2), rangeEnd=Math.min(totalPages-1,rangeStart+4);
  for(var p=rangeStart;p<=rangeEnd;p++){
    var isC=p===page;
    html+='<button onclick="'+goFn+'('+p+')" style="padding:5px 10px;border-radius:6px;font-size:12px;font-weight:'+(isC?'800':'600')+';cursor:pointer;border:1px solid '+(isC?'#534AB7':'var(--border)')+';background:'+(isC?'#534AB7':'var(--card)')+';color:'+(isC?'#fff':'var(--t1)')+'">'+(p+1)+'</button>';
  }
  html+='<button onclick="'+goFn+'('+(page+1)+')" style="'+_admPgBtnStyle(page===totalPages-1)+'" '+(page===totalPages-1?'disabled':'')+'>›</button>';
  html+='<button onclick="'+goFn+'('+(totalPages-1)+')" style="'+_admPgBtnStyle(page===totalPages-1)+'" '+(page===totalPages-1?'disabled':'')+'>»</button>';
  html+='</div></div>';
  return html;
}
function _admPgBtnStyle(disabled){
  return 'padding:5px 10px;border-radius:6px;font-size:12px;font-weight:600;cursor:'+(disabled?'default':'pointer')+';border:1px solid var(--border);background:var(--card);color:'+(disabled?'var(--t3)':'var(--t1)')+';';
}
function admDailyGo(p){_admDailyPage=p;_renderAdmDailyTable();}
function admDailyPS(ps){_admDailyPS=ps;_admDailyPage=0;_renderAdmDailyTable();}
function admMonthlyGo(p){_admMonthlyPage=p;_renderAdmMonthlyTable();}
function admMonthlyPS(ps){_admMonthlyPS=ps;_admMonthlyPage=0;_renderAdmMonthlyTable();}

/* ════════════════════════════════
   지점 계정 리포트
   ════════════════════════════════ */
function initBranchReport(){
  if(typeof _loggedBranch==='undefined'||!_loggedBranch) return;
  var sec=document.getElementById('branch-report-section'); if(!sec) return;
  var br=_loggedBranch;
  var isKorea=typeof KOREA_BRANCHES!=='undefined'&&KOREA_BRANCHES.indexOf(br)>=0;
  var lang=isKorea?'ko':'en', region=isKorea?'korea':'global';
  var brName=(typeof BR_NAMES!=='undefined'&&BR_NAMES[br])||_AN[br]||br;
  var brIcon=_AI[br]||'📍', brCol=_AC[br]||'#534AB7';
  window._brRptLang=lang; window._brRptRegion=region;
  sec.innerHTML=[
    '<div class="section-divider"></div>',
    '<div style="margin-top:4px">',
    // 헤더: flex-wrap으로 모바일 대응
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">',
    '<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;font-size:20px;flex-shrink:0;background:'+brCol+'22">'+brIcon+'</span>',
    '<div><div style="font-size:15px;font-weight:800;color:var(--t0)">'+(isKorea?brName+' 에러 리포트':br+' Error Report')+'</div>',
    '<div style="font-size:11px;color:var(--t2);margin-top:1px">'+(isKorea?'해당 지점 에러만 포함 · 월간 리포트 생성':'Branch-specific errors only · Monthly report')+'</div></div></div>',
    // 코멘트 카드
    '<div class="card" style="border:1.5px solid rgba(83,74,183,0.15);margin-bottom:12px">',
    '<div style="text-align:center;margin-bottom:10px">',
    '<div style="font-size:13px;font-weight:800;color:var(--t0)">📝 '+(isKorea?'코멘트 / 비고':'Comment / Remarks')+'</div>',
    '<div style="font-size:10px;color:var(--t3);margin-top:2px">'+(isKorea?'선택사항':'Optional')+'</div></div>',
    '<div style="position:relative;">',
    '<textarea id="branch-rpt-comment" rows="3"',
    ' style="width:100%;padding:10px 36px 10px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);color:var(--t0);font-family:var(--f,sans-serif);font-size:13px;resize:vertical;outline:none;transition:border-color .2s;-webkit-appearance:none"',
    ' onfocus="this.style.borderColor=\'#534AB7\'" onblur="this.style.borderColor=\'var(--border)\'"',
    ' placeholder="'+(isKorea?'예: LED 모듈 이상 관련 추가 조사 필요.':'e.g. LED module anomaly requires further investigation.')+'"',
    '></textarea>',
    '<button onclick="document.getElementById(\'branch-rpt-comment\').value=\'\'" title="'+(isKorea?'지우기':'Clear')+'"',
    ' style="position:absolute;right:8px;top:8px;background:none;border:none;cursor:pointer;color:var(--t3);font-size:14px;padding:4px;border-radius:4px;line-height:1;transition:color .15s"',
    ' onmouseenter="this.style.color=\'var(--t0)\'" onmouseleave="this.style.color=\'var(--t3)\'">✕</button>',
    '</div></div>',
    // 월간 리포트 카드
    '<div class="card" style="border-left:4px solid '+brCol+'">',
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap">',
    '<div style="display:flex;align-items:center;gap:8px;min-width:0">',
    '<span style="font-size:11px;font-weight:800;color:#fff;background:'+brCol+';padding:3px 10px;border-radius:5px;flex-shrink:0">MONTHLY</span>',
    '<div style="min-width:0"><div style="font-size:13px;font-weight:800;color:var(--t0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(isKorea?brName+' 월간 에러 리포트':br+' Monthly Error Report')+'</div>',
    '<div style="font-size:11px;color:var(--t3);margin-top:1px">'+(isKorea?'해당 지점 에러만 포함':'Branch errors only')+'</div></div></div>',
    '<span style="font-size:10px;font-weight:700;color:var(--t3);background:var(--sub);padding:3px 10px;border-radius:20px;border:1px solid var(--border);flex-shrink:0;align-self:flex-start">'+(isKorea?'🇰🇷 KOR':'🌍 ENG')+'</span></div>',
    '<div class="branch-rpt-btn-row" style="display:flex;gap:8px">',
    '<button class="btn btn-sm" style="flex:1;background:'+brCol+';color:#fff;font-weight:700;border-radius:8px;padding:10px;min-height:44px" onclick="branchReport(\'download\',\'monthly\')">'+(isKorea?'⬇ 다운로드':'⬇ Download')+'</button>',
    '<button class="btn btn-sm" style="flex:1;background:var(--card);color:var(--t1);border:1.5px solid var(--border);font-weight:700;border-radius:8px;padding:10px;min-height:44px" onclick="branchReport(\'preview\',\'monthly\')">'+(isKorea?'👁 미리보기':'👁 Preview')+'</button>',
    '</div><div id="br-monthly-status" style="margin-top:8px"></div></div></div>'
  ].join('');
  sec.style.display='block';
}

async function branchReport(action,type){
  if(typeof _loggedBranch==='undefined'||!_loggedBranch) return;
  var br=_loggedBranch, lang=window._brRptLang||'en', region=window._brRptRegion||'global';
  var isKorea=region==='korea';
  var comment=(document.getElementById('branch-rpt-comment')||{}).value||'';
  var mSel=document.getElementById('monthSel'), ySel=document.getElementById('yearSel');
  var month=mSel?parseInt(mSel.value):CM, year=ySel?parseInt(ySel.value):CY;
  var statusEl=document.getElementById(type==='annual'?'br-annual-status':'br-monthly-status');
  if(statusEl){
    statusEl.style.cssText='padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;background:var(--bg);border:1px solid var(--border);margin-top:10px;color:var(--t2)';
    statusEl.innerHTML='<div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;border:2px solid var(--border);border-top-color:#534AB7;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>'+(isKorea?'리포트 생성 중...':'Generating...')+'</div>';
  }
  var endpoint=type==='annual'?'/api/annual-report':'/api/report';
  var body=type==='annual'
    ?{year:year,action:action,lang:lang,region:region,comment:comment,branchFilter:br}
    :{month:month,year:year,action:action,lang:lang,reportType:'monthly',region:region,comment:comment,branchFilter:br};
  try{
    var resp=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await resp.json(); if(!d.ok) throw new Error(d.error||(isKorea?'생성 실패':'Failed'));
    if(statusEl){statusEl.style.cssText='padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;background:#f0fdf4;border:1px solid #86efac;margin-top:10px;color:#166534';statusEl.textContent='✅ '+d.message;}
    if(action==='download'||action==='preview'){
      var bin=atob(d.pdfBase64),arr=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      var blob=new Blob([arr],{type:'application/pdf'}),url=URL.createObjectURL(blob);
      if(action==='download'){var a=document.createElement('a');a.href=url;a.download=d.fileName;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},3000);}
      else{window.open(url,'_blank');setTimeout(function(){URL.revokeObjectURL(url);},120000);}
    }
    if(typeof toast==='function') toast(d.fileName+(isKorea?' 생성 완료':' generated'),'success');
  }catch(e){
    if(statusEl){statusEl.style.cssText='padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;background:#fef2f2;border:1px solid #fca5a5;margin-top:10px;color:#991b1b';statusEl.textContent='❌ '+e.message;}
    if(typeof toast==='function') toast((isKorea?'리포트 생성 실패: ':'Report failed: ')+e.message,'error');
  }
}

/* ════════════════════════════════
   초기화
   ════════════════════════════════ */
function _populateAdminSelects(){
  var MKO=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  var years=[CY,CY-1,CY-2];
  ['adm-g-year','adm-k-year'].forEach(function(id){
    var s=document.getElementById(id); if(!s||s.options.length) return;
    years.forEach(function(y){var o=document.createElement('option');o.value=y;o.textContent=y+'년';if(y===CY)o.selected=true;s.appendChild(o);});
  });
  ['adm-g-month','adm-k-month'].forEach(function(id){
    var s=document.getElementById(id); if(!s||s.options.length>1) return;
    MKO.forEach(function(mn,i){var o=document.createElement('option');o.value=i;o.textContent=mn;if(i===CM)o.selected=true;s.appendChild(o);});
  });
  var ys=document.getElementById('adm-m-year');
  if(ys&&!ys.options.length){years.forEach(function(y){var o=document.createElement('option');o.value=y;o.textContent=y+'년';if(y===CY)o.selected=true;ys.appendChild(o);});}
  var ms=document.getElementById('adm-m-month');
  if(ms&&!ms.options.length){MKO.forEach(function(mn,i){var o=document.createElement('option');o.value=i;o.textContent=mn;if(i===CM)o.selected=true;ms.appendChild(o);});}
}

function initAdminPage(){
  if(typeof _loggedId==='undefined'||_loggedId!=='gto') return;
  var tab=document.getElementById('adminTab'); if(tab) tab.style.display='';
  _populateAdminSelects();
  // 기본값: 일일현황 > 전체
  _admDailyRegion='all'; _admDailyBranch='ALL';
  _admMonthlyRegion='all'; _admMonthlyBranch='ALL';
  _admDailyStrip();
  _admMonthlyStrip();
}

function renderAdmin(){
  // nav.js goPage(-1) 에서 호출 — 진입시 일일현황 전체 기본
  _admDailyRegion='all'; _admDailyBranch='ALL';
  _admMonthlyRegion='all'; _admMonthlyBranch='ALL';
  _adminView='daily';
  // 버튼 스타일
  var bd=document.getElementById('adm-btn-daily'), bm=document.getElementById('adm-btn-monthly');
  if(bd){bd.style.background='#534AB7';bd.style.color='#fff';bd.style.border='none';}
  if(bm){bm.style.background='var(--card)';bm.style.color='var(--t1)';bm.style.border='1px solid var(--border)';}
  var vd=document.getElementById('adm-view-daily'), vm=document.getElementById('adm-view-monthly');
  if(vd) vd.style.display='';
  if(vm) vm.style.display='none';
  // 리전 버튼 초기화
  document.querySelectorAll('#adm-daily-region-toggle .region-btn').forEach(function(b){b.classList.toggle('active',b.dataset.region==='all');});
  _admDailyStrip();
  // G 이미 로드됐으면 즉시 렌더, 아니면 pending
  if(G&&G.logs&&G.logs.length){
    renderAdminDaily();
  } else {
    window._admDailyPendingRender=true;
  }
}

// G 데이터 로드 완료 후 Admin pending 렌더링 처리
// data.js 의 G 설정 후 호출되는 훅에 연결
var _admOrigSetG = typeof window._onGLoaded === 'function' ? window._onGLoaded : null;
window._onAdminGLoaded = function(){
  if(window._admDailyPendingRender){
    window._admDailyPendingRender = false;
    // Admin 탭이 활성화된 상태면 바로 렌더
    var pA=document.getElementById('pAdmin');
    if(pA && (pA.classList.contains('active') || pA.style.display!=='none')){
      _admDailyStrip();
      renderAdminDaily();
    }
  }
};


(function(){
  function _i(){
    initAdminPage();
    initBranchReport();
    // G.logs 준비 후 Admin 페이지가 활성화되어 있으면 즉시 렌더링
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',_i);
  } else {
    _i();
  }
})();
    // goPage(-1) 호출 시점에 G가 �