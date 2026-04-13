'use strict';

// ═══════════════════════════════════════════════════════════════════
// G-ATIS MOBILE APP — Expert-Level Native App Experience for PWA
// Research-backed: Skeleton loading, Glassmorphism, Micro-interactions,
// Page transitions, 3-5 metrics rule, Card UX, 48px+ touch targets
// ═══════════════════════════════════════════════════════════════════

var _isMobileApp = false;
var _mCharts = {};
var _currentMobilePage = 0;
var _pageTransitioning = false;

// ══════════════════════════════════════
// 1. DEVICE DETECTION
// ══════════════════════════════════════
function detectMobileDevice(){
  var touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  var small = window.innerWidth <= 768;
  var ua = /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent);
  // PWA standalone mode = always mobile app
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   window.navigator.standalone === true;
  return (touch && small) || (ua && small) || (standalone && small);
}

// ══════════════════════════════════════
// 2. INITIALIZATION
// ══════════════════════════════════════
function initMobileApp(){
  _isMobileApp = detectMobileDevice();
  if(!_isMobileApp){
    document.body.classList.remove('mobile-app');
    var hdr = document.getElementById('m-app-header');
    if(hdr) hdr.style.display = 'none';
    return;
  }
  document.body.classList.add('mobile-app');
  buildMobileHeader();
  setupPullToRefresh();
  // setupSwipeNav(); — disabled: bottom tab nav preferred (user request 2026-04-07)
  setupPageTransitions();
  // Inject skeleton into P1 container immediately
  showP1Skeleton();
  console.log('[MobileApp] v2.0 — Expert mode activated');
}

// ══════════════════════════════════════
// 3. APP HEADER (Glassmorphism)
// ══════════════════════════════════════
function buildMobileHeader(){
  if(document.getElementById('m-app-header')) return;
  var hdr = document.createElement('div');
  hdr.id = 'm-app-header';
  hdr.innerHTML =
    '<div class="mah-left">' +
      '<img src="/fonts/dstrict_CI_BLACK.png" alt="d\'strict" class="mah-logo">' +
      '<div class="mah-title-wrap">' +
        '<div class="mah-title">Error</div>' +
        '<div class="mah-subtitle" id="mah-page-label">'+(typeof t==='function'?t('monthlyOverview'):'Monthly Overview')+'</div>' +
      '</div>' +
      '<div class="mah-live"><div class="mah-live-dot"></div></div>' +
    '</div>' +
    '<div class="mah-right">' +
      '<button class="mah-btn" onclick="toggleLang()" id="m-lang-btn" aria-label="Toggle language">EN</button>' +
      '<button class="mah-btn" onclick="toggleTheme()" id="m-theme-btn" aria-label="Toggle theme">🌙</button>' +
      '<button class="mah-btn mah-sync" onclick="reloadData()" aria-label="Sync data">⟳</button>' +
      '<button class="mah-btn" onclick="doLogout()" aria-label="Logout" style="color:#dc2626;font-size:13px">⏻</button>' +
    '</div>';
  document.body.insertBefore(hdr, document.body.firstChild);
}

// Update header subtitle when page changes (i18n-aware)
function updateMobileHeaderLabel(idx){
  var keys = ['dailyOverview', 'monthlyOverview', 'errorLogTitle', 'branchDetail', 'search'];
  var el = document.getElementById('mah-page-label');
  if(el) el.textContent = (typeof t === 'function' ? t(keys[idx]) : ['Daily Overview','Monthly Overview','Error Log','Branch Detail','Search'][idx]) || '';
}

