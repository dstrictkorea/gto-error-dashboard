'use strict';

var G={logs:[],history:[],assets:[],meta:{}}, curBranch='ALL', _timer=null;
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var NOW=new Date(), CY=NOW.getFullYear(), CM=NOW.getMonth();

/* ── Branch / Region Registry (Frontend) ── */
var BR_NAMES={AMGN:'Gangneung',AMYS:'Yeosu',AMBS:'Busan',AMJJ:'Jeju',AMNY:'New York',AMLV:'Las Vegas',AMDB:'Dubai'};
var BR_COLORS_MAP={AMGN:'#0891b2',AMYS:'#059669',AMBS:'#2563eb',AMJJ:'#7c3aed',AMNY:'#185FA5',AMLV:'#993C1D',AMDB:'#534AB7'};
var BR_REGIONS={AMGN:'Korea',AMYS:'Korea',AMBS:'Korea',AMJJ:'Korea',AMNY:'Global',AMLV:'Global',AMDB:'Global'};
var KOREA_BRANCHES=['AMGN','AMYS','AMBS','AMJJ'];
var GLOBAL_BRANCHES=['AMNY','AMLV','AMDB'];
var ALL_BRANCHES=KOREA_BRANCHES.concat(GLOBAL_BRANCHES);

/* Current region toggle state: 'korea' or 'global' */
/* URL-based locale: /kr → Korea+한글, /en → Global+English, / → Global+English */
var _urlLocale = (function(){
  var p = location.pathname.toLowerCase();
  if (p === '/kr') return 'kr';
  if (p === '/en') return 'en';
  return '';
})();
var _region = (_urlLocale === 'kr') ? 'korea' : 'global';
function getRegionBranches(){return _region==='korea'?KOREA_BRANCHES:GLOBAL_BRANCHES;}
function toggleRegion(r){
  _region=r||(_region==='korea'?'global':'korea');
  localStorage.setItem('region',_region);
  if(typeof curBranch!=='undefined') curBranch='ALL';
  if(typeof _dailyBranch!=='undefined') _dailyBranch=(_region==='korea'?'AMGN':'AMNY');
  document.querySelectorAll('.region-btn[data-region]').forEach(function(b){
    b.classList.toggle('active',b.dataset.region===_region);
  });
  var ap=document.querySelector('.page.active');
  if(ap){
    if(ap.id==='pd'&&typeof renderDaily==='function') renderDaily();
    else if(ap.id==='p0'&&typeof renderP0==='function') renderP0();
    else if(ap.id==='p2'&&typeof renderBranchPage==='function') renderBranchPage();
  }
}

// Sync region toggle buttons with _region on page load
(function(){
  function syncRegionBtns(){
    document.querySelectorAll('.region-btn[data-region]').forEach(function(b){
      b.classList.toggle('active', b.dataset.region === _region);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', syncRegionBtns);
  else setTimeout(syncRegionBtns, 50);
})();

function el(id){return document.getElementById(id)}
function unique(a){
  // case-insensitive dedup: keep first occurrence's casing
  var seen={},out=[];
  a.filter(Boolean).forEach(function(v){var k=v.toLowerCase();if(!seen[k]){seen[k]=1;out.push(v)}});
  return out;
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function debounce(fn,ms){var t;return function(){clearTimeout(t);t=setTimeout(fn,ms||300);}}
function throttle(fn,ms){var last=0;return function(){var now=Date.now();if(now-last>=ms){fn();last=now}}}
function brBadge(b){return'<span class="bp bp-'+b.toLowerCase()+'">'+b+'</span>'}
function catBadge(c){return({Software:'<span class="cat-sw">SW</span>',Hardware:'<span class="cat-hw">HW</span>',Network:'<span class="cat-net">Net</span>'}[c]||'<span class="cat-sw">'+esc(c)+'</span>')}
function catFull(c){var ko=typeof _lang!=='undefined'&&_lang==='ko';return({Software:'<span class="cat-sw">'+(ko?'소프트웨어':'Software')+'</span>',Hardware:'<span class="cat-hw">'+(ko?'하드웨어':'Hardware')+'</span>',Network:'<span class="cat-net">'+(ko?'네트워크':'Network')+'</span>'}[c]||esc(c))}
function tmBadge(t){return t&&t.indexOf('15')>=0?'<span class="tm-fast">'+esc(t)+'</span>':'<span class="tm-slow">'+(esc(t)||'\u2014')+'</span>'}
function stars(n){n=Math.min(5,Math.max(1,n||1));return'<span class="diff-stars" style="color:#f59e0b">'+'\u2605'.repeat(n)+'</span><span class="diff-stars" style="color:#e2e8f0">'+'\u2605'.repeat(5-n)+'</span>'}
var _toastTimeoutUtils=null;
function pulse(){var b=el('refresh-bar');if(!b)return;b.classList.remove('active');requestAnimationFrame(function(){b.classList.add('active')})}
function toast(m,t){var e=el('toast');if(!e)return;if(_toastTimeoutUtils){clearTimeout(_toastTimeoutUtils);_toastTimeoutUtils=null;}e.setAttribute('role','alert');e.setAttribute('aria-live','assertive');e.textContent=m;e.className='show '+(t||'');_toastTimeoutUtils=setTimeout(function(){e.className='';_toastTimeoutUtils=null},2800)}
function getByMonth(m,y){return G.logs.filter(function(r){var d=new Date(r.Date);return d.getMonth()===m&&d.getFullYear()===y})}
function getByBranch(b){return G.logs.filter(function(r){return r.Branch===b}).sort(function(a,c){return new Date(c.Date)-new Date(a.Date)})}

