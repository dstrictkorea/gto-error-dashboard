'use strict';

var _pageNames = ['daily', 'monthly', 'errorlog', 'branches', 'search', 'ai'];

function goPage(i, btn, skipHistory) {
  // Admin page: i === -1
  var isAdmin = (i === -1);
  var adminPage = document.getElementById('pAdmin');

  // Hide all regular pages + admin (clear inline display style)
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
    p.style.display = '';  // clear inline display:none so CSS .page.active works
  });
  if(adminPage) { adminPage.classList.remove('active'); adminPage.style.display = ''; }

  if(isAdmin){
    if(adminPage) adminPage.classList.add('active');
  } else {
    var pages = document.querySelectorAll('.page:not(#pAdmin)');
    pages.forEach(function(p, j) { p.classList.toggle('active', j === i); });
  }

  // Update nav tabs
  document.querySelectorAll('.ntab').forEach(function(b) {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
    b.setAttribute('tabindex', '-1');
  });
  if(isAdmin){
    var adminTab = document.getElementById('adminTab');
    if(adminTab){ adminTab.classList.add('active'); adminTab.setAttribute('aria-selected','true'); adminTab.setAttribute('tabindex','0'); }
  } else if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    btn.setAttribute('tabindex', '0');
  } else {
    // +1 offset because adminTab is the first .ntab now
    var tabs = document.querySelectorAll('.ntab');
    var tabIdx = (typeof _loggedId !== 'undefined' && _loggedId === 'gto') ? i + 1 : i;
    if (tabs[tabIdx]) {
      tabs[tabIdx].classList.add('active');
      tabs[tabIdx].setAttribute('aria-selected', 'true');
      tabs[tabIdx].setAttribute('tabindex', '0');
    }
  }

  if (!skipHistory) {
    var pageName = isAdmin ? 'admin' : (_pageNames[i] || 'daily');
    var hash = '#' + pageName;
    var localePath = (typeof _urlLocale !== 'undefined' && _urlLocale) ? '/' + _urlLocale : '';
    var fullPath = localePath + hash;
    if (window.location.pathname + window.location.hash !== fullPath) {
      history.pushState({ page: i }, '', fullPath);
    }
  }

  // Sync mobile page index when desktop nav is used
  if(!isAdmin && typeof _currentMobilePage !== 'undefined') {
    _currentMobilePage = i;
  }
  if(!isAdmin && typeof updateMobileHeaderLabel === 'function') {
    updateMobileHeaderLabel(i);
  }

  /* Render the target page */
  if (isAdmin && typeof renderAdmin === 'function') renderAdmin();
  if (i === 0 && typeof renderDaily === 'function') renderDaily();
  if (i === 1) renderP0();
  if (i === 2) renderP1();
  if (i === 3) renderBranchPage();
  if (i === 4) renderHist();
}

// Handle browser back/forward buttons
window.addEventListener('popstate', function(e) {
  var page = 0;
  if (e.state && typeof e.state.page === 'number') {
    page = e.state.page;
  } else {
    var hash = window.location.hash.replace('#', '');
    if (hash === 'admin') { page = -1; }
    else {
      var idx = _pageNames.indexOf(hash);
      if (idx >= 0) page = idx;
    }
  }
  goPage(page, null, true);
});

// Restore page from hash on initial load
(function() {
  var hash = window.location.hash.replace('#', '');
  var isGto = (typeof _loggedId !== 'undefined' && _loggedId === 'gto');

  if (hash === 'admin' && isGto) {
    history.replaceState({ page: -1 }, '', '#admin');
    setTimeout(function() { goPage(-1, null, true); }, 200);
  } else if (hash) {
    var idx = _pageNames.indexOf(hash);
    if (idx > 0) {
      history.replaceState({ page: idx }, '', '#' + hash);
      setTimeout(function() { goPage(idx, null, true); }, 200);
    } else if (!hash || hash === 'daily') {
      // gto defaults to admin
      if (isGto) {
        history.replaceState({ page: -1 }, '', '#admin');
        setTimeout(function() { goPage(-1, null, true); }, 200);
      } else {
        history.replaceState({ page: 0 }, '', '#daily');
      }
    }
  } else {
    // No hash: gto → admin, others → daily
    if (isGto) {
      history.replaceState({ page: -1 }, '', '#admin');
      setTimeout(function() { goPage(-1, null, true); }, 200);
    } else {
      history.replaceState({ page: 0 }, '', '#daily');
    }
  }
})();

// ═══ MOBILE BOTTOM TAB NAVIGATION ═══
function mobileTabGo(i, btn) {
  _currentMobilePage = i;
  goPage(i, document.querySelectorAll('.ntab')[
    (typeof _loggedId !== 'undefined' && _loggedId === 'gto') ? i + 1 : i
  ]);
  // Update bottom nav active state
  document.querySelectorAll('#mobileBottomNav button').forEach(function(b, idx) {
    // Skip admin tab (first button if visible) — match by data or position
    if (b.id === 'mobileAdminTab') return;
    b.classList.remove('bnav-active');
  });
  if (btn) btn.classList.add('bnav-active');
  // Deactivate mobile admin tab
  var mAdm = document.getElementById('mobileAdminTab');
  if (mAdm) mAdm.classList.remove('bnav-active');
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Mobile app: render mobile-specific content
  if (typeof renderMobilePage === 'function') setTimeout(function(){ renderMobilePage(i); }, 100);
}

