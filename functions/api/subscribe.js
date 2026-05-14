// POST /api/subscribe
// 1. Validates form (name/email/company/position required + consent required)
// 2. Saves submission to D1
// 3. Sends gift email via MailChannels (PDF link + 無料相談 CTA)
// 4. Returns 200 with unlock token

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

  const email     = (body.email     || '').trim().toLowerCase();
  const name      = (body.name      || '').trim();
  const company   = (body.company   || '').trim();
  const position  = (body.position  || '').trim();
  const giftType  = (body.gift_type || '').trim();
  const source    = (body.source_path || '').trim().slice(0, 255);
  const consent   = body.consent_newsletter === 1 || body.consent_newsletter === true || body.consent_newsletter === '1' ? 1 : 0;

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

  // Send gift email via MailChannels (best-effort)
  let emailSent = false;
  let emailError = null;
  try {
    await sendGiftEmail({ email, name, company, position, giftType, sourcePath: source, env });
    emailSent = true;
  } catch (e) {
    emailError = String(e).slice(0, 200);
    // Don't fail the request — content still unlocks via JS event
    console.log('mailchannels_error', emailError);
  }

  return jsonResponse({
    ok: true,
    submission_id: id,
    gift_type: giftType,
    download_url: giftType === 'obsidian_vault' ? '/decks/obsidian-vault-template.html' : null,
    unlock: true,
    email_sent: emailSent,
    email_error: emailError,
  }, 200, allowedOrigin);
}

export function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  const allowedOrigin = origin.startsWith('https://plai-ai.com') || origin.startsWith('http://localhost') ? origin : '';
  return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
}

/* ---------------------------- Email Templates ---------------------------- */

const SITE = 'https://plai-ai.com';
const CONTACT_URL = `${SITE}/contact.html#contact-form`;
const FROM = { email: 'noreply@plai-ai.com', name: '株式会社PLai' };
const REPLY_TO = { email: 'jiuhuot10@gmail.com', name: '株式会社PLai' };

