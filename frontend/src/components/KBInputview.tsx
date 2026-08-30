import {useRef,useState} from "react";
import type {InputMethod, KBData} from "../types";
import "./KBInputView.css";

interface KBInputViewProps {
    method: InputMethod;
    projectName: string | null;
    formulas: string[];
    goal: string;
    upload: KBData | null;
    isUploading: boolean;
    isConverting: boolean;
    uploadError: string;
    onUpload(file: File): Promise<void>;
    AddFormula(formula: string): void;
    RemoveFormula(index: number): void;
    GoalChange(goal: string): void;
    Convert(): void;
    onBack(): void;
}

export function KBInputView({
    method,
    projectName,
    formulas,
    goal,
    upload,
    isUploading,
    isConverting,
    uploadError,
    onUpload,
    AddFormula,
    RemoveFormula,
    GoalChange,
    Convert,
    onBack,
}: KBInputViewProps) {
    const [formulaDraft, setFormulaDraft] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    function addDraftFormula() {
        const value = formulaDraft.trim();
        if (!value) return;
        AddFormula(value);
        setFormulaDraft("");
    }

    const canFinish = formulas.length > 0;

    async function selectedFile(file: File | undefined) {
        if (file) await onUpload(file);
    }

    return (
        <main className="input-screen">
            <section className="content-shell content-shell--input">
                <header className="page-heading page-heading--input">
                    <p className="eyebrow">{projectName ? "Sample project" : "Knowledge-base input"}</p>
                    <h1>{projectName ?? (method === "upload" ? "Upload Kb" : "Type KB")}</h1>
                </header>

                <div className="input-layout input-layout--single">
                    {method === "upload" && (
                        <section className="input-panel input-panel--active">
                            <div className="panel-heading">
                                <span className="step-number">01</span>
                                <div>
                                    <h2>Upload KB</h2>
                                    <p>Choose a JSON or line-based knowledge-base file.</p>
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                className="visually-hidden"
                                type="file"
                                accept=".json, .txt, .kb, application/json, text/plain"
                                onChange={(event) => void selectedFile(event.target.files?.[0])}
                            />
                            <button
                                className="upload-zone"
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                            >
                                <span className="upload-icon" aria-hidden="true"></span>
                                <strong>{isUploading ? "uploadin..." : "Choose knowledge-base file"}</strong>
                                <small>Maximum 1 MB · `.json`, `.txt`, `.kb`</small>
                            </button>

                            {uploadError && <p className="status-message status-message--error">{uploadError}</p>}
                            {upload && (
                                <div className="upload-summary" aria-live="polite">
                                    <div>
                                        <span>File</span>
                                        <strong>{upload.fileName}</strong>
                                    </div>
                                    <div>
                                        <span>Formulas loaded</span>
                                    </div>
                                    <p>Knowledge base uploaded successfully.</p>
                                </div>
                            )}

                            <div className="goal-field goal-field--upload">
                                <label htmlFor="goal">Enter goal formula</label>
                                <input
                                    id="goal"
                                    value={goal}
                                    placeholder="Example: S"
                                    onChange={(event) => GoalChange(event.target.value)}
                                />
                            </div>
                        </section>
                    )}

                    {method === "type" && (
                        <section className="input-panel input-panel--active">
                            <div className="panel-heading">
                                <span className="step-number">01</span>
                                <div>
                                    <h2>{projectName ? "Knowledge Base" : "Type KB"}</h2>
                                    <p>
                                        {projectName
                                            ? "The sample is loaded and remains editable."
                                            : "Add one formula at a time. Formula are checked while you type."}
                                    </p>
                                </div>
                            </div>

                            <div className="formula-entry">
                                <label htmlFor="formula">Enter formulas</label>

                                <div className="formula-input-list">

                                    {formulas.map((formula, index) => (
                                        <div className="formula-input-row" key={`${formula}-${index}`}>
                                            <span className="formula-number">
                                                {index + 1}
                                            </span>

                                            <input
                                                type="text"
                                                value={formula}
                                                readOnly
                                            />

                                            <button
                                                type="button"
                                                className="formula-remove"
                                                aria-label={`Remove formula ${index + 1}`}
                                                onClick={() => RemoveFormula(index)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}

                                    <div className="formula-input-row formula-input-row--active">
                                        <span className="formula-number">
                                            {formulas.length + 1}
                                        </span>

                                        <input
                                            id="formula"
                                            type="text"
                                            value={formulaDraft}
                                            placeholder="Enter formula, e.g. M → A"
                                            onChange={(event) => setFormulaDraft(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    addDraftFormula();
                                                }
                                            }}
                                        />
                                    </div>

                                </div>

                                <p className="operator-help">
                                    Allowed operators: ~ &nbsp; · &nbsp; | &nbsp; · &nbsp; → &nbsp; · &nbsp; ↔
                                </p>
                            </div>

                            <div className="goal-field">
                                <label htmlFor="goal">Enter goal formula</label>
                                <input
                                    id="goal"
                                    value={goal}
                                    placeholder="Example: S"
                                    onChange={(event) => GoalChange(event.target.value)}
                                />
                            </div>
                          </section>
                                                
                    )}
                        </div>
                        <div className="screen-actions">
                            <button className="nav-button nav-button--back" type="button" onClick={onBack}>
                                Back
                             </button>
                             <button
                                    className="nav-button"
                                    type="button"
                                    disabled={!canFinish || isUploading || isConverting}
                                    onClick={Convert}
                            >
                                    {isConverting ? "Converting..." : "Convert to CNF"}
                              </button>
                          </div>
            </section>
        </main>
    );
}