// Keyboard navigation for tabs — prevent page scrolling on arrow keys
document.querySelector('.nav-tabs').addEventListener('keydown', function(e) {
  var tabs = Array.from(document.querySelectorAll('.ntab:not([style*="display:none"])'));
  var idx = tabs.indexOf(document.activeElement);
  if (idx < 0) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); var next = (idx + 1) % tabs.length; tabs[next].focus(); tabs[next].click(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); var next = (idx + 1) % tabs.length; tabs[next].focus(); tabs[next].click(); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); var prev = (idx - 1 + tabs.length) % tabs.length; tabs[prev].focus(); tabs[prev].click(); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); var prev = (idx - 1 + tabs.length) % tabs.length; tabs[prev].focus(); tabs[prev].click(); return; }
});

/* ═══════════════════════════════════════
   KEYBOARD SHORTCUTS — Desktop power-user
   ═══════════════════════════════════════ */
var _shortcutsOverlay = null;

function _toggleShortcutsOverlay() {
  if (_shortcutsOverlay) {
    _shortcutsOverlay.remove();
    _shortcutsOverlay = null;
    return;
  }
  var isKo = (typeof _lang !== 'undefined' && _lang === 'ko');
  var overlay = document.createElement('div');
  overlay.id = 'shortcuts-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;animation:fadeIn .15s ease';

  var shortcuts = [
    { key: '1', desc: isKo ? '일일 현황' : 'Daily Overview' },
    { key: '2', desc: isKo ? '월간 현황' : 'Monthly Overview' },
    { key: '3', desc: isKo ? '에러 로그' : 'Error Log' },
    { key: '4', desc: isKo ? '지점별' : 'Branches' },
    { key: '5', desc: isKo ? '검색' : 'Search' },
    { key: 'R', desc: isKo ? '데이터 새로고침' : 'Refresh Data' },
    { key: 'L', desc: isKo ? '언어 전환 (EN/KO)' : 'Toggle Language' },
    { key: 'D', desc: isKo ? '다크모드 전환' : 'Toggle Dark Mode' },
    { key: 'E', desc: isKo ? '에러 제출 양식' : 'Submit Error Form' },
    { key: '?', desc: isKo ? '단축키 도움말' : 'Show Shortcuts' },
    { key: 'Esc', desc: isKo ? '닫기' : 'Close' }
  ];

  var rows = '';
  shortcuts.forEach(function(s) {
    rows += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">'
      + '<span style="color:rgba(255,255,255,0.85);font-size:14px;font-weight:500">' + s.desc + '</span>'
      + '<kbd style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:4px 10px;font-size:13px;font-weight:700;color:#fff;font-family:var(--f-mono);min-width:32px;text-align:center">' + s.key + '</kbd>'
      + '</div>';
  });

  overlay.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px 32px;width:380px;max-width:90vw;max-height:85vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.3)">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">'
    + '<div style="font-size:18px;font-weight:800;color:var(--t0);font-family:var(--f-display)">⌨️ ' + (isKo ? '키보드 단축키' : 'Keyboard Shortcuts') + '</div>'
    + '<button onclick="_toggleShortcutsOverlay()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--t2);padding:4px 8px;border-radius:6px;transition:background .15s" onmouseover="this.style.background=\'var(--hover)\'" onmouseout="this.style.background=\'none\'">×</button>'
    + '</div>'
    + rows
    + '<div style="margin-top:16px;text-align:center;font-size:11px;color:var(--t3)">' + (isKo ? '어디서든 ? 를 눌러 이 패널을 열 수 있습니다' : 'Press ? anywhere to toggle this panel') + '</div>'
    + '</div>';

  overlay.addEventListener('click', function(ev) {
    if (ev.target === overlay) _toggleShortcutsOverlay();
  });

  document.body.appendChild(overlay);
  _shortcutsOverlay = overlay;
}

// Global keyboard shortcuts listener
document.addEventListener('keydown', function(e) {
  // Don't fire when typing in inputs/textareas/selects
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
  // Don't fire with modifier keys (except Shift for ?)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  var key = e.key;

  // ? = toggle shortcuts overlay
  if (key === '?') { e.preventDefault(); _toggleShortcutsOverlay(); return; }

  // Escape = close overlay / close form modal
  if (key === 'Escape') {
    if (_shortcutsOverlay) { _toggleShortcutsOverlay(); return; }
    if (typeof closeFormModal === 'function') closeFormModal();
    return;
  }

  // If shortcuts overlay is open, block other shortcuts
  if (_shortcutsOverlay) return;

  // 1-5 = navigate pages
  if (key >= '1' && key <= '5') { e.preventDefault(); goPage(parseInt(key) - 1); return; }

  // R = refresh data
  if (key === 'r' || key === 'R') { e.preventDefault(); if (typeof reloadData === 'function') reloadData(); return; }

  // L = toggle language
  if (key === 'l' || key === 'L') { e.preventDefault(); if (typeof toggleLang === 'function') toggleLang(); return; }

  // D = toggle dark mode
  if (key === 'd' || key === 'D') { e.preventDefault(); if (typeof toggleTheme === 'function') toggleTheme(); return; }

  // E = open error submit form
  if (key === 'e' || key === 'E') { e.preventDefault(); if (typeof openFormModal === 'function') openFormModal(); return; }
});
