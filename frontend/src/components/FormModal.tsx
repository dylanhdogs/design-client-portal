import { FormEvent, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface FormModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  busy?: boolean;
  submitLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  showSubmit?: boolean;
  maxWidthClass?: string;
  onClose: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}

/**
 * Reusable modal shell for application submission forms.
 *
 * Provides a dimmed backdrop, accessible dialog semantics, Escape/backdrop
 * closing, locked page scrolling, a scrollable body, and sticky actions.
 */
export default function FormModal({
  open,
  title,
  description,
  children,
  busy = false,
  submitLabel = 'Save changes',
  busyLabel = 'Saving…',
  cancelLabel = 'Cancel',
  showSubmit = true,
  maxWidthClass = 'max-w-3xl',
  onClose,
  onSubmit,
}: FormModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [busy, onClose, open]);

  if (!open) return null;
  const titleId = `form-modal-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const modal = <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`max-h-[92vh] w-full ${maxWidthClass} overflow-y-auto rounded-2xl bg-white shadow-2xl`}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
        <div>
          <h2 id={titleId} className="text-xl font-semibold text-gray-950">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {showSubmit ? <form onSubmit={onSubmit}>
          <div className="space-y-6 p-5 sm:p-6">{children}</div>
          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:px-6">
            <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">{cancelLabel}</button>
            <button disabled={busy} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? busyLabel : submitLabel}</button>
          </div>
        </form> : <div>
          <div className="space-y-6 p-5 sm:p-6">{children}</div>
          <div className="sticky bottom-0 flex justify-end border-t border-gray-200 bg-white px-5 py-4 sm:px-6"><button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{cancelLabel}</button></div>
      </div>}
    </section>
  </div>;

  return createPortal(modal, document.body);
}
