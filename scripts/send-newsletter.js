#!/usr/bin/env node
/**
 * PLai Newsletter Sender
 *
 * Resend API key は macOS Keychain から取得（git管理外、安全）:
 *   security add-generic-password -a plai -s resend-api-key -w 're_xxxxx'
 *
 * 配信先は D1 plai-submissions テーブルの consent_newsletter=1 のメアド（重複除去）。
 *
 * 使い方:
 *   # プレビュー送信（jiuhuot10@gmail.com に1通だけ）
 *   node scripts/send-newsletter.js \
 *     --preview \
 *     --slug 2026-05-launch \
 *     --subject "【PLai】◯◯のお知らせ" \
 *     --html scripts/newsletters/2026-05-launch.html \
 *     --text scripts/newsletters/2026-05-launch.txt
 *
 *   # 本配信（同意済み全員 + D1 newsletter_sends に記録）
 *   node scripts/send-newsletter.js \
 *     --send-all \
 *     --slug 2026-05-launch \
 *     --subject "【PLai】◯◯のお知らせ" \
 *     --html scripts/newsletters/2026-05-launch.html \
 *     --text scripts/newsletters/2026-05-launch.txt
 *
 * テンプレ差し込み: 本文中の {{name}} は受信者の名前に置換される。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const FROM = 'PLai <noreply@plai-ai.com>';
const REPLY_TO = 'jiuhuot10@gmail.com';
const PREVIEW_TO = { email: 'jiuhuot10@gmail.com', name: '市岡 直人' };
const D1_DB = 'plai-submissions';
const BATCH_SIZE = 100;
const BATCH_INTERVAL_MS = 1100;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { mode: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--preview') out.mode = 'preview';
    else if (a === '--send-all') out.mode = 'send-all';
    else if (a === '--slug') out.slug = args[++i];
    else if (a === '--subject') out.subject = args[++i];
    else if (a === '--html') out.htmlPath = args[++i];
    else if (a === '--text') out.textPath = args[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  if (!out.mode) die('--preview か --send-all を指定してください');
  if (!out.slug) die('--slug は必須（例: 2026-05-launch）');
  if (!out.subject) die('--subject は必須');
  if (!out.htmlPath) die('--html は必須（HTMLテンプレファイルへのパス）');
  if (!out.textPath) die('--text は必須（プレーンテキスト版へのパス）');
  return out;
}

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function getApiKey() {
  try {
    return execSync('security find-generic-password -a plai -s resend-api-key -w', {
      encoding: 'utf8',
    }).trim();
  } catch (e) {
    die('Keychainから resend-api-key を取得できません。先に `security add-generic-password -a plai -s resend-api-key -w \\'re_xxxxx\\'` を実行してください。');
  }
}

function escapeShellSingleQuote(s) {
  return s.replace(/'/g, `'\\''`);
}

function getRecipients() {
  const sql = `SELECT email, MIN(name) AS name FROM submissions WHERE consent_newsletter = 1 GROUP BY email ORDER BY MIN(created_at);`;
  const cmd = `npx wrangler d1 execute ${D1_DB} --remote --command '${escapeShellSingleQuote(sql)}' --json`;
  let out;
  try {
    out = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    die(`D1取得失敗: ${e.message}`);
  }
  let data;
  try {
    data = JSON.parse(out);
  } catch (e) {
    die(`wrangler 出力のJSONパース失敗: ${e.message}`);
  }
  // wrangler d1 --json は配列 [{ results: [...] }] を返す
  const results = Array.isArray(data) ? data[0]?.results : data.results;
  if (!Array.isArray(results)) die(`予期しないwrangler応答: ${JSON.stringify(data).slice(0, 200)}`);
  return results.filter(r => r.email);
}

function applyTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] != null ? String(vars[k]) : '');
}

async function sendBatch(apiKey, payloads) {
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payloads),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend batch HTTP ${res.status}: ${body.slice(0, 400)}`);
  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = {}; }
  return parsed.data || [];
}

async function sendOne(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 400)}`);
  return JSON.parse(body);
}

function logSendsToD1(rows) {
  if (rows.length === 0) return;
  const values = rows.map(r => {
    const v = [
      r.id, r.campaign_slug, r.subject, r.recipient_email,
      r.recipient_name || '', r.resend_message_id || '',
      r.status, r.error || '', r.preview ? 1 : 0,
    ];
    return '(' + v.map(x => typeof x === 'number' ? x : `'${escapeSql(String(x))}'`).join(',') + ')';
  }).join(',\n');
  const sql = `INSERT INTO newsletter_sends (id, campaign_slug, subject, recipient_email, recipient_name, resend_message_id, status, error, preview) VALUES ${values};`;
  const cmd = `npx wrangler d1 execute ${D1_DB} --remote --command '${escapeShellSingleQuote(sql)}'`;
  try {
    execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    console.warn(`⚠ D1への配信ログ記録失敗（メール送信自体は成功）: ${e.message}`);
  }
}

function escapeSql(s) {
  return s.replace(/'/g, "''");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function buildPayload({ to, name, subject, htmlTpl, textTpl }) {
  const vars = { name: name || '' };
  return {
    from: FROM,
    to: [name ? `${name} <${to}>` : to],
    reply_to: REPLY_TO,
    subject: applyTemplate(subject, vars),
    html: applyTemplate(htmlTpl, vars),
    text: applyTemplate(textTpl, vars),
  };
}

(async () => {
  const opts = parseArgs();
  const htmlTpl = fs.readFileSync(path.resolve(opts.htmlPath), 'utf8');
  const textTpl = fs.readFileSync(path.resolve(opts.textPath), 'utf8');
  const apiKey = getApiKey();

  console.log(`▶ campaign: ${opts.slug}`);
  console.log(`▶ subject : ${opts.subject}`);
  console.log(`▶ mode    : ${opts.mode}`);

  if (opts.mode === 'preview') {
    const payload = buildPayload({
      to: PREVIEW_TO.email, name: PREVIEW_TO.name,
      subject: `[PREVIEW] ${opts.subject}`,
      htmlTpl, textTpl,
    });
    console.log(`\n▶ 送信先: ${payload.to[0]}（PREVIEW）`);
    if (opts.dryRun) { console.log('-- dry-run, 実送信なし --'); return; }
    try {
      const r = await sendOne(apiKey, payload);
      console.log(`✓ プレビュー送信成功 (message_id: ${r.id})`);
      logSendsToD1([{
        id: crypto.randomUUID(), campaign_slug: opts.slug, subject: opts.subject,
        recipient_email: PREVIEW_TO.email, recipient_name: PREVIEW_TO.name,
        resend_message_id: r.id, status: 'sent', preview: 1,
      }]);
    } catch (e) {
      die(`プレビュー送信失敗: ${e.message}`);
    }
    return;
  }

  // send-all
  const recipients = getRecipients();
  console.log(`\n▶ 配信対象（consent_newsletter=1, 重複除去）: ${recipients.length}件`);
  if (recipients.length === 0) die('配信対象が0件です。');
  recipients.slice(0, 5).forEach((r, i) => console.log(`   ${i + 1}. ${r.name || '(no name)'} <${r.email}>`));
  if (recipients.length > 5) console.log(`   ... 他 ${recipients.length - 5}件`);

  if (opts.dryRun) { console.log('\n-- dry-run, 実送信なし --'); return; }

  const logRows = [];
  let okCount = 0, failCount = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const payloads = chunk.map(r => buildPayload({
      to: r.email, name: r.name,
      subject: opts.subject, htmlTpl, textTpl,
    }));
    try {
      const results = await sendBatch(apiKey, payloads);
      chunk.forEach((r, j) => {
        const messageId = results[j]?.id || null;
        okCount++;
        logRows.push({
          id: crypto.randomUUID(), campaign_slug: opts.slug, subject: opts.subject,
          recipient_email: r.email, recipient_name: r.name,
          resend_message_id: messageId, status: 'sent', preview: 0,
        });
      });
      console.log(`✓ batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recipients.length / BATCH_SIZE)}: ${chunk.length}件 送信完了`);
    } catch (e) {
      chunk.forEach(r => {
        failCount++;
        logRows.push({
          id: crypto.randomUUID(), campaign_slug: opts.slug, subject: opts.subject,
          recipient_email: r.email, recipient_name: r.name,
          status: 'failed', error: e.message.slice(0, 500), preview: 0,
        });
      });
      console.error(`✗ batch ${Math.floor(i / BATCH_SIZE) + 1} 失敗: ${e.message}`);
    }
    if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_INTERVAL_MS);
  }

  logSendsToD1(logRows);
  console.log(`\n━━━ 配信完了 ━━━`);
  console.log(`  成功: ${okCount} 件`);
  console.log(`  失敗: ${failCount} 件`);
  console.log(`  D1 newsletter_sends にログ記録済み (campaign_slug=${opts.slug})`);
})().catch(e => die(`致命的エラー: ${e.message}`));
