import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressStartedOutside = useRef(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function isOutsideBox(clientX: number, clientY: number): boolean {
    const dialog = dialogRef.current;
    if (!dialog) {
      return false;
    }
    const rect = dialog.getBoundingClientRect();
    return (
      clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onCancel={onClose}
      onMouseDown={(event) => {
        pressStartedOutside.current =
          event.target === dialogRef.current && isOutsideBox(event.clientX, event.clientY);
      }}
      onClick={(event) => {
        // Backdrop clicks target the <dialog> element, but so do clicks on its
        // padding, and a drag released outside reports the release position.
        // Close only when the full click (press AND release) happened outside.
        if (
          pressStartedOutside.current &&
          event.target === dialogRef.current &&
          isOutsideBox(event.clientX, event.clientY)
        ) {
          onClose();
        }
        pressStartedOutside.current = false;
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
