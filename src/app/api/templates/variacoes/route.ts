import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-pro';

function extrairVariaveis(texto: string): string[] {
  return Array.from(new Set(texto.match(/\{\{\w+\}\}/g) ?? []));
}

function contarCombinacoes(texto: string): number {
  const blocos = texto.match(/\{([^{}]+)\}/g) ?? [];
  let total = 1;
  for (const bloco of blocos) {
    const conteudo = bloco.slice(1, -1);
    if (!conteudo.includes('|')) continue;
    total *= conteudo.split('|').length;
  }
  return total;
}

const PROMPT = (corpo: string) => `Você reescreve mensagens de prospecção de WhatsApp em formato "spintax", pra evitar que o mesmo texto literal seja enviado repetidamente pra contatos diferentes — isso é o principal sinal que derruba número em disparo no WhatsApp.

REGRAS (siga à risca):
1. Preserve toda variável no formato {{variavel}} exatamente como está (ex: {{nome}}) — nunca a coloque dentro de um bloco de variação nem altere o nome dela.
2. Transforme trechos da mensagem (saudação, corpo, chamada pra ação, despedida) em blocos de variação usando a sintaxe {opção 1|opção 2|opção 3} — cada bloco com pelo menos 3 opções genuinamente diferentes na estrutura da frase, não só troca de sinônimo.
3. Gere pelo menos 3 blocos de variação espalhados pela mensagem.
4. Mantenha exatamente o mesmo sentido, tom e call-to-action da mensagem original — não invente promessas nem mude a oferta.
5. Tom: WhatsApp real — direto, frases curtas, sem formalidade excessiva.
6. Devolva APENAS o texto final da mensagem com os blocos de variação. Sem comentários, sem explicações, sem markdown, sem aspas envolvendo o texto.

MENSAGEM ORIGINAL:
${corpo}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const corpo = typeof body?.corpo === 'string' ? body.corpo.trim() : '';
    if (!corpo) {
      return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT(corpo) }] }],
          generationConfig: { temperature: 0.8 },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Erro Gemini:', resp.status, errText);
      return NextResponse.json({ error: 'Erro ao gerar variações com IA.' }, { status: 502 });
    }

    const data = await resp.json();
    const textoGerado: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoGerado?.trim()) {
      return NextResponse.json({ error: 'A IA não retornou texto.' }, { status: 502 });
    }

    const corpoGerado = textoGerado.trim();

    // Validação: as variáveis originais precisam continuar lá, e tem que ter variação de verdade
    const varsOriginais = extrairVariaveis(corpo);
    const varsFaltando = varsOriginais.filter(v => !corpoGerado.includes(v));
    if (varsFaltando.length > 0) {
      return NextResponse.json(
        { error: `A IA removeu a(s) variável(is) ${varsFaltando.join(', ')}. Tenta gerar de novo.` },
        { status: 502 }
      );
    }
    if (contarCombinacoes(corpoGerado) <= 1) {
      return NextResponse.json({ error: 'A IA não gerou blocos de variação. Tenta gerar de novo.' }, { status: 502 });
    }

    return NextResponse.json({ corpo: corpoGerado });
  } catch (err) {
    console.error('Erro ao gerar variações de template:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
