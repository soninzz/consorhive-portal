'use client';

import { useCallback, useState } from 'react';
import { ConfirmDialog, type ConfirmTone } from '@/components/ui/confirm-dialog';

type ConfirmParams = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void | Promise<void>;
};

type ConfirmState = ConfirmParams & { open: boolean; busy: boolean };

/**
 * Substitui window.confirm() por um modal no estilo do app.
 * Uso: confirm({ description: '...', tone: 'danger', onConfirm: async () => { ... } })
 * — abre o modal e só roda onConfirm se o usuário confirmar; mantém o modal
 * aberto com "Aguarde..." enquanto onConfirm está em andamento.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((params: ConfirmParams) => {
    setState({ ...params, open: true, busy: false });
  }, []);

  function fechar() {
    setState(null);
  }

  async function confirmar() {
    if (!state) return;
    setState(s => (s ? { ...s, busy: true } : s));
    try {
      await state.onConfirm();
      fechar();
    } catch {
      setState(s => (s ? { ...s, busy: false } : s));
    }
  }

  const dialog = (
    <ConfirmDialog
      open={!!state?.open}
      title={state?.title ?? 'Confirmar ação'}
      description={state?.description ?? ''}
      confirmLabel={state?.confirmLabel ?? 'Confirmar'}
      cancelLabel={state?.cancelLabel ?? 'Cancelar'}
      tone={state?.tone ?? 'default'}
      busy={!!state?.busy}
      onConfirm={confirmar}
      onCancel={fechar}
    />
  );

  return { confirm, dialog };
}
