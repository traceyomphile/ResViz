import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {ResolutionResponse} from '../api/knowledgeBase';
import {
    buildResolutionProofTree,
    firstRelevantProofStep,
    layoutResolutionProofTree,
    type PositionedProofNode,
    type ProofInference,
} from '../utils/resolutionProofTree';
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
    if (node.usedInProof) return `${node.clauseId} · USED INPUT`;
    return `${node.clauseId} · PROJECT INPUT`;
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
    onContradictionReached,
}: {
    resolution: ResolutionResponse;
    goal: string;
    onBack(): void;
    onBackToKnowledgeBase(): void;
    onContradictionReached?(): void | Promise<void>;
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
    const completionTriggered = useRef(false);
    const [completionOpen, setCompletionOpen] = useState(false);
    const [completionState, setCompletionState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [completionError, setCompletionError] = useState('');

    const selectedNode = layout.byKey.get(selected ?? '') ?? null;
    const currentInference = walkthrough ? proof.inferences[stepIndex] ?? null : null;
    const contradictionStep = useMemo(() => proof.inferences.findIndex(inference => {
        const expression = proof.clauses.get(inference.resultId)?.expression ?? inference.resultExpression;
        return expression.trim() === '□';
    }), [proof]);
    const verifiedShortest = Boolean(
        resolution.graph?.shortest_proof?.length
        && resolution.graph.shortest_is_optimal,
    );
    const usedInputSet = useMemo(() => new Set(proof.usedInputIds), [proof.usedInputIds]);

    function fit() {
        const element = viewport.current;
        if (!element) return;
        anchor.current = null;
        const next = Math.max(
            0.14,
            Math.min(1.15, (element.clientWidth - 30) / layout.width, (element.clientHeight - 30) / layout.height),
        );
        setScale(next);
        requestAnimationFrame(() => {
            element.scrollLeft = 0;
            element.scrollTop = 0;
        });
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
        setScale(Math.max(0.14, Math.min(3, value)));
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

    function focusClauseIds(clauseIds: string[]) {
        const element = viewport.current;
        if (!element) return;
        const nodes = clauseIds
            .map(id => layout.byClauseId.get(id))
            .filter((node): node is PositionedProofNode => Boolean(node));
        if (!nodes.length) return;

        const minX = Math.min(...nodes.map(node => node.x));
        const minY = Math.min(...nodes.map(node => node.y));
        const maxX = Math.max(...nodes.map(node => node.x + node.width));
        const maxY = Math.max(...nodes.map(node => node.y + node.height));
        const focusWidth = maxX - minX + 160;
        const focusHeight = maxY - minY + 170;
        const nextScale = Math.max(
            0.58,
            Math.min(1.55, (element.clientWidth - 36) / focusWidth, (element.clientHeight - 36) / focusHeight),
        );
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        anchor.current = null;
        setScale(nextScale);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const left = Math.max(0, centerX * nextScale - element.clientWidth / 2);
            const top = Math.max(0, centerY * nextScale - element.clientHeight / 2);
            if (typeof element.scrollTo === 'function') {
                element.scrollTo({left, top, behavior: 'smooth'});
            } else {
                element.scrollLeft = left;
                element.scrollTop = top;
            }
        }));
    }

    function focusInference(index: number) {
        const inference = proof.inferences[index];
        if (!inference) return;
        focusClauseIds([inference.parent1, inference.parent2, inference.resultId]);
    }

    async function persistCompletion() {
        setCompletionState('saving');
        setCompletionError('');
        try {
            await onContradictionReached?.();
            setCompletionState('saved');
        } catch (failure) {
            setCompletionState('error');
            setCompletionError(
                failure instanceof Error
                    ? failure.message
                    : 'The contradiction was reached, but the project status could not be saved.',
            );
        }
    }

    function announceContradiction(index: number) {
        if (
            !resolution.entailed
            || contradictionStep < 0
            || index !== contradictionStep
            || completionTriggered.current
        ) return;

        completionTriggered.current = true;
        setCompletionOpen(true);
        void persistCompletion();
    }

    function jumpToStep(index: number, preferredKey?: string) {
        if (!proof.inferences.length) return;
        const bounded = Math.max(0, Math.min(proof.inferences.length - 1, index));
        setStepIndex(bounded);
        setWalkthrough(true);
        setTab('tree');

        const inference = proof.inferences[bounded];
        const preferred = preferredKey ? layout.byKey.get(preferredKey) : null;
        const target = preferred ?? layout.byClauseId.get(inference.resultId);
        if (target) setSelected(target.key);
        requestAnimationFrame(() => focusInference(bounded));
        announceContradiction(bounded);
    }

    function selectNode(node: PositionedProofNode) {
        setSelected(node.key);
        const step = firstRelevantProofStep(node, proof.inferences);
        if (step !== null) {
            jumpToStep(step, node.key);
            return;
        }
        // An unused project clause has no proof step to jump to. Keep it in the
        // overview and explain that status in the details panel.
        setWalkthrough(false);
        setTab('tree');
        centerNode(node.key);
    }

    function showFinalProof() {
        setWalkthrough(false);
        setTab('tree');
        if (proof.root) setSelected(proof.root.key);
        requestAnimationFrame(fit);
    }

    useLayoutEffect(() => {
        if (tab !== 'tree' || !viewport.current) return;
        fit();
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

    const totalInputs = proof.inputClauseIds.length;
    const usedInputs = proof.usedInputIds.length;
    const unusedInputs = proof.unusedInputIds.length;
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

    const selectedPairings = selectedNode
        ? (resolution.graph?.branches ?? []).filter(branch =>
            branch.parent_1 === selectedNode.clauseId || branch.parent_2 === selectedNode.clauseId,
        ).length
        : 0;

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
                    Every starting clause in the project stays visible. Proof edges are drawn only for the clauses that actually contribute to the displayed contradiction proof, so you can see both the full context and the proof itself.
                </p>
                <div className="graph-summary">
                    <span>{totalInputs} project {totalInputs === 1 ? 'clause' : 'clauses'}</span>
                    <span>{usedInputs} used in proof</span>
                    <span>{unusedInputs} not used in this proof</span>
                    <span>{stepCount} proof {stepCount === 1 ? 'inference' : 'inferences'}</span>
                    <span>Final clause: <strong>{display(finalExpression)}</strong></span>
                    <span>{verifiedShortest ? 'Verified shortest proof' : 'Proof returned by resolution'}</span>
                </div>
                <div className="proof-help-strip">
                    <strong>Walkthrough:</strong> Previous and Next automatically zoom to the two parent clauses and their resolvent. All other project clauses remain on the canvas, but fade into the background.
                </div>
            </section>

            <nav className="resolution-tabs" aria-label="Resolution proof views">
                <button className={tab === 'tree' ? 'active' : ''} onClick={() => setTab('tree')}>Proof tree</button>
                <button className={tab === 'steps' ? 'active' : ''} onClick={() => setTab('steps')}>Proof steps</button>
                <button className={tab === 'clauses' ? 'active' : ''} onClick={() => setTab('clauses')}>Project clauses</button>
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
                                    Overview
                                </button>
                                <button
                                    className={walkthrough ? 'active' : ''}
                                    onClick={() => jumpToStep(walkthrough ? stepIndex : 0)}
                                >
                                    Step through
                                </button>
                            </div>

                            <div className="proof-context-legend" aria-label="Proof graph legend">
                                <span className="proof-legend-used">Used in proof</span>
                                <span className="proof-legend-unused">Available input</span>
                                <span className="proof-legend-goal">Negated goal</span>
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
                            aria-label="Resolution proof tree canvas with all project clauses"
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
                                aria-label="Final resolution proof with complete project clause context"
                            >
                                <defs>
                                    <marker id="proof-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                                        <path d="M0,0 L6,3 L0,6" fill="context-stroke" />
                                    </marker>
                                </defs>

                                <text className="proof-input-bank-label" x={48} y={27}>
                                    PROJECT CLAUSES · {totalInputs}
                                </text>
                                <line
                                    className="proof-input-bank-divider"
                                    x1={38}
                                    x2={Math.max(38, layout.width - 38)}
                                    y1={layout.inputBandBottom - 34}
                                    y2={layout.inputBandBottom - 34}
                                />
                                <text className="proof-derivation-label" x={48} y={layout.inputBandBottom - 11}>
                                    PROOF DERIVATIONS
                                </text>

                                {layout.edges.map((edge, index) => {
                                    const parent = layout.byClauseId.get(edge.from)!;
                                    const child = layout.byClauseId.get(edge.to)!;
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
                                            key={`${edge.from}-${edge.to}-${index}`}
                                            className={`proof-tree-edge ${future ? 'future' : ''} ${active ? 'active' : ''} ${complete ? 'complete' : ''}`}
                                            d={`M${x1},${y1} V${joinY} H${x2} V${y2}`}
                                            markerEnd="url(#proof-arrow)"
                                        />
                                    );
                                })}

                                {layout.nodes
                                    .filter(node => node.derivationStep !== null)
                                    .map(node => {
                                        const dimmed = walkthrough && node.derivationStep !== stepIndex;
                                        return (
                                            <g key={`pivot-${node.key}`} className={dimmed ? 'proof-pivot-group dimmed' : 'proof-pivot-group'}>
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
                                        );
                                    })}

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
                                    const unusedInput = node.derivationStep === null && !node.usedInProof;
                                    const contextDimmed = walkthrough && !active;
                                    return (
                                        <g
                                            key={node.key}
                                            data-proof-node={node.key}
                                            role="button"
                                            tabIndex={0}
                                            className={`proof-tree-node ${node.kind} ${node.isNegatedGoal ? 'negated-goal' : ''} ${node.usedInProof && node.derivationStep === null ? 'used-input' : ''} ${unusedInput ? 'unused-input' : ''} ${selected === node.key ? 'selected' : ''} ${future ? 'future' : ''} ${active ? 'active-step' : ''} ${currentResult ? 'current-result' : ''} ${completed ? 'completed' : ''} ${contextDimmed ? 'context-dimmed' : ''}`}
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
                                                {node.derivationStep !== null
                                                    ? ` Click to jump to proof step ${node.derivationStep + 1}.`
                                                    : node.usedInProof
                                                        ? ' Click to jump to the first proof step that uses this clause.'
                                                        : ' This project clause is not used in the displayed proof.'}
                                            </title>
                                            <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={11} />
                                            <text className="proof-node-caption" x={node.x + 14} y={node.y + 21}>
                                                {nodeCaption(node)}
                                            </text>
                                            <text className="proof-node-expression" x={node.x + 14} y={node.y + 51}>
                                                {node.kind === 'empty' ? '□  Contradiction' : short(display(node.expression), 25)}
                                            </text>
                                            <text className="proof-node-footer" x={node.x + 14} y={node.y + 75}>
                                                {node.isNegatedGoal
                                                    ? 'Added negation of the goal'
                                                    : node.derivationStep !== null
                                                        ? `Derived by resolution · step ${node.derivationStep + 1}`
                                                        : unusedInput
                                                            ? 'Available · not used in displayed proof'
                                                            : short(node.sourceKnowledgeBase ?? 'Knowledge-base premise', 28)}
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
                                <button className="button secondary small" onClick={fit}><Icon name="fit" size={17} />Fit all clauses</button>
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
                                    {selectedNode.derivationStep === null && !selectedNode.usedInProof && <small>Not used in displayed proof</small>}
                                </div>

                                {selectedNode.derivationStep === null ? (
                                    <>
                                        <p>Role in the proof</p>
                                        <div className="proof-detail-copy">
                                            {selectedNode.isNegatedGoal
                                                ? 'This clause is the negation of the goal introduced for proof by contradiction.'
                                                : selectedNode.usedInProof
                                                    ? 'This is an original project clause that contributes to the displayed proof.'
                                                    : 'This clause belongs to the project, but it is not required by the displayed proof. It remains on the graph so the complete starting clause set is visible.'}
                                        </div>
                                        {!selectedNode.usedInProof && resolution.graph && (
                                            <>
                                                <p>Resolution search</p>
                                                <div className="proof-detail-copy">
                                                    {selectedPairings > 0
                                                        ? `The full resolution search examined this clause in ${selectedPairings} ${selectedPairings === 1 ? 'pairing' : 'pairings'}, but none was needed for the displayed proof.`
                                                        : 'No recorded pairing involving this clause was needed for the displayed proof.'}
                                                </div>
                                            </>
                                        )}
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
                                            {selectedNode.parents.map(parent => {
                                                const positionedParent = layout.byClauseId.get(parent.clauseId);
                                                return (
                                                    <button
                                                        key={parent.key}
                                                        onClick={() => positionedParent && selectNode(positionedParent)}
                                                    >
                                                        <small>{parent.clauseId}</small>
                                                        <strong>{display(parent.expression)}</strong>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                <p className="proof-click-note">
                                    {selectedNode.derivationStep === null && !selectedNode.usedInProof
                                        ? 'This clause has no step in the displayed proof. Select a used clause, or choose Step through, to focus the proof path.'
                                        : 'Clicking a proof clause jumps to where it is derived or first contributes to the proof, then the graph zooms to that inference.'}
                                </p>
                            </>
                        ) : (
                            <p>Select any clause to inspect its role in the project and in the displayed proof.</p>
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
                            <p>The proof in chronological inference order. Show jumps back to the graph and focuses that inference.</p>
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
                    <div className="proof-data-heading">
                        <div>
                            <h2>Project clauses</h2>
                            <p>Every starting clause is listed here, including clauses that the displayed proof does not use.</p>
                        </div>
                    </div>
                    <div className="clause-list proof-project-clause-list">
                        {resolution.initial_clauses.map(clause => {
                            const used = usedInputSet.has(clause.id);
                            return (
                                <div className="clause-list-row" key={clause.id}>
                                    <span>{clause.id}</span>
                                    <strong>{display(clause.expression)}</strong>
                                    <small>
                                        {clause.is_negated_goal
                                            ? 'Negated goal'
                                            : clause.source_knowledge_base ?? 'Project input'}
                                    </small>
                                    <em className={`proof-clause-status ${used ? 'used' : 'unused'}`}>
                                        {used ? 'Used in proof' : 'Not used in displayed proof'}
                                    </em>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {completionOpen && (
                <div className="proof-completion-backdrop" role="presentation">
                    <section
                        className="proof-completion-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="proof-completion-title"
                        aria-describedby="proof-completion-description"
                    >
                        <div className="proof-completion-symbol" aria-hidden="true">□</div>
                        <div className="proof-completion-copy">
                            <span className="proof-completion-kicker">Contradiction reached</span>
                            <h2 id="proof-completion-title">The goal is entailed</h2>
                            <p id="proof-completion-description">
                                Resolution derived the empty clause <strong>□</strong>. Because adding the negation of
                                <strong> {display(goal)}</strong> leads to a contradiction, the original goal is entailed by the project knowledge base.
                            </p>
                            <div className={`proof-completion-save-state ${completionState}`}>
                                {completionState === 'saving' && 'Saving project as completed…'}
                                {completionState === 'saved' && 'Project status updated to Completed.'}
                                {completionState === 'error' && (completionError || 'Could not save the completed status.')}
                            </div>
                        </div>
                        <div className="proof-completion-actions">
                            {completionState === 'error' && (
                                <button className="button secondary" onClick={() => void persistCompletion()}>
                                    Retry status update
                                </button>
                            )}
                            <button
                                className="button primary"
                                disabled={completionState === 'saving'}
                                onClick={() => setCompletionOpen(false)}
                            >
                                Return to proof
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}
