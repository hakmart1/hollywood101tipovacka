import { useCallback, useState } from "react";
import Modal from "./Modal";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

// A confirmation dialog that uses our custom Modal (unified look) but is awaited
// like window.confirm: `if (!(await confirm({...}))) return;`. Render the
// returned `confirmElement` once in the component.
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  function close(result: boolean) {
    if (state) {
      state.resolve(result);
    }
    setState(null);
  }

  const confirmElement = state ? (
    <Modal title={state.title} onClose={() => close(false)}>
      <p className="modal-note">{state.message}</p>
      <div className="form-actions">
        <button type="button" onClick={() => close(false)}>
          Zrušit
        </button>
        <button
          type="button"
          className={`primary${state.danger ? " danger" : ""}`}
          autoFocus
          onClick={() => close(true)}
        >
          {state.confirmLabel ?? "Potvrdit"}
        </button>
      </div>
    </Modal>
  ) : null;

  return { confirm, confirmElement };
}
