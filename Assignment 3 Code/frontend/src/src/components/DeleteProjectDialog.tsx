import {useEffect, useRef} from 'react';
import {Icon} from './Icons';

export function DeleteProjectDialog({name, saved, busy, error, onClose, onDelete}: {
  name: string; saved: boolean; busy: boolean; error: string; onClose(): void; onDelete(): Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    cancel.current?.focus();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="rename-dialog delete-dialog" aria-labelledby="delete-project-title" aria-describedby="delete-project-description" onCancel={event => {event.preventDefault(); if (!busy) onClose();}}>
    <header className="rename-dialog-heading"><span className="round-icon"><Icon name="trash" size={25} /></span><div><h2 id="delete-project-title">Delete project?</h2><p>Remove this workspace.</p></div><button type="button" className="rename-dialog-close" aria-label="Close delete dialog" disabled={busy} onClick={onClose}><Icon name="close" size={20} /></button></header>
    <p id="delete-project-description">{saved ? <>Delete <strong>{name}</strong> and its knowledge bases, formulas, and proof? This cannot be undone. Export the project first if you want to keep a copy.</> : <>Remove <strong>{name}</strong> from your projects? You can still open the sample from the home page.</>}</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    <footer className="rename-dialog-actions"><button ref={cancel} autoFocus className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button danger" disabled={busy} onClick={() => void onDelete()}>{busy ? 'Deleting…' : 'Delete project'}</button></footer>
  </dialog>;
}
