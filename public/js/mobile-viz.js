'use strict';

// ═══════════════════════════════════════════════
// MOBILE VISUAL DASHBOARD — Charts & Graphs Only
// Replaces text-heavy tables on mobile (≤768px)
// ═══════════════════════════════════════════════

var _isMobile = function(){ return window.innerWidth <= 768; };
var _mobileCharts = {};

// Destroy a mobile chart safely
function _destroyMC(key){
  if(_mobileCharts[key]){ _mobileCharts[key].destroy(); delete _mobileCharts[key]; }
}

// ── Chart.js defaults for mobile ──
var _mobileChartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 10, padding: 8,
        font: { size: 11, family: "'Pretendard',sans-serif" },
        color: '#63635e'
      }
    },
    tooltip: {
      backgroundColor: '#111110',
      titleFont: { family: "'Pretendard',sans-serif", size: 12 },
      bodyFont: { family: "'Pretendard',sans-serif", size: 11 },
      borderColor: '#2e2e2e', borderWidth: 1,
      cornerRadius: 8, padding: 10
    }
  }
};

// ═══ P1 MOBILE: Error Log Visual Dashboard ═══
function renderP1MobileViz(){
  if(!_isMobile()) return;
  var container = document.getElementById('p1-mobile-viz');
  if(!container) return;

  // Get filtered data (reuse _p1Data from incidents.js)
  var data = _p1Data || [];
  var total = data.length;

  if(total === 0){
    container.innerHTML = '<div class="mobile-viz-empty"><div style="font-size:48px;margin-bottom:12px">📭</div><div style="font-size:16px;font-weight:700;color:var(--t1)">No errors found</div><div style="font-size:12px;color:var(--t3);margin-top:4px">Try adjusting your filters</div></div>';
    return;
  }

  // Calculate data
  var brCount = {AMNY:0, AMLV:0, AMDB:0};
  var catCount = {Hardware:0, Software:0, Network:0, Other:0};
  var diffCount = {1:0, 2:0, 3:0, 4:0, 5:0};
  var recentCrit = [];

  data.forEach(function(r){
    if(brCount.hasOwnProperty(r.Branch)) brCount[r.Branch]++;
    var c = (r.Category||'').toLowerCase();
    if(c.includes('hardware')) catCount.Hardware++;
    else if(c.includes('software')) catCount.Software++;
    else if(c.includes('network')) catCount.Network++;
    else catCount.Other++;
    if(r.Difficulty >= 1 && r.Difficulty <= 5) diffCount[r.Difficulty]++;
    if(r.Difficulty >= 4 && recentCrit.length < 5) recentCrit.push(r);
  });

  // Build visual cards
  var html = '';

  // ── 1. Summary KPI Strip ──
  var critTotal = (diffCount[4]||0) + (diffCount[5]||0);
  html += '<div class="mviz-kpi-strip">';
  html += '<div class="mviz-kpi" style="--kpi-c:#534AB7"><div class="mviz-kpi-val">'+total+'</div><div class="mviz-kpi-lbl">Total</div></div>';
  html += '<div class="mviz-kpi" style="--kpi-c:#2563eb"><div class="mviz-kpi-val">'+brCount.AMNY+'</div><div class="mviz-kpi-lbl">AMNY</div></div>';
  html += '<div class="mviz-kpi" style="--kpi-c:#ea580c"><div class="mviz-kpi-val">'+brCount.AMLV+'</div><div class="mviz-kpi-lbl">AMLV</div></div>';
  html += '<div class="mviz-kpi" style="--kpi-c:#7c3aed"><div class="mviz-kpi-val">'+brCount.AMDB+'</div><div class="mviz-kpi-lbl">AMDB</div></div>';
  html += '<div class="mviz-kpi" style="--kpi-c:'+(critTotal>0?'#dc2626':'#16a34a')+'"><div class="mviz-kpi-val">'+critTotal+'</div><div class="mviz-kpi-lbl">Critical</div></div>';
  html += '</div>';

  // ── 2. Category Donut ──
  html += '<div class="mviz-card">';
  html += '<div class="mviz-card-title">Category Breakdown</div>';
  html += '<div style="position:relative;height:200px"><canvas id="m-cat-donut"></canvas></div>';
  html += '</div>';

  // ── 3. Branch Comparison Bars ──
  html += '<div class="mviz-card">';
  html += '<div class="mviz-card-title">Branch Comparison</div>';
  html += '<div style="position:relative;height:160px"><canvas id="m-branch-bar"></canvas></div>';
  html += '</div>';

  // ── 4. Difficulty Distribution ──
  html += '<div class="mviz-card">';
  html += '<div class="mviz-card-title">Difficulty Distribution</div>';
  html += '<div style="position:relative;height:160px"><canvas id="m-diff-bar"></canvas></div>';
  html += '</div>';

  // ── 5. Recent Critical Errors (visual badges) ──
  if(recentCrit.length > 0){
    html += '<div class="mviz-card mviz-card-alert">';
    html += '<div class="mviz-card-title" style="color:#dc2626">⚠ Critical Errors (Lv.4+)</div>';
    recentCrit.forEach(function(r){
      var diffColor = r.Difficulty >= 5 ? '#dc2626' : '#ea580c';
      html += '<div class="mviz-crit-item">';
      html += '<div class="mviz-crit-badge" style="background:'+diffColor+'">Lv.'+r.Difficulty+'</div>';
      html += '<div class="mviz-crit-info">';
      html += '<div class="mviz-crit-zone">'+esc(r.Zone||'N/A')+'</div>';
      html += '<div class="mviz-crit-meta">'+esc(r.Branch)+' · '+esc(r.Date||'')+'</div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // ── 6. Top Zones Visual ──
  var zoneCount = {};
  data.forEach(function(r){ zoneCount[r.Zone] = (zoneCount[r.Zone]||0)+1; });
  var topZones = Object.entries(zoneCount).sort(function(a,b){return b[1]-a[1]}).slice(0,8);
  if(topZones.length > 0){
    var maxZone = topZones[0][1];
    html += '<div class="mviz-card">';
    html += '<div class="mviz-card-title">Top Affected Zones</div>';
    topZones.forEach(function(z, i){
      var pct = Math.round(z[1]/maxZone*100);
      var sharePct = total ? Math.round(z[1]/total*100) : 0;
      var gradColors = ['#534AB7','#2563eb','#7c3aed','#ea580c','#0891b2','#059669','#ca8a04','#dc2626'];
      var barColor = gradColors[i % gradColors.length];
      html += '<div class="mviz-zone-bar">';
      html += '<div class="mviz-zone-name">'+(z[0].length > 16 ? z[0].slice(0,15)+'…' : z[0])+'</div>';
      html += '<div class="mviz-zone-track"><div class="mviz-zone-fill" style="width:'+pct+'%;background:'+barColor+'"></div></div>';
      html += '<div class="mviz-zone-count">'+z[1]+' <span style="color:var(--t4);font-weight:400">('+sharePct+'%)</span></div>';
      html += '</div>';
    });
    html += '</div>';
  }

  container.innerHTML = html;

  // ── Render Chart.js charts ──
  setTimeout(function(){
    // Category Donut
    _destroyMC('catDonut');
    var catCanvas = document.getElementById('m-cat-donut');
    if(catCanvas){
      _mobileCharts.catDonut = new Chart(catCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Hardware','Software','Network','Other'],
          datasets: [{
            data: [catCount.Hardware, catCount.Software, catCount.Network, catCount.Other],
            backgroundColor: ['#2563eb','#ca8a04','#059669','#8a8a84'],
            borderWidth: 2, borderColor: 'var(--card)',
            hoverOffset: 8
          }]
        },
        options: Object.assign({}, _mobileChartDefaults, {
          cutout: '60%',
          plugins: Object.assign({}, _mobileChartDefaults.plugins, {
            legend: { position: 'right', labels: { boxWidth: 10, padding: 10, font: { size: 11, family: "'Pretendard',sans-serif" } } }
          })
        })
      });
    }

    // Branch Bar
    _destroyMC('branchBar');
    var brCanvas = document.getElementById('m-branch-bar');
    if(brCanvas){
      _mobileCharts.branchBar = new Chart(brCanvas, {
        type: 'bar',
        data: {
          labels: ['AMNY','AMLV','AMDB'],
          datasets: [{
            data: [brCount.AMNY, brCount.AMLV, brCount.AMDB],
            backgroundColor: ['#2563eb','#ea580c','#7c3aed'],
            borderRadius: 6, borderSkipped: false,
            barPercentage: 0.6
          }]
        },
        options: Object.assign({}, _mobileChartDefaults, {
          indexAxis: 'y',
          plugins: Object.assign({}, _mobileChartDefaults.plugins, {
            legend: { display: false },
            tooltip: _mobileChartDefaults.plugins.tooltip
          }),
          scales: {
            x: { grid: { color: '#e5e4df' }, ticks: { font: { size: 11 }, color: document.documentElement.classList.contains('dark-mode')?'#ededed':'#111110' }, beginAtZero: true },
            y: { grid: { display: false }, ticks: { font: { size: 12, weight: '600' }, color: '#1a1a18' } }
          }
        })
      });
    }

    // Difficulty Distribution
    _destroyMC('diffBar');
    var diffCanvas = document.getElementById('m-diff-bar');
    if(diffCanvas){
      _mobileCharts.diffBar = new Chart(diffCanvas, {
        type: 'bar',
        data: {
          labels: ['Lv.1','Lv.2','Lv.3','Lv.4','Lv.5'],
          datasets: [{
            data: [diffCount[1],diffCount[2],diffCount[3],diffCount[4],diffCount[5]],
            backgroundColor: ['#a3a29c','#185FA5','#854F0B','#993C1D','#A32D2D'],
            borderRadius: 6, borderSkipped: false,
            barPercentage: 0.7
          }]
        },
        options: Object.assign({}, _mobileChartDefaults, {
          plugins: Object.assign({}, _mobileChartDefaults.plugins, {
            legend: { display: false }
          }),
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' }, color: '#1a1a18' } },
            y: { grid: { color: '#e5e4df' }, ticks: { font: { size: 10 }, color: document.documentElement.classList.contains('dark-mode')?'#ededed':'#111110' }, beginAtZero: true }
          }
        })
      });
    }
  }, 50);
}

