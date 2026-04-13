'use strict';

const express = require('express');

// ══════════════════════════════════════════════
//  AI Comment — All Difficulty Levels Auto-Analysis (v4.1)
//  ✅ Free API 3: Gemini 2.5 (Google), Groq (Llama), Mistral
// ══════════════════════════════════════════════
const AI_CFG = {
  gemini: {
    key: process.env.GEMINI_KEY || '',
    model: 'gemini-2.5-flash',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    label: 'Gemini 2.5 Flash',
  },
  groq: {
    key: process.env.GROQ_KEY || '',
    model: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    label: 'Llama 3.3 70B (Groq)',
  },
  mistral: {
    key: process.env.MISTRAL_KEY || '',
    model: 'mistral-small-latest',
    url: 'https://api.mistral.ai/v1/chat/completions',
    label: 'Mistral Small (Free)',
  },
};
AI_CFG.enabled = !!(AI_CFG.gemini.key || AI_CFG.groq.key || AI_CFG.mistral.key);

function buildAIPrompt(incident, assets, history, lang) {
  const isKo = lang === 'ko';
  const langInstruction = isKo ? '\n\nIMPORTANT: Write ALL output in Korean (한국어). Section headers (Root Cause, Immediate Action, etc.) must stay in English but ALL bullet content must be in Korean.' : '';
  return `You are a senior AV/IT field engineer at d'strict (immersive media installations running 12+ hrs/day).${langInstruction}

FIELD CODES: "pj"=Projector, Device naming: ZONE-SURFACE-DEVICE-NUMBER (e.g. T-t-pc-006), Surface: W=Wall F=Floor T=Table C=Ceiling

INCIDENT: ${incident.Branch} | ${incident.Zone} | ${incident.Category} | Diff ${incident.Difficulty}/5
Issue: ${incident.IssueDetail}
Action: ${incident.ActionTaken}
By: ${incident.SolvedBy} | Duration: ${incident.TimeTaken}
${assets.length ? '\nEQUIPMENT: ' + assets.map(a => a.Name + ' (' + a.Maker + ' ' + a.Model + ') [' + (a.Spec||'N/A') + ']').join(', ') : ''}
${history.length ? '\nPAST CASES:\n' + history.slice(0,3).map((h,i) => (i+1) + '. [' + h.zone + '] ' + h.detail + ' → ' + h.action).join('\n') : ''}

FORMAT RULES (STRICT — follow exactly):
- Use bullet points (•) for EVERY item within each section.
- Each bullet: 1 specific, actionable sentence. No filler, no generic advice.
- 2-4 bullets per section. Reference device codes, zone names, equipment models.
- Skip "Equipment Note" if no equipment data above. Skip "Pattern Alert" if no past cases above.

Root Cause:
• [What component/subsystem failed — be specific to this zone and device]
• [Why it failed — technical root cause at hardware/software/config level]

Immediate Action:
• [Step 1: specific physical check, command, or setting to verify]
• [Step 2: concrete fix — include menu paths, firmware commands, cable specs where applicable]
• [Step 3: validation step to confirm resolution]

Prevention:
• [Specific preventive measure — maintenance interval, firmware version, config change]
• [Monitoring threshold or automated check to catch early]

Equipment Note:
• [Model-specific known issue for this exact model in 12+ hr operation]
• [Recommended firmware version or optimal setting]

Pattern Alert:
• [Recurrence frequency and pattern across zones/dates if past cases exist]
• [Whether this needs systemic fix or is isolated — "First occurrence — document and monitor" if no past cases]`;
}


// ── AI fetch with timeout ──
const AI_TIMEOUT = 30000; // 30 seconds per AI call
async function aiFetch(url, opts) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), AI_TIMEOUT);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    return r;
  } finally { clearTimeout(id); }
}

