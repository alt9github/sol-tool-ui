import { useEffect, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Footer content (typically `<Button>` actions). Optional. */
  footer?: ReactNode;
  /** Body content. */
  children: ReactNode;
  /** Approximate width hint (px). Body still respects max-height/scroll. */
  width?: number;
  /** Click on the overlay closes by default; pass false to disable. */
  closeOnOverlay?: boolean;
  /** Escape closes by default; pass false to disable (e.g. during a busy op). */
  closeOnEscape?: boolean;
  /** Additional className appended to the modal panel. */
  className?: string;
}

/**
 * Simple framework-agnostic-style modal — fixed overlay, centered panel,
 * scrollable body. No portal/focus-trap to keep the surface tiny; host can
 * wrap in createPortal if needed.
 */
export function Modal({
  open,
  onClose,
  title,
  footer,
  children,
  width,
  closeOnOverlay = true,
  closeOnEscape = true,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlay) return;
    if (e.target === e.currentTarget) onClose();
  };

  const style = width ? { width } : undefined;
  const cls = ['sol-ui-modal', className].filter(Boolean).join(' ');

  return (
    <div className="sol-ui-modal-overlay" onMouseDown={onOverlayClick}>
      <div className={cls} role="dialog" aria-modal="true" style={style}>
        {title != null && (
          <div className="sol-ui-modal-header">
            <h3 className="sol-ui-modal-title">{title}</h3>
          </div>
        )}
        <div className="sol-ui-modal-body">{children}</div>
        {footer != null && <div className="sol-ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
