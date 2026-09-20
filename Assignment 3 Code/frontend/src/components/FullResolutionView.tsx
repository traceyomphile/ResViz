import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {ResolutionResponse} from '../api/knowledgeBase';
import {
    buildResolutionProofTree,
    firstRelevantProofStep,
    layoutResolutionProofTree,
    type PositionedProofNode,
    type ProofInference,
} from '../utils/resolutionProofTree.ts';
import {Icon} from './Icons';

const display = (value: string) => value
    .replace(/<->/g, '↔')
    .replace(/->/g, '→')
    .replace(/~/g, '¬');

const short = (value: string, max = 30) => value.length > max
    ? `${value.slice(0, max - 1)}…`
    : value;

function resultLabel(resolution: ResolutionResponse): string {
    if (resolution.entailed) return 'Entailed';
    if (resolution.status === 'not_entailed') return 'Not entailed';
    return 'Search incomplete';
}

function nodeCaption(node: PositionedProofNode): string {
    if (node.kind === 'empty') return `${node.clauseId} · FINAL CONTRADICTION`;
    if (node.derivationStep !== null) return `${node.clauseId} · STEP ${node.derivationStep + 1}`;
    if (node.isNegatedGoal) return `${node.clauseId} · NEGATED GOAL`;
    return `${node.clauseId} · INPUT CLAUSE`;
}

function walkthroughText(inference: ProofInference, resolution: ResolutionResponse): string {
    const clauses = new Map([
        ...resolution.initial_clauses,
        ...resolution.clauses,
        ...(resolution.graph?.clauses ?? []),
    ].map(clause => [clause.id, clause]));
    const left = clauses.get(inference.parent1)?.expression ?? inference.parent1;
    const right = clauses.get(inference.parent2)?.expression ?? inference.parent2;
    const result = clauses.get(inference.resultId)?.expression ?? inference.resultExpression;
    return `${display(left)}  +  ${display(right)}  ⟶  ${display(result)}`;
}

