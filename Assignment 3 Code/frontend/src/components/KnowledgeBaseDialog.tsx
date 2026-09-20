import {useEffect, useRef, useState} from 'react';
import type {SavedProjectKB} from '../api/projects';
import {validateFormula} from '../types/validator';
import {createId} from '../utils/id';
import {Icon} from './Icons';

interface EditableRow {
  id: string;
  formula: string;
  annotation: string;
}

export function KnowledgeBaseDialog({knowledgeBase, initialEditing = false, busy, error, onClose, onSave}: {
  knowledgeBase: SavedProjectKB;
  initialEditing?: boolean;
  busy: boolean;
  error: string;
  onClose(): void;
  onSave(id: string, name: string, formulas: string[], annotations: string[]): Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(initialEditing);
  const [name, setName] = useState(knowledgeBase.name);
  const [rows, setRows] = useState<EditableRow[]>(() => knowledgeBase.formulas.map((formula, index) => ({
    id: createId(),
    formula,
    annotation: knowledgeBase.annotations?.[index] ?? '',
  })));
  const [pendingFormula, setPendingFormula] = useState('');
  const [pendingError, setPendingError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const validations = rows.map(row => validateFormula(row.formula));
  const canSave = Boolean(name.trim())
    && rows.length > 0
    && !pendingFormula.trim()
    && validations.every(result => result.valid);

  function reset() {
    setName(knowledgeBase.name);
    setRows(knowledgeBase.formulas.map((formula, index) => ({
      id: createId(),
      formula,
      annotation: knowledgeBase.annotations?.[index] ?? '',
    })));
    setPendingFormula('');
    setPendingError('');
  }

  function stopEditing() {
    reset();
    setEditing(false);
  }

  function addFormula() {
    const value = pendingFormula.trim();
    if (!value || busy) return;
    const result = validateFormula(value);
    if (!result.valid) {
      setPendingError(result.error ?? 'Enter a valid formula.');
      return;
    }
    setRows(current => [...current, {id: createId(), formula: value, annotation: ''}]);
    setPendingFormula('');
    setPendingError('');
  }

  async function save() {
    if (!canSave || busy) return;
    const saved = await onSave(
      knowledgeBase.id,
      name.trim(),
      rows.map(row => row.formula.trim()),
      rows.map(row => row.annotation.trim()),
    );
    if (saved) setEditing(false);
  }

  return <dialog
    ref={dialog}
    className="rename-dialog kb-dialog"
    aria-labelledby="kb-dialog-title"
    onCancel={event => {
      event.preventDefault();
      if (!busy) onClose();
    }}
  >
    <header className="rename-dialog-heading kb-dialog-heading">
      <span className="round-icon"><Icon name="file" size={24} /></span>
      <div>
        <h2 id="kb-dialog-title">{editing ? 'Edit knowledge base' : knowledgeBase.name}</h2>
        <p>{rows.length} {rows.length === 1 ? 'formula' : 'formulas'} · saved in this project</p>
      </div>
      <button className="rename-dialog-close" aria-label="Close knowledge base" disabled={busy} onClick={onClose}>
        <Icon name="close" size={20} />
      </button>
    </header>

    {editing ? <div className="kb-dialog-editor">
      <label className="field-label" htmlFor="dialog-kb-name">KB Name</label>
      <input
        id="dialog-kb-name"
        value={name}
        maxLength={120}
        disabled={busy}
        onChange={event => setName(event.target.value)}
      />

      <div className="kb-dialog-formulas">
        {rows.map((row, index) => <div className="kb-dialog-edit-row" key={row.id}>
          <div className="formula-row">
            <span className="formula-number">{index + 1}</span>
            <input
              aria-label={`Edit formula ${index + 1}`}
              value={row.formula}
              disabled={busy}
              aria-invalid={!validations[index].valid}
              onChange={event => setRows(current => current.map(item => item.id === row.id ? {...item, formula: event.target.value} : item))}
            />
            <button
              className="remove-button"
              aria-label={`Remove formula ${index + 1}`}
              disabled={busy || rows.length === 1}
              onClick={() => setRows(current => current.filter(item => item.id !== row.id))}
            >
              <Icon name="close" size={17} />
            </button>
          </div>
          <textarea
            rows={1}
            aria-label={`Edit annotation ${index + 1}`}
            value={row.annotation}
            disabled={busy}
            placeholder="Optional annotation"
            onChange={event => setRows(current => current.map(item => item.id === row.id ? {...item, annotation: event.target.value} : item))}
          />
          {!validations[index].valid && <p className="field-error" role="alert">{validations[index].error}</p>}
        </div>)}
      </div>

      <div className="kb-dialog-add-row">
        <input
          aria-label="Add formula in dialog"
          value={pendingFormula}
          disabled={busy}
          aria-invalid={Boolean(pendingError)}
          placeholder="Add another formula and press Enter"
          onChange={event => {
            setPendingFormula(event.target.value);
            setPendingError('');
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              addFormula();
            }
          }}
        />
        <button className="button outline small" disabled={!pendingFormula.trim() || busy} onClick={addFormula}>
          <Icon name="plus" size={16} />Add
        </button>
      </div>
      {pendingError && <p className="field-error" role="alert">{pendingError}</p>}
    </div> : <div className="kb-dialog-view">
      {rows.map((row, index) => <article className="kb-dialog-formula" key={row.id}>
        <span>{index + 1}</span>
        <div>
          <strong>{row.formula}</strong>
          {row.annotation && <p>{row.annotation}</p>}
        </div>
      </article>)}
    </div>}

    {error && <p className="field-error kb-dialog-error" role="alert">{error}</p>}

    <footer className="rename-dialog-actions kb-dialog-actions">
      {editing ? <>
        <button className="button secondary" disabled={busy} onClick={stopEditing}>Cancel editing</button>
        <button className="button primary" disabled={!canSave || busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </> : <>
        <button className="button secondary" disabled={busy} onClick={onClose}>Close</button>
        <button className="button primary" disabled={busy} onClick={() => setEditing(true)}>
          <Icon name="edit" size={17} />Edit KB
        </button>
      </>}
    </footer>
  </dialog>;
}
