import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const n8nUrl = process.env.N8N_DISPARO_WEBHOOK;
    if (!n8nUrl) {
      return NextResponse.json({ error: 'Webhook não configurado' }, { status: 500 });
    }

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    console.log('n8n response:', response.status, text);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro ao chamar n8n:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}