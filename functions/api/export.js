// GET /api/export?token=<EXPORT_TOKEN>&format=csv|json
// Returns all submissions as CSV (default) or JSON.
// Token is configured in Cloudflare Pages → Settings → Environment variables: EXPORT_TOKEN

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();

  if (!env.EXPORT_TOKEN || token !== env.EXPORT_TOKEN) {
    return new Response('Forbidden', { status: 403 });
  }

  let rows;
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, email, name, company, position, gift_type, source_path, created_at, ip, user_agent
       FROM submissions
       ORDER BY created_at DESC`
    ).all();
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

  // CSV
  const columns = ['id', 'email', 'name', 'company', 'position', 'gift_type', 'source_path', 'created_at', 'ip', 'user_agent'];
  const csv = [
    columns.join(','),
    ...rows.map(r => columns.map(c => csvEscape(r[c])).join(',')),
  ].join('\n');

  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="plai-submissions-${new Date().toISOString().slice(0, 10)}.csv"`,
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
