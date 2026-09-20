import {useEffect, useRef, useState, type ReactNode} from 'react';
import {useTheme} from '../context/ThemeContext';
import type {SavedProjectKB} from '../api/projects';
import {Brand, Icon} from './Icons.tsx';

export type Section = 'projects' | 'learn' | 'help';

export function ThemeToggle() {
  const {theme, toggleTheme} = useTheme();
  return <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle light/dark mode" aria-pressed={theme === 'dark'}><Icon name={theme === 'light' ? 'sun' : 'moon'} /><span className="theme-switch"><i /></span></button>;
}

export function SessionMenu() {
  const [open, setOpen] = useState(false);
  return <div className="session-menu"><button type="button" className="avatar" aria-label="Workspace tip" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="bulb" size={20} /></button>{open && <div className="session-popover"><strong>Workspace tip</strong><p>Your projects belong to this browser tab. Sessions expire after two hours of inactivity, so export important projects to keep a JSON copy.</p><button className="text-button" onClick={() => setOpen(false)}>Close</button></div>}</div>;
}

function KnowledgeBaseMenu({knowledgeBase, busy, onView, onEdit, onExport, onDelete}: {
  knowledgeBase: SavedProjectKB;
  busy?: boolean;
  onView?(id: string): void;
  onEdit?(id: string): void;
  onExport?(id: string): void;
  onDelete?(id: string): void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!busy || !open) return;

    const timeoutId = window.setTimeout(() => {
      setOpen(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [busy, open]);

  function run(action?: (id: string) => void) {
    setOpen(false);
    action?.(knowledgeBase.id);
  }

  return <div className="sidebar-kb-menu" ref={menu}>
    <button
      type="button"
      className="sidebar-kb-menu-trigger"
      disabled={busy}
      aria-label={`Actions for ${knowledgeBase.name}`}
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={() => setOpen(current => !current)}
    >
      <Icon name="more" size={18} />
    </button>
    {open && <div className="sidebar-kb-menu-popover" role="menu" aria-label={`${knowledgeBase.name} actions`}>
      <button type="button" role="menuitem" onClick={() => run(onView)}><Icon name="file" size={16} />View</button>
      <button type="button" role="menuitem" onClick={() => run(onEdit)}><Icon name="edit" size={16} />Edit</button>
      <button type="button" role="menuitem" onClick={() => run(onExport)}><Icon name="download" size={16} />Export</button>
      <div className="sidebar-kb-menu-divider" />
      <button type="button" role="menuitem" className="danger" onClick={() => run(onDelete)}><Icon name="trash" size={16} />Delete</button>
    </div>}
  </div>;
}

export function AppShell({
  children,
  section = 'projects',
  projectName,
  stage = 1,
  onNavigate,
  onHome,
  onStage,
  onRename,
  busy,
  knowledgeBases = [],
  activeKnowledgeBaseId,
  onKnowledgeBase,
  onEditKnowledgeBase,
  onExportKnowledgeBase,
  onDeleteKnowledgeBase,
}: {
  knowledgeBases?: SavedProjectKB[];
  activeKnowledgeBaseId?: string;
  onKnowledgeBase?(id: string): void;
  onEditKnowledgeBase?(id: string): void;
  onExportKnowledgeBase?(id: string): void;
  onDeleteKnowledgeBase?(id: string): void;
  children: ReactNode;
  section?: Section;
  projectName?: string;
  stage?: number;
  onNavigate(section: Section): void;
  onHome(): void;
  onStage?(stage: number): void;
  onRename?(): void;
  busy?: boolean;
}) {
  return <div className={`app-shell ${projectName ? 'app-shell--workspace' : ''} ${stage === 3 ? 'app-shell--resolution' : ''}`}>
    <aside className="sidebar">
      <div className="sidebar-brand"><Brand onClick={onHome} /><p>{projectName ? 'Logic  ·  Visualized' : 'Visualize. Reason. Learn.'}</p></div>
      {projectName ? <>
        <div className="current-project"><span className="sidebar-label">Current project</span><strong><span>{projectName}</span><button className="rename-project" disabled={busy} onClick={onRename} aria-label="Rename project"><Icon name="edit" size={17} /></button></strong></div>
        <nav className="sidebar-knowledge-bases" aria-label="Project knowledge bases">
          <div className="sidebar-kb-heading"><span className="sidebar-label">Knowledge Bases</span><span>{knowledgeBases.length}</span></div>
          <div className="sidebar-kb-list">
            {knowledgeBases.map(kb => <div className="sidebar-kb-entry" key={kb.id}>
              <button
                className={`sidebar-kb-main ${kb.id === activeKnowledgeBaseId ? 'active' : ''}`}
                aria-current={kb.id === activeKnowledgeBaseId ? 'page' : undefined}
                disabled={busy}
                title={`View ${kb.name}`}
                onClick={() => onKnowledgeBase?.(kb.id)}
              >
                <Icon name="file" size={17} />
                <span>{kb.name}<small>{kb.formulas.length} {kb.formulas.length === 1 ? 'formula' : 'formulas'}</small></span>
              </button>
              <KnowledgeBaseMenu
                knowledgeBase={kb}
                busy={busy}
                onView={onKnowledgeBase}
                onEdit={onEditKnowledgeBase}
                onExport={onExportKnowledgeBase}
                onDelete={onDeleteKnowledgeBase}
              />
            </div>)}
          </div>
          {!knowledgeBases.length && <p>No knowledge bases yet.</p>}
        </nav>
        <div className="pipeline"><span className="sidebar-label">Reasoning pipeline</span>{[
          ['Knowledge Base', 'Build or select your KB'], ['CNF Conversion', 'Convert formulas to clauses'], ['Resolution', 'Trace the proof'],
        ].map(([title, description], i) => <button className={`pipeline-step ${stage === i + 1 ? 'active' : ''} ${stage > i + 1 ? 'complete' : ''}`} key={title} disabled={busy || i + 1 > stage} onClick={() => onStage?.(i + 1)}><span className="pipeline-number">{i + 1}</span><span><strong>{title}</strong><small>{description}</small></span>{stage > i + 1 && <span className="pipeline-check"><Icon name="check" size={14} /></span>}</button>)}</div>
        <button className="sidebar-back" onClick={() => onNavigate('projects')}><Icon name="back" size={19} />Back to Projects</button>
      </> : <>
        <nav className="sidebar-nav" aria-label="Main navigation">{(['projects', 'learn', 'help'] as const).map(item => <button className={section === item ? 'active' : ''} key={item} onClick={() => onNavigate(item)}><Icon name={item === 'projects' ? 'folder' : item} size={26} />{item[0].toUpperCase() + item.slice(1)}</button>)}</nav>
        <footer className="sidebar-footer"><span>Resolution Logic for Everyone</span><small>v1.0.0</small></footer>
      </>}
    </aside>
    <div className="main-content">{children}</div>
  </div>;
}

export function WorkspaceHeader({projectName, onProjects}: {projectName: string; onProjects(): void}) {
  return <header className="workspace-header"><nav aria-label="Breadcrumb"><button onClick={onProjects}>Projects</button><span>/</span><span>{projectName}</span></nav><div className="header-tools"><ThemeToggle /><SessionMenu /></div></header>;
}

export function GuideView({section}: {section: 'learn' | 'help'}) {
  return <main className="guide-screen"><h1>{section === 'learn' ? 'Learn resolution' : 'How can we help?'}</h1><p className="page-subtitle">{section === 'learn' ? 'Follow the reasoning from formulas to a proof.' : 'Everything you need to build and explore your workspace.'}</p><ol className="guide-sections">{(section === 'learn' ? [
    ['Build a knowledge base', 'Write the facts and rules you know. For example, P → Q and P state that P implies Q, and that P is true.'],
    ['Convert to CNF', 'Conjunctive normal form turns each rule into clauses. P → Q becomes ¬P ∨ Q. Add the negation of your goal, ¬Q.'],
    ['Apply resolution', 'Resolve complementary literals in two clauses. ¬P ∨ Q and P yield Q; Q and ¬Q yield the empty clause □.'],
    ['Read the result', 'An empty clause proves a contradiction, so the knowledge base entails the goal. The green route highlights the shortest displayed path; it is labelled Shortest proof when the backend verifies that no shorter general proof exists. The overall entailment result comes from the backend, independently of which branches are unfolded.'],
    ['Explore separate branches', 'Start from the negated goal and resolve it with each complementary partner, one pivot at a time. Each result has its own recursive subtree. Repeated clauses are copied into separate paths and never merged. A branch uses only input clauses and earlier results in that same path. A brick wall, tautology or repeated state stops only that path.'],
  ] : [
    ['Knowledge bases', 'Each project can contain several knowledge bases. Use the Add KB button beside the workspace heading for typed formulas. Valid uploaded files are saved automatically. Click a saved KB to view it, or use its three-dot menu to view, edit, export, or delete it. Continue to CNF uses every saved knowledge base in the project.'],
    ['Input formats', 'Type a formula in the new-formula field and press Enter to add it, then use the small Add KB button beside the editor heading. Upload JSON containing a formulas or knowledge_base array, or a TXT/KB file with one formula per line. A valid uploaded file is saved to the sidebar immediately after validation.'],
    ['Optional annotations', 'Add an optional note beneath any formula. In TXT or KB uploads, write formula :: annotation on the same line, for example P → Q :: Passing implies eligibility. Lines without :: remain valid. JSON also accepts formula/annotation objects or an annotations array alongside formulas. Notes are saved with the KB and included in project exports; they do not affect the proof.'],
    ['Formula syntax', 'Use proposition names such as P, Ad, or Pass. Operators: ¬ or ~, ∧ or &, ∨ or |, → or ->, and ↔ or <->. Use parentheses to group expressions.'],
    ['Save your work', 'Projects use guest sessions in this browser tab. Sessions expire after two hours of inactivity. Export a single knowledge base from its three-dot menu, or use Export project to preserve the whole project as JSON.'],
    ['Shortest path', 'The green route is the shortest path to an empty clause among the generated branches. When its inference count matches the globally shortest proof verified by the backend, the label is Shortest proof. Otherwise the label is Shortest shown path. Goal-led chains are an educational exploration, and may not display every general resolution proof. A dead branch cannot establish non-entailment.'],
    ['Explore the tree', 'Select a first choice above the canvas to focus its own subtree, or choose Whole tree to compare branches. Use + on a card to unfold its own children, and Expand all shown branches to reveal the generated tree. Initial generation is bounded to eight levels and 1,200 occurrences; select a limited card and Continue this branch to reveal more. Click a card for the history of only that path. Zoom, Fit view, 100% and background dragging help navigate larger trees.'],
  ]).map(([title, copy], index) => <li className="guide-section" key={title}><span className="guide-step-number" aria-hidden="true">{index + 1}.</span><div><h2>{title}</h2><p>{copy}</p></div></li>)}</ol></main>;
}
