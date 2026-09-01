import {useState} from 'react';
import type {CNFConversionResponse, ResolutionResponse} from '../api/knowledgeBase';
import './ResolutionView.css';

interface CnfCompleteViewProps {
    conversion: CNFConversionResponse;
    onBack(): void;
    onStartResolution(): void;
}

export function CnfCompleteView({conversion, onBack, onStartResolution}: CnfCompleteViewProps) {
    const supportStart = conversion.cnf_clauses.length;

    return (
        <main className="logic-screen">
            <section className="logic-shell">
                <header className="logic-heading">
                    <h1>CNF Conversion Complete</h1>
                    <p>The project knowledge bases have been converted into one set of CNF clauses.</p>
                </header>
                <div className="negated-query"><strong>Negated query:</strong> {conversion.negated_goal}</div>
                <div className="cnf-clause-stack">
                    {conversion.cnf_clauses.map((clause, index) => (
                        <div className="cnf-clause" key={`kb-${index}`}>
                            <strong>C{index + 1}</strong><code>{clause}</code>
                        </div>
                    ))}
                    {conversion.support_clauses.map((clause, index) => (
                        <div className="cnf-clause" key={`support-${index}`}>
                            <strong>C{supportStart + index + 1}</strong><code>{clause}</code>
                            <span className="support-badge">Set of support</span>
                        </div>
                    ))}
                </div>
                <div className="logic-actions logic-actions--left">
                    <button className="nav-button nav-button--back" type="button" onClick={onBack}>Back</button>
                    <button className="nav-button logic-primary" type="button" onClick={onStartResolution}>Start Resolution</button>
                </div>
            </section>
        </main>
    );
}

interface ProofIntroViewProps {
    goal: string;
    negatedGoal: string;
    isResolving: boolean;
    error: string;
    onBack(): void;
    onBegin(): void;
}

export function ProofIntroView({goal, negatedGoal, isResolving, error, onBack, onBegin}: ProofIntroViewProps) {
    return (
        <main className="logic-screen">
            <section className="logic-shell logic-shell--intro">
                <header className="logic-heading logic-heading--center">
                    <h1>Proof by Contradiction</h1>
                    <p>To determine whether the project entails <strong>{goal}</strong>, we assume the opposite.</p>
                </header>
                <div className="negated-goal-display">{negatedGoal}</div>
                <div className="proof-copy">
                    <p>The negated goal is added to the CNF clauses.</p>
                    <p>Resolution then searches for complementary literals.</p>
                    <p>If the empty clause □ is reached, KB ∧ {negatedGoal} is unsatisfiable.</p>
                    <p>Therefore, {goal} is entailed by the project knowledge bases.</p>
                </div>
                {error && <p className="status-message status-message--error" role="alert">{error}</p>}
                <div className="logic-actions logic-actions--center">
                    <button className="nav-button nav-button--back" type="button" onClick={onBack}>Back</button>
                    <button className="nav-button logic-primary" type="button" onClick={onBegin} disabled={isResolving}>
                        {isResolving ? 'Starting…' : 'Begin Resolution'}
                    </button>
                </div>
            </section>
        </main>
    );
}

interface ResolutionViewProps {
    resolution: ResolutionResponse;
    onBack(): void;
    onBackToKnowledgeBase(): void;
}

function complement(literal: string): string {
    return literal.startsWith('~') ? literal.slice(1) : `~${literal}`;
}

export function ResolutionView({resolution, onBack, onBackToKnowledgeBase}: ResolutionViewProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const step = resolution.steps[stepIndex];
    const clausesById = new Map(resolution.clauses.map((clause) => [clause.id, clause.expression]));

    if (!step) {
        return <main className="logic-screen"><section className="logic-shell logic-shell--intro">
            <header className="logic-heading logic-heading--center">
                <h1>Resolution</h1><p>No resolution steps could be derived.</p>
            </header>
            <div className="logic-actions logic-actions--center">
                <button className="nav-button nav-button--back" type="button" onClick={onBack}>Back</button>
                <button className="nav-button" type="button" onClick={onBackToKnowledgeBase}>Back to Knowledge Base</button>
            </div>
        </section></main>;
    }

    const parentOne = clausesById.get(step.parent_1) ?? step.parent_1;
    const parentTwo = clausesById.get(step.parent_2) ?? step.parent_2;
    const isLast = stepIndex === resolution.steps.length - 1;

    return (
        <main className="logic-screen">
            <section className="logic-shell logic-shell--steps">
                <header className="logic-heading logic-heading--center"><h1>Resolution</h1></header>
                <div className="step-pill">Step {stepIndex + 1} of {resolution.steps.length}</div>
                <section className="resolution-card">
                    <div className="resolution-clause"><strong>{step.parent_1}</strong><code>{parentOne}</code></div>
                    <div className="resolution-operator">+</div>
                    <div className="resolution-clause"><strong>{step.parent_2}</strong><code>{parentTwo}</code></div>
                    <p className="complementary-literals">Complementary literals: <strong>{step.pivot} / {complement(step.pivot)}</strong></p>
                    <div className="resolution-arrow">↓</div>
                    <div className={`resolution-clause resolution-clause--result ${step.resolvent === '□' ? 'resolution-clause--empty' : ''}`}>
                        <strong>{step.resolvent_id}</strong><code>{step.resolvent}</code>
                    </div>
                </section>
                {isLast && <p className={`resolution-outcome ${resolution.entailed ? 'resolution-outcome--success' : ''}`}>
                    {resolution.entailed ? 'Empty clause reached — the query is entailed.' : 'No contradiction was found — the query is not entailed.'}
                </p>}
                {isLast && <div className="resolution-finish-actions">
                    <button className="nav-button" type="button" onClick={onBackToKnowledgeBase}>Back to Knowledge Base</button>
                </div>}
                <div className="step-navigation">
                    <button className="nav-button nav-button--back" type="button" onClick={() => stepIndex ? setStepIndex(stepIndex - 1) : onBack()}>Previous</button>
                    <button className="nav-button" type="button" disabled={isLast} onClick={() => setStepIndex(stepIndex + 1)}>Next</button>
                </div>
            </section>
        </main>
    );
}
