import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {ResolutionResponse} from '../api/knowledgeBase';
import {layoutFullGraph, type GraphNode} from '../utils/fullGraphLayout';
import {Icon} from './Icons';
const display = (value: string) => value.replace(/<->/g, '↔').replace(/->/g, '→').replace(/~/g, '¬').replace(/\|/g, '∨').replace(/&/g, '∧');
const short = (value: string, max = 29) => value.length > max ? value.slice(0, max - 1) + '…' : value;

export function FullResolutionView({resolution, goal, onBack, onBackToKnowledgeBase}: {resolution: ResolutionResponse; goal: string; onBack(): void; onBackToKnowledgeBase(): void}) {
  const graph = resolution.graph;
  const layout = useMemo(() => graph ? layoutFullGraph(graph, resolution.initial_clauses) : null, [graph, resolution.initial_clauses]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'tree' | 'clauses' | 'pairs'>('tree');
  const [scale, setScale] = useState(1);
  const [walls, setWalls] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [bounds, setBounds] = useState({left: 0, top: 0, width: 800, height: 600});
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{x: number; y: number; left: number; top: number} | null>(null);
  const anchor = useRef<{x: number; y: number; worldX: number; worldY: number} | null>(null);
  const didFit = useRef(false);
  function updateBounds() {const element = viewport.current; if (element) setBounds({left: element.scrollLeft, top: element.scrollTop, width: element.clientWidth, height: element.clientHeight});}
  function fit() {const element = viewport.current; if (!element || !layout) return; anchor.current = null; setScale(Math.max(.001, Math.min(1, (element.clientWidth - 28) / layout.width, (element.clientHeight - 28) / layout.height))); element.scrollLeft = 0; element.scrollTop = 0;}
  function zoom(value: number, x?: number, y?: number) {
    const element = viewport.current; if (!element) return;
    x ??= element.clientWidth / 2; y ??= element.clientHeight / 2;
    anchor.current = {x, y, worldX: (element.scrollLeft + x) / scale, worldY: (element.scrollTop + y) / scale};
    setScale(Math.max(.001, Math.min(4, value)));
  }
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !layout) return;
    if (!didFit.current) {didFit.current = true; fit(); return;}
    if (anchor.current) {element.scrollLeft = anchor.current.worldX * scale - anchor.current.x; element.scrollTop = anchor.current.worldY * scale - anchor.current.y; anchor.current = null;}
    updateBounds();
    // The fit calculation is deliberately performed once; zoom changes retain
    // the user's chosen centre instead of refitting the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, layout, tab]);
  useEffect(() => {
    const element = viewport.current; if (!element || tab !== 'tree') return;
    const observer = new ResizeObserver(updateBounds); observer.observe(element);
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); const box = element!.getBoundingClientRect();
      zoom(scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2), event.clientX - box.left, event.clientY - box.top);
    }
    element.addEventListener('wheel', wheel, {passive: false});
    return () => {observer.disconnect(); element.removeEventListener('wheel', wheel);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, tab]);
  if (!graph || !layout) return <main className="resolution-screen"><h1>Resolution graph</h1><p>Run resolution again to generate the complete pair graph.</p><button className="button primary" onClick={onBack}>Back to CNF</button></main>;
  const proof = new Set(graph.shortest_proof);
  const proofCreators = new Map(graph.branches.filter(branch => proof.has(branch.id) && branch.result_id).map(branch => [branch.result_id!, layout.branchNodes.get(branch.id)!]));
  const clauseMap = new Map(graph.clauses.map(clause => [clause.id, clause]));
  const selectedNode = layout.nodes.find(node => node.key === selected);
  const selectedBranch = selectedNode?.branch;
  const selectedClause = selectedNode?.clause ?? (selectedBranch?.result_id ? clauseMap.get(selectedBranch.result_id) : undefined);
  const branchMatches = graph.branches.filter(branch => {
    const text = [branch.id, branch.parent_1, branch.parent_2, branch.pivot, display(branch.expression), branch.reason].join(' ').toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const related = selectedClause ? graph.branches.filter(branch => branch.parent_1 === selectedClause.id || branch.parent_2 === selectedClause.id) : [];
  const isWall = (node: GraphNode) => node.branch?.kind === 'dead_end' || node.branch?.kind === 'tautology';
  const visible = layout.nodes.filter(node => (walls || !isWall(node)) && node.x + node.width >= bounds.left / scale - 120 && node.x <= (bounds.left + bounds.width) / scale + 120 && node.y + node.height >= bounds.top / scale - 160 && node.y <= (bounds.top + bounds.height) / scale + 160);
  const visibleKeys = new Set(visible.map(node => node.key));
  function selectNode(node: GraphNode) {setSelected(node.key);}
  function centre(key: string) {
    const node = layout.nodes.find(item => item.key === key); if (!node) return;
    setSelected(key); setTab('tree'); anchor.current = null; setScale(1);
    requestAnimationFrame(() => {const element = viewport.current; if (element) {element.scrollLeft = node.x - element.clientWidth / 2 + node.width / 2; element.scrollTop = node.y - element.clientHeight / 2 + node.height / 2; updateBounds();}});
  }
  const resultText = graph.entailed ? 'Entailed' : graph.complete ? 'Not entailed' : 'Search incomplete';
  const pathText = graph.shortest_is_optimal ? 'Shortest proof' : 'Best proof found';
  return <main className="resolution-screen full-resolution-screen"><header className="resolution-heading"><div><h1>Resolution visualisation</h1><span className={`result-badge ${graph.entailed ? 'result-badge--success' : ''}`}>{resultText}</span></div><p><strong>Goal:</strong> {display(goal)}</p></header>
    <section className="resolution-overview"><p>The negated goal starts at the top. Every explored pair and pivot is shown, including alternative conclusions and brick walls. Shared clauses are expanded once to keep the graph finite.</p><div className="graph-summary"><span>{resolution.initial_clauses.length} input clauses</span><span>{graph.clauses.length} total clauses</span><span>{graph.pairs_examined} pairs explored</span><span>{graph.complete ? 'All pairs explored' : `${graph.pending_pairs} pairs/pivots remain`}</span>{graph.entailed && <button className="text-button" onClick={() => {const last = graph.shortest_proof.at(-1); if (last) centre(last);}}>{pathText}: {graph.shortest_proof.length} {graph.shortest_proof.length === 1 ? 'inference' : 'inferences'}</button>}</div>
      {!graph.complete && <p className="graph-limit" role="status">{graph.limit_reason} {graph.entailed ? 'A contradiction is proved, but further alternatives may exist.' : 'This does not establish that the goal is not entailed.'}</p>}
      {graph.entailed && !graph.shortest_is_optimal && <p className="graph-limit">The highlighted proof is valid. The search limit prevented verifying that it is globally shortest.</p>}
      <div className="graph-legend"><span className="legend-proof">{pathText}</span><span className="legend-branch">Other derivations</span><span className="legend-reference">Existing clause reference</span><span className="legend-wall">Brick wall / tautology</span></div>
    </section>
    <nav className="resolution-tabs" aria-label="Resolution views">{([['tree', 'Full resolution tree'], ['clauses', 'All clauses'], ['pairs', 'All pairs']] as const).map(([key, title]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{title}</button>)}</nav>
    <div className="resolution-layout full-graph-layout"><section className="panel full-graph-panel">{tab === 'tree' ? <><div className="full-graph-viewport" ref={viewport} tabIndex={0} aria-label="Full resolution tree canvas" onScroll={updateBounds} onKeyDown={event => {if (event.target !== event.currentTarget) return; if (['+', '=', '-'].includes(event.key)) {event.preventDefault(); zoom(scale * (event.key === '-' ? 1 / 1.2 : 1.2));} if (event.key === '0') {event.preventDefault(); fit();}}} onPointerDown={event => {
      if (event.button !== 0 || (event.target as Element).closest('[data-graph-node]')) return;
      const element = event.currentTarget; drag.current = {x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop}; element.setPointerCapture(event.pointerId); element.classList.add('panning');
    }} onPointerMove={event => {if (!drag.current) return; event.currentTarget.scrollLeft = drag.current.left - event.clientX + drag.current.x; event.currentTarget.scrollTop = drag.current.top - event.clientY + drag.current.y;}} onPointerUp={event => {drag.current = null; event.currentTarget.classList.remove('panning');}} onLostPointerCapture={event => {drag.current = null; event.currentTarget.classList.remove('panning');}}>
      <svg className="full-graph-svg" width={layout.width * scale} height={layout.height * scale} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-label="All resolution pair branches, with the shortest found refutation highlighted">
        <defs><marker id="all-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6" fill="currentColor" /></marker></defs>
        <text className="graph-layer-heading" x={24} y={26}>NEGATED GOAL — START</text><text className="graph-layer-heading" x={24} y={layout.sourceTop - 18}>PROJECT CLAUSES</text><text className="graph-layer-heading" x={24} y={layout.branchesTop - 18}>PAIRINGS AND THEIR CONCLUSIONS</text>
        {graph.branches.flatMap(branch => {
          if (!walls && (branch.kind === 'dead_end' || branch.kind === 'tautology')) return [];
          const target = layout.branchNodes.get(branch.id)!; const highlighted = proof.has(branch.id);
          return [branch.parent_1, branch.parent_2].map((id, i) => {
            const parent = highlighted ? proofCreators.get(id) ?? layout.clauseNodes.get(id) : layout.clauseNodes.get(id);
            if (!parent) return null;
            if (!visibleKeys.has(target.key) && !visibleKeys.has(parent.key) && (Math.max(parent.y, target.y) < bounds.top / scale || Math.min(parent.y, target.y) > (bounds.top + bounds.height) / scale)) return null;
            const x1 = parent.x + parent.width / 2, y1 = parent.y + parent.height, x2 = target.x + target.width / 2 + (i ? 9 : -9), y2 = target.y;
            return <path key={`${branch.id}-${i}`} className={`graph-edge ${highlighted ? 'highlighted' : ''} ${selected === branch.id ? 'selected' : ''}`} d={`M${x1},${y1} C${x1},${y1 + 35} ${x2},${y2 - 35} ${x2},${y2}`} markerEnd="url(#all-arrow)" />;
          });
        })}
        {visible.map(node => {
          const branch = node.branch; const clause = node.clause;
          const highlight = branch ? proof.has(branch.id) : graph.shortest_proof.some(id => {const b = layout.branchNodes.get(id)?.branch; return b?.parent_1 === clause?.id || b?.parent_2 === clause?.id;});
          return <g key={node.key} data-graph-node={node.key} className={`graph-node ${branch?.kind ?? 'input'} ${clause?.is_negated_goal ? 'goal-root' : ''} ${highlight ? 'highlighted' : ''} ${selected === node.key ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={branch ? `${branch.id}: ${branch.parent_1} with ${branch.parent_2}, ${branch.pivot ? `resolve on ${branch.pivot}` : 'brick wall'}, ${display(branch.expression) || branch.reason}` : `${clause!.id}: ${display(clause!.expression)}`} onClick={() => selectNode(node)} onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); selectNode(node);}}}>
            <title>{branch ? `${branch.id} · ${branch.parent_1} + ${branch.parent_2} · ${display(branch.expression)} · ${branch.reason}` : `${clause!.id} · ${display(clause!.expression)} · ${clause!.source_knowledge_base ?? 'Negated goal'}`}</title>
            <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={10} />
            {branch ? <><text className="graph-node-caption" x={node.x + 14} y={node.y + 22}>{branch.id} · {branch.parent_1} + {branch.parent_2}</text><text className="graph-node-pivot" x={node.x + 14} y={node.y + 43}>{branch.pivot ? `Resolve on ${branch.pivot}` : 'No complementary literals'}</text><text className="graph-node-expression" x={node.x + 14} y={node.y + 73}>{branch.kind === 'dead_end' ? 'Brick wall' : short(display(branch.expression))}</text><text className="graph-node-caption" x={node.x + 14} y={node.y + 98}>{branch.kind === 'tautology' ? 'Tautology · branch stops' : branch.kind === 'existing' ? `Reference to ${branch.result_id} · already present` : branch.kind === 'dead_end' ? 'This pair cannot derive a clause' : branch.expression === '□' ? `${branch.result_id} · contradiction reached` : `${branch.result_id} · continue with this clause`}</text></> : <><text className="graph-node-caption" x={node.x + 14} y={node.y + 23}>{clause!.id} · {clause!.is_negated_goal ? 'Negated goal' : short(clause!.source_knowledge_base ?? 'Project input', 23)}</text><text className="graph-node-expression" x={node.x + 14} y={node.y + 53}>{short(display(clause!.expression))}</text></>}
          </g>;
        })}
      </svg>
    </div><footer className="proof-toolbar"><div className="zoom-tools"><button className="icon-button" aria-label="Zoom out" disabled={scale <= .001} onClick={() => zoom(scale / 1.2)}>−</button><span>{(scale * 100).toFixed(scale < .1 ? 1 : 0)}%</span><button className="icon-button" aria-label="Zoom in" disabled={scale >= 4} onClick={() => zoom(scale * 1.2)}>+</button><button className="button secondary small" onClick={fit}><Icon name="fit" size={17} />Fit view</button><button className="button secondary small" onClick={() => zoom(1)}>100%</button></div><label className="graph-walls-toggle"><input type="checkbox" checked={walls} onChange={event => setWalls(event.target.checked)} />Show brick walls</label></footer><p className="graph-pan-hint">Drag the background or scroll to pan · Ctrl + wheel or + / − to zoom · 0 fits the graph</p></> : tab === 'clauses' ? <div className="proof-data graph-data"><h2>All input and derived clauses</h2><div className="clause-list">{graph.clauses.map(clause => <button className="clause-list-row" key={clause.id} onClick={() => centre(layout.clauseNodes.get(clause.id)?.key ?? clause.id)}><span>{clause.id}</span><strong>{display(clause.expression)}</strong><small>{clause.is_negated_goal ? 'Negated goal' : clause.source_knowledge_base ?? 'Derived clause'}</small></button>)}</div></div> : <div className="proof-data graph-data"><h2>All explored pairs and pivots</h2><input aria-label="Search clause pairs" placeholder="Search clause IDs, pivot, result or brick wall…" value={query} onChange={event => {setQuery(event.target.value); setPage(0);}} /><div className="table-scroll"><table><thead><tr><th>Pair</th><th>Parents</th><th>Pivot</th><th>Conclusion</th><th>Outcome</th></tr></thead><tbody>{branchMatches.slice(page * 60, (page + 1) * 60).map(branch => <tr key={branch.id} className={proof.has(branch.id) ? 'proof-table-highlight' : ''}><td><button className="text-button" onClick={() => centre(branch.id)}>{branch.id}</button></td><td>{branch.parent_1} + {branch.parent_2}</td><td>{branch.pivot ?? '—'}</td><td>{display(branch.expression) || 'Brick wall'}</td><td>{branch.kind === 'existing' ? `Reference to ${branch.result_id}` : branch.kind === 'derived' ? branch.result_id : branch.kind}</td></tr>)}</tbody></table></div><div className="graph-pagination"><button className="button secondary small" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>{branchMatches.length ? page * 60 + 1 : 0}–{Math.min(branchMatches.length, (page + 1) * 60)} of {branchMatches.length}</span><button className="button secondary small" disabled={(page + 1) * 60 >= branchMatches.length} onClick={() => setPage(page + 1)}>Next</button></div></div>}</section>
      <aside className="panel graph-detail"><h2>{selectedBranch ? `Pair ${selectedBranch.id}` : selectedClause ? selectedClause.id : 'Follow every possibility'}</h2>{selectedBranch ? <><p>Parent clauses</p>{[selectedBranch.parent_1, selectedBranch.parent_2].map(id => <button key={id} className="detail-clause" onClick={() => centre(layout.clauseNodes.get(id)?.key ?? id)}><strong>{display(clauseMap.get(id)?.expression ?? id)}</strong><small>{id}</small></button>)}<p>Pivot</p><div className="detail-clause">{selectedBranch.pivot ?? 'None — this pair cannot resolve'}</div><p>Conclusion</p><div className={`detail-clause ${selectedBranch.expression === '□' ? 'success' : ''}`}>{display(selectedBranch.expression) || 'Brick wall'}</div><p>{selectedBranch.reason}</p>{proof.has(selectedBranch.id) && <p className="graph-proof-note">Highlighted as part of the {pathText.toLowerCase()}.</p>}</> : selectedClause ? <><div className="detail-clause"><strong>{display(selectedClause.expression)}</strong></div><p>{selectedClause.source_knowledge_base ?? (selectedClause.is_negated_goal ? 'Negated goal' : 'Derived clause')}</p><p>{selectedClause.expression === '□' ? 'Empty clause: the contradiction proves entailment.' : `${related.length} pairing/pivot outcomes use this clause.`}</p></> : <p>Click any clause or pairing in the tree to inspect its parents, pivot and conclusion. Green branches show the shortest verified proof, or the best proof found when search is limited. Grey brick walls stop only that pairing.</p>}
        {selectedClause && selectedClause.expression !== '□' && <div className="graph-related"><h3>Pairings using {selectedClause.id}</h3>{related.map(branch => <button key={branch.id} onClick={() => centre(branch.id)}><span>{branch.parent_1} + {branch.parent_2}{branch.pivot ? ` · ${branch.pivot}` : ''}</span><strong>{display(branch.expression) || 'Brick wall'}</strong></button>)}</div>}
        <div className="graph-detail-actions"><button className="button secondary" onClick={onBack}>Back to CNF</button><button className="text-button" onClick={onBackToKnowledgeBase}>Back to Knowledge Base</button></div>
      </aside>
    </div>
  </main>;
}
