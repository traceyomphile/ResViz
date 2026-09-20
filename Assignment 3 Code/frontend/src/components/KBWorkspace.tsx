import {useEffect, useRef, useState} from 'react';
import {validateFormula, validateKBFile} from '../types/validator';
import type {SavedProjectKB} from '../api/projects';
import {parseKBContent} from '../utils/kbFiles';
import {createId} from '../utils/id';
import {Icon} from './Icons';
import {WorkspaceHeader} from './Appshell';
interface Row {id: string; value: string; annotation?: string; fileId?: string}
interface UploadedFile {id: string; name: string}
export interface WorkspaceData {name: string; formulas: string[]; annotations?: string[]; goal: string; entryId?: string; editor?: {rows: Row[]; files: UploadedFile[]; pendingFormula?: string}}
export function KBWorkspace({projectName, initialFormulas, initialAnnotations, initialGoal, initialName, initialEditor, entryId, entries, busy, error, message, onBack, onSave, onConvert, onDraftChange, onReading, onDelete}: {
  projectName: string; initialFormulas: string[]; initialAnnotations?: string[]; initialGoal: string; initialName: string; initialEditor?: WorkspaceData['editor']; entryId?: string; entries: SavedProjectKB[];
  busy: boolean; error: string; message: string; onBack(): void; onSave(data: WorkspaceData): Promise<void>; onConvert(data: WorkspaceData): Promise<void>;
  onDraftChange(data: WorkspaceData): void; onDelete(): void; onReading(reading: boolean): void;
}) {
  const [name, setName] = useState(initialName);
  const [goal, setGoal] = useState(initialGoal);
  const [rows, setRows] = useState<Row[]>(() => initialEditor?.rows ?? initialFormulas.map((value, index) => ({id: createId(), value, annotation: initialAnnotations?.[index] ?? ''})));
  const [files, setFiles] = useState<UploadedFile[]>(initialEditor?.files ?? []);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [replaceId, setReplaceId] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  const [pendingFormula, setPendingFormula] = useState(initialEditor?.pendingFormula ?? '');
  const [composerError, setComposerError] = useState('');
  const locked = busy || uploading;
  useEffect(() => {onDraftChange({name, goal, formulas: rows.map(row => row.value), annotations: rows.map(row => row.annotation ?? ''), entryId, editor: {rows, files, pendingFormula}});}, [name, goal, rows, files, pendingFormula, entryId, onDraftChange]);
  const goalValidation = goal.trim() ? validateFormula(goal) : null;
  const invalidRows = rows.map(row => row.value.trim() ? validateFormula(row.value) : {valid: false, error: 'Enter a formula.'});
  const validToSave = !pendingFormula.trim() && Boolean(name.trim()) && (Boolean(entryId) || rows.length > 0) && invalidRows.every(result => result.valid) && (!goal.trim() || goalValidation?.valid);
  const savedEntry = entries.find(kb => kb.id === entryId);
  const currentContent = [name.trim(), rows.map(row => row.value.trim()), rows.map(row => row.annotation?.trim() ?? ''), goal.trim()];
  const savedContent = savedEntry ? [savedEntry.name.trim(), savedEntry.formulas.map(value => value.trim()), savedEntry.formulas.map((_, index) => savedEntry.annotations?.[index]?.trim() ?? ''), savedEntry.goal?.trim() ?? ''] : null;
  const hasChanges = Boolean(savedEntry) && JSON.stringify(currentContent) !== JSON.stringify(savedContent);
  const canSave = validToSave && (!entryId || hasChanges);
  const projectHasFormulas = rows.length > 0 || entries.some(kb => kb.id !== entryId && kb.formulas.length > 0);
  const canContinue = validToSave && projectHasFormulas && goalValidation?.valid;
  const data = () => ({name: name.trim(), formulas: rows.map(row => row.value.trim()), annotations: rows.map(row => row.annotation?.trim() ?? ''), goal: goal.trim(), entryId, editor: {rows, files, pendingFormula}});
  function addFormula() {
    if (locked || !pendingFormula.trim()) return;
    const separator = pendingFormula.indexOf('::');
    const value = (separator < 0 ? pendingFormula : pendingFormula.slice(0, separator)).trim();
    const annotation = separator < 0 ? '' : pendingFormula.slice(separator + 2).trim();
    const result = validateFormula(value);
    if (!result.valid) {setComposerError(result.error ?? 'Enter a valid formula.'); return;}
    setRows(current => [...current, {id: createId(), value, annotation}]);
    setPendingFormula(''); setComposerError(''); composer.current?.focus();
  }
  function chooseFile(id?: string) {setReplaceId(id); input.current?.click();}
  async function upload(selected: File[]) {
    setUploading(true); onReading(true); setFileError('');
    try {
      const additions: {file: UploadedFile; rows: Row[]; goal?: string}[] = [];
      for (const file of selected) {
        const result = await validateKBFile(file);
        if (!result.valid) throw new Error(`${file.name}: ${result.errors.map(e => `${e.formulaIndex ? `Formula ${e.formulaIndex}: ` : ''}${e.error}`).join(' ')}`);
        const content = await file.text();
        const parsed = parseKBContent(file.name, content);
        const id = createId();
        additions.push({file: {id, name: file.name}, rows: parsed.rows.map(row => ({id: createId(), value: row.formula, annotation: row.annotation, fileId: id})), goal: parsed.goal});
      }
      setRows(current => [...current.filter(row => !replaceId || row.fileId !== replaceId), ...additions.flatMap(item => item.rows)]);
      setFiles(current => [...current.filter(file => file.id !== replaceId), ...additions.map(item => item.file)]);
      const uploadedGoal = additions.find(item => item.goal)?.goal;
      if (uploadedGoal) setGoal(uploadedGoal);
    } catch (failure) {setFileError(failure instanceof Error ? failure.message : 'Could not read the file.');}
    finally {setUploading(false); onReading(false); setReplaceId(undefined); if (input.current) input.current.value = '';}
  }
  return <><WorkspaceHeader projectName={projectName} onProjects={onBack} /><main className="kb-workspace">
    <header className="workspace-heading"><h1>Build your knowledge base</h1><p>Enter a name for your knowledge base, add formulas via file upload or by typing them manually, and set the goal formula. Formulas are checked while you type.</p></header>
    <div id="kb-editor-panel" role="region" aria-label="Knowledge base editor" className="kb-columns"><section className="panel kb-panel"><div className="panel-heading"><span className="round-icon"><Icon name="file" size={29} /></span><div><h2>Knowledge Base</h2><p>Upload a file or type formulas manually. You can review and edit all formulas below.</p></div></div>
      <label className="field-label" htmlFor="kb-name">KB Name</label><input id="kb-name" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="e.g. Student Eligibility" disabled={locked} />
      <input ref={input} type="file" className="visually-hidden" accept=".json,.txt,.kb" multiple={!replaceId} onChange={e => void upload(Array.from(e.target.files ?? []))} />
      <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); if (!locked) {setReplaceId(undefined); void upload(Array.from(e.dataTransfer.files));}}}><Icon name="upload" size={27} /><div><strong>Upload knowledge-base file</strong><small>JSON or TXT · Maximum 5 MB</small></div><button className="button outline small" disabled={locked} onClick={() => chooseFile()}>{uploading ? 'Reading…' : 'Choose file'}</button></div>
        {files.length > 0 && <div className="uploaded-files"><div className="files-heading"><strong>Uploaded files</strong><span>{files.length} {files.length === 1 ? 'file' : 'files'}</span></div>{files.map(file => <div className="file-row" key={file.id}><Icon name="file" size={21} /><span>{file.name}</span><button className="text-button" disabled={locked} onClick={() => chooseFile(file.id)}><Icon name="refresh" size={16} />Replace</button><button className="remove-button" disabled={locked} aria-label={`Remove ${file.name}`} onClick={() => {setFiles(current => current.filter(item => item.id !== file.id)); setRows(current => current.filter(row => row.fileId !== file.id));}}><Icon name="close" size={18} /></button></div>)}<button className="add-button" disabled={locked} onClick={() => chooseFile()}><Icon name="plus" size={18} />Add another file</button></div>}
      <div className="formula-review"><strong>Review and edit formulas</strong><p>Edit a formula and optionally add a note explaining it.</p><p className="annotation-upload-hint">TXT / KB format: <code>P → Q :: Optional annotation</code></p>{rows.map((row, i) => <div className="formula-item" key={row.id}><div className="formula-row"><span className="formula-number">{i + 1}</span><input aria-label={`Formula ${i + 1}`} value={row.value} disabled={locked} aria-invalid={!invalidRows[i].valid && Boolean(row.value)} placeholder="e.g. Ad → El" onKeyDown={event => {if (event.key === 'Enter' && !event.nativeEvent.isComposing) {event.preventDefault(); composer.current?.focus();}}} onChange={e => setRows(current => current.map(item => item.id === row.id ? {...item, value: e.target.value} : item))} /><button className="remove-button" aria-label={`Remove formula ${i + 1}`} disabled={locked} onClick={() => setRows(current => current.filter(item => item.id !== row.id))}><Icon name="close" size={18} /></button></div><div className="formula-annotation"><label htmlFor={`annotation-${row.id}`}>Annotation <span>optional</span></label><textarea id={`annotation-${row.id}`} aria-label={`Annotation ${i + 1}`} rows={1} value={row.annotation ?? ''} disabled={locked} placeholder="e.g. Students who pass qualify" onChange={e => setRows(current => current.map(item => item.id === row.id ? {...item, annotation: e.target.value} : item))} /></div>{row.value && !invalidRows[i].valid && <p className="field-error" role="alert">{invalidRows[i].error}</p>}</div>)}
        <div className="formula-composer"><label htmlFor="new-formula">Add a formula <span>press Enter</span></label><input ref={composer} id="new-formula" aria-label="New formula" value={pendingFormula} disabled={locked} aria-invalid={Boolean(composerError)} placeholder="Type a formula, then press Enter" onChange={event => {setPendingFormula(event.target.value); setComposerError('');}} onKeyDown={event => {if (event.key === 'Enter' && !event.nativeEvent.isComposing) {event.preventDefault(); addFormula();}}} /><p>Press <kbd>Enter</kbd> to add. An optional note can follow <code>::</code>, or be added below the formula.</p>{composerError && <p className="field-error" role="alert">{composerError}</p>}</div></div>
      {(fileError || error) && <p className="field-error" role="alert">{fileError || error}</p>}
    </section><div className="kb-right-column"><section className="panel goal-panel"><div className="panel-heading"><span className="round-icon"><Icon name="target" size={31} /></span><div><h2>Goal</h2><p>Specify the goal to prove using every knowledge base in this project.</p></div></div><input aria-label="Goal formula" value={goal} placeholder="e.g. Pass" aria-invalid={Boolean(goalValidation && !goalValidation.valid)} disabled={locked} onChange={e => setGoal(e.target.value)} />{goalValidation && !goalValidation.valid && <p className="field-error" role="alert">{goalValidation.error}</p>}</section>
      <section className="panel syntax-panel"><div className="panel-heading"><span className="round-icon"><Icon name="book" size={31} /></span><div><h2>Syntax guide</h2><p>Use the following operators in your formulas.</p></div></div><div className="syntax-operators">{[['¬','Not','negation'],['&','And','conjunction'],['|','Or','disjunction'],['→','Implies','implication'],['↔','Iff','biconditional']].map(([symbol, title, desc]) => <div key={symbol}><strong>{symbol}</strong><span>{title}</span><small>({desc})</small></div>)}</div><div className="syntax-tip"><span>i</span><p>Tip: <em>Use parentheses to clarify the order of operations.</em><br /><strong>Example:</strong> <i className="math">(A &amp; B) → C</i></p></div></section>
    </div></div>
    <div className="kb-save-note">{message && <p role="status">{message}</p>}<p>{entryId ? 'Continue to CNF saves edits across your knowledge bases and uses all knowledge bases in this project. Save changes keeps edits in this KB without running conversion.' : 'Add this knowledge base to your project before continuing to CNF.'}</p></div>
    <footer className="workspace-actions"><button className="button secondary" disabled={locked} onClick={onBack}>Back</button>{entryId && <button className="button delete-kb-button" disabled={locked} onClick={onDelete}><Icon name="trash" size={17} />Delete KB</button>}<button className={`button ${entryId ? 'secondary' : 'primary'}`} disabled={!canSave || locked} onClick={() => void onSave(data())}>{busy ? 'Saving…' : entryId ? 'Save changes' : 'Add KB'}{!entryId && <Icon name="plus" size={20} />}</button>{entryId && <button className="button primary" disabled={!canContinue || locked} onClick={() => void onConvert(data())}>{busy ? 'Working…' : 'Continue to CNF'}<Icon name="arrow" size={20} /></button>}</footer>
  </main></>;
}
