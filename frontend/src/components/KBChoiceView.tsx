import "./KBChoiceView.css";
import { useEffect, useState } from "react";
import type {InputMethod} from "../types"
import { validateFormula } from "../types/validator";
import { 
    deleteSavedKnowledgeBase,
    listKnowledgeBases, 
    type KnowledgeBaseEntrySummary 
} from "../api/knowledgeBase";

interface KBChoiceViewProps{
    projectId: string;
    refreshKey?: number;
    isConverting: boolean;
    error?: string;
    query: string;
    activeKnowledgeBaseId: string | null;
    onChoose(method:InputMethod):void;
    onQueryChange(query: string): void;
    onBack():void;
    onConvert():void;
    onSelectKnowledgeBase?(kb: KnowledgeBaseEntrySummary): void
}

export function KBChoiceView({ projectId, refreshKey = 0, isConverting, error, query, activeKnowledgeBaseId, onChoose, onQueryChange, onBack, onConvert, onSelectKnowledgeBase }:KBChoiceViewProps){
    const [savedKbs, setSavedKbs] = useState<KnowledgeBaseEntrySummary[]>([]);
    const [kbsLoading, setKbsLoading] = useState(true);
    const [kbsError, setKbsError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const trimmedQuery = query.trim();
    const queryResult = trimmedQuery ? validateFormula(trimmedQuery) : null;
    const queryError = queryResult && !queryResult.valid
        ? queryResult.error ?? "Invalid query formula."
        : null;
    const canConvert = Boolean(activeKnowledgeBaseId) && Boolean(trimmedQuery) && !queryError;

    async function removeKnowledgeBase(kb: KnowledgeBaseEntrySummary) {
        setDeletingId(kb.id);
        setKbsError(null);
        try {
            await deleteSavedKnowledgeBase(projectId, kb.id);
            setSavedKbs((current) => current.filter((item) => item.id !== kb.id));
        } catch (err: unknown) {
            setKbsError(err instanceof Error ? err.message : "Could not remove the knowledge base");
        } finally {
            setDeletingId(null);
        }
    }

    useEffect(() => {
        let cancelled = false;

        const loadSavedKnowledgeBases = async () => {
            setKbsLoading(true);
            setKbsError(null);

            try {
                const response = await listKnowledgeBases(projectId);
                if (!cancelled) {
                    setSavedKbs(response.knowledge_bases);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setKbsError(err instanceof Error ? err.message : "Could not load saved knowledge base");
                }
            } finally {
                if (!cancelled) {
                    setKbsLoading(false);
                }
            }
        };

        void loadSavedKnowledgeBases();

        return () => {
            cancelled = true;
        };
    }, [projectId, refreshKey]);

    return(
        <main className="kb-choice-screen">
            <div className="kb-choice-layout">
                <aside className="kb-sidebar">
                    <h2 className="kb-sidebar__heading">Saved Knowledge Bases</h2>
 
                    {kbsLoading && (
                        <p className="kb-sidebar__status">Loading…</p>
                    )}
 
                    {!kbsLoading && kbsError && (
                        <p className="kb-sidebar__status kb-sidebar__status--error">{kbsError}</p>
                    )}
 
                    {!kbsLoading && !kbsError && savedKbs.length === 0 && (
                        <p className="kb-sidebar__status">No knowledge bases saved yet.</p>
                    )}
 
                    {!kbsLoading && !kbsError && savedKbs.length > 0 && (
                        <ul className="kb-sidebar__list">
                            {savedKbs.map((kb) => (
                                <li key={kb.id}>
                                    <div className={`kb-sidebar__row${activeKnowledgeBaseId === kb.id ? ' kb-sidebar__row--active' : ''}`}
                                    >
                                        <button
                                            type="button"
                                            className="kb-sidebar__item"
                                            onClick={() => onSelectKnowledgeBase?.(kb)}
                                        >
                                            <strong>{kb.name}</strong>
                                            <span>
                                                {kb.formula_count} formula{kb.formula_count === 1 ? "" : "s"}
                                            </span>
                                        </button>

                                        <button
                                            type='button' className="kb-sidebar__remove"
                                            aria-label={`Remove ${kb.name}`}
                                            disabled={deletingId === kb.id}
                                            onClick={() => void removeKnowledgeBase(kb)}
                                        >
                                            {deletingId === kb.id ? '...' : 'x'}
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                <section className="content-shell">
                    <header className="page-heading">
                        <h1>Knowledge Base</h1>
                        <p>Upload a prepared file or enter formulas manually.</p>
                    </header>

                    <div className="choice-grid">
                        <button
                        className="choice-card"
                        type="button"
                        onClick={()=> onChoose("upload")}
                        >
                        <strong>Upload KB</strong>
                        <span>Load `.json`</span>
                        </button>
                        <button
                            className="choice-card"
                            type="button"
                            onClick={()=> onChoose("type")}
                        >
                            <strong>TypeKB</strong>
                            <span>Add formulas one at a time</span>
                        </button>
                    </div>

                    <div className="query-field">
                        <label htmlFor="resolution-query">Resolution query</label>
                        <input id="resolution-query" type="text" value={query}
                            placeholder="Enter query, e.g. Q"
                            aria-invalid={Boolean(queryError)}
                            onChange={(event) => onQueryChange(event.target.value)} />
                        {queryError ? (
                            <p className="query-message query-message--error" role="alert">{queryError}</p>
                        ) : trimmedQuery ? (
                            <p className="query-message query-message--valid">Query is valid.</p>
                        ) : (
                            <p className="query-message">Select a saved KB and add a valid query to continue.</p>
                        )}
                    </div>

                    <div className="screen-actions screen-actions--choice">
                        <button className="nav-button nav-button--back" type="button" onClick={onBack}>
                            Back
                        </button>

                        <button
                            className="nav-button nav-button--convert"
                            type='button'
                            disabled={isConverting || !canConvert}
                            onClick={onConvert}
                        >
                            {isConverting ? 'Converting...' : 'Convert to CNF'}
                        </button>
                    </div>
                    {error && <p className='kb-choice-error' role='alert'>{error}</p>}
                </section>
            </div>
        </main>
    );
}
