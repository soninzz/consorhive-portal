import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-pro';
const TAMANHO_MAX_BYTES = 15 * 1024 * 1024; // 15MB — folga pra ficar dentro do limite de payload inline do Gemini

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }
    if (file.size > TAMANHO_MAX_BYTES) {
      return NextResponse.json({ error: 'PDF muito grande (máx. 15MB). Divida o documento ou cole o texto direto.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: base64 } },
              {
                text: 'Extraia todo o texto deste documento em formato markdown limpo, preservando a estrutura de títulos e parágrafos. Retorne APENAS o texto extraído, sem comentários.',
              },
            ],
          }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Erro Gemini (extração PDF):', resp.status, errText);
      return NextResponse.json({ error: 'Erro ao extrair texto do PDF.' }, { status: 502 });
    }

    const data = await resp.json();
    const texto: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto?.trim()) {
      return NextResponse.json({ error: 'Não foi possível extrair texto deste PDF.' }, { status: 502 });
    }

    return NextResponse.json({ texto: texto.trim() });
  } catch (err) {
    console.error('Erro ao processar PDF:', err);
    return NextResponse.json({ error: 'Erro interno ao processar o arquivo.' }, { status: 500 });
  }
}