async function sendGiftEmail(opts) {
  const { email, name, company, giftType, sourcePath, env } = opts;

  let subject, plain, html;
  if (giftType === 'obsidian_vault') {
    ({ subject, plain, html } = buildVaultEmail({ name, company }));
  } else {
    ({ subject, plain, html } = buildArticleEmail({ name, company, sourcePath }));
  }

  // Prefer Resend (3000/month free); fallback note: MailChannels free tier ended 2024-08
  if (!env || !env.RESEND_API_KEY) {
    throw new Error('resend_api_key_missing: set RESEND_API_KEY as Cloudflare Pages secret');
  }

  // Use plai-ai.com once domain is verified in Resend dashboard; otherwise use onboarding@resend.dev
  const fromAddr = env.RESEND_FROM_VERIFIED === '1'
    ? `${FROM.name} <${FROM.email}>`
    : `${FROM.name} <onboarding@resend.dev>`;

  const payload = {
    from: fromAddr,
    to: [`${name} <${email}>`],
    reply_to: REPLY_TO.email,
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

function buildVaultEmail({ name, company }) {
  const subject = `【PLai】Obsidian Vault テンプレートをお届けします`;
  const pdfUrl = `${SITE}/assets/pdf/plai-vault-template.pdf`;
  const htmlDeckUrl = `${SITE}/decks/obsidian-vault-template.html`;

  const plain = [
    `${name} 様`,
    company ? `(${company})` : '',
    ``,
    `このたびはPLaiのObsidian Vaultテンプレートをお受け取りいただき、ありがとうございます。`,
    ``,
    `下記より、Vault設計を解説した約32枚のスライド資料（PDF）をダウンロードいただけます。`,
    `▶ PDF版:  ${pdfUrl}`,
    `▶ HTML版: ${htmlDeckUrl}`,
    ``,
    `------------------------------------------------------------`,
    ``,
    `▼ AI活用・組織ナレッジ構築でお困りでしたら`,
    ``,
    `PLaiでは、貴社専用のVault設計・運用代行を行っています。`,
    `30分の無料相談で、優先度マップ・投資対効果の概算・導入ロードマップをお持ち帰りいただけます。`,
    ``,
    `▶ 無料相談を申し込む: ${CONTACT_URL}`,
    ``,
    `------------------------------------------------------------`,
    ``,
    `株式会社PLai`,
    `https://plai-ai.com`,
  ].filter(Boolean).join('\n');

  const html = emailHtml({
    name, company,
    bodyHtml: `
      <p>このたびはPLaiの <strong>Obsidian Vault テンプレート</strong> をお受け取りいただき、ありがとうございます。</p>
      <p>下記より、Vault設計を解説した約32枚のスライド資料をダウンロードいただけます。</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr><td style="padding:8px 0;"><a href="${pdfUrl}" style="background:#1a1a2e;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;">📄 PDF版をダウンロード</a></td></tr>
        <tr><td style="padding:8px 0;"><a href="${htmlDeckUrl}" style="color:#6b46c1;font-size:14px;">▶ HTMLスライド版で見る</a></td></tr>
      </table>
    `,
  });

  return { subject, plain, html };
}

const ARTICLES = [
  {
    slug: 'karpathy-external-brain-claude-code',
    title: 'Karpathyが実践する「AI外部脳」を、Claude Codeでゼロから作る完全ガイド',
  },
  {
    slug: 'claude-obsidian-ai-brain',
    title: 'Claude Code × Obsidian で「AIセカンド脳」を作る',
  },
  {
    slug: 'claude-code-textbook',
    title: '【保存版】初心者向け Claude Codeの教科書',
  },
];

function buildArticleEmail({ name, company, sourcePath }) {
  const subject = `【PLai】記事の続き＆過去記事一覧をお届けします`;

  // Identify which article they came from (if any)
  const fromSlug = (sourcePath || '').match(/articles\/([^/?#]+?)(?:\.html)?$/)?.[1];
  const matched = ARTICLES.find(a => a.slug === fromSlug);

  const linesPlain = ARTICLES.map((a, i) => {
    const star = matched && a.slug === matched.slug ? ' ★ ご覧いただいていた記事' : '';
    return [
      `${i + 1}. ${a.title}${star}`,
      `   ▶ Web: ${SITE}/articles/${a.slug}.html`,
      `   ▶ PDF: ${SITE}/assets/pdf/article-${a.slug}.pdf`,
    ].join('\n');
  }).join('\n\n');

  const plain = [
    `${name} 様`,
    company ? `(${company})` : '',
    ``,
    `このたびはご登録いただき、ありがとうございます。`,
    `PLaiが現在公開している全記事のロックを解除しました。下記URLからお読みいただけます。`,
    ``,
    `------------------------------------------------------------`,
    ``,
    linesPlain,
    ``,
    `------------------------------------------------------------`,
    ``,
    `▼ AI活用でお困りでしたら`,
    ``,
    `PLaiでは、AI社員構築・組織ナレッジ構築・SNS自動化・AIマーケティングを行っています。`,
    `30分の無料相談で、優先度マップ・投資対効果の概算・導入ロードマップをお持ち帰りいただけます。`,
    ``,
    `▶ 無料相談を申し込む: ${CONTACT_URL}`,
    ``,
    `------------------------------------------------------------`,
    ``,
    `株式会社PLai`,
    `https://plai-ai.com`,
  ].filter(Boolean).join('\n');

  const articleListHtml = ARTICLES.map((a) => {
    const star = matched && a.slug === matched.slug ? '<span style="display:inline-block;font-size:11px;background:#f7a85a;color:#fff;padding:2px 8px;border-radius:100px;margin-left:6px;vertical-align:middle;">先ほどの記事</span>' : '';
    return `
      <tr><td style="padding:16px 0;border-bottom:1px solid #e8e8ee;">
        <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1a2e;">${escapeHtml(a.title)}${star}</p>
        <p style="margin:0;font-size:13px;">
          <a href="${SITE}/articles/${a.slug}.html" style="color:#6b46c1;text-decoration:none;margin-right:16px;">▶ Web版で読む</a>
          <a href="${SITE}/assets/pdf/article-${a.slug}.pdf" style="color:#6b46c1;text-decoration:none;">📄 PDF版</a>
        </p>
      </td></tr>
    `;
  }).join('');

  const html = emailHtml({
    name, company,
    bodyHtml: `
      <p>このたびはご登録いただき、ありがとうございます。</p>
      <p>PLaiが現在公開している全記事のロックを解除しました。下記からお読みいただけます。</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;">${articleListHtml}</table>
    `,
  });

  return { subject, plain, html };
}

function emailHtml({ name, company, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:'Hiragino Sans','Yu Gothic',sans-serif;color:#1a1a2e;line-height:1.85;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;padding:40px 32px;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:13px;color:#6b6b78;letter-spacing:0.1em;">PLAI INC. — FREE GIFT</p>
          <p style="margin:0 0 20px;font-size:15px;">${escapeHtml(name)} 様${company ? `<span style="color:#6b6b78;font-size:13px;">  /  ${escapeHtml(company)}</span>` : ''}</p>
          ${bodyHtml}
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e8e8ee;">
            <p style="margin:0 0 12px;font-size:13px;color:#6b6b78;letter-spacing:0.05em;">▼ AI活用でお困りでしたら</p>
            <p style="margin:0 0 16px;font-size:14px;color:#4a4a55;">PLaiでは、貴社専用のAI社員構築・組織ナレッジ構築・SNS自動化・AIマーケティングを行っています。30分の無料相談で、優先度マップ・投資対効果の概算・導入ロードマップをお持ち帰りいただけます。</p>
            <table cellpadding="0" cellspacing="0" border="0"><tr><td>
              <a href="${CONTACT_URL}" style="background:linear-gradient(135deg,#6b46c1,#f7a85a);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">無料相談を申し込む →</a>
            </td></tr></table>
          </div>
          <p style="margin:40px 0 0;font-size:12px;color:#9999a8;text-align:center;line-height:1.7;">
            株式会社PLai &nbsp;|&nbsp; <a href="${SITE}" style="color:#6b46c1;text-decoration:none;">plai-ai.com</a><br>
            このメールは PLai サイトのフリーギフトお申込みに対する自動配信です。<br>
            ご質問は本メールへの返信でお問い合わせいただけます。
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------------------------- Helpers ---------------------------- */

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
