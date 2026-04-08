'use strict';

// ══════════════════════════════════════════════
//  CONFIG — Azure AD + SharePoint
// ══════════════════════════════════════════════
const C = {
  tenant:   process.env.AZURE_TENANT   || '',
  clientId: process.env.AZURE_CLIENT_ID || '',
  secret:   process.env.AZURE_SECRET    || '',
  driveId:  process.env.SP_DRIVE_ID     || '',
  fileId:   process.env.SP_FILE_ID      || '',
  sheets: {
    hq: process.env.SP_SHEET_HQ || 'Table_HQ',
    history: process.env.SP_SHEET_HISTORY || 'Past_History',
    assets: process.env.SP_SHEET_ASSETS || 'Asset_List',
    summary: process.env.SP_SHEET_SUMMARY || 'Table_Summary'
  }
};

// ══════════════════════════════════════════════
//  Startup validation — warn about missing config
// ══════════════════════════════════════════════
function validateConfig() {
  const errors = [];
  const warnings = [];
  // Required Azure/SharePoint config
  if (!C.tenant)   errors.push('AZURE_TENANT is missing');
  if (!C.clientId)  errors.push('AZURE_CLIENT_ID is missing');
  if (!C.secret)    errors.push('AZURE_SECRET is missing — SharePoint API will fail');
  if (!C.driveId)   errors.push('SP_DRIVE_ID is missing');
  if (!C.fileId)    errors.push('SP_FILE_ID is missing');
  // Warnings
  if (!process.env.APP_PASSWORD || process.env.APP_PASSWORD === '1234')
    warnings.push('APP_PASSWORD is default (1234) — change for production');
  if (!process.env.GEMINI_KEY && !process.env.GROQ_KEY && !process.env.MISTRAL_KEY)
    warnings.push('No AI API keys set — AI analysis will be disabled');
  if (errors.length) {
    console.error('\n❌ Configuration errors (check .env file):');
    errors.forEach(e => console.error('   • ' + e));
    console.error('');
  }
  if (warnings.length) {
    console.warn('\n⚠️  Configuration warnings:');
    warnings.forEach(w => console.warn('   • ' + w));
    console.warn('');
  }
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const BR_NAMES = {
  AMGN:'Gangneung', AMYS:'Yeosu', AMBS:'Busan', AMJJ:'Jeju',
  AMNY:'New York', AMLV:'Las Vegas', AMDB:'Dubai'
};
const BR_COLORS = {
  AMGN:'#0891b2', AMYS:'#059669', AMBS:'#2563eb', AMJJ:'#7c3aed',
  AMNY:'#185FA5', AMLV:'#993C1D', AMDB:'#534AB7'
};
const BR_REGIONS = {
  AMGN:'Korea', AMYS:'Korea', AMBS:'Korea', AMJJ:'Korea',
  AMNY:'Global', AMLV:'Global', AMDB:'Global'
};
const KOREA_BRANCHES = ['AMGN','AMYS','AMBS','AMJJ'];
const GLOBAL_BRANCHES = ['AMNY','AMLV','AMDB'];
const ALL_BRANCHES = KOREA_BRANCHES.concat(GLOBAL_BRANCHES);

module.exports = { C, MONTHS_EN, BR_NAMES, BR_COLORS, BR_REGIONS, KOREA_BRANCHES, GLOBAL_BRANCHES, ALL_BRANCHES, validateConfig };