export function FullResolutionView({
    resolution,
    goal,
    onBack,
    onBackToKnowledgeBase,
}: {
    resolution: ResolutionResponse;
    goal: string;
    onBack(): void;
    onBackToKnowledgeBase(): void;
}) {
    const proof = useMemo(() => buildResolutionProofTree(resolution), [resolution]);
    const layout = useMemo(() => layoutResolutionProofTree(proof), [proof]);
    const [tab, setTab] = useState<'tree' | 'steps' | 'clauses'>('tree');
    const [selected, setSelected] = useState<string | null>(proof.root?.key ?? null);
    const [walkthrough, setWalkthrough] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [scale, setScale] = useState(1);
    const viewport = useRef<HTMLDivElement>(null);
    const drag = useRef<{x: number; y: number; left: number; top: number} | null>(null);
    const anchor = useRef<{x: number; y: number; worldX: number; worldY: number} | null>(null);

    const selectedNode = layout.byKey.get(selected ?? '') ?? null;
    const currentInference = walkthrough ? proof.inferences[stepIndex] ?? null : null;
    const verifiedShortest = Boolean(
        resolution.graph?.shortest_proof?.length
        && resolution.graph.shortest_is_optimal,
    );

    function fit() {
        const element = viewport.current;
        if (!element) return;
        anchor.current = null;
        const next = Math.max(
            0.25,
            Math.min(1.15, (element.clientWidth - 30) / layout.width, (element.clientHeight - 30) / layout.height),
        );
        setScale(next);
        element.scrollLeft = 0;
        element.scrollTop = 0;
    }

    function zoom(value: number, x?: number, y?: number) {
        const element = viewport.current;
        if (!element) return;
        const localX = x ?? element.clientWidth / 2;
        const localY = y ?? element.clientHeight / 2;
        anchor.current = {
            x: localX,
            y: localY,
            worldX: (element.scrollLeft + localX) / scale,
            worldY: (element.scrollTop + localY) / scale,
        };
        setScale(Math.max(0.2, Math.min(3, value)));
    }

    function centerNode(key: string) {
        const element = viewport.current;
        const node = layout.byKey.get(key);
        if (!element || !node) return;
        requestAnimationFrame(() => {
            const left = Math.max(0, (node.x + node.width / 2) * scale - element.clientWidth / 2);
            const top = Math.max(0, (node.y + node.height / 2) * scale - element.clientHeight / 2);
            if (typeof element.scrollTo === 'function') {
                element.scrollTo({left, top, behavior: 'smooth'});
            } else {
                element.scrollLeft = left;
                element.scrollTop = top;
            }
        });
    }

    function jumpToStep(index: number, preferredKey?: string) {
        if (!proof.inferences.length) return;
        const bounded = Math.max(0, Math.min(proof.inferences.length - 1, index));
        setStepIndex(bounded);
        setWalkthrough(true);
        setTab('tree');

        const inference = proof.inferences[bounded];
        const target = preferredKey
            ? layout.byKey.get(preferredKey)
            : layout.nodes.find(node =>
                node.clauseId === inference.resultId && node.derivationStep === bounded,
            );
        if (target) {
            setSelected(target.key);
            centerNode(target.key);
        }
    }

    function selectNode(node: PositionedProofNode) {
        setSelected(node.key);
        const step = firstRelevantProofStep(node, proof.inferences);
        if (step !== null) jumpToStep(step, node.key);
        else centerNode(node.key);
    }

    function showFinalProof() {
        setWalkthrough(false);
        setTab('tree');
        if (proof.root) {
            setSelected(proof.root.key);
            centerNode(proof.root.key);
        }
    }

    useLayoutEffect(() => {
        if (tab !== 'tree' || !viewport.current) return;
        fit();
        // Layout changes only when the proof changes; do not refit while users
        // are walking through steps or selecting nodes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layout, tab]);

    useLayoutEffect(() => {
        const element = viewport.current;
        if (!element || !anchor.current) return;
        const current = anchor.current;
        element.scrollLeft = current.worldX * scale - current.x;
        element.scrollTop = current.worldY * scale - current.y;
        anchor.current = null;
    }, [scale]);

    useEffect(() => {
        const element = viewport.current;
        if (!element || tab !== 'tree') return;
        function wheel(event: WheelEvent) {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            const box = element!.getBoundingClientRect();
            zoom(
                scale * (event.deltaY < 0 ? 1.18 : 1 / 1.18),
                event.clientX - box.left,
                event.clientY - box.top,
            );
        }
        element.addEventListener('wheel', wheel, {passive: false});
        return () => element.removeEventListener('wheel', wheel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scale, tab]);

    const usedInputs = proof.usedInputIds.length;
    const finalExpression = proof.root?.expression ?? '';
    const stepCount = proof.inferences.length;

    if (!proof.root || !stepCount) {
        const incomplete = resolution.status === 'limit_reached';
        return (
            <main className="resolution-screen full-resolution-screen proof-resolution-screen">
                <header className="resolution-heading">
                    <div>
                        <h1>Resolution proof</h1>
                        <span className={`result-badge ${resolution.entailed ? 'result-badge--success' : ''}`}>
                            {resultLabel(resolution)}
                        </span>
                    </div>
                    <p><strong>Goal:</strong> {display(goal)}</p>
                </header>
                <section className="panel proof-empty-state">
                    <span className="proof-empty-symbol">{incomplete ? '…' : '∅'}</span>
                    <h2>{incomplete ? 'No complete proof is available yet' : 'No contradiction proof was produced'}</h2>
                    <p>
                        {incomplete
                            ? 'The resolution search stopped before it could establish a complete result, so there is no final proof tree to draw.'
                            : 'Resolution completed without deriving the empty clause, so there is no entailment proof tree for this goal.'}
                    </p>
                    <div className="graph-detail-actions">
                        <button className="button secondary" onClick={onBack}>Back to CNF</button>
                        <button className="text-button" onClick={onBackToKnowledgeBase}>Back to Knowledge Base</button>
                    </div>
                </section>
            </main>
        );
    }

    const activeIds = currentInference
        ? new Set([currentInference.parent1, currentInference.parent2, currentInference.resultId])
        : new Set<string>();

    return (
        <main className="resolution-screen full-resolution-screen proof-resolution-screen">
            <header className="resolution-heading">
                <div>
                    <h1>Resolution proof</h1>
                    <span className={`result-badge ${resolution.entailed ? 'result-badge--success' : ''}`}>
                        {resultLabel(resolution)}
                    </span>
                </div>
                <p><strong>Goal:</strong> {display(goal)}</p>
            </header>

            <section className="resolution-overview proof-overview">
                <p>
                    This is the proof itself, not the resolution search space. Each derived clause sits below the two clauses used to produce it, and the proof finishes at the empty clause <strong>□</strong>.
                </p>
                <div className="graph-summary">
                    <span>{stepCount} proof {stepCount === 1 ? 'inference' : 'inferences'}</span>
                    <span>{usedInputs} input {usedInputs === 1 ? 'clause' : 'clauses'} used</span>
                    <span>Final clause: <strong>{display(finalExpression)}</strong></span>
                    <span>{verifiedShortest ? 'Verified shortest proof' : 'Proof returned by resolution'}</span>
                </div>
                <div className="proof-help-strip">
                    <strong>Interactive:</strong> click any clause to jump to the step where it is derived or first used, then move through the proof with Previous and Next.
                </div>
            </section>

            <nav className="resolution-tabs" aria-label="Resolution proof views">
                <button className={tab === 'tree' ? 'active' : ''} onClick={() => setTab('tree')}>Proof tree</button>
                <button className={tab === 'steps' ? 'active' : ''} onClick={() => setTab('steps')}>Proof steps</button>
                <button className={tab === 'clauses' ? 'active' : ''} onClick={() => setTab('clauses')}>Input clauses</button>
            </nav>

            {tab === 'tree' && (
                <div className="resolution-layout full-graph-layout proof-tree-layout">
                    <section className="panel full-graph-panel proof-tree-panel">
                        <div className="proof-tree-toolbar">
                            <div className="proof-mode-switch">
                                <button
                                    className={!walkthrough ? 'active' : ''}
                                    onClick={showFinalProof}
                                >
                                    Final proof
                                </button>
                                <button
                                    className={walkthrough ? 'active' : ''}
                                    onClick={() => jumpToStep(walkthrough ? stepIndex : 0)}
                                >
                                    Step through
                                </button>
                            </div>

                            {walkthrough && currentInference && (
                                <div className="proof-step-controls" aria-label="Proof walkthrough controls">
                                    <button
                                        className="button secondary small"
                                        disabled={stepIndex === 0}
                                        onClick={() => jumpToStep(stepIndex - 1)}
                                    >
                                        Previous
                                    </button>
                                    <span><strong>Step {stepIndex + 1}</strong> of {stepCount}</span>
                                    <button
                                        className="button primary small"
                                        disabled={stepIndex >= stepCount - 1}
                                        onClick={() => jumpToStep(stepIndex + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>

                        {walkthrough && currentInference && (
                            <div className="proof-current-step" role="status">
                                <span>Resolve on <strong>{display(currentInference.pivot)}</strong></span>
                                <code>{walkthroughText(currentInference, resolution)}</code>
                            </div>
                        )}

                        <div
                            className="full-graph-viewport proof-tree-viewport"
                            ref={viewport}
                            tabIndex={0}
                            aria-label="Resolution proof tree canvas"
                            onKeyDown={event => {
                                if (event.target !== event.currentTarget) return;
                                if (['+', '=', '-'].includes(event.key)) {
                                    event.preventDefault();
                                    zoom(scale * (event.key === '-' ? 1 / 1.18 : 1.18));
                                }
                                if (event.key === '0') {
                                    event.preventDefault();
                                    fit();
                                }
                                if (walkthrough && event.key === 'ArrowRight' && stepIndex < stepCount - 1) {
                                    event.preventDefault();
                                    jumpToStep(stepIndex + 1);
                                }
                                if (walkthrough && event.key === 'ArrowLeft' && stepIndex > 0) {
                                    event.preventDefault();
                                    jumpToStep(stepIndex - 1);
                                }
                            }}
                            onPointerDown={event => {
                                if (event.button !== 0 || (event.target as Element).closest('[data-proof-node]')) return;
                                const element = event.currentTarget;
                                drag.current = {
                                    x: event.clientX,
                                    y: event.clientY,
                                    left: element.scrollLeft,
                                    top: element.scrollTop,
                                };
                                element.setPointerCapture(event.pointerId);
                                element.classList.add('panning');
                            }}
                            onPointerMove={event => {
                                if (!drag.current) return;
                                event.currentTarget.scrollLeft = drag.current.left - event.clientX + drag.current.x;
                                event.currentTarget.scrollTop = drag.current.top - event.clientY + drag.current.y;
                            }}
                            onPointerUp={event => {
                                drag.current = null;
                                event.currentTarget.classList.remove('panning');
                            }}
                            onLostPointerCapture={event => {
                                drag.current = null;
                                event.currentTarget.classList.remove('panning');
                            }}
                        >
                            <svg
                                className={`full-graph-svg proof-tree-svg ${walkthrough ? 'is-walking' : ''}`}
                                width={layout.width * scale}
                                height={layout.height * scale}
                                viewBox={`0 0 ${layout.width} ${layout.height}`}
                                aria-label="Final binary resolution proof tree"
                            >
                                <defs>
                                    <marker id="proof-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                                        <path d="M0,0 L6,3 L0,6" fill="context-stroke" />
                                    </marker>
                                </defs>

                                {layout.edges.map(edge => {
                                    const parent = layout.byKey.get(edge.from)!;
                                    const child = layout.byKey.get(edge.to)!;
                                    const future = walkthrough && edge.step > stepIndex;
                                    const active = walkthrough && edge.step === stepIndex;
                                    const complete = walkthrough && edge.step < stepIndex;
                                    const x1 = parent.x + parent.width / 2;
                                    const y1 = parent.y + parent.height;
                                    const x2 = child.x + child.width / 2;
                                    const y2 = child.y;
                                    const joinY = y2 - 30;
                                    return (
                                        <path
                                            key={`${edge.from}-${edge.to}`}
                                            className={`proof-tree-edge ${future ? 'future' : ''} ${active ? 'active' : ''} ${complete ? 'complete' : ''}`}
                                            d={`M${x1},${y1} V${joinY} H${x2} V${y2}`}
                                            markerEnd="url(#proof-arrow)"
                                        />
                                    );
                                })}

                                {layout.nodes
                                    .filter(node => node.derivationStep !== null)
                                    .map(node => (
                                        <g key={`pivot-${node.key}`}>
                                            <rect
                                                className="proof-pivot-pill"
                                                x={node.x + node.width / 2 - 43}
                                                y={node.y - 24}
                                                width={86}
                                                height={18}
                                                rx={9}
                                            />
                                            <text
                                                className="proof-pivot-text"
                                                x={node.x + node.width / 2}
                                                y={node.y - 11}
                                            >
                                                on {short(display(node.pivot ?? ''), 10)}
                                            </text>
                                        </g>
                                    ))}

                                {layout.nodes.map(node => {
                                    const future = walkthrough
                                        && node.derivationStep !== null
                                        && node.derivationStep > stepIndex;
                                    const active = walkthrough && activeIds.has(node.clauseId);
                                    const currentResult = walkthrough
                                        && currentInference?.resultId === node.clauseId
                                        && node.derivationStep === stepIndex;
                                    const completed = walkthrough
                                        && node.derivationStep !== null
                                        && node.derivationStep < stepIndex;
                                    return (
                                        <g
                                            key={node.key}
                                            data-proof-node={node.key}
                                            role="button"
                                            tabIndex={0}
                                            className={`proof-tree-node ${node.kind} ${node.isNegatedGoal ? 'negated-goal' : ''} ${selected === node.key ? 'selected' : ''} ${future ? 'future' : ''} ${active ? 'active-step' : ''} ${currentResult ? 'current-result' : ''} ${completed ? 'completed' : ''}`}
                                            aria-label={`${node.clauseId}: ${display(node.expression)}, ${node.derivationStep === null ? 'input clause' : `derived at step ${node.derivationStep + 1}`}`}
                                            onClick={() => selectNode(node)}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    selectNode(node);
                                                }
                                            }}
                                        >
                                            <title>
                                                {nodeCaption(node)}. {display(node.expression)}.
                                                {node.derivationStep === null
                                                    ? ' Click to start where this clause is first used.'
                                                    : ` Click to jump to proof step ${node.derivationStep + 1}.`}
                                            </title>
                                            <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={11} />
                                            <text className="proof-node-caption" x={node.x + 14} y={node.y + 21}>
                                                {nodeCaption(node)}
                                            </text>
                                            <text className="proof-node-expression" x={node.x + 14} y={node.y + 51}>
                                                {node.kind === 'empty' ? '□  Contradiction' : short(display(node.expression), 27)}
                                            </text>
                                            <text className="proof-node-footer" x={node.x + 14} y={node.y + 75}>
                                                {node.isNegatedGoal
                                                    ? 'Added negation of the goal'
                                                    : node.derivationStep !== null
                                                        ? `Derived by resolution · step ${node.derivationStep + 1}`
                                                        : short(node.sourceKnowledgeBase ?? 'Knowledge-base premise', 30)}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>

                        <footer className="proof-toolbar proof-tree-footer">
                            <div className="zoom-tools">
                                <button className="icon-button" aria-label="Zoom out" onClick={() => zoom(scale / 1.18)}>−</button>
                                <span>{Math.round(scale * 100)}%</span>
                                <button className="icon-button" aria-label="Zoom in" onClick={() => zoom(scale * 1.18)}>+</button>
                                <button className="button secondary small" onClick={fit}><Icon name="fit" size={17} />Fit view</button>
                                <button className="button secondary small" onClick={() => zoom(1)}>100%</button>
                            </div>
                            {walkthrough && (
                                <button className="text-button" onClick={showFinalProof}>Show complete proof</button>
                            )}
                        </footer>
                        <p className="graph-pan-hint">Drag the background to pan · Ctrl + wheel or + / − to zoom · ← / → moves through the walkthrough</p>
                    </section>

                    <aside className="panel graph-detail proof-node-detail">
                        <h2>{selectedNode ? selectedNode.clauseId : 'Proof details'}</h2>
                        {selectedNode ? (
                            <>
                                <p>Clause</p>
                                <div className="detail-clause proof-detail-clause">
                                    <strong>{display(selectedNode.expression)}</strong>
                                    {selectedNode.isNegatedGoal && <small>Negated goal</small>}
                                </div>

                                {selectedNode.derivationStep === null ? (
                                    <>
                                        <p>Role in the proof</p>
                                        <div className="proof-detail-copy">
                                            {selectedNode.isNegatedGoal
                                                ? 'This premise is the negation of the goal introduced for proof by contradiction.'
                                                : 'This is an original knowledge-base premise used by the proof.'}
                                        </div>
                                        {selectedNode.sourceKnowledgeBase && (
                                            <><p>Knowledge base</p><div className="proof-detail-copy">{selectedNode.sourceKnowledgeBase}</div></>
                                        )}
                                        {selectedNode.sourceFormula && (
                                            <><p>Source formula</p><div className="proof-detail-copy">{display(selectedNode.sourceFormula)}</div></>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <p>Derived at</p>
                                        <div className="proof-detail-copy">Step {selectedNode.derivationStep + 1}</div>
                                        <p>Resolve on</p>
                                        <div className="proof-detail-copy"><strong>{display(selectedNode.pivot ?? '')}</strong></div>
                                        <p>Parent clauses</p>
                                        <div className="proof-parent-pair">
                                            {selectedNode.parents.map(parent => (
                                                <button key={parent.key} onClick={() => selectNode(layout.byKey.get(parent.key) ?? parent as PositionedProofNode)}>
                                                    <small>{parent.clauseId}</small>
                                                    <strong>{display(parent.expression)}</strong>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                <p className="proof-click-note">
                                    Clicking a clause jumps the walkthrough to where that clause is derived or first contributes to the proof.
                                </p>
                            </>
                        ) : (
                            <p>Select any clause in the proof tree to inspect it or begin walking through the proof from that point.</p>
                        )}
                        <div className="graph-detail-actions">
                            <button className="button secondary" onClick={onBack}>Back to CNF</button>
                            <button className="text-button" onClick={onBackToKnowledgeBase}>Back to Knowledge Base</button>
                        </div>
                    </aside>
                </div>
            )}

            {tab === 'steps' && (
                <section className="panel proof-data graph-data proof-steps-panel">
                    <div className="proof-data-heading">
                        <div>
                            <h2>Proof steps</h2>
                            <p>The same proof in chronological inference order.</p>
                        </div>
                        <button className="button secondary small" onClick={() => jumpToStep(0)}>Walk from step 1</button>
                    </div>
                    <div className="table-scroll">
                        <table className="proof-step-table">
                            <thead>
                                <tr><th>Step</th><th>Parent 1</th><th>Parent 2</th><th>Pivot</th><th>Result</th><th /></tr>
                            </thead>
                            <tbody>
                                {proof.inferences.map((inference, index) => {
                                    const left = proof.clauses.get(inference.parent1);
                                    const right = proof.clauses.get(inference.parent2);
                                    const result = proof.clauses.get(inference.resultId);
                                    return (
                                        <tr key={inference.id} className={walkthrough && stepIndex === index ? 'proof-table-highlight' : ''}>
                                            <td><strong>{index + 1}</strong></td>
                                            <td><small>{inference.parent1}</small>{display(left?.expression ?? inference.parent1)}</td>
                                            <td><small>{inference.parent2}</small>{display(right?.expression ?? inference.parent2)}</td>
                                            <td>{display(inference.pivot)}</td>
                                            <td><small>{inference.resultId}</small><strong>{display(result?.expression ?? inference.resultExpression)}</strong></td>
                                            <td><button className="text-button" onClick={() => jumpToStep(index)}>Show</button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {tab === 'clauses' && (
                <section className="panel proof-data graph-data">
                    <h2>Input clauses</h2>
                    <div className="clause-list">
                        {resolution.initial_clauses.map(clause => (
                            <div className="clause-list-row" key={clause.id}>
                                <span>{clause.id}</span>
                                <strong>{display(clause.expression)}</strong>
                                <small>
                                    {clause.is_negated_goal
                                        ? 'Negated goal'
                                        : clause.source_knowledge_base ?? 'Project input'}
                                </small>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </main>
    );
}
