'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/router.js
//  v2 PDF endpoints. Mounted by server.js at /api/v2.
//  Currently exposes only the smoke-test route; monthly/annual
//  endpoints will land here as the rebuild progresses.
//
//  Design notes:
//    · Returns application/pdf bytes directly (not JSON+base64).
//      The existing frontend uses base64; v2 consumers can decide,
//      but this makes the endpoint curl/browser-friendly for dev.
//    · `?download=1` flips Content-Disposition to attachment.
//    · All routes are GET for trivial dev testing and have a small
//      server-side rate budget via the app-level rate limiter.
// ══════════════════════════════════════════════════════════════════

const express = require('express');
const { renderPdf } = require('./renderer');
const { buildSmokeContext } = require('./context');

const router = express.Router();

// ── /api/v2/smoke ─────────────────────────────────────────────────
router.get('/smoke', async (req, res) => {
  const t0 = Date.now();
  try {
    const lang = req.query.lang === 'ko' ? 'ko' : 'en';
    const download = req.query.download === '1' || req.query.download === 'true';

    const ctx = buildSmokeContext({ lang });
    const pdf = await renderPdf({ template: 'smoke', data: ctx });

    const fileName = `smoke-v2-${lang}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${fileName}"`
    );
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('X-Render-ms', String(Date.now() - t0));
    res.end(pdf);
  } catch (e) {
    console.error('[v2/smoke] render error:', e);
    res.status(500).json({ error: 'v2 smoke render failed', detail: e.message });
  }
});

// ── /api/v2/health ─────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ ok: true, system: 'reports-v2', ts: new Date().toISOString() });
});

module.exports = router;