// ══════════════════════════════════════
// 4. PULL TO REFRESH (Improved Physics)
// ══════════════════════════════════════
var _pullToRefreshSetup = false;
function setupPullToRefresh(){
  if(_pullToRefreshSetup || document.getElementById('m-pull-indicator')) return;
  _pullToRefreshSetup = true;
  var pill = document.createElement('div');
  pill.id = 'm-pull-indicator';
  pill.innerHTML = '<div class="mpi-spinner"></div><span>'+(typeof t==='function'?t('pullToRefresh'):'Pull to refresh')+'</span>';
  document.body.appendChild(pill);

  var startY = 0, pulling = false, triggered = false;

  document.addEventListener('touchstart', function(e){
    if(window.scrollY <= 2 && !_pageTransitioning){
      startY = e.touches[0].clientY;
      pulling = true;
      triggered = false;
    }
  }, {passive: true});

  document.addEventListener('touchmove', function(e){
    if(!pulling || triggered) return;
    var dy = e.touches[0].clientY - startY;
    if(dy > 0 && dy < 140 && window.scrollY <= 2){
      // Rubber-band physics: diminishing returns
      var progress = Math.min(dy / 100, 1);
      var visualDy = dy * (1 - progress * 0.4);
      pill.style.transform = 'translateX(-50%) translateY(' + Math.min(visualDy * 0.4, 50) + 'px)';
      pill.style.opacity = String(Math.min(progress, 1));
      pill.querySelector('span').textContent = progress >= 0.8 ? (typeof t==='function'?t('releaseToRefresh'):'Release to refresh') : (typeof t==='function'?t('pullToRefresh'):'Pull to refresh');
      // Rotate spinner based on pull distance
      var spinner = pill.querySelector('.mpi-spinner');
      if(spinner) spinner.style.transform = 'rotate(' + (dy * 3) + 'deg)';
    }
  }, {passive: true});

  document.addEventListener('touchend', function(){
    if(!pulling) return;
    pulling = false;
    var op = parseFloat(pill.style.opacity) || 0;
    if(op >= 0.8 && !triggered){
      triggered = true;
      pill.querySelector('span').textContent = typeof t==='function'?t('refreshing'):'Refreshing...';
      pill.classList.add('mpi-loading');
      // Haptic feedback (vibrate API)
      if(navigator.vibrate) navigator.vibrate(15);
      reloadData();
      setTimeout(function(){
        pill.classList.remove('mpi-loading');
        pill.style.transform = 'translateX(-50%) translateY(-60px)';
        pill.style.opacity = '0';
      }, 2000);
    } else {
      pill.style.transform = 'translateX(-50%) translateY(-60px)';
      pill.style.opacity = '0';
    }
  }, {passive: true});
}