// ── Gemini (Google AI Studio Free) ──
async function callGemini(prompt) {
  if (!AI_CFG.gemini.key) return null;
  const r = await aiFetch(`${AI_CFG.gemini.url}?key=${AI_CFG.gemini.key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
    })
  });
  if (!r.ok) { const msg = `Gemini: HTTP ${r.status}`; console.error(`[AI] ${msg}`); throw new Error(msg); }
  const d = await r.json();
  if (d.error) { const msg = `Gemini: ${d.error.message}`; console.error(`[AI] ${msg}`); throw new Error(msg); }
  return d.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ── Groq (Llama 3.3 70B Free) ──
async function callGroq(prompt) {
  if (!AI_CFG.groq.key) return null;
  const r = await aiFetch(AI_CFG.groq.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_CFG.groq.key}` },
    body: JSON.stringify({
      model: AI_CFG.groq.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500, temperature: 0.3
    })
  });
  if (!r.ok) { const msg = `Groq: HTTP ${r.status}`; console.error(`[AI] ${msg}`); throw new Error(msg); }
  const d = await r.json();
  if (d.error) { const msg = `Groq: ${d.error.message}`; console.error(`[AI] ${msg}`); throw new Error(msg); }
  return d.choices?.[0]?.message?.content || null;
}

// ── Mistral (Free tier — unlimited models) ──
async function callMistral(prompt) {
  if (!AI_CFG.mistral.key) return null;
  const r = await aiFetch(AI_CFG.mistral.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_CFG.mistral.key}` },
    body: JSON.stringify({
      model: AI_CFG.mistral.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500, temperature: 0.3
    })
  });
  if (!r.ok) { const msg = `Mistral: HTTP ${r.status}`; console.error(`[AI] ${msg}`); throw new Error(msg); }
  const d = await r.json();
  if (d.error) { const msg = `Mistral: ${d.error.message||d.error}`; console.error(`[AI] ${msg}`); throw new Error(msg); }
  return d.choices?.[0]?.message?.content || null;
}

// Create Express router for AI routes
const router = express.Router();

// ── Best-of-N selection: parse and score each AI response ──
function parseAIResponse(text) {
  if (!text) return null;
  // Clean markdown bold, numbered prefixes
  const lines = text.replace(/\*\*/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  let root = [], action = [], prevent = [], equipment = [], pattern = [];

  // Accumulate bullets per section
  let currentField = null;
  for (const l of lines) {
    const lo = l.replace(/^(line\s*\d+:\s*)/i, '');
    // Detect section headers
    if (/^root\s*cause\s*:/i.test(lo)) {
      currentField = 'root';
      const rest = lo.replace(/^root\s*cause\s*:\s*/i, '').trim();
      if (rest && rest.length > 3) root.push(cleanBullet(rest));
    } else if (/^immediate\s*action\s*:/i.test(lo)) {
      currentField = 'action';
      const rest = lo.replace(/^immediate\s*action\s*:\s*/i, '').trim();
      if (rest && rest.length > 3) action.push(cleanBullet(rest));
    } else if (/^prevention\s*:/i.test(lo)) {
      currentField = 'prevent';
      const rest = lo.replace(/^prevention\s*:\s*/i, '').trim();
      if (rest && rest.length > 3) prevent.push(cleanBullet(rest));
    } else if (/^equipment\s*note\s*:/i.test(lo)) {
      currentField = 'equipment';
      const rest = lo.replace(/^equipment\s*note\s*:\s*/i, '').trim();
      if (rest && rest.length > 3) equipment.push(cleanBullet(rest));
    } else if (/^pattern\s*alert\s*:/i.test(lo)) {
      currentField = 'pattern';
      const rest = lo.replace(/^pattern\s*alert\s*:\s*/i, '').trim();
      if (rest && rest.length > 3) pattern.push(cleanBullet(rest));
    } else if (currentField && l.length > 3) {
      // Bullet or continuation line → push to current field
      const bullet = cleanBullet(l);
      if (bullet.length > 3) {
        if (currentField === 'root') root.push(bullet);
        else if (currentField === 'action') action.push(bullet);
        else if (currentField === 'prevent') prevent.push(bullet);
        else if (currentField === 'equipment') equipment.push(bullet);
        else if (currentField === 'pattern') pattern.push(bullet);
      }
    }
  }

  // Convert arrays to bullet-string format: "• line1\n• line2"
  const toBullets = arr => arr.map(s => '• ' + s).join('\n');

  // Fallback if no sections parsed
  if (!root.length && !action.length && !prevent.length) {
    const fallback = lines.filter(l => l.length > 10).slice(0, 3);
    if (fallback.length >= 1) root = [cleanBullet(fallback[0])];
    if (fallback.length >= 2) action = [cleanBullet(fallback[1])];
    if (fallback.length >= 3) prevent = [cleanBullet(fallback[2])];
  }

  return {
    root: toBullets(root),
    action: toBullets(action),
    prevent: toBullets(prevent),
    equipment: toBullets(equipment),
    pattern: toBullets(pattern)
  };
}

// Strip bullet prefixes (•, -, *, numbered) for uniform re-formatting
function cleanBullet(s) {
  return s.replace(/^[\u2022\u2023\u25E6\-\*]\s*/, '')
          .replace(/^\d+[\.\)]\s*/, '')
          .trim();
}

function scoreResponse(parsed) {
  if (!parsed) return 0;
  let s = 0;
  // Count bullets per section (• delimited)
  const countBullets = str => (str || '').split('\n').filter(l => l.startsWith('•')).length;
  // Core 3 fields — reward bullet count + length
  const rb = countBullets(parsed.root), ab = countBullets(parsed.action), pb = countBullets(parsed.prevent);
  if (rb >= 2) s += 4; else if (rb >= 1) s += 2;
  if (ab >= 2) s += 4; else if (ab >= 1) s += 2;
  if (pb >= 2) s += 4; else if (pb >= 1) s += 2;
  // Bonus for optional fields
  if (countBullets(parsed.equipment) >= 1) s += 2;
  if (countBullets(parsed.pattern) >= 1) s += 2;
  // Bonus for specificity
  const all = [parsed.root, parsed.action, parsed.prevent, parsed.equipment||'', parsed.pattern||''].join(' ').toLowerCase();
  if (/pc[\.\s]?\d{3}|pj|led|hdmi|nuc|unreal/i.test(all)) s += 2;
  if (/restart|reboot|replace|update|firmware|check|config/i.test(all)) s += 1;
  if (/firmware\s*(v|version)?[\d\.]+|bios|driver|f\/w/i.test(all)) s += 2;
  if (/manufacturer|model|spec|datasheet/i.test(all)) s += 1;
  if (/recur|pattern|systemic|frequency|repeat/i.test(all)) s += 1;
  // Penalty for too short
  if (all.length < 80) s -= 4;
  return s;
}

function selectBestResponse(rawResponses) {
  // rawResponses: [{name, text}]
  const valid = rawResponses.filter(r => r.text && r.text.length > 20);
  if (valid.length === 0) return { best: null, source: 'none', count: 0 };

  const scored = valid.map(r => {
    const parsed = parseAIResponse(r.text);
    return { ...r, parsed, score: scoreResponse(parsed) };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  return {
    best: best.parsed,
    source: best.name,
    count: valid.length,
    rawBest: best.text
  };
}

// POST /api/ai-comment — AI Analysis (best-of-N selection)
router.post('/ai-comment', async (req, res) => {
  if (!AI_CFG.enabled) {
    return res.json({ enabled: false,
      message: 'AI API keys not configured -- add free keys to .env',
      result: null,
      guide: {
        gemini: 'https://aistudio.google.com/apikey',
        groq: 'https://console.groq.com',
        mistral: 'https://console.mistral.ai/api-keys'
      }
    });
  }
  try {
    const { incident, assets, history, lang } = req.body;
    if (!incident) return res.status(400).json({ error: 'incident data required' });

    const prompt = buildAIPrompt(incident, assets || [], history || [], lang || 'en');
    const activeAI = [
      AI_CFG.gemini.key ? 'Gemini' : null,
      AI_CFG.groq.key ? 'Groq' : null,
      AI_CFG.mistral.key ? 'Mistral' : null
    ].filter(Boolean);
    console.log(`[AI] ${new Date().toISOString()} — Analysis: ${incident.Branch} ${incident.Zone} Diff=${incident.Difficulty} providers=${activeAI.join(',')}`);

    const [gem, grq, mst] = await Promise.allSettled([
      callGemini(prompt), callGroq(prompt), callMistral(prompt)
    ]);

    const rawResponses = [
      { name: 'Gemini', text: gem.status === 'fulfilled' ? gem.value : null },
      { name: 'Groq', text: grq.status === 'fulfilled' ? grq.value : null },
      { name: 'Mistral', text: mst.status === 'fulfilled' ? mst.value : null },
    ].filter(r => r.text);

    if (rawResponses.length === 0) {
      const errors = [gem, grq, mst].map((r,i) => r.status === 'rejected' ? `${['Gemini','Groq','Mistral'][i]}: ${r.reason?.message||'failed'}` : null).filter(Boolean);
      console.warn('All AI providers failed:', errors.join(', '));
      return res.json({ enabled: true, result: { root: 'All AI providers failed to respond. Please check API keys and try again.', action: '', prevent: '' }, source: 'none', aiCount: 0, models: activeAI });
    }
    const selection = selectBestResponse(rawResponses);

    console.log(`AI Analysis: ${rawResponses.length} responses received, best=${selection.source}`);
    res.json({
      enabled: true,
      result: selection.best,
      source: selection.source,
      aiCount: selection.count,
      models: activeAI
    });
  } catch (e) {
    console.error('[AI] /ai-comment error:', e.message);
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

// POST /api/asset-ai — Equipment AI Spec Search
router.post('/asset-ai', async (req, res) => {
  if (!AI_CFG.enabled) {
    return res.status(200).json({ error: 'AI API keys not configured. Add keys to .env file.' });
  }
  try {
    const { asset, incident } = req.body;
    if (!asset || !incident) return res.status(400).json({ error: 'asset + incident required' });

    const prompt = `You are an AV/IT equipment specialist at d'strict (immersive installations, 12+ hr/day operation).

EQUIPMENT: ${asset.Name} — ${asset.Maker} ${asset.Model} [Spec: ${asset.Spec || 'N/A'}] [Status: ${asset.Status}]
INCIDENT: ${incident.Branch} | ${incident.Zone} | ${incident.Category}
Issue: ${incident.IssueDetail}
Action: ${incident.ActionTaken || 'N/A'}

FORMAT: Use bullet points (•) for EVERY item. 2-3 bullets per section. Be specific to ${asset.Model} — no generic advice.

KNOWN ISSUES:
• [Known problem for ${asset.Model} related to this issue — include affected firmware versions]
• [Second known issue if applicable]

MANUFACTURER FIX:
• [Specific fix — include menu path, firmware version, or command]
• [Alternative fix if first fails]

OPTIMAL SETTINGS:
• [Key setting for 12+ hr continuous operation — power management, auto-recovery]
• [Additional recommended setting]

MAINTENANCE:
• [Specific maintenance interval and procedure for this model]

ESCALATION:
• [Next step if standard fix fails — ${asset.Maker} support procedure, RMA process]`;

    console.log(`[AI] ${new Date().toISOString()} — Asset AI: ${asset.Maker} ${asset.Model} issue=${String(incident.IssueDetail||'').slice(0,40)}`);

    const [gem, grq] = await Promise.allSettled([
      callGemini(prompt), callGroq(prompt)
    ]);

    const results = {
      gemini: gem.status === 'fulfilled' ? gem.value : null,
      groq:   grq.status === 'fulfilled' ? grq.value : null,
    };
    console.log(`Asset AI: Gemini=${!!results.gemini}, Groq=${!!results.groq}`);
    res.json(results);
  } catch (e) {
    console.error('Asset AI error:', e.message);
    res.status(500).json({ error: 'Asset AI analysis failed. Check server logs.' });
  }
});

// ══════════════════════════════════════════════
//  POST /api/translate — Batch EN→KO AI translation
//  Collects unique English strings and returns natural Korean
// ══════════════════════════════════════════════
const _trCache = new Map();   // server-side cache: EN→KO

router.post('/translate', async (req, res) => {
  if (!AI_CFG.enabled) {
    return res.json({ ok: false, translations: {}, message: 'AI API keys not configured' });
  }
  try {
    const { texts } = req.body;   // string[]
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ ok: false, error: 'texts array required' });
    }

    // 1) Filter: skip empty, already cached
    const unique = [...new Set(texts.map(t => (t||'').trim()).filter(Boolean))];
    const result = {};
    const toTranslate = [];

    for (const t of unique) {
      if (_trCache.has(t.toLowerCase())) {
        result[t] = _trCache.get(t.toLowerCase());
      } else {
        toTranslate.push(t);
      }
    }

    // 2) If nothing to translate, return cached
    if (toTranslate.length === 0) {
      return res.json({ ok: true, translations: result, cached: unique.length, translated: 0 });
    }

    // 3) Chunk into batches of 60 to stay within token limits
    const CHUNK = 60;
    const chunks = [];
    for (let i = 0; i < toTranslate.length; i += CHUNK) {
      chunks.push(toTranslate.slice(i, i + CHUNK));
    }

    console.log(`[AI] ${new Date().toISOString()} — Translate: ${toTranslate.length} strings in ${chunks.length} batch(es)`);

    for (const chunk of chunks) {
      const numbered = chunk.map((t, i) => `${i + 1}. ${t}`).join('\n');
      const prompt = `You are a professional EN→KO translator for a d'strict AV/IT facility operations dashboard.
Context: These are error descriptions, action logs, and HQ comments from immersive media installations (LED walls, projectors, media servers, etc.) across global branches (Dubai, New York, Las Vegas).

RULES:
- Translate each line into natural, professional Korean (한국어)
- Keep proper nouns, device codes (e.g. T-w-pj-001), zone names, and model numbers as-is
- Keep abbreviations like BMS, HDMI, PC, LED, IP as-is
- Use AV/IT industry standard Korean terminology
- Be concise — match the original tone (error report style, not conversational)
- Output ONLY a JSON object mapping the original English text to Korean translation
- No markdown, no explanation, just pure JSON

TEXTS TO TRANSLATE:
${numbered}

OUTPUT FORMAT (pure JSON, no markdown):
{"original english 1":"한국어 번역 1","original english 2":"한국어 번역 2"}`;

      // Try Gemini first (best for structured output), fallback to Groq
      let jsonText = null;
      try {
        jsonText = await callGemini(prompt);
      } catch (e) {
        console.warn('Translate Gemini failed:', e.message);
      }
      if (!jsonText) {
        try {
          jsonText = await callGroq(prompt);
        } catch (e) {
          console.warn('Translate Groq failed:', e.message);
        }
      }
      if (!jsonText) {
        try {
          jsonText = await callMistral(prompt);
        } catch (e) {
          console.warn('Translate Mistral failed:', e.message);
        }
      }

      // 4) Parse JSON from AI response
      if (jsonText) {
        try {
          // Strip markdown code fences if present
          let cleaned = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          // Find the JSON object
          const jsonStart = cleaned.indexOf('{');
          const jsonEnd = cleaned.lastIndexOf('}');
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
          }
          const parsed = JSON.parse(cleaned);
          for (const [en, ko] of Object.entries(parsed)) {
            if (typeof ko === 'string' && ko.length > 0) {
              result[en] = ko;
              _trCache.set(en.toLowerCase(), ko);
            }
          }
        } catch (parseErr) {
          console.warn('Translate JSON parse error:', parseErr.message);
          // Try line-by-line fallback: "1. english" → "1. korean"
          const lines = jsonText.split('\n').filter(l => l.trim());
          for (let li = 0; li < Math.min(lines.length, chunk.length); li++) {
            const line = lines[li].replace(/^\d+[\.\)]\s*/, '').trim();
            if (line && line.length > 0 && chunk[li]) {
              result[chunk[li]] = line;
              _trCache.set(chunk[li].toLowerCase(), line);
            }
          }
        }
      }
    }

    console.log(`✅ Translate: ${Object.keys(result).length} / ${unique.length} strings translated`);
    res.json({ ok: true, translations: result, cached: unique.length - toTranslate.length, translated: toTranslate.length });

  } catch (e) {
    console.error('[AI] /translate error:', e.message);
    res.status(500).json({ ok: false, error: 'Translation failed. Please try again.' });
  }
});

module.exports = { AI_CFG, buildAIPrompt, callGemini, callGroq, callMistral, router };
