import {useEffect, useRef, useState} from 'react';
import {Icon} from './Icons';

export function RenameProjectDialog({name, busy, error, onClose, onSave}: {
  name: string; busy: boolean; error: string; onClose(): void; onSave(name: string): Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(name);
  const trimmed = draft.trim();
  const validation = trimmed ? '' : 'Enter a project name.';
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    input.current?.select();
    return () => element?.close();
  }, []);

  return <dialog ref={dialog} className="rename-dialog" aria-labelledby="rename-project-title" aria-describedby="rename-project-description" onCancel={event => {event.preventDefault(); if (!busy) onClose();}}>
    <form noValidate onSubmit={event => {event.preventDefault(); if (!busy && trimmed) void onSave(trimmed);}}>
      <header className="rename-dialog-heading"><span className="round-icon"><Icon name="edit" size={25} /></span><div><h2 id="rename-project-title">Rename project</h2><p id="rename-project-description">Choose a name for your workspace.</p></div><button type="button" className="rename-dialog-close" aria-label="Close rename dialog" disabled={busy} onClick={onClose}><Icon name="close" size={20} /></button></header>
      <label className="field-label" htmlFor="project-name">Project name</label>
      <input ref={input} id="project-name" autoFocus value={draft} maxLength={120} disabled={busy} aria-invalid={Boolean(validation)} aria-describedby={validation || error ? 'rename-project-error' : undefined} onChange={event => setDraft(event.target.value)} />
      <div className="rename-dialog-meta"><span>{busy ? 'Saving your new project name…' : 'Your formulas and proof stay in this workspace.'}</span><span>{draft.length}/120</span></div>
      {(validation || error) && <p id="rename-project-error" className="field-error" role="alert">{validation || error}</p>}
      <footer className="rename-dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="button primary" disabled={busy || !trimmed}>{busy ? 'Saving…' : 'Save name'}</button></footer>
    </form>
  </dialog>;
}
