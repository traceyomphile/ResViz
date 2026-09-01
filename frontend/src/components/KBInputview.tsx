import { useEffect, useRef, useState } from "react";
import type { InputMethod, KBData } from "../types";
import { validateFormula, validateKBFile } from "../types/validator";
import type { UploadedFormulaError } from "../types/validator";
import "./KBInputView.css";

export interface SavedKB{
    id?: string;
    name: string;
    method: InputMethod;
    formulas: string[];
    upload: KBData | null;
}

interface KBInputViewProps {
    method: InputMethod;
    projectName: string | null;
    kbName: string;
    editingKnowledgeBaseId: string | null;
    formulas: string[];
    upload: KBData | null;
    isUploading: boolean;
    isSaving: boolean;
    uploadError: string;
    onUpload(file: File): Promise<void>;
    AddFormula(formula: string): void;
    RemoveFormula(index: number): void;
    KBNameChange(name: string): void;
    SaveKB(kb: SavedKB): void;
    onBack(): void;
}

export function KBInputView({
    method,
    projectName,
    kbName,
    editingKnowledgeBaseId,
    formulas,
    upload,
    isUploading,
    isSaving,
    uploadError,
    onUpload,
    AddFormula,
    RemoveFormula,
    KBNameChange,
    SaveKB,
    onBack,
}: KBInputViewProps) {
    const [formulaDraft, setFormulaDraft] = useState("");
    const [formulaError, setFormulaError] = useState<string | null>(null);
    const [kbNameTouched, setKbNameTouched] = useState(false);
    const [uploadValidationErrors, setUploadValidationErrors] = useState<UploadedFormulaError[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const trimmedName = kbName.trim();
    const kbNameError = kbNameTouched && !trimmedName ? 'Knowledge base name is required.' : null;

    useEffect(() => {
        const value = formulaDraft.trim();

        if (!value) {
            return;
        }

        const timer = window.setTimeout(() => {
            const result = validateFormula(value);
            setFormulaError(result.valid ? null : result.error ?? 'Invalid formula');
        }, 500);

        return () => window.clearTimeout(timer);
    }, [formulaDraft]);

    function addDraftFormula() {
        const value = formulaDraft.trim();
        if (!value) return
        const result = validateFormula(value);
        if (!result.valid) {
            setFormulaError(
                result.error ?? "Invalid formula."
            );

            return;
        }
        AddFormula(value);
        setFormulaDraft("");
        setFormulaError(null);   
    }

    async function selectedFile(file: File | undefined) {
        if (!file) return;

        setUploadValidationErrors([]);

        const result = await validateKBFile(file);

        if (!result.valid) {
            setUploadValidationErrors(result.errors);
            return;
        }

        await onUpload(file);
    }
    const hasKB= method === "upload" ? Boolean(upload) : formulas.length >0;
    const canSave =hasKB && uploadValidationErrors.length === 0 && Boolean (trimmedName);

    async function handleSaveClick(){
        setKbNameTouched(true);
        if (!canSave) return;

        await SaveKB({
            id: editingKnowledgeBaseId ?? undefined,
            name: trimmedName,
            method,
            formulas,
            upload,
        });
    }

   return (
    <main className="input-screen">
      <section className="content-shell content-shell--input">
        <header className="page-heading page-heading page-heading--input">
          <p className="eyebrow">Project input</p>

          <h1>{projectName ?? "New project"}</h1>
        </header>

        <div className="input-layout input-layout--single">
          <section className="input-panel input-panel--active">
            <div className="kb-name-field">
              <label htmlFor="kb-name">KB Name</label>

              <input id="kb-name" type="text" value={kbName}
                placeholder="Example: Block World KB" aria-invalid={Boolean(kbNameError)}

                onChange={(event) => KBNameChange(event.target.value)}
                onBlur={() => setKbNameTouched(true)} />

              {kbNameError && <p className="status-message status-message--error">{kbNameError}</p>}
            </div>

            {method === "upload" ? (
              <>
                <div className="panel-heading">
                    <span className="step-number">01</span>
                    <div>
                    <h2>
                        Upload KB
                        </h2>

                        <p>Choose a JSON or line-based knowledge-base file.</p>
                    </div>
                </div>

                <input 
                    ref={fileInputRef} 
                    className="visually-hidden" 
                    type="file"
                    accept=".json,.txt,.kb,application/json,text/plain"
                    onChange={(event) => void selectedFile(event.target.files?.[0])} 
                />

                <button className="upload-zone" 
                    type="button"
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isUploading || isSaving}
                >
                  <span className="upload-icon" aria-hidden="true" />
                  <strong>{isUploading ? "Uploading..." : "Choose knowledge-base file"}</strong>
                  <small>Maximum 5 MB · `.json`</small>
                </button>

                {uploadValidationErrors.length > 0 && 
                <div>
                  <p className="status-message status-message--error">Found {uploadValidationErrors.length} invalid {uploadValidationErrors.length === 1 ? "formula" : "formulas"}.</p>
                  {uploadValidationErrors.map((error, index) => <p className="status-message status-message--error"
                    key={`${error.line ?? error.formulaIndex ?? index}-${error.error}`}>
                    {error.line !== undefined && <>Line {error.line}: </>}
                    {error.formulaIndex !== undefined && <>Formula {error.formulaIndex}: </>}
                    {error.formula && <>“{error.formula}” — </>}{error.error}
                  </p>)}

                </div>}

                {upload && <div className="upload-summary" aria-live="polite">
                  <div><span>File</span><strong>{upload.fileName}</strong></div>
                  <div><span>Formulas loaded</span><strong>{upload.formulas.length}</strong></div>
                  <p>Knowledge base uploaded successfully.</p>
                </div>}
              </>
            ) : (
              <>
                <div className="panel-heading"><span className="step-number">01</span><div>
                  <h2>{projectName ? "Knowledge Base" : "Type KB"}</h2>
                  <p>Add one formula at a time. Formulas are checked while you type.</p>
                </div></div>
                <div className="formula-entry"><label htmlFor="formula">Enter formulas</label>
                  <div className="formula-input-list">
                    {formulas.map((formula, index) => <div className="formula-input-row" key={`${formula}-${index}`}>
                      <span className="formula-number">{index + 1}</span>
                      <input type="text" value={formula} readOnly />
                      <button type="button" className="formula-remove" aria-label={`Remove formula ${index + 1}`}
                        onClick={() => RemoveFormula(index)}>×</button>
                    </div>)}
                    <div className="formula-input-row formula-input-row--active">
                      <span className="formula-number">{formulas.length + 1}</span>
                      <input id="formula" type="text" value={formulaDraft} placeholder="Enter formula, e.g. M → A"
                        aria-invalid={Boolean(formulaError)} onChange={(event) => setFormulaDraft(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDraftFormula(); } }} />
                    </div>
                  </div>
                  {formulaError && <p className="status-message status-message--error">{formulaError}</p>}
                  <p className="operator-help">Allowed operators: ~ · | · → · ↔</p>
                </div>
              </>
            )}
            {uploadError && <p className="status-message status-message--error" role="alert">{uploadError}</p>}
          </section>
        </div>

        <div className="screen-actions">
          <button className="nav-button nav-button--back" type="button" onClick={onBack}>Back</button>
          <button className="nav-button" type="button" disabled={!canSave || isUploading || isSaving}
            onClick={() => void handleSaveClick()}>{isSaving ? "Saving..." : editingKnowledgeBaseId ? "Save changes" : "Save KB"}</button>
        </div>
      </section>
    </main>
  );
}
