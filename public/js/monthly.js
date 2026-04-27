'use strict';

// ═══ PAGE 0: MONTHLY ═══
var _charts = {};
function renderP0(){
  if(!G||!Array.isArray(G.logs)) return;
  if(!el('monthSel')||!el('yearSel')) return;
  pulse();
  var isDark=document.documentElement.classList.contains('dark-mode');
  var gridC=isDark?'#2e2e2e':'#e5e4df', tickC=isDark?'#ededed':'#111110';
  var m=parseInt(el('monthSel').value),y=parseInt(el('yearSel').value);
  if(isNaN(m))m=CM;if(isNaN(y))y=CY;
  var md=getByMonth(m,y),lm=m===0?getByMonth(11,y-1):getByMonth(m-1,y);

  // KPI cards with sparklines and clear delta labels
  var prevMonName=MONTHS[m===0?11:m-1].slice(0,3);
  function kpi(l,v,p,c,brData){
    var d=v-p,pct=p?Math.round((d/p)*1000)/10:(v>0?100:0),ds=d>0?'up':d<0?'dn':'eq';
    var sparkSvg='<svg class="kpi-spark" width="48" height="18"><polyline points="'+brData.map(function(x,i){return i*(48/5)+','+Math.round(18-x*18)+''}).join(' ')+'" fill="none" stroke="'+c+'" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>';
    var deltaArrow=ds==='up'?'↑':ds==='dn'?'↓':'→';
    var deltaText=_lang==='ko'?
      ('전월 대비 '+deltaArrow+Math.abs(pct).toFixed(1)+'% ('+(d>=0?'+':'')+d+'건 '+(ds==='up'?'증가':ds==='dn'?'감소':'동일')+')'):
      (deltaArrow+' '+Math.abs(pct).toFixed(1)+'% ('+(d>=0?'+':'')+d+') vs Last Month');
    return'<div class="card mc" style="--mc-c:'+c+'"><div class="mc-lbl">'+l+'</div><div class="mc-val-row"><div class="mc-val">'+v+'</div><div class="mc-spark-wrap">'+sparkSvg+'</div></div><div class="mc-delta '+ds+'">'+deltaText+'</div></div>'
  }

  var lastSixMonths=function(l,br){
    var result=[];
    for(var i=5;i>=0;i--){
      var checkM=m-i;var checkY=y;if(checkM<0){checkM+=12;checkY--}
      var mData=getByMonth(checkM,checkY);
      var count=br?mData.filter(function(r){return r.Branch===br}).length:mData.filter(function(r){return regionBrs.indexOf(r.Branch)>=0}).length;
      result.push(count)
    }
    var max=Math.max.apply(null,result);return result.map(function(v){return max?v/max:0})
  };

  // Region-aware KPI cards — Total only counts current region's branches
  var regionBrs=typeof getRegionBranches==='function'?getRegionBranches():['AMNY','AMLV','AMDB'];
  var regionMd=md.filter(function(r){return regionBrs.indexOf(r.Branch)>=0});
  var regionLm=lm.filter(function(r){return regionBrs.indexOf(r.Branch)>=0});
  var totalLabel=_region==='korea'?(_lang==='ko'?'국내 Total':'Korea Total'):(_lang==='ko'?'해외 Total':'Global Total');
  var kpiHtml=kpi(totalLabel,regionMd.length,regionLm.length,'#64748b',lastSixMonths('Total'));
  regionBrs.forEach(function(br){
    var brCol=(BR_COLORS_MAP&&BR_COLORS_MAP[br])||'#534AB7';
    var brCount=md.filter(function(r){return r.Branch===br}).length;
    var lmCount=lm.filter(function(r){return r.Branch===br}).length;
    kpiHtml+=kpi(br,brCount,lmCount,brCol,lastSixMonths(br,br));
  });
  el('kpi-row').innerHTML=kpiHtml;

  // Annual Trend (Chart.js line) with gradient and animations — REGION FILTERED
  var trendCanvas = document.getElementById('annual-trend');
  if(_charts.trend) _charts.trend.destroy();
  var trendLabels = MONTHS.map(function(m){return m.slice(0,3)});
  var trendData = MONTHS.map(function(_,mi){return getByMonth(mi,y).filter(function(r){return regionBrs.indexOf(r.Branch)>=0}).length});
  var prevYrData = MONTHS.map(function(_,mi){return getByMonth(mi,y-1).filter(function(r){return regionBrs.indexOf(r.Branch)>=0}).length});
  var yr = y;

  // Find peak index for annotation
  var peakIdx=0,peakVal=0;
  trendData.forEach(function(v,i){if(v>peakVal){peakVal=v;peakIdx=i}});

  var ctx=trendCanvas.getContext('2d');
  var gradient=ctx.createLinearGradient(0,0,0,300);
  gradient.addColorStop(0,isDark?'rgba(83,74,183,0.25)':'rgba(83,74,183,0.12)');
  gradient.addColorStop(1,isDark?'rgba(83,74,183,0.02)':'rgba(83,74,183,0)');

  _charts.trend = new Chart(trendCanvas, {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [
        {label: String(yr), data: trendData, borderColor:'#534AB7', backgroundColor:gradient, fill:true, tension:0.35, pointRadius:3, pointBackgroundColor:'#534AB7', borderWidth:2.5, pointHoverRadius:6, pointHoverBorderWidth:2, pointHoverBorderColor:'#fff'},
        {label: String(yr-1), data: prevYrData, borderColor:'#d1d0ca', backgroundColor:'transparent', fill:false, tension:0.35, pointRadius:3, pointBackgroundColor:'#8a8a84', borderWidth:1.5, borderDash:[4,3], pointHoverRadius:6, pointHoverBorderWidth:2, pointHoverBorderColor:'#fff'}
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: {duration: 800, easing: 'easeOutQuart'},
      plugins: {
        legend: {position:'top', align:'end', labels:{boxWidth:12,padding:8,font:{size:12,family:"'Pretendard',sans-serif"},color:tickC}},
        tooltip: {
          backgroundColor:'#111110', titleFont:{family:"'Pretendard',sans-serif",color:'#fff'}, bodyFont:{family:"'Pretendard',sans-serif",color:'#d4d4d4'}, borderColor:'#2e2e2e', borderWidth:1, cornerRadius:8, padding:10, mode:'index',intersect:false,
          callbacks: {
            title: function(ctx){return trendLabels[ctx[0].dataIndex]+' '+yr},
            afterLabel: function(ctx){
              if(ctx.datasetIndex===0&&ctx.dataIndex<trendData.length-1){
                var curr=trendData[ctx.dataIndex],next=trendData[ctx.dataIndex+1];
                var chg=next-curr;return(chg>=0?'MoM: +':chg<0?'MoM: ':'')+(chg||0)
              }
              return ''
            }
          }
        },
        // Peak annotation rendered via tooltip callbacks (no external plugin needed)
      },
      scales: {
        x: {grid:{color:gridC}, ticks:{font:{size:12,family:"'Pretendard',sans-serif"},color:tickC}},
        y: {grid:{color:gridC}, ticks:{stepSize:1,precision:0,font:{size:12,family:"'Pretendard',sans-serif"},color:tickC},beginAtZero:true}
      },
      interaction:{mode:'nearest',axis:'x',intersect:false}
    },
    plugins:[{
      id:'trendPointLabels',
      afterDatasetsDraw:function(chart){
        var ctx=chart.ctx;
        var meta=chart.getDatasetMeta(0);
        if(!meta||!meta.data)return;
        var darkMode=document.documentElement.classList.contains('dark-mode');
        meta.data.forEach(function(pt,idx){
          var val=trendData[idx];
          if(val===0)return;
          ctx.save();
          ctx.font='bold 11px Pretendard,Montserrat,sans-serif';
          ctx.textAlign='center';
          ctx.textBaseline='bottom';
          ctx.fillStyle=darkMode?'#e5e5e5':'#534AB7';
          ctx.fillText(val,pt.x,pt.y-6);
          ctx.restore();
        });
      }
    }]
  });

  // Zone Heatmap with gradient animations and sorting — REGION FILTERED
  var zones=unique(regionMd.map(function(r){return r.Zone})).sort(),zc={};
  zones.forEach(function(z){zc[z]=regionMd.filter(function(r){return r.Zone===z}).length});
  var maxZ=Math.max.apply(null,Object.values(zc).concat([1]));
  var sortedZones=zones.sort(function(a,b){return(zc[b]||0)-(zc[a]||0)});

  el('zone-hm').innerHTML='<div class="hm-grid">'+sortedZones.map(function(z){var v=zc[z]||0,op=.05+v/maxZ*.85;return'<div class="hm-cell" style="background:rgba(37,99,235,'+op+');color:'+(v>maxZ*.5?'#fff':'#1d4ed8')+'" title="'+esc(z)+'" onclick="filterZone('+JSON.stringify(z).replace(/</g,'\\u003c')+')">'+'<div class="hm-val">'+v+'</div><div class="hm-label">'+(z.length>10?z.slice(0,9)+'\u2026':z)+'</div></div>'}).join('')+'</div>';

  // Category Doughnut with center text and enhanced legend
  var catCanvas = document.getElementById('cat-chart');
  if(_charts.cat) _charts.cat.destroy();
  var catLabels = _lang==='ko'?['소프트웨어','하드웨어','네트워크']:['Software','Hardware','Network'];
  var catData = [
    regionMd.filter(function(r){return r.Category==='Software'}).length,
    regionMd.filter(function(r){return r.Category==='Hardware'}).length,
    regionMd.filter(function(r){return r.Category==='Network'}).length
  ];
  var catColors = ['#ca8a04','#2563eb','#7c3aed'];
  var catTotal=catData.reduce(function(a,b){return a+b},0);

  var catCtx=catCanvas.getContext('2d');
  var catPctLabels=catLabels.map(function(label,i){
    var pct=catTotal?Math.round((catData[i]/catTotal)*100):0;
    return label+' ('+pct+'%)';
  });
  _charts.cat = new Chart(catCanvas, {
    type: 'doughnut',
    data: {
      labels: catPctLabels,
      datasets: [{data: catData, backgroundColor: catColors, borderWidth: 2, borderColor: isDark?'#1a1a18':'#ffffff', hoverOffset: 8}]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position:'bottom',
          labels: {
            boxWidth:12,padding:12,font:{size:12,family:"'Pretendard',sans-serif"},color:tickC,
            usePointStyle:true,pointStyle:'circle'
          }
        },
        tooltip: {backgroundColor:'#111110', titleFont:{family:"'Pretendard',sans-serif",color:'#fff'}, bodyFont:{family:"'Pretendard',sans-serif",color:'#d4d4d4'}, borderColor:'#2e2e2e', borderWidth:1, cornerRadius:8, padding:10},
        datalabels: {display:false},
        centerText: {
          text: catTotal
        }
      },
      cutout: '60%',
      animation: {duration: 800, easing: 'easeOutQuart'},
      onClick: function(evt, elems) {
        if(elems.length>0){
          var idx=elems[0].index;
          // Always use English category names for filter matching
          var catMap=['Software','Hardware','Network'];
          var cat=catMap[idx]||catLabels[idx];
          var sel=document.getElementById('f1-ca');
          if(sel){sel.value=cat;goPage(2,document.querySelectorAll('.ntab')[2]);if(typeof renderP1==='function')renderP1();}
        }
      }
    },
    plugins: [{
      id: 'centerText',
      afterDatasetsDraw: function(chart){
        var meta=chart.getDatasetMeta(0);
        if(!meta||!meta.data||!meta.data[0])return;
        var arc=meta.data[0];
        var cx=arc.x, cy=arc.y;
        var ctx=chart.ctx;
        ctx.save();
        var fontSize=Math.round(Math.min(chart.width,chart.height)/6.5);
        ctx.font='800 '+fontSize+'px Pretendard, Montserrat, sans-serif';
        ctx.textAlign='center';
        /* measure actual text height for true vertical centering */
        var metrics=ctx.measureText(String(catTotal));
        var textH=metrics.actualBoundingBoxAscent+(metrics.actualBoundingBoxDescent||0);
        ctx.textBaseline='alphabetic';
        var darkMode=document.documentElement.classList.contains('dark-mode');
        ctx.fillStyle=darkMode?'#f5f5f4':'#111110';
        ctx.fillText(String(catTotal), cx, cy + textH/2 - 1);
        ctx.restore()
      }
    }]
  });

  // Difficulty Chart with gradient bars and background reference
  var diffCanvas = document.getElementById('diff-chart');
  if(_charts.diff) _charts.diff.destroy();
  var diffLabels = ['Lv.1','Lv.2','Lv.3','Lv.4','Lv.5'];
  var diffData = [
    regionMd.filter(function(r){return r.Difficulty<=1}).length,
    regionMd.filter(function(r){return r.Difficulty===2}).length,
    regionMd.filter(function(r){return r.Difficulty===3}).length,
    regionMd.filter(function(r){return r.Difficulty===4}).length,
    regionMd.filter(function(r){return r.Difficulty>=5}).length
  ];
  var diffColors = ['#22c55e','#eab308','#ef4444','#be123c','#7f1d1d'];
  var diffMax=Math.max.apply(null,diffData.concat([1]));

  _charts.diff = new Chart(diffCanvas, {
    type: 'bar',
    data: {
      labels: diffLabels,
      datasets: [
        {label: 'Max', data: Array(5).fill(diffMax), backgroundColor: 'rgba(200,200,200,0.1)', borderWidth: 0, borderRadius: 8, barThickness: 22, order: 2},
        {label: 'Count', data: diffData, backgroundColor: diffColors, borderWidth: 0, borderRadius: 8, barThickness: 22, order: 1}
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend:{display:false},
        tooltip:{backgroundColor:'#111110', titleFont:{family:"'Pretendard',sans-serif",color:'#fff'}, bodyFont:{family:"'Pretendard',sans-serif",color:'#d4d4d4'}, borderColor:'#2e2e2e', borderWidth:1, cornerRadius:8, padding:10}
      },
      scales: {
        x: {grid:{color:gridC}, ticks:{stepSize:1,precision:0,font:{size:11,family:"'Pretendard',sans-serif"},color:tickC},max:diffMax},
        y: {grid:{display:false}, ticks:{font:{size:12,weight:'bold',family:"'Pretendard',sans-serif"},color:tickC}}
      },
      onClick: function(evt, elems) {
        if(elems.length>0){
          var idx=elems[0].index;
          var diffVal=String(idx+1);
          var sel=document.getElementById('f1-df');
          if(sel){sel.value=diffVal;goPage(2,document.querySelectorAll('.ntab')[2]);if(typeof renderP1==='function')renderP1();}
        }
      }
    },
    plugins:[{
      id:'diffBarLabels',
      afterDatasetsDraw:function(chart){
        var ctx=chart.ctx;
        var meta=chart.getDatasetMeta(1);
        if(!meta||!meta.data)return;
        var darkMode=document.documentElement.classList.contains('dark-mode');
        meta.data.forEach(function(bar,idx){
          var val=diffData[idx];
          if(val===0)return;
          ctx.save();
          ctx.font='bold 12px Pretendard,Montserrat,sans-serif';
          ctx.textBaseline='middle';
          var barW=bar.x-chart.chartArea.left;
          if(barW>30){
            ctx.fillStyle='#fff';
            ctx.textAlign='center';
            ctx.fillText(val,chart.chartArea.left+(barW/2),bar.y);
          }else{
            ctx.fillStyle=darkMode?'#e5e5e5':'#111110';
            ctx.textAlign='left';
            ctx.fillText(val,bar.x+6,bar.y);
          }
          ctx.restore();
        });
      }
    }]
  });

  // Action Type Chart with gradient bars and icon labels
  var actCanvas = document.getElementById('action-chart');
  if(_charts.act) _charts.act.destroy();
  var actLabels = ['🏢 '+t('onSite'),'📡 '+t('remote')];
  var actData = [
    regionMd.filter(function(r){return(r.ActionType||'').indexOf('On')>=0}).length,
    regionMd.filter(function(r){return(r.ActionType||'').indexOf('Remote')>=0}).length
  ];
  var actColors = ['#3b82f6','#8b5cf6'];
  var actMax=Math.max.apply(null,actData.concat([1]));

  _charts.act = new Chart(actCanvas, {
    type: 'bar',
    data: {
      labels: actLabels,
      datasets: [
        {label: 'Max', data: Array(2).fill(actMax), backgroundColor: 'rgba(200,200,200,0.1)', borderWidth: 0, borderRadius: 8, barThickness: 24, order: 2},
        {label: 'Count', data: actData, backgroundColor: actColors, borderWidth: 0, borderRadius: 8, barThickness: 24, order: 1}
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {legend:{display:false}, tooltip:{backgroundColor:'#111110', titleFont:{family:"'Pretendard',sans-serif",color:'#fff'}, bodyFont:{family:"'Pretendard',sans-serif",color:'#d4d4d4'}, borderColor:'#2e2e2e', borderWidth:1, cornerRadius:8, padding:10}},
      scales: {
        x: {grid:{color:gridC}, ticks:{stepSize:1,precision:0,font:{size:11,family:"'Pretendard',sans-serif"},color:tickC},max:actMax},
        y: {grid:{display:false}, ticks:{font:{size:11,family:"'Pretendard',sans-serif"},color:tickC}}
      }
    },
    plugins:[{
      id:'actBarLabels',
      afterDatasetsDraw:function(chart){
        var ctx=chart.ctx;
        var meta=chart.getDatasetMeta(1);
        if(!meta||!meta.data)return;
        var darkMode=document.documentElement.classList.contains('dark-mode');
        meta.data.forEach(function(bar,idx){
          var val=actData[idx];
          if(val===0)return;
          ctx.save();
          ctx.font='bold 12px Pretendard,Montserrat,sans-serif';
          ctx.textBaseline='middle';
          var barW=bar.x-chart.chartArea.left;
          if(barW>30){
            ctx.fillStyle='#fff';
            ctx.textAlign='center';
            ctx.fillText(val,chart.chartArea.left+(barW/2),bar.y);
          }else{
            ctx.fillStyle=darkMode?'#e5e5e5':'#111110';
            ctx.textAlign='left';
            ctx.fillText(val,bar.x+6,bar.y);
          }
          ctx.restore();
        });
      }
    }]
  });

  el('mon-cnt').textContent=regionMd.length+' '+t('errors');
  var map={};regionMd.forEach(function(r){var k=r.Zone+'|'+r.Category;if(!map[k])map[k]={zone:r.Zone,cat:r.Category,br:r.Branch,cnt:0,s:r.IssueDetail};map[k].cnt++});
  var top=Object.values(map).sort(function(a,b){return b.cnt-a.cnt}).slice(0,8);

  // Top issues with rank badges — clean count display, no bar chart
  var medals=['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'];
  el('top-issues').innerHTML=top.length?top.map(function(v,i){
    var rank=i<3?'<span class="medal-icon">'+medals[i]+'</span>':'<span class="rank-num">'+(i+1)+'</span>';
    return'<tr><td class="td-rank">'+rank+'</td><td>'+brBadge(v.br)+'</td><td><span class="zp">'+esc(v.zone)+'</span></td><td>'+catFull(v.cat)+'</td><td class="td-left td-detail td-wrap">'+esc(v.s)+'</td><td class="td-count">'+v.cnt+'</td></tr>'
  }).join(''):'<tr><td colspan="6" class="td-empty">'+t('noErrors')+'</td></tr>';
}

