import type {InputMethod} from "../types"

interface KBChoiceViewProps{
    onChoose(method:InputMethod):void;
    onBack():void;
}

export function KBChoiceView({ onChoose,onBack,}:KBChoiceViewProps){
    return(
        <main className="screen">
            <section className="Content-shell">
                <header className="page-heading">
                    <p className="eyebrow">Input method</p>
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
                      <span>Load `.json`, `.txt`, or `.kb`</span>
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
        </main>
    );
}