// ══════════════════════════════════════
// 5. SWIPE NAVIGATION + PAGE TRANSITIONS
// ══════════════════════════════════════
function setupSwipeNav(){
  var startX = 0, startY = 0, tracking = false;

  document.addEventListener('touchstart', function(e){
    if(_pageTransitioning) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, {passive: true});

  document.addEventListener('touchend', function(e){
    if(!tracking || _pageTransitioning) return;
    tracking = false;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    // Require strong horizontal intent
    if(Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2.5){
      if(dx < 0 && _currentMobilePage < 3){
        mobileTabGo(_currentMobilePage + 1);
      } else if(dx > 0 && _currentMobilePage > 0){
        mobileTabGo(_currentMobilePage - 1);
      }
    }
  }, {passive: true});
}

function setupPageTransitions(){
  // Add transition class to all pages
  document.querySelectorAll('.page').forEach(function(p){
    p.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  });
}

// Animate page transition
function animatePageSwitch(fromIdx, toIdx, callback){
  _pageTransitioning = true;
  var pages = document.querySelectorAll('.page');
  var direction = toIdx > fromIdx ? 1 : -1;

  // Fade out current
  if(pages[fromIdx]){
    pages[fromIdx].style.opacity = '0';
    pages[fromIdx].style.transform = 'translateX(' + (-direction * 20) + 'px)';
  }

  setTimeout(function(){
    // Switch active state
    pages.forEach(function(p, j){ p.classList.toggle('active', j === toIdx); });

    // Fade in new
    if(pages[toIdx]){
      pages[toIdx].style.opacity = '0';
      pages[toIdx].style.transform = 'translateX(' + (direction * 20) + 'px)';
      // Force reflow
      pages[toIdx].offsetHeight;
      pages[toIdx].style.opacity = '1';
      pages[toIdx].style.transform = 'translateX(0)';
    }

    // Reset old page
    if(pages[fromIdx]){
      pages[fromIdx].style.opacity = '1';
      pages[fromIdx].style.transform = 'translateX(0)';
    }

    _pageTransitioning = false;
    if(callback) callback();
  }, 200);
}

// ══════════════════════════════════════
// 6. SKELETON LOADING (Shimmer Effect)
// ══════════════════════════════════════
function showP1Skeleton(){
  var container = document.getElementById('p1-mobile-viz');
  if(!container || container.dataset.loaded === '1') return;
  var html = '<div class="ma-skeleton" id="p1-skeleton-loader">';
  // KPI skeleton
  html += '<div class="ma-skel-grid">';
  html += '<div class="ma-skel-box ma-skel-hero"></div>';
  for(var i=0;i<5;i++) html += '<div class="ma-skel-box"></div>';
  html += '</div>';
  // Chart skeleton
  html += '<div class="ma-skel-chart"></div>';
  // Cards skeleton
  for(var j=0;j<4;j++) html += '<div class="ma-skel-card"><div class="ma-skel-line w60"></div><div class="ma-skel-line w80"></div><div class="ma-skel-line w40"></div></div>';
  html += '</div>';
  container.innerHTML = html;
  container.style.display = 'block';
  // Ensure skeleton is removed once data loads (animation duration failsafe)
  container.dataset.skeletonShown = Date.now();
}

// Helper to hide skeleton when data is ready
function hideP1Skeleton(){
  var container = document.getElementById('p1-mobile-viz');
  if(container){
    var skeletonEl = document.getElementById('p1-skeleton-loader');
    if(skeletonEl) skeletonEl.style.display = 'none';
    container.dataset.loaded = '1';
  }
}

// ══════════════════════════════════════
// 7. CHART HELPER
// ══════════════════════════════════════
function _mc(key){ if(_mCharts[key]){ _mCharts[key].destroy(); delete _mCharts[key]; } }

var _mcDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 450, easing: 'easeOutQuart' },
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 10, padding: 6, font: { size: 11, family: "'Pretendard',sans-serif" }, color: document.documentElement.classList.contains('dark-mode')?'#ededed':'#111110', usePointStyle: true, pointStyle: 'circle' } },
    tooltip: { backgroundColor: 'rgba(26,26,24,0.95)', titleFont: { size: 12, family: "'Pretendard',sans-serif" }, bodyFont: { size: 11, family: "'Pretendard',sans-serif" }, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, cornerRadius: 12, padding: 12, displayColors: true, boxPadding: 4 }
  }
};

// ══════════════════════════════════════
// 8. RENDER DISPATCHER
// ══════════════════════════════════════
function renderMobilePage(idx){
  if(!_isMobileApp) return;
  updateMobileHeaderLabel(idx);
  if(idx === 0 && typeof renderDaily==='function') renderDaily(); /* Daily uses shared renderer */
  if(idx === 1) renderMobileP0();
  if(idx === 2) renderMobileP1();
  if(idx === 3) renderMobileP2();
}

// ══════════════════════════════════════
// 9. P0: MONTHLY — Mobile App
// ══════════════════════════════════════
function renderMobileP0(){
  if(!_isMobileApp || typeof Chart === 'undefined') return;
  // P0 uses existing Chart.js rendering + CSS transformation
  // Update header with localized title + sync time
  var syncEl = document.getElementById('mah-page-label');
  if(syncEl){
    var label = typeof t === 'function' ? t('monthlyOverview') : 'Monthly Overview';
    if(G && G.meta && G.meta.lastSync){
      label += ' · ' + G.meta.lastSync;
    }
    syncEl.textContent = label;
  }
}

