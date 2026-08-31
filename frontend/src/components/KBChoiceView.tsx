import "./KBChoiceView.css";
import { useEffect, useState } from "react";
import type {InputMethod} from "../types"
import { listKnowledgeBases, type KnowledgeBaseEntrySummary } from "../api/knowledgeBase";


interface KBChoiceViewProps{
    projectId: string;
    onChoose(method:InputMethod):void;
    onBack():void;
    onSelectKnowledgeBase?(kb: KnowledgeBaseEntrySummary): void
}

export function KBChoiceView({ projectId, onChoose, onBack, onSelectKnowledgeBase }:KBChoiceViewProps){
    const [savedKbs, setSavedKbs] = useState<KnowledgeBaseEntrySummary[]>([]);
    const [kbsLoading, setKbsLoading] = useState(true);
    const [kbsError, setKbsError] = useState<string | null>(null);

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
    }, [projectId]);

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

                    <div className="screen-actions screen-actions--choice">
                        <button className="nav-button nav-button--back" type="button" onClick={onBack}>
                            Back
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}
