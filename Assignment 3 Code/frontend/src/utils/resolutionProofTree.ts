import type {
    ResolutionBranch,
    ResolutionClause,
    ResolutionResponse,
} from '../api/knowledgeBase';

export interface ProofInference {
    index: number;
    id: string;
    parent1: string;
    parent2: string;
    pivot: string;
    resultId: string;
    resultExpression: string;
}

export interface ProofTreeNode {
    key: string;
    clauseId: string;
    expression: string;
    sourceFormula: string | null;
    sourceKnowledgeBase: string | null;
    isNegatedGoal: boolean;
    kind: 'input' | 'derived' | 'empty';
    derivationStep: number | null;
    inferenceId: string | null;
    pivot: string | null;
    level: number;
    parents: ProofTreeNode[];
    usedInProof: boolean;
}

export interface ProofTree {
    root: ProofTreeNode | null;
    nodes: ProofTreeNode[];
    inferences: ProofInference[];
    clauses: Map<string, ResolutionClause>;
    inputClauseIds: string[];
    usedInputIds: string[];
    unusedInputIds: string[];
    maxLevel: number;
    source: 'shortest-proof' | 'resolution-trace' | 'none';
}

export interface PositionedProofNode extends ProofTreeNode {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ProofTreeEdge {
    from: string;
    to: string;
    step: number;
    pivot: string;
}

export interface ProofTreeLayout {
    nodes: PositionedProofNode[];
    byKey: Map<string, PositionedProofNode>;
    byClauseId: Map<string, PositionedProofNode>;
    edges: ProofTreeEdge[];
    width: number;
    height: number;
    inputBandBottom: number;
}

function clauseMap(response: ResolutionResponse): Map<string, ResolutionClause> {
    const result = new Map<string, ResolutionClause>();
    for (const clause of response.initial_clauses) result.set(clause.id, clause);
    for (const clause of response.clauses) result.set(clause.id, clause);
    for (const clause of response.graph?.clauses ?? []) result.set(clause.id, clause);
    return result;
}

function graphInferences(response: ResolutionResponse, clauses: Map<string, ResolutionClause>): ProofInference[] {
    const graph = response.graph;
    if (!graph?.shortest_proof?.length) return [];

    const byId = new Map<string, ResolutionBranch>(graph.branches.map(branch => [branch.id, branch]));
    return graph.shortest_proof.flatMap((branchId, index) => {
        const branch = byId.get(branchId);
        if (!branch?.result_id) return [];
        return [{
            index,
            id: branch.id,
            parent1: branch.parent_1,
            parent2: branch.parent_2,
            pivot: branch.pivot ?? '',
            resultId: branch.result_id,
            resultExpression: clauses.get(branch.result_id)?.expression ?? branch.expression,
        }];
    });
}

function traceInferences(response: ResolutionResponse): ProofInference[] {
    return response.steps.map((step, index) => ({
        index,
        id: `S${step.step_number}`,
        parent1: step.parent_1,
        parent2: step.parent_2,
        pivot: step.pivot.replace(/^~/, ''),
        resultId: step.resolvent_id,
        resultExpression: step.resolvent,
    }));
}

function syntheticClause(id: string, expression = id): ResolutionClause {
    return {id, expression, source_formula: null};
}

/**
 * Builds the displayed contradiction proof while keeping the complete set of
 * original project clauses available to the visualiser.
 *
 * The backend's full graph contains every search alternative. We deliberately
 * do not render those alternatives in the proof view. Instead, shortest_proof
 * (or the regular step trace as a fallback) identifies the actual inference
 * chain, while every original input clause remains visible as context.
 *
 * Unlike the older tree builder, clause nodes are unique by clause id. This
 * means the renderer behaves like a proof DAG when a derived clause is reused,
 * while still reading visually as a top-down resolution proof.
 */
export function buildResolutionProofTree(response: ResolutionResponse): ProofTree {
    const clauses = clauseMap(response);
    let inferences = graphInferences(response, clauses);
    let source: ProofTree['source'] = 'shortest-proof';

    if (!inferences.length && response.steps.length) {
        inferences = traceInferences(response);
        source = 'resolution-trace';
    }

    const inputClauseIds = response.initial_clauses.map(clause => clause.id);

    if (!inferences.length) {
        const nodes = response.initial_clauses.map(clause => ({
            key: `clause:${clause.id}`,
            clauseId: clause.id,
            expression: clause.expression,
            sourceFormula: clause.source_formula,
            sourceKnowledgeBase: clause.source_knowledge_base ?? null,
            isNegatedGoal: Boolean(clause.is_negated_goal),
            kind: 'input' as const,
            derivationStep: null,
            inferenceId: null,
            pivot: null,
            level: 0,
            parents: [],
            usedInProof: false,
        }));
        return {
            root: null,
            nodes,
            inferences: [],
            clauses,
            inputClauseIds,
            usedInputIds: [],
            unusedInputIds: [...inputClauseIds],
            maxLevel: 0,
            source: 'none',
        };
    }

    for (const inference of inferences) {
        if (!clauses.has(inference.parent1)) clauses.set(inference.parent1, syntheticClause(inference.parent1));
        if (!clauses.has(inference.parent2)) clauses.set(inference.parent2, syntheticClause(inference.parent2));
        if (!clauses.has(inference.resultId)) {
            clauses.set(inference.resultId, syntheticClause(inference.resultId, inference.resultExpression));
        }
    }

    const derivationByResult = new Map(inferences.map(inference => [inference.resultId, inference]));
    const usedClauseIds = new Set<string>();
    for (const inference of inferences) {
        usedClauseIds.add(inference.parent1);
        usedClauseIds.add(inference.parent2);
        usedClauseIds.add(inference.resultId);
    }

    const levelMemo = new Map<string, number>();
    const levelActive = new Set<string>();
    function levelFor(clauseId: string): number {
        if (levelMemo.has(clauseId)) return levelMemo.get(clauseId)!;
        const inference = derivationByResult.get(clauseId);
        if (!inference || levelActive.has(clauseId)) {
            levelMemo.set(clauseId, 0);
            return 0;
        }
        levelActive.add(clauseId);
        const level = Math.max(levelFor(inference.parent1), levelFor(inference.parent2)) + 1;
        levelActive.delete(clauseId);
        levelMemo.set(clauseId, level);
        return level;
    }

    const nodeByClauseId = new Map<string, ProofTreeNode>();
    const buildActive = new Set<string>();
    function materialise(clauseId: string): ProofTreeNode {
        const existing = nodeByClauseId.get(clauseId);
        if (existing) return existing;

        const clause = clauses.get(clauseId) ?? syntheticClause(clauseId);
        const inference = derivationByResult.get(clauseId);
        const expression = clause.expression || clauseId;
        const node: ProofTreeNode = {
            key: `clause:${clauseId}`,
            clauseId,
            expression,
            sourceFormula: clause.source_formula,
            sourceKnowledgeBase: clause.source_knowledge_base ?? null,
            isNegatedGoal: Boolean(clause.is_negated_goal),
            kind: expression.trim() === '□' ? 'empty' : inference ? 'derived' : 'input',
            derivationStep: inference?.index ?? null,
            inferenceId: inference?.id ?? null,
            pivot: inference?.pivot ?? null,
            level: levelFor(clauseId),
            parents: [],
            usedInProof: usedClauseIds.has(clauseId),
        };
        nodeByClauseId.set(clauseId, node);

        if (inference && !buildActive.has(clauseId)) {
            buildActive.add(clauseId);
            node.parents = [materialise(inference.parent1), materialise(inference.parent2)];
            buildActive.delete(clauseId);
        }
        return node;
    }

    // Always materialise every starting project clause, even when it never
    // contributes to the displayed proof.
    for (const clauseId of inputClauseIds) materialise(clauseId);
    for (const inference of inferences) {
        materialise(inference.parent1);
        materialise(inference.parent2);
        materialise(inference.resultId);
    }

    const finalInference = [...inferences].reverse().find(inference => {
        const expression = clauses.get(inference.resultId)?.expression ?? inference.resultExpression;
        return expression.trim() === '□';
    }) ?? inferences.at(-1)!;
    const root = materialise(finalInference.resultId);

    const inputSet = new Set(inputClauseIds);
    const usedInputIds = inputClauseIds.filter(id => inputSet.has(id) && usedClauseIds.has(id));
    const unusedInputIds = inputClauseIds.filter(id => !usedClauseIds.has(id));
    const nodes = [...nodeByClauseId.values()];

    return {
        root,
        nodes,
        inferences,
        clauses,
        inputClauseIds,
        usedInputIds,
        unusedInputIds,
        maxLevel: Math.max(0, ...nodes.map(node => node.level)),
        source,
    };
}

export function firstRelevantProofStep(node: ProofTreeNode, inferences: ProofInference[]): number | null {
    if (node.derivationStep !== null) return node.derivationStep;
    const firstUse = inferences.find(inference =>
        inference.parent1 === node.clauseId || inference.parent2 === node.clauseId,
    );
    return firstUse?.index ?? null;
}

/**
 * Lays out all original project clauses in one context row at the top, then
 * places only proof-derived clauses beneath them. The overview can therefore
 * show the complete starting state, while walkthrough mode can zoom to one
 * local inference without changing the underlying graph.
 */
export function layoutResolutionProofTree(
    proof: ProofTree,
    nodeWidth = 224,
    nodeHeight = 88,
    horizontalGap = 34,
    verticalGap = 166,
): ProofTreeLayout {
    const leftPadding = 48;
    const topPadding = 48;
    const inputNodes = proof.inputClauseIds
        .map(id => proof.nodes.find(node => node.clauseId === id))
        .filter((node): node is ProofTreeNode => Boolean(node));

    const positioned = new Map<string, PositionedProofNode>();
    inputNodes.forEach((node, index) => {
        positioned.set(node.clauseId, {
            ...node,
            x: leftPadding + index * (nodeWidth + horizontalGap),
            y: topPadding,
            width: nodeWidth,
            height: nodeHeight,
        });
    });

    const inputBandBottom = topPadding + nodeHeight + 70;
    const occupiedByLevel = new Map<number, Array<{left: number; right: number}>>();

    function parentCenter(clauseId: string): number {
        const parent = positioned.get(clauseId);
        return parent ? parent.x + parent.width / 2 : leftPadding + nodeWidth / 2;
    }

    for (const inference of proof.inferences) {
        const node = proof.nodes.find(candidate => candidate.clauseId === inference.resultId);
        if (!node) continue;

        const level = Math.max(1, node.level);
        const idealCenter = (parentCenter(inference.parent1) + parentCenter(inference.parent2)) / 2;
        let x = Math.max(leftPadding, idealCenter - nodeWidth / 2);
        const occupied = occupiedByLevel.get(level) ?? [];

        let moved = true;
        while (moved) {
            moved = false;
            for (const interval of occupied) {
                const right = x + nodeWidth;
                if (right + horizontalGap > interval.left && x - horizontalGap < interval.right) {
                    x = interval.right + horizontalGap;
                    moved = true;
                }
            }
        }

        occupied.push({left: x, right: x + nodeWidth});
        occupiedByLevel.set(level, occupied);
        positioned.set(node.clauseId, {
            ...node,
            x,
            y: inputBandBottom + (level - 1) * verticalGap,
            width: nodeWidth,
            height: nodeHeight,
        });
    }

    // Synthetic proof parents that were not part of initial_clauses are rare,
    // but place them in the input band instead of dropping them from the graph.
    const extras = proof.nodes.filter(node => !positioned.has(node.clauseId));
    for (const node of extras) {
        const index = positioned.size;
        positioned.set(node.clauseId, {
            ...node,
            x: leftPadding + index * (nodeWidth + horizontalGap),
            y: topPadding,
            width: nodeWidth,
            height: nodeHeight,
        });
    }

    const edges: ProofTreeEdge[] = [];
    for (const inference of proof.inferences) {
        if (!positioned.has(inference.parent1) || !positioned.has(inference.parent2) || !positioned.has(inference.resultId)) continue;
        edges.push({from: inference.parent1, to: inference.resultId, step: inference.index, pivot: inference.pivot});
        edges.push({from: inference.parent2, to: inference.resultId, step: inference.index, pivot: inference.pivot});
    }

    const minX = Math.min(leftPadding, ...[...positioned.values()].map(node => node.x));
    if (minX < leftPadding) {
        const shift = leftPadding - minX;
        for (const node of positioned.values()) node.x += shift;
    }

    const nodes = [...positioned.values()];
    const maxRight = Math.max(760, ...nodes.map(node => node.x + node.width + leftPadding));
    const maxBottom = Math.max(520, ...nodes.map(node => node.y + node.height + 90));

    return {
        nodes,
        byKey: new Map(nodes.map(node => [node.key, node])),
        byClauseId: new Map(nodes.map(node => [node.clauseId, node])),
        edges,
        width: maxRight,
        height: maxBottom,
        inputBandBottom,
    };
}
