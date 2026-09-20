import {useEffect, useRef, useState} from 'react';
import {validateFormula, validateKBFile} from '../types/validator';
import type {SavedProjectKB} from '../api/projects';
import {parseKBContent} from '../utils/kbFiles';
import {createId} from '../utils/id';
import {Icon} from './Icons';
import {WorkspaceHeader} from './AppShell';

interface Row {
  id: string;
  value: string;
  annotation?: string;
}

interface UploadedFile {
  id: string;
  name: string;
}

export interface WorkspaceData {
  name: string;
  formulas: string[];
  annotations?: string[];
  goal: string;
  entryId?: string;
  editor?: {
    rows: Row[];
    files: UploadedFile[];
    pendingFormula?: string;
  };
}

export function KBWorkspace({
  projectName,
  initialFormulas,
  initialAnnotations,
  initialGoal,
  initialName,
  initialEditor,
  entries,
  busy,
  error,
  message,
  onBack,
  onSave,
  onConvert,
  onDraftChange,
  onReading,
}: {
  projectName: string;
  initialFormulas: string[];
  initialAnnotations?: string[];
  initialGoal: string;
  initialName: string;
  initialEditor?: WorkspaceData['editor'];
  entries: SavedProjectKB[];
  busy: boolean;
  error: string;
  message: string;
  onBack(): void;
  onSave(data: WorkspaceData): Promise<boolean>;
  onConvert(data: WorkspaceData): Promise<boolean>;
  onDraftChange(data: WorkspaceData): void;
  onReading(reading: boolean): void;
}) {
  const [name, setName] = useState(initialName);
  const [goal, setGoal] = useState(initialGoal);
  const [rows, setRows] = useState<Row[]>(() =>
    initialEditor?.rows
      ?? initialFormulas.map((value, index) => ({
        id: createId(),
        value,
        annotation: initialAnnotations?.[index] ?? '',
      })),
  );
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingFormula, setPendingFormula] = useState(initialEditor?.pendingFormula ?? '');
  const [composerError, setComposerError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  const locked = busy || uploading;

  useEffect(() => {
    onDraftChange({
      name,
      goal,
      formulas: rows.map(row => row.value),
      annotations: rows.map(row => row.annotation ?? ''),
      editor: {rows, files: [], pendingFormula},
    });
  }, [name, goal, rows, pendingFormula, onDraftChange]);

  const goalValidation = goal.trim() ? validateFormula(goal) : null;
  const rowValidation = rows.map(row =>
    row.value.trim() ? validateFormula(row.value) : {valid: false, error: 'Enter a formula.'},
  );
  const validDraft = Boolean(name.trim())
    && rows.length > 0
    && !pendingFormula.trim()
    && rowValidation.every(result => result.valid);
  const hasSavedFormulas = entries.some(kb => kb.formulas.length > 0);
  const canContinue = Boolean(goal.trim())
    && Boolean(goalValidation?.valid)
    && (hasSavedFormulas || validDraft);

  const data = (): WorkspaceData => ({
    name: name.trim(),
    formulas: rows.map(row => row.value.trim()),
    annotations: rows.map(row => row.annotation?.trim() ?? ''),
    goal: goal.trim(),
    editor: {rows, files: [], pendingFormula},
  });

  function clearBuilder(keepGoal = true) {
    setName('');
    setRows([]);
    setPendingFormula('');
    setComposerError('');
    setFileError('');
    if (!keepGoal) setGoal('');
  }

  function addFormula() {
    if (locked || !pendingFormula.trim()) return;

    const separator = pendingFormula.indexOf('::');
    const value = (separator < 0 ? pendingFormula : pendingFormula.slice(0, separator)).trim();
    const annotation = separator < 0 ? '' : pendingFormula.slice(separator + 2).trim();
    const result = validateFormula(value);

    if (!result.valid) {
      setComposerError(result.error ?? 'Enter a valid formula.');
      return;
    }

    setRows(current => [...current, {id: createId(), value, annotation}]);
    setPendingFormula('');
    setComposerError('');
    composer.current?.focus();
  }

  function chooseFile() {
    input.current?.click();
  }

  function fileNameWithoutExtension(fileName: string) {
    const lastDot = fileName.lastIndexOf('.');
    return (lastDot > 0 ? fileName.slice(0, lastDot) : fileName).trim();
  }

  async function upload(selected: File[]) {
    const file = selected[0];
    if (!file || locked) return;

    setUploading(true);
    onReading(true);
    setFileError('');

    try {
      const result = await validateKBFile(file);
      if (!result.valid) {
        throw new Error(
          `${file.name}: ${result.errors.map(item => `${item.formulaIndex ? `Formula ${item.formulaIndex}: ` : ''}${item.error}`).join(' ')}`,
        );
      }

      const parsed = parseKBContent(file.name, await file.text());
      const parsedRows: Row[] = parsed.rows.map(row => ({
        id: createId(),
        value: row.formula,
        annotation: row.annotation,
      }));
      const uploadedGoal = parsed.goal?.trim() || goal.trim();
      const uploadedName = name.trim() || fileNameWithoutExtension(file.name) || 'Uploaded knowledge base';
      const uploadData: WorkspaceData = {
        name: uploadedName,
        formulas: parsedRows.map(row => row.value.trim()),
        annotations: parsedRows.map(row => row.annotation?.trim() ?? ''),
        goal: uploadedGoal,
        editor: {rows: parsedRows, files: [{id: createId(), name: file.name}], pendingFormula: ''},
      };

      setName(uploadedName);
      setRows(parsedRows);
      if (parsed.goal) setGoal(parsed.goal);

      const saved = await onSave(uploadData);
      if (saved) clearBuilder(true);
    } catch (failure) {
      setFileError(failure instanceof Error ? failure.message : 'Could not read the file.');
    } finally {
      setUploading(false);
      onReading(false);
      if (input.current) input.current.value = '';
    }
  }

  async function addKnowledgeBase() {
    if (!validDraft || locked) return;
    const saved = await onSave(data());
    if (saved) clearBuilder(true);
  }

  return <>
    <WorkspaceHeader projectName={projectName} onProjects={onBack} />
    <main className="kb-workspace">
      <header className="workspace-heading">
        <h1>Build your knowledge base</h1>
        <p>Add new knowledge bases here. Saved knowledge bases stay in the sidebar — click one there to view or edit it.</p>
      </header>

      <div id="kb-editor-panel" role="region" aria-label="Knowledge base editor" className="kb-columns kb-columns--simple">
        <section className="panel kb-panel">
          <div className="panel-heading">
            <span className="round-icon"><Icon name="file" size={29} /></span>
            <div className="kb-panel-heading-copy">
              <div className="kb-panel-title-row">
                <h2>Add a knowledge base</h2>
                <button
                  className="button secondary small kb-heading-add"
                  disabled={!validDraft || locked}
                  onClick={() => void addKnowledgeBase()}
                >
                  <Icon name="plus" size={17} />
                  {busy ? 'Adding…' : 'Add KB'}
                </button>
              </div>
              <p>Upload a valid file for automatic saving, or type formulas manually and add the KB when you are ready.</p>
            </div>
          </div>

          <label className="field-label" htmlFor="kb-name">KB Name</label>
          <input
            id="kb-name"
            value={name}
            maxLength={120}
            onChange={event => setName(event.target.value)}
            placeholder="e.g. Student Eligibility"
            disabled={locked}
          />

          <input
            ref={input}
            type="file"
            className="visually-hidden"
            accept=".json,.txt,.kb"
            onChange={event => void upload(Array.from(event.target.files ?? []))}
          />

          <div
            className="upload-zone"
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              if (!locked) void upload(Array.from(event.dataTransfer.files));
            }}
          >
            <Icon name="upload" size={27} />
            <div>
              <strong>Upload knowledge-base file</strong>
              <small>JSON, TXT or KB · saved automatically after validation</small>
            </div>
            <button className="button outline small" disabled={locked} onClick={chooseFile}>
              {uploading ? 'Saving…' : 'Choose file'}
            </button>
          </div>

          <div className="formula-review formula-review--builder">
            <div className="formula-section-heading">
              <div>
                <strong>Or type formulas</strong>
                <p>Press Enter to add each formula. Notes are optional.</p>
              </div>
              {rows.length > 0 && <span>{rows.length} {rows.length === 1 ? 'formula' : 'formulas'}</span>}
            </div>

            {rows.map((row, index) => <div className="formula-item" key={row.id}>
              <div className="formula-row">
                <span className="formula-number">{index + 1}</span>
                <input
                  aria-label={`Formula ${index + 1}`}
                  value={row.value}
                  disabled={locked}
                  aria-invalid={!rowValidation[index].valid && Boolean(row.value)}
                  placeholder="e.g. Ad → El"
                  onChange={event => setRows(current => current.map(item => item.id === row.id ? {...item, value: event.target.value} : item))}
                />
                <button
                  className="remove-button"
                  aria-label={`Remove formula ${index + 1}`}
                  disabled={locked}
                  onClick={() => setRows(current => current.filter(item => item.id !== row.id))}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              <div className="formula-annotation">
                <label htmlFor={`annotation-${row.id}`}>Annotation <span>optional</span></label>
                <textarea
                  id={`annotation-${row.id}`}
                  aria-label={`Annotation ${index + 1}`}
                  rows={1}
                  value={row.annotation ?? ''}
                  disabled={locked}
                  placeholder="e.g. Students who pass qualify"
                  onChange={event => setRows(current => current.map(item => item.id === row.id ? {...item, annotation: event.target.value} : item))}
                />
              </div>
              {row.value && !rowValidation[index].valid && <p className="field-error" role="alert">{rowValidation[index].error}</p>}
            </div>)}

            <div className="formula-composer">
              <label htmlFor="new-formula">Add a formula <span>press Enter</span></label>
              <input
                ref={composer}
                id="new-formula"
                aria-label="New formula"
                value={pendingFormula}
                disabled={locked}
                aria-invalid={Boolean(composerError)}
                placeholder="Type a formula, then press Enter"
                onChange={event => {
                  setPendingFormula(event.target.value);
                  setComposerError('');
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    addFormula();
                  }
                }}
              />
              <p>Optional note format: <code>P → Q :: Students who pass qualify</code></p>
              {composerError && <p className="field-error" role="alert">{composerError}</p>}
            </div>

          </div>

          {(fileError || error) && <p className="field-error" role="alert">{fileError || error}</p>}
          {message && <p className="kb-inline-message" role="status">{message}</p>}
        </section>

        <section className="panel goal-panel goal-panel--standalone">
          <div className="panel-heading">
            <span className="round-icon"><Icon name="target" size={31} /></span>
            <div>
              <h2>Goal</h2>
              <p>Set the proposition you want to prove. CNF conversion uses every saved knowledge base in this project.</p>
            </div>
          </div>
          <label className="field-label" htmlFor="goal-formula">Resolution goal</label>
          <input
            id="goal-formula"
            aria-label="Goal formula"
            value={goal}
            placeholder="e.g. Pass"
            aria-invalid={Boolean(goalValidation && !goalValidation.valid)}
            disabled={locked}
            onChange={event => setGoal(event.target.value)}
          />
          {goalValidation && !goalValidation.valid && <p className="field-error" role="alert">{goalValidation.error}</p>}
          <div className="goal-kb-summary">
            <Icon name="file" size={17} />
            <span>{entries.length} saved {entries.length === 1 ? 'knowledge base' : 'knowledge bases'} will be included.</span>
          </div>
        </section>
      </div>

      <footer className="workspace-actions workspace-actions--minimal">
        <button className="button primary" disabled={!canContinue || locked} onClick={() => void onConvert(data())}>
          {busy ? 'Working…' : 'Continue to CNF'}
          <Icon name="arrow" size={20} />
        </button>
      </footer>
    </main>
  </>;
}
