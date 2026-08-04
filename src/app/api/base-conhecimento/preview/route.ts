import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-pro';

// Mantém o mesmo texto de consorhive-agent/main.py (SYSTEM_PROMPT_BASE) — se
// mudar o prompt lá, replique aqui pra simulação continuar fiel à produção.
const SYSTEM_PROMPT_BASE = `Você é o Maikon Festinalli, consultor de estratégia patrimonial (Ademicon). Está respondendo pelo seu próprio WhatsApp, em primeira pessoa — não é um assistente ou representante, é você mesmo conversando.

### QUEM VOCÊ É:
- Fala sempre em primeira pessoa, como o próprio Maikon
- Se perguntado diretamente e sem ambiguidade se é um robô/IA/sistema automático, seja honesto — não negue. Fora isso, não se apresente como assistente nem mencione ser automatizado
- Trabalha com consórcio Ademicon: imóvel, veículo, serviços e outros bens
- Dirija-se ao lead sempre pelo primeiro nome dele, nunca pelo nome completo

### REGRAS ABSOLUTAS (nunca viole):
1. NUNCA prometa contemplação rápida, taxa exclusiva, vaga limitada ou retorno garantido
2. NUNCA mencione prestamista durante a prospecção
3. NUNCA opere lead que já é cliente de outro consultor Ademicon — encerre educadamente
4. NUNCA feche negócio — só na reunião/handoff
5. NUNCA faça mais de uma pergunta por mensagem
6. Se o lead pedir para parar ("pare", "não quero", "sai", "descadastra") — confirme opt-out educadamente e pare

### TOM:
- WhatsApp real: frases curtas, direto ao ponto, sem formalidades
- Consultivo, não vendedor de esquina
- Um emoji pontual no máximo por mensagem
- Vá direto ao ponto — sem se apresentar, você já está numa conversa

### ROTEIRO DE QUALIFICAÇÃO (7 dimensões — uma pergunta por vez, pule se já respondido):
- D1: Qual o projeto? (imóvel, veículo, outros)
- D2: Qual o prazo que pensa em concretizar? (meses)
- D3: Qual o valor aproximado do bem? (ticket em R$)
- D4: Quanto consegue pagar por mês de parcela?
- D5: Decisão é sozinho ou dividido com alguém?
- D6: Já conhece consórcio? Já teve cota antes?
- D7: É cliente de outro consultor Ademicon? (crítico — se sim, encerre)

### REGRA DE CONTEXTUALIZAÇÃO:
Analise o histórico completo. Se o lead já respondeu uma dimensão espontaneamente, não pergunte de novo. Valide e avance. Se a resposta do lead for incomum, irônica ou fora do previsto, use argumentos reais pra tentar entender a real necessidade e reconduzir a conversa — não desista de engajar.

### HANDOFF:
Quando tiver project_type + timing_months + ticket_brl preenchidos E score >= 61, acione handoff=true. Você (Maikon) assume a conversa a partir daí.

### FOLLOW-UP AGENDADO:
Se o lead pedir explicitamente pra ser contactado depois ("me chama semana que vem", "fala comigo dia 20", "só decido mês que vem"), aceite naturalmente, NÃO insista em continuar a qualificação agora — preencha follow_up_data/follow_up_nota e deixe o resto pra data combinada.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intencao_cliente: {
      type: 'STRING',
      description: "Classifique: 'QUALIFICACAO' (interesse real), 'SPAM_OUTRO' (fora do escopo, grosseria), 'OUTRO_CONSULTOR' (já tem consultor Ademicon), 'OPTOUT' (não quer contato).",
    },
    mensagem_para_cliente: {
      type: 'STRING',
      description: 'Mensagem para enviar no WhatsApp. Curta, humana, direta. Máximo 3 linhas. Se for SPAM_OUTRO ou OPTOUT, deixe vazia.',
    },
    dados_extraidos: {
      type: 'OBJECT',
      description: 'Preencha os campos que o lead revelou: project_type (imovel/veiculo/outros/servico), timing_months (int), ticket_brl (int), installment_capacity_brl (int), decision_maker (sozinho/dividido), product_maturity (nunca/ja_olhou/ja_tem_cota), other_consultant_client (bool).',
    },
    score: {
      type: 'INTEGER',
      description: 'Score de 0 a 100 indicando quão qualificado está o lead. 0-40=frio, 41-60=morno, 61-80=quente, 81-100=quente prioritário.',
    },
    acionar_handoff: {
      type: 'BOOLEAN',
      description: 'True se: score >= 61 E tem project_type + timing_months + ticket_brl preenchidos, OU se ticket_brl > 1000000, OU se lead pediu explicitamente para falar com humano.',
    },
  },
  required: ['intencao_cliente', 'mensagem_para_cliente', 'dados_extraidos', 'score', 'acionar_handoff'],
};

type Mensagem = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kb = typeof body?.kb === 'string' ? body.kb : '';
    const historico: Mensagem[] = Array.isArray(body?.historico) ? body.historico : [];
    const qualificacaoAtual = body?.qualificacao_atual ?? {};

    if (historico.length === 0) {
      return NextResponse.json({ error: 'Histórico vazio.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    const systemPrompt = kb.trim()
      ? `${SYSTEM_PROMPT_BASE}\n\n---\n### BASE DE CONHECIMENTO DO MAIKON:\n${kb}`
      : SYSTEM_PROMPT_BASE;

    const qualificacaoStr = Object.keys(qualificacaoAtual).length > 0
      ? `\n\n### DADOS JÁ COLETADOS DESTE LEAD:\n${JSON.stringify(qualificacaoAtual, null, 2)}`
      : '';

    const historicoFormatado = historico
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const dataHoje = new Date().toISOString().slice(0, 10);
    const promptCompleto = `${systemPrompt}${qualificacaoStr}\n\n### SIMULAÇÃO — este é um teste, não é um lead real.\n\n### DATA DE HOJE: ${dataHoje}\n\n### HISTÓRICO DA CONVERSA:\n${historicoFormatado}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptCompleto }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Erro Gemini (preview KB):', resp.status, errText);
      return NextResponse.json({ error: 'Erro ao simular resposta.' }, { status: 502 });
    }

    const data = await resp.json();
    const textoJson: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoJson) {
      return NextResponse.json({ error: 'A IA não retornou resposta.' }, { status: 502 });
    }

    const resultado = JSON.parse(textoJson);

    return NextResponse.json({
      mensagem_para_cliente: resultado.mensagem_para_cliente ?? '',
      intencao_cliente: resultado.intencao_cliente ?? 'QUALIFICACAO',
      dados_extraidos: resultado.dados_extraidos ?? {},
      score: Math.min(100, Math.max(0, resultado.score ?? 0)),
      acionar_handoff: !!resultado.acionar_handoff,
    });
  } catch (err) {
    console.error('Erro na simulação da base de conhecimento:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
