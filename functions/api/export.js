// GET /api/export?token=<EXPORT_TOKEN>&format=csv|json&type=submissions|contacts
// Returns all submissions (gift form) or contacts (HP問い合わせ) as CSV (default) or JSON.
// Token is configured in Cloudflare Pages → Settings → Environment variables: EXPORT_TOKEN

const TABLES = {
  submissions: {
    sql: `SELECT id, email, name, company, position, gift_type, source_path, consent_newsletter, created_at, ip, user_agent
          FROM submissions ORDER BY created_at DESC`,
    columns: ['id', 'email', 'name', 'company', 'position', 'gift_type', 'source_path', 'consent_newsletter', 'created_at', 'ip', 'user_agent'],
    filenamePrefix: 'plai-submissions',
  },
  contacts: {
    sql: `SELECT id, name, company, email, phone, services, budget, message, candidate_slots, status, notified, created_at, ip, user_agent
          FROM contacts ORDER BY created_at DESC`,
    columns: ['id', 'name', 'company', 'email', 'phone', 'services', 'budget', 'message', 'candidate_slots', 'status', 'notified', 'created_at', 'ip', 'user_agent'],
    filenamePrefix: 'plai-contacts',
  },
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  const type = (url.searchParams.get('type') || 'submissions').toLowerCase();

  if (!env.EXPORT_TOKEN || token !== env.EXPORT_TOKEN) {
    return new Response('Forbidden', { status: 403 });
  }

  const tableDef = TABLES[type];
  if (!tableDef) {
    return new Response('Invalid type. Use ?type=submissions or ?type=contacts', { status: 400 });
  }

  let rows;
  try {
    const { results } = await env.DB.prepare(tableDef.sql).all();
    rows = results;
  } catch (e) {
    return new Response('DB error: ' + e.message, { status: 500 });
  }

  if (format === 'json') {
    return new Response(JSON.stringify(rows, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const csv = [
    tableDef.columns.join(','),
    ...rows.map(r => tableDef.columns.map(c => csvEscape(r[c])).join(',')),
  ].join('\n');

  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${tableDef.filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
