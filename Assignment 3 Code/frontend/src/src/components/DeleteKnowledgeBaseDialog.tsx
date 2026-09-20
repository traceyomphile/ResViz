import {useEffect, useRef} from 'react';
import {Icon} from './Icons';

export function DeleteKnowledgeBaseDialog({name, formulaCount, busy, error, onClose, onDelete}: {
  name: string; formulaCount: number; busy: boolean; error: string; onClose(): void; onDelete(): Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal(); cancel.current?.focus();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="rename-dialog delete-dialog" aria-labelledby="delete-kb-title" aria-describedby="delete-kb-description" onCancel={event => {event.preventDefault(); if (!busy) onClose();}}>
    <header className="rename-dialog-heading"><span className="round-icon"><Icon name="trash" size={25} /></span><div><h2 id="delete-kb-title">Delete knowledge base?</h2><p>Remove this KB from the project.</p></div><button className="rename-dialog-close" aria-label="Close knowledge base delete dialog" disabled={busy} onClick={onClose}><Icon name="close" size={20} /></button></header>
    <p id="delete-kb-description">Delete <strong>{name}</strong> and its {formulaCount} {formulaCount === 1 ? 'formula' : 'formulas'}, annotations and unsaved edits? This cannot be undone. The project's CNF and proof will need to be run again.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    <footer className="rename-dialog-actions"><button ref={cancel} className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button danger" disabled={busy} onClick={() => void onDelete()}>{busy ? 'Deleting…' : 'Delete knowledge base'}</button></footer>
  </dialog>;
}
