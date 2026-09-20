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
}

export interface ProofTree {
    root: ProofTreeNode | null;
    inferences: ProofInference[];
    clauses: Map<string, ResolutionClause>;
    usedInputIds: string[];
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
    edges: ProofTreeEdge[];
    width: number;
    height: number;
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
 * Builds only the proof that establishes the final contradiction.
 *
 * The backend's full graph contains search alternatives. `shortest_proof`
 * identifies the inference sequence that is actually needed. Reconstructing
 * recursively from its final result turns that sequence into a genuine binary
 * resolution proof tree: two parents above every derived clause and □ at the
 * bottom. Shared subproofs are intentionally duplicated so the visual remains
 * a tree rather than a DAG.
 */
export function buildResolutionProofTree(response: ResolutionResponse): ProofTree {
    const clauses = clauseMap(response);
    let inferences = graphInferences(response, clauses);
    let source: ProofTree['source'] = 'shortest-proof';

    if (!inferences.length && response.steps.length) {
        inferences = traceInferences(response);
        source = 'resolution-trace';
    }
    if (!inferences.length) {
        return {
            root: null,
            inferences: [],
            clauses,
            usedInputIds: [],
            maxLevel: 0,
            source: 'none',
        };
    }

    // Ensure every referenced clause is available to the renderer, including
    // older API responses that only supplied the step trace.
    for (const inference of inferences) {
        if (!clauses.has(inference.parent1)) clauses.set(inference.parent1, syntheticClause(inference.parent1));
        if (!clauses.has(inference.parent2)) clauses.set(inference.parent2, syntheticClause(inference.parent2));
        if (!clauses.has(inference.resultId)) clauses.set(inference.resultId, syntheticClause(inference.resultId, inference.resultExpression));
    }

    const derivationByResult = new Map(inferences.map(inference => [inference.resultId, inference]));
    const levelByClause = new Map<string, number>();
    for (const clause of response.initial_clauses) levelByClause.set(clause.id, 0);
    for (const inference of inferences) {
        const parentLevel = Math.max(
            levelByClause.get(inference.parent1) ?? 0,
            levelByClause.get(inference.parent2) ?? 0,
        );
        levelByClause.set(inference.resultId, parentLevel + 1);
    }

    const finalInference = [...inferences].reverse().find(inference => {
        const expression = clauses.get(inference.resultId)?.expression ?? inference.resultExpression;
        return expression.trim() === '□';
    }) ?? inferences.at(-1)!;

    let occurrence = 0;
    const usedInputs = new Set<string>();
    const active = new Set<string>();

    function build(clauseId: string): ProofTreeNode {
        occurrence += 1;
        const key = `P${occurrence}`;
        const clause = clauses.get(clauseId) ?? syntheticClause(clauseId);
        const inference = derivationByResult.get(clauseId);
        const expression = clause.expression || clauseId;

        // A cycle should not exist in a valid proof, but treating an unexpected
        // repeated active clause as a leaf prevents a malformed response from
        // recursively crashing the visualiser.
        if (!inference || active.has(clauseId)) {
            usedInputs.add(clauseId);
            return {
                key,
                clauseId,
                expression,
                sourceFormula: clause.source_formula,
                sourceKnowledgeBase: clause.source_knowledge_base ?? null,
                isNegatedGoal: Boolean(clause.is_negated_goal),
                kind: expression.trim() === '□' ? 'empty' : 'input',
                derivationStep: null,
                inferenceId: null,
                pivot: null,
                level: levelByClause.get(clauseId) ?? 0,
                parents: [],
            };
        }

        active.add(clauseId);
        const parents = [build(inference.parent1), build(inference.parent2)];
        active.delete(clauseId);
        return {
            key,
            clauseId,
            expression,
            sourceFormula: clause.source_formula,
            sourceKnowledgeBase: clause.source_knowledge_base ?? null,
            isNegatedGoal: Boolean(clause.is_negated_goal),
            kind: expression.trim() === '□' ? 'empty' : 'derived',
            derivationStep: inference.index,
            inferenceId: inference.id,
            pivot: inference.pivot,
            level: levelByClause.get(clauseId) ?? inference.index + 1,
            parents,
        };
    }

    const root = build(finalInference.resultId);
    return {
        root,
        inferences,
        clauses,
        usedInputIds: [...usedInputs],
        maxLevel: Math.max(0, ...levelByClause.values()),
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

export function layoutResolutionProofTree(
    proof: ProofTree,
    nodeWidth = 236,
    nodeHeight = 88,
    horizontalGap = 64,
    verticalGap = 158,
): ProofTreeLayout {
    if (!proof.root) {
        return {nodes: [], byKey: new Map(), edges: [], width: 720, height: 480};
    }

    const span = new Map<string, number>();
    function measure(node: ProofTreeNode): number {
        if (!node.parents.length) {
            span.set(node.key, nodeWidth);
            return nodeWidth;
        }
        const measured = node.parents.map(measure);
        const width = Math.max(nodeWidth, measured.reduce((total, value) => total + value, 0) + horizontalGap * (measured.length - 1));
        span.set(node.key, width);
        return width;
    }

    measure(proof.root);
    const nodes: PositionedProofNode[] = [];
    const edges: ProofTreeEdge[] = [];

    function place(node: ProofTreeNode, left: number): number {
        const ownSpan = span.get(node.key) ?? nodeWidth;
        const childCenters: number[] = [];
        let offset = left;

        for (const parent of node.parents) {
            const parentSpan = span.get(parent.key) ?? nodeWidth;
            childCenters.push(place(parent, offset));
            edges.push({
                from: parent.key,
                to: node.key,
                step: node.derivationStep ?? 0,
                pivot: node.pivot ?? '',
            });
            offset += parentSpan + horizontalGap;
        }

        const center = childCenters.length
            ? (childCenters[0] + childCenters[childCenters.length - 1]) / 2
            : left + ownSpan / 2;
        const y = 36 + node.level * verticalGap;
        nodes.push({
            ...node,
            x: center - nodeWidth / 2,
            y,
            width: nodeWidth,
            height: nodeHeight,
        });
        return center;
    }

    const contentWidth = span.get(proof.root.key) ?? nodeWidth;
    place(proof.root, 40);
    const width = Math.max(760, contentWidth + 80);
    const height = Math.max(520, 36 + (proof.maxLevel + 1) * verticalGap + 80);
    return {
        nodes,
        byKey: new Map(nodes.map(node => [node.key, node])),
        edges,
        width,
        height,
    };
}
