// POST /api/contact
// 1. Validates the contact form
// 2. Saves the inquiry to D1 (contacts table) — durable record even if email delivery fails
// 3. Sends a notification email to jiuhuot10@gmail.com via Resend
// 4. Sends a thank-you auto-reply to the inquirer (best-effort)

const ADMIN_EMAIL = 'jiuhuot10@gmail.com';
const ADMIN_NAME  = '株式会社PLai';
const SITE = 'https://plai-ai.com';

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = origin.startsWith('https://plai-ai.com') || origin.startsWith('http://localhost') || origin === '' ? origin : null;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400, allowedOrigin);
  }

  const name     = (body.name     || '').trim();
  const company  = (body.company  || '').trim();
  const email    = (body.email    || '').trim().toLowerCase();
  const phone    = (body.phone    || '').trim();
  const message  = (body.message  || '').trim();
  const budget   = (body.budget   || '').trim();
  const services = Array.isArray(body.services) ? body.services.map(s => String(s).trim()).filter(Boolean) : [];
  const slots    = Array.isArray(body.candidate_slots) ? body.candidate_slots.map(s => String(s).trim()).filter(Boolean) : [];
  const honey    = (body._honey || '').trim();

  if (honey)                              return jsonResponse({ ok: true, skipped: true }, 200, allowedOrigin); // silent honeypot
  if (!name || name.length > 100)         return jsonResponse({ ok: false, error: 'invalid_name' }, 400, allowedOrigin);
  if (!isValidEmail(email))               return jsonResponse({ ok: false, error: 'invalid_email' }, 400, allowedOrigin);
  if (!message || message.length > 5000)  return jsonResponse({ ok: false, error: 'invalid_message' }, 400, allowedOrigin);
  if (company.length > 200)               return jsonResponse({ ok: false, error: 'invalid_company' }, 400, allowedOrigin);
  if (phone.length > 50)                  return jsonResponse({ ok: false, error: 'invalid_phone' }, 400, allowedOrigin);
  if (budget.length > 100)                return jsonResponse({ ok: false, error: 'invalid_budget' }, 400, allowedOrigin);
  if (services.length > 20)               return jsonResponse({ ok: false, error: 'invalid_services' }, 400, allowedOrigin);
  if (slots.length > 10)                  return jsonResponse({ ok: false, error: 'invalid_slots' }, 400, allowedOrigin);

  const id = crypto.randomUUID();
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ua = (request.headers.get('User-Agent') || '').slice(0, 500);
  const servicesStr = services.join(', ');
  const slotsStr    = slots.join(' / ');

  try {
    await env.DB.prepare(
      `INSERT INTO contacts (id, name, company, email, phone, services, budget, message, candidate_slots, ip, user_agent)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    ).bind(id, name, company || null, email, phone || null, servicesStr || null, budget || null, message, slotsStr || null, ip || null, ua || null).run();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'db_error', detail: String(e).slice(0, 200) }, 500, allowedOrigin);
  }

  // Notify admin (jiuhuot10@gmail.com) — high priority
  let adminNotified = false;
  let adminError = null;
  try {
    await sendAdminNotification({ id, name, company, email, phone, services, budget, message, slots, ip, env });
    adminNotified = true;
    try {
      await env.DB.prepare(`UPDATE contacts SET notified = 1 WHERE id = ?1`).bind(id).run();
    } catch (_) { /* non-fatal */ }
  } catch (e) {
    adminError = String(e).slice(0, 200);
    console.log('admin_notify_error', adminError);
  }

  // Auto-reply to user — best-effort
  let replySent = false;
  try {
    await sendAutoReply({ name, company, email, env });
    replySent = true;
  } catch (e) {
    console.log('auto_reply_error', String(e).slice(0, 200));
  }

  return jsonResponse({
    ok: true,
    submission_id: id,
    admin_notified: adminNotified,
    admin_error: adminError,
    auto_reply_sent: replySent,
  }, 200, allowedOrigin);
}

export function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  const allowedOrigin = origin.startsWith('https://plai-ai.com') || origin.startsWith('http://localhost') ? origin : '';
  return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
}

/* ---------------------------- Email senders ---------------------------- */

async function sendAdminNotification({ id, name, company, email, phone, services, budget, message, slots, ip, env }) {
  if (!env || !env.RESEND_API_KEY) {
    throw new Error('resend_api_key_missing');
  }
  const fromAddr = env.RESEND_FROM_VERIFIED === '1'
    ? `${ADMIN_NAME} <noreply@plai-ai.com>`
    : `${ADMIN_NAME} <onboarding@resend.dev>`;

  const subject = `【PLai HP】新規お問い合わせ: ${name}${company ? ` / ${company}` : ''}`;

  const lines = [
    `新しいお問い合わせを受信しました。`,
    ``,
    `■ お名前: ${name}`,
    `■ 会社名: ${company || '(未入力)'}`,
    `■ メール: ${email}`,
    `■ 電話番号: ${phone || '(未入力)'}`,
    `■ ご相談事業: ${services.length ? services.join(' / ') : '(未選択)'}`,
    `■ ご予算: ${budget || '(未入力)'}`,
    ``,
    `■ お問い合わせ内容:`,
    message,
    ``,
    `■ 初回面談の候補日時:`,
    slots.length ? slots.map((s, i) => `  ${i + 1}. ${s}`).join('\n') : '  (未入力)',
    ``,
    `------------------------------------------------------------`,
    `Submission ID: ${id}`,
    `IP: ${ip || '-'}`,
    `Received: ${new Date().toISOString()}`,
    ``,
    `※ 返信は ${email} 宛にそのまま返信できます (Reply-To 設定済み)。`,
  ].join('\n');

  const htmlRows = [
    ['お名前', escapeHtml(name)],
    ['会社名', escapeHtml(company || '(未入力)')],
    ['メール', `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`],
    ['電話番号', escapeHtml(phone || '(未入力)')],
    ['ご相談事業', services.length ? escapeHtml(services.join(' / ')) : '(未選択)'],
    ['ご予算', escapeHtml(budget || '(未入力)')],
  ].map(([k, v]) => `<tr><td style="padding:8px 14px;background:#f4f2ec;color:#666;width:120px;font-size:13px;border-bottom:1px solid #e8e8ee;">${k}</td><td style="padding:8px 14px;font-size:14px;border-bottom:1px solid #e8e8ee;">${v}</td></tr>`).join('');

  const slotsHtml = slots.length
    ? `<ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.9;">${slots.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`
    : '<p style="margin:0;color:#999;font-size:13px;">(未入力)</p>';

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:'Hiragino Sans','Yu Gothic',sans-serif;color:#1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f5f0;padding:32px 16px;"><tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#fff;border-radius:12px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:12px;color:#9999a8;letter-spacing:0.12em;">PLAI HP — NEW INQUIRY</p>
        <h1 style="margin:0 0 24px;font-size:22px;color:#1a1a2e;">新規お問い合わせ</h1>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e8e8ee;border-radius:8px;overflow:hidden;margin-bottom:24px;">${htmlRows}</table>
        <h2 style="margin:24px 0 10px;font-size:15px;color:#1a1a2e;">お問い合わせ内容</h2>
        <div style="padding:16px;background:#faf9f5;border-radius:8px;font-size:14px;line-height:1.9;white-space:pre-wrap;">${escapeHtml(message)}</div>
        <h2 style="margin:24px 0 10px;font-size:15px;color:#1a1a2e;">初回面談の候補日時</h2>
        <div style="padding:16px;background:#faf9f5;border-radius:8px;">${slotsHtml}</div>
        <p style="margin:32px 0 0;font-size:11px;color:#9999a8;line-height:1.7;">
          Submission ID: ${escapeHtml(id)}<br>
          IP: ${escapeHtml(ip || '-')}<br>
          Received: ${new Date().toISOString()}<br>
          返信は <a href="mailto:${escapeHtml(email)}" style="color:#6b46c1;">${escapeHtml(email)}</a> にそのまま返信できます。
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const payload = {
    from: fromAddr,
    to: [`${ADMIN_NAME} <${ADMIN_EMAIL}>`],
    reply_to: email,
    subject,
    html,
    text: lines,
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`resend_${res.status}: ${txt.slice(0, 200)}`);
  }
}

