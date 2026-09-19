import type {ResolutionClause} from '../api/knowledgeBase';
import {resolutionChoices} from './resolutionExploration';

export type PathKind = 'root' | 'step' | 'empty' | 'wall' | 'tautology' | 'cycle' | 'limit';
export interface PathNode {
  key: string;
  parent: string | null;
  clause: ResolutionClause;
  partner?: ResolutionClause;
  pivot?: string;
  kind: PathKind;
  reason: string;
  depth: number;
  children: string[];
  available: ResolutionClause[];
  seen: string[];
}
export interface ResolutionPaths {nodes: PathNode[]; roots: string[]; next: number}
const canonical = (expression: string) => expression.split('|').map(value => value.trim()).sort().join('|');
function state(clause: ResolutionClause, available: ResolutionClause[]) {
  return canonical(clause.expression) + ':' + [...new Set(available.map(c => canonical(c.expression)))].sort().join(';');
}

// Each occurrence belongs to exactly one parent. Clauses from siblings are
// never available here, and identical conclusions in separate paths are copied.
function grow(tree: ResolutionPaths, starts: PathNode[], depthLimit: number, nodeLimit: number) {
  const queue = [...starts];
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index];
    if (['empty', 'tautology', 'cycle', 'wall'].includes(node.kind)) continue;
    const choices = resolutionChoices(node.clause, node.available);
    if (!choices.length) {node.kind = 'wall'; node.reason = 'Brick wall: no complementary partner is available along this path.'; continue;}
    if (node.depth >= depthLimit || tree.nodes.length + choices.length > nodeLimit) {
      node.kind = 'limit'; node.reason = `${choices.length} choices remain here. Continue this branch to reveal them.`; continue;
    }
    node.kind = node.parent ? 'step' : 'root';
    const available = node.available.some(c => c.id === node.clause.id) ? node.available : [...node.available, node.clause];
    for (const choice of choices) {
      const key = `B${tree.next++}`;
      const clause: ResolutionClause = {id: key, expression: choice.expression, source_formula: null};
      const nextState = state(clause, available);
      const kind: PathKind = choice.blocked ? 'tautology' : choice.expression === '□' ? 'empty' : node.seen.includes(nextState) ? 'cycle' : 'step';
      const reason = kind === 'empty' ? 'Empty clause: this path reaches a contradiction.' : kind === 'tautology' ? 'Tautology: this result contains a literal and its negation.' : kind === 'cycle' ? 'This path revisits the same clause with the same available clauses. It would repeat forever.' : 'Continue with this result and the clauses available in this branch.';
      const child: PathNode = {key, parent: node.key, clause, partner: choice.partner, pivot: choice.pivot.replace(/^~/, ''), kind, reason, depth: node.depth + 1, children: [], available, seen: [...node.seen, nextState]};
      node.children.push(key); tree.nodes.push(child); queue.push(child);
    }
  }
  return tree;
}
export function buildResolutionPaths(initial: ResolutionClause[], maxDepth = 8, maxNodes = 1200): ResolutionPaths {
  const roots = initial.filter(c => c.is_negated_goal).map((clause, i): PathNode => ({key: `G${i + 1}`, parent: null, clause, kind: clause.expression === '□' ? 'empty' : 'root', reason: 'Start with this negated-goal clause.', depth: 0, children: [], available: initial, seen: [state(clause, initial)]}));
  return grow({nodes: roots.slice(), roots: roots.map(n => n.key), next: 1}, roots, maxDepth, maxNodes);
}
export function continueResolutionPath(previous: ResolutionPaths, key: string, extraDepth = 3, extraNodes = 600) {
  const tree = {...previous, nodes: previous.nodes.map(n => ({...n, children: [...n.children]}))};
  const target = tree.nodes.find(n => n.key === key);
  if (!target || target.kind !== 'limit') return previous;
  return grow(tree, [target], target.depth + extraDepth, tree.nodes.length + extraNodes);
}
export function ancestry(tree: ResolutionPaths, key: string): PathNode[] {
  const byKey = new Map(tree.nodes.map(n => [n.key, n]));
  const path: PathNode[] = [];
  let node = byKey.get(key);
  while (node) {path.push(node); node = node.parent ? byKey.get(node.parent) : undefined;}
  return path.reverse();
}
export function shortestPath(tree: ResolutionPaths): PathNode[] {
  const leaf = tree.nodes.filter(n => n.kind === 'empty').sort((a,b) => a.depth - b.depth)[0];
  return leaf ? ancestry(tree, leaf.key) : [];
}
export interface PositionedPath extends PathNode {x: number; y: number; width: number; height: number}
export function layoutResolutionPaths(tree: ResolutionPaths, focus: string | null = null, collapsed = new Set<string>()) {
  const byKey = new Map(tree.nodes.map(n => [n.key, n]));
  const prefix = focus ? ancestry(tree, focus) : [];
  const prefixChild = new Map(prefix.slice(0,-1).map((n,i) => [n.key, prefix[i+1].key]));
  const children = (node: PathNode) => prefixChild.has(node.key) ? [prefixChild.get(node.key)!] : collapsed.has(node.key) ? [] : node.children;
  const widths = new Map<string, number>();
  function measure(key: string): number {
    const node = byKey.get(key)!;
    const width = Math.max(300, children(node).reduce((sum, child) => sum + measure(child), 0));
    widths.set(key, width); return width;
  }
  const roots = focus && prefix.length ? [prefix[0].key] : tree.roots;
  const width = Math.max(600, roots.reduce((sum, key) => sum + measure(key), 0) + 80);
  const nodes: PositionedPath[] = [];
  function place(key: string, left: number) {
    const node = byKey.get(key)!, span = widths.get(key)!;
    nodes.push({...node, x: left + (span - 264) / 2, y: 50 + node.depth * 174, width: 264, height: node.parent ? 124 : 86});
    let offset = left;
    for (const child of children(node)) {place(child, offset); offset += widths.get(child)!;}
  }
  let left = 40;
  for (const key of roots) {place(key,left); left += widths.get(key)!;}
  return {nodes, byKey: new Map(nodes.map(n => [n.key,n])), width, height: Math.max(540, Math.max(0,...nodes.map(n=>n.y+n.height))+60)};
}