// ═══ P2 MOBILE: Branch Visual Summary ═══
function renderP2MobileViz(){
  if(!_isMobile()) return;
  // Branch page already has KPI cards and zone bar charts
  // Just hide the table on mobile via CSS — no additional rendering needed
  // The existing branch content (KPI cards + zone chart) is already visual
}

// ═══ MONTHLY MOBILE: Hide table, keep charts ═══
function renderP0MobileViz(){
  if(!_isMobile()) return;
  // Monthly page already has Chart.js charts
  // Just ensure the "Top Recurring Issues" table is hidden
  // and report cards are compacted — handled via CSS
}

// ═══ RESPONSIVE TOGGLE ═══
function checkMobileVizState(){
  var mobile = _isMobile();
  // P1: Toggle between table and visual dashboard
  var p1Table = document.querySelector('#p1 .tbl-wrap');
  var p1Viz = document.getElementById('p1-mobile-viz');
  var p1Empty = document.getElementById('p1-empty');
  var p1Filters = document.querySelectorAll('#p1 .fbar');

  if(p1Table) p1Table.style.display = mobile ? 'none' : '';
  if(p1Viz) p1Viz.style.display = mobile ? 'block' : 'none';
  if(p1Empty && mobile) p1Empty.style.display = 'none';

  // On mobile, simplify filter bars (show only essential)
  p1Filters.forEach(function(f, i){
    if(i === 1 && mobile){
      // Second filter bar: hide complex filters on mobile
      f.classList.add('mobile-filter-simple');
    } else {
      f.classList.remove('mobile-filter-simple');
    }
  });

  // If switching to mobile, render viz
  if(mobile){
    renderP1MobileViz();
  }
}

// Listen for resize
var _mvizResizeTimer;
window.addEventListener('resize', function(){
  clearTimeout(_mvizResizeTimer);
  _mvizResizeTimer = setTimeout(checkMobileVizState, 200);
});

// Initial check on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(checkMobileVizState, 500);
});