async function sendAutoReply({ name, company, email, env }) {
  if (!env || !env.RESEND_API_KEY) return;

  const fromAddr = env.RESEND_FROM_VERIFIED === '1'
    ? `${ADMIN_NAME} <noreply@plai-ai.com>`
    : `${ADMIN_NAME} <onboarding@resend.dev>`;

  const subject = `【PLai】お問い合わせを受け付けました`;
  const plain = [
    `${name} 様`,
    company ? `(${company})` : '',
    ``,
    `この度はPLaiにお問い合わせいただき、誠にありがとうございます。`,
    `内容を確認のうえ、1〜2営業日以内に担当者よりご返信いたします。`,
    ``,
    `お急ぎの場合は、直接 ${ADMIN_EMAIL} までご連絡ください。`,
    ``,
    `------------------------------------------------------------`,
    `株式会社PLai`,
    `${SITE}`,
    `Email: ${ADMIN_EMAIL}`,
    `Tel: 080-3896-7229`,
  ].filter(Boolean).join('\n');

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:'Hiragino Sans','Yu Gothic',sans-serif;color:#1a1a2e;line-height:1.85;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f5f0;padding:32px 16px;"><tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;padding:40px 32px;">
      <tr><td>
        <p style="margin:0 0 18px;font-size:13px;color:#6b6b78;letter-spacing:0.1em;">PLAI INC.</p>
        <p style="margin:0 0 20px;font-size:15px;">${escapeHtml(name)} 様${company ? `<span style="color:#6b6b78;font-size:13px;">  /  ${escapeHtml(company)}</span>` : ''}</p>
        <p>この度はPLaiにお問い合わせいただき、誠にありがとうございます。</p>
        <p>内容を確認のうえ、<strong>1〜2営業日以内</strong>に担当者よりご返信いたします。</p>
        <p style="margin-top:24px;font-size:13px;color:#6b6b78;">お急ぎの場合は、直接 <a href="mailto:${ADMIN_EMAIL}" style="color:#6b46c1;">${ADMIN_EMAIL}</a> までご連絡ください。</p>
        <p style="margin:40px 0 0;font-size:12px;color:#9999a8;text-align:center;line-height:1.7;">
          株式会社PLai &nbsp;|&nbsp; <a href="${SITE}" style="color:#6b46c1;text-decoration:none;">plai-ai.com</a><br>
          Email: ${ADMIN_EMAIL} &nbsp;|&nbsp; Tel: 080-3896-7229
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const payload = {
    from: fromAddr,
    to: [`${name} <${email}>`],
    reply_to: ADMIN_EMAIL,
    subject,
    html,
    text: plain,
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`resend_${res.status}: ${txt.slice(0, 200)}`);
  }
}

/* ---------------------------- Helpers ---------------------------- */

function isValidEmail(s) {
  return typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
