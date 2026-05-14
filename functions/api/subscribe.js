// POST /api/subscribe
// Receives email + name + company + position + gift_type + source_path
// Saves to D1, returns 200 with unlock token + download URL
//
// Single-opt-in: no confirmation email sent. Data stored for later CSV export.

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS: same-origin only on production; allow during local dev
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = origin.startsWith('https://plai-ai.com') || origin.startsWith('http://localhost') || origin === '' ? origin : null;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400, allowedOrigin);
  }

  const email     = (body.email     || '').trim().toLowerCase();
  const name      = (body.name      || '').trim();
  const company   = (body.company   || '').trim();
  const position  = (body.position  || '').trim();
  const giftType  = (body.gift_type || '').trim();
  const source    = (body.source_path || '').trim().slice(0, 255);
  const consent   = body.consent_newsletter === 1 || body.consent_newsletter === true || body.consent_newsletter === '1' ? 1 : 0;

  // Basic validation — all 4 user fields required + consent required
  if (!isValidEmail(email))              return jsonResponse({ ok: false, error: 'invalid_email' }, 400, allowedOrigin);
  if (!name || name.length > 100)        return jsonResponse({ ok: false, error: 'invalid_name' }, 400, allowedOrigin);
  if (!company || company.length > 200)  return jsonResponse({ ok: false, error: 'invalid_company' }, 400, allowedOrigin);
  if (!position || position.length > 100) return jsonResponse({ ok: false, error: 'invalid_position' }, 400, allowedOrigin);
  if (consent !== 1)                     return jsonResponse({ ok: false, error: 'consent_required' }, 400, allowedOrigin);
  if (!['article_continue', 'obsidian_vault'].includes(giftType))
                                         return jsonResponse({ ok: false, error: 'invalid_gift_type' }, 400, allowedOrigin);

  const id = crypto.randomUUID();
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ua = (request.headers.get('User-Agent') || '').slice(0, 500);

  try {
    await env.DB.prepare(
      `INSERT INTO submissions (id, email, name, company, position, gift_type, source_path, ip, user_agent, consent_newsletter)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    ).bind(id, email, name, company, position, giftType, source || null, ip || null, ua || null, consent).run();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'db_error', detail: String(e).slice(0, 200) }, 500, allowedOrigin);
  }

  // Return unlock info — client-side reveals content or shows download link
  const payload = {
    ok: true,
    submission_id: id,
    gift_type: giftType,
    download_url: giftType === 'obsidian_vault' ? '/decks/obsidian-vault-template.html' : null,
    unlock: true,
  };
  return jsonResponse(payload, 200, allowedOrigin);
}

export function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  const allowedOrigin = origin.startsWith('https://plai-ai.com') || origin.startsWith('http://localhost') ? origin : '';
  return new Response(null, {
    status: 204,
    headers: corsHeaders(allowedOrigin),
  });
}

function isValidEmail(s) {
  return typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function corsHeaders(allowedOrigin) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (allowedOrigin) h['Access-Control-Allow-Origin'] = allowedOrigin;
  return h;
}

function jsonResponse(obj, status, allowedOrigin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(allowedOrigin || ''),
    },
  });
}
