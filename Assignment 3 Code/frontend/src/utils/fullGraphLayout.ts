import type {FullResolutionGraph, ResolutionBranch, ResolutionClause} from '../api/knowledgeBase';
export interface GraphNode {key: string; clause?: ResolutionClause; branch?: ResolutionBranch; x: number; y: number; width: number; height: number}
export function layoutFullGraph(graph: FullResolutionGraph, initial: ResolutionClause[]) {
  const nodes: GraphNode[] = [];
  const clauseNodes = new Map<string, GraphNode>();
  const branchNodes = new Map<string, GraphNode>();
  const cols = Math.max(4, Math.min(10, initial.length));
  const width = cols * 290 + 50;
  let y = 42;
  function roots(clauses: ResolutionClause[]) {
    clauses.forEach((clause, i) => {
      const row = Math.floor(i / cols), column = i % cols;
      const rowCount = Math.min(cols, clauses.length - row * cols);
      const node = {key: clause.id, clause, x: (width - rowCount * 290) / 2 + column * 290 + 15, y: y + row * 108, width: 260, height: 78};
      nodes.push(node); clauseNodes.set(clause.id, node);
    });
    y += Math.ceil(clauses.length / cols) * 108 + 48;
  }
  roots(initial.filter(clause => clause.is_negated_goal));
  const sourceTop = y;
  roots(initial.filter(clause => !clause.is_negated_goal));
  const branchesTop = y;
  const layers = new Map<number, ResolutionBranch[]>();
  for (const branch of graph.branches) {const layer = layers.get(branch.depth) ?? []; layer.push(branch); layers.set(branch.depth, layer);}
  for (const [, layer] of [...layers].sort((a, b) => a[0] - b[0])) {
    layer.forEach((branch, i) => {
      const node = {key: branch.id, branch, x: 40 + i % cols * 290, y: y + Math.floor(i / cols) * 156, width: 260, height: 112};
      nodes.push(node); branchNodes.set(branch.id, node);
      if (branch.kind === 'derived' && branch.result_id) clauseNodes.set(branch.result_id, node);
    });
    y += Math.ceil(layer.length / cols) * 156 + 70;
  }
  return {nodes, clauseNodes, branchNodes, width, height: Math.max(520, y), sourceTop, branchesTop};
}