// ══════════════════════════════════════
// 10. P1: ERROR LOG — Full Mobile Dashboard
// ══════════════════════════════════════
function renderMobileP1(){
  if(!_isMobileApp) return;
  var container = document.getElementById('p1-mobile-viz');
  if(!container) return;
  container.dataset.loaded = '1';

  var data = (typeof _p1Data !== 'undefined') ? _p1Data : [];
  var total = data.length;

  // Empty State
  if(total === 0){
    container.innerHTML =
      '<div class="ma-empty">' +
        '<div class="ma-empty-icon">📭</div>' +
        '<div class="ma-empty-title">'+(typeof t==='function'?t('noErrorsFound'):'No errors found')+'</div>' +
        '<div class="ma-empty-sub">'+(typeof t==='function'?t('adjustFilters'):'Adjust filters or pull down to refresh')+'</div>' +
      '</div>';
    container.style.display = 'block';
    return;
  }

  // ── Data Aggregation ──
  var brCount = {};
  ALL_BRANCHES.forEach(function(b){ brCount[b] = 0; });
  var catCount = {Hardware:0, Software:0, Network:0, Other:0};
  var diffCount = [0,0,0,0,0,0];
  var critErrors = [];
  var zoneCount = {};

  data.forEach(function(r){
    if(brCount.hasOwnProperty(r.Branch)) brCount[r.Branch]++;
    var c = (r.Category||'').toLowerCase();
    if(c.indexOf('hardware')>=0) catCount.Hardware++;
    else if(c.indexOf('software')>=0) catCount.Software++;
    else if(c.indexOf('network')>=0) catCount.Network++;
    else catCount.Other++;
    var d = parseInt(r.Difficulty) || 0;
    if(d >= 1 && d <= 5) diffCount[d]++;
    if(d >= 4 && critErrors.length < 6) critErrors.push(r);
    if(r.Zone) zoneCount[r.Zone] = (zoneCount[r.Zone]||0)+1;
  });
  var critTotal = diffCount[4] + diffCount[5];

  var html = '';

  // ══ HERO KPI (Single big number — "one question per screen" rule) ══
  html += '<div class="ma-hero-kpi">';
  html += '<div class="ma-hero-num">' + total + '</div>';
  html += '<div class="ma-hero-label">'+(typeof t==='function'?t('totalErrorsLabel'):'Total Errors')+'</div>';
  if(critTotal > 0){
    html += '<div class="ma-hero-alert">' + critTotal + ' Critical (Lv.4+)</div>';
  }
  html += '</div>';

  // ══ Branch Mini Cards (horizontal scroll — max 3-5 metrics) ══
  html += '<div class="ma-branch-strip">';
  var BR_ICONS = {AMGN:'🏔',AMYS:'🌊',AMBS:'⚓',AMJJ:'🍊',AMNY:'🗽',AMLV:'🎰',AMDB:'🏙'};
  var activeBranches = getRegionBranches();
  var branches = activeBranches.map(function(b){
    return {name:b, count:brCount[b]||0, color:BR_COLORS_MAP[b]||'#666', icon:BR_ICONS[b]||'📍'};
  });
  branches.forEach(function(b){
    var pct = total ? Math.round(b.count/total*100) : 0;
    html += '<div class="ma-branch-chip" style="--bc:'+b.color+'">';
    html += '<div class="ma-bc-icon">'+b.icon+'</div>';
    html += '<div class="ma-bc-info"><div class="ma-bc-name">'+b.name+'</div><div class="ma-bc-num">'+b.count+' <span>('+pct+'%)</span></div></div>';
    html += '</div>';
  });
  html += '</div>';

  // ══ Category & Difficulty — Side by Side Charts ══
  html += '<div class="ma-chart-pair">';
  html += '<div class="ma-chart-card"><div class="ma-cc-title">'+(typeof t==='function'?t('categoryLabel'):'Category')+'</div><div class="ma-cc-canvas"><canvas id="ma-cat-chart"></canvas></div></div>';
  html += '<div class="ma-chart-card"><div class="ma-cc-title">'+(typeof t==='function'?t('difficultyLabel'):'Difficulty')+'</div><div class="ma-cc-canvas"><canvas id="ma-diff-chart"></canvas></div></div>';
  html += '</div>';

  // ══ Top Zones — Horizontal Bar ══
  var topZones = Object.entries(zoneCount).sort(function(a,b){return b[1]-a[1]}).slice(0,5);
  if(topZones.length > 0){
    var maxZ = topZones[0][1];
    html += '<div class="ma-card"><div class="ma-card-title">'+(typeof t==='function'?t('topZonesLabel'):'Top Zones')+'</div>';
    topZones.forEach(function(z, i){
      var pct = Math.round(z[1]/maxZ*100);
      var colors = ['#534AB7','#2563eb','#7c3aed','#ea580c','#0891b2'];
      html += '<div class="ma-zone-row">';
      html += '<div class="ma-zr-name">'+esc(z[0].length>16?z[0].slice(0,15)+'…':z[0])+'</div>';
      html += '<div class="ma-zr-track"><div class="ma-zr-fill" style="width:'+pct+'%;background:'+colors[i%5]+';animation:maBarGrow 0.5s ease '+((i*80))+'ms both"></div></div>';
      html += '<div class="ma-zr-num">'+z[1]+'</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // ══ Critical Errors — Alert Cards ══
  if(critErrors.length > 0){
    html += '<div class="ma-card ma-card-alert"><div class="ma-card-title" style="color:#dc2626">⚠ '+(typeof t==='function'?t('criticalErrors'):'Critical Errors')+'</div>';
    critErrors.forEach(function(r, i){
      var lvColor = r.Difficulty >= 5 ? '#dc2626' : '#ea580c';
      html += '<div class="ma-crit-card" style="animation:maFadeUp 0.3s ease '+(i*60)+'ms both">';
      html += '<div class="ma-cc-header">';
      html += '<span class="ma-cc-badge" style="background:'+lvColor+'">Lv.'+r.Difficulty+'</span>';
      html += '<span class="ma-cc-branch">'+esc(r.Branch||'')+'</span>';
      html += '<span class="ma-cc-date">'+esc(r.Date||'')+'</span>';
      html += '</div>';
      html += '<div class="ma-cc-zone">'+esc(r.Zone||'N/A')+'</div>';
      html += '<div class="ma-cc-detail">'+esc((r.IssueDetail||'').slice(0,90))+'</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // ══ Recent Error List — Expandable Cards ══
  var showCount = Math.min(data.length, 15);
  html += '<div class="ma-card"><div class="ma-card-title">'+(typeof t==='function'?t('recentErrorsLabel'):'Recent Errors')+' <span class="ma-card-count">'+showCount+' '+(typeof t==='function'?t('ofLabel'):'of')+' '+total+'</span></div>';
  data.slice(0, showCount).forEach(function(r, i){
    var d = parseInt(r.Difficulty)||0;
    var borderColor = d>=5?'#dc2626':d>=4?'#ea580c':d>=3?'#eab308':'var(--border)';
    var catIcon = (r.Category||'').toLowerCase().indexOf('hardware')>=0?'🔧':
                  (r.Category||'').toLowerCase().indexOf('software')>=0?'💻':
                  (r.Category||'').toLowerCase().indexOf('network')>=0?'🌐':'📎';
    html += '<div class="ma-err-item" style="border-left:3px solid '+borderColor+';animation:maFadeUp 0.25s ease '+(i*30)+'ms both" onclick="this.classList.toggle(\'expanded\')">';
    html += '<div class="ma-ei-main">';
    html += '<div class="ma-ei-left">';
    html += '<div class="ma-ei-zone">'+esc(r.Zone||'N/A')+'</div>';
    html += '<div class="ma-ei-meta">'+catIcon+' '+esc(r.Category||'etc')+' · '+esc(r.Branch||'')+' · '+esc(r.Date||'')+'</div>';
    html += '</div>';
    html += '<div class="ma-ei-right"><span class="ma-ei-lv" style="'+(d>=4?'background:#fef2f2;color:#dc2626':'')+'">Lv.'+d+'</span><span class="ma-ei-chevron">›</span></div>';
    html += '</div>';
    // Expandable detail
    html += '<div class="ma-ei-expand">';
    html += '<div class="ma-ei-issue">'+esc(r.IssueDetail||(typeof t==='function'?t('noDetail'):'No detail'))+'</div>';
    html += '<div class="ma-ei-tags">';
    html += '<span>👤 '+esc(r.SolvedBy||'N/A')+'</span>';
    html += '<span>⏱ '+esc(r.TimeTaken||'N/A')+'</span>';
    html += '<span>🔨 '+esc(r.ActionType||'N/A')+'</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';

  container.innerHTML = html;
  container.style.display = 'block';

  // ── Render Charts (delayed for DOM paint) ──
  requestAnimationFrame(function(){
    setTimeout(function(){
      if(typeof Chart === 'undefined') return;
      _renderMobileCharts(catCount, diffCount);
    }, 60);
  });
}

function _renderMobileCharts(catCount, diffCount){
  // Category Donut
  _mc('maCat');
  var catEl = document.getElementById('ma-cat-chart');
  if(catEl){
    var catTotal = (catCount.Hardware||0)+(catCount.Software||0)+(catCount.Network||0)+(catCount.Other||0);
    _mCharts.maCat = new Chart(catEl, {
      type: 'doughnut',
      data: {
        labels: ['HW','SW','Net','Other'],
        datasets: [{
          data: [catCount.Hardware, catCount.Software, catCount.Network, catCount.Other],
          backgroundColor: ['#3b82f6','#eab308','#22c55e','#a3a29c'],
          borderWidth: 0, hoverOffset: 4
        }]
      },
      options: Object.assign({}, _mcDefaults, {
        cutout: '58%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, padding: 4, font: { size: 10 }, usePointStyle: true, pointStyle: 'circle' } }, tooltip: _mcDefaults.plugins.tooltip }
      }),
      plugins: [{
        id: 'maCenterText',
        afterDatasetsDraw: function(chart){
          var meta=chart.getDatasetMeta(0);
          if(!meta||!meta.data||!meta.data[0])return;
          var arc=meta.data[0];
          var cx=arc.x, cy=arc.y;
          var ctx=chart.ctx;
          ctx.save();
          var fontSize=Math.round(Math.min(chart.width,chart.height)/5);
          ctx.font='800 '+fontSize+'px Pretendard, Montserrat, sans-serif';
          ctx.textAlign='center';
          var metrics=ctx.measureText(String(catTotal));
          var textH=metrics.actualBoundingBoxAscent+(metrics.actualBoundingBoxDescent||0);
          ctx.textBaseline='alphabetic';
          var dark=document.documentElement.classList.contains('dark-mode');
          ctx.fillStyle=dark?'#f5f5f4':'#111110';
          ctx.fillText(String(catTotal), cx, cy + textH/2 - 1);
          ctx.restore();
        }
      }]
    });
  }

  // Difficulty Bar
  _mc('maDiff');
  var diffEl = document.getElementById('ma-diff-chart');
  if(diffEl){
    _mCharts.maDiff = new Chart(diffEl, {
      type: 'bar',
      data: {
        labels: ['1','2','3','4','5'],
        datasets: [{
          data: [diffCount[1],diffCount[2],diffCount[3],diffCount[4],diffCount[5]],
          backgroundColor: ['#a3a29c','#3b82f6','#eab308','#f97316','#ef4444'],
          borderRadius: 8, borderSkipped: false, barPercentage: 0.65
        }]
      },
      options: Object.assign({}, _mcDefaults, {
        plugins: { legend: { display: false }, tooltip: _mcDefaults.plugins.tooltip },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11, weight: '700' }, color: '#1a1a18' } },
          y: { display: false, beginAtZero: true }
        }
      })
    });
  }
}

// ══════════════════════════════════════
// 11. P2: BRANCHES — Mobile
// ══════════════════════════════════════
function renderMobileP2(){
  if(!_isMobileApp) return;
  // Existing branch KPI + zone bars work well with CSS transformation
}

// ══════════════════════════════════════
// 12. RESIZE HANDLER
// ══════════════════════════════════════
var _maResizeTimer;
window.addEventListener('resize', function(){
  clearTimeout(_maResizeTimer);
  _maResizeTimer = setTimeout(function(){
    var was = _isMobileApp;
    _isMobileApp = detectMobileDevice();
    if(_isMobileApp && !was) initMobileApp();
    if(!_isMobileApp && was){
      document.body.classList.remove('mobile-app');
      var hdr = document.getElementById('m-app-header');
      if(hdr) hdr.style.display = 'none';
    }
  }, 300);
});

// ══════════════════════════════════════
// 13. INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(initMobileApp, 200);
});
