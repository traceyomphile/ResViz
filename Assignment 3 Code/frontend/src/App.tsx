import {useCallback, useEffect, useRef, useState} from 'react';
import './App.css';
import {restoreSession} from './api/session';
import {completeProject, getProjects, getProject, createProject, renameProject, type ProjectSummary, type SavedProjectKB} from './api/projects';
import {deleteSavedKnowledgeBase, convertProjectToCnf, resolveProject, saveNamedKnowledgeBase, saveQuery, updateNamedKnowledgeBase, validateKnowledgeBase, type CNFConversionResponse, type ResolutionResponse} from './api/knowledgeBase';
import {DeleteKnowledgeBaseDialog} from './components/DeleteKnowledgeBaseDialog';
import {KnowledgeBaseDialog} from './components/KnowledgeBaseDialog';
import {RenameProjectDialog} from './components/RenameProjectDialog';
import SplashScreen from './components/SplashScreen';
import {LandingView} from './components/LandingView';
import {AppShell, GuideView, ThemeToggle, SessionMenu, type Section} from './components/AppShell';
import {ProjectView} from './components/ProjectView';
import {KBWorkspace, type WorkspaceData} from './components/KBWorkspace';
import {CnfCompleteView, ResolutionView} from './components/ResolutionView';

type Screen = 'landing' | Section | 'workspace' | 'cnf' | 'resolution';

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [startupError, setStartupError] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const drafts = useRef<Record<string, WorkspaceData>>({});
  const [kbMessage, setKbMessage] = useState('');
  const [editorData, setEditorData] = useState<WorkspaceData | null>(null);
  const [builderVersion, setBuilderVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const locked = busy || reading;
  const [error, setError] = useState('');
  const [deleteKb, setDeleteKb] = useState<SavedProjectKB | null>(null);
  const [deleteKbError, setDeleteKbError] = useState('');
  const [viewKnowledgeBase, setViewKnowledgeBase] = useState<SavedProjectKB | null>(null);
  const [knowledgeBaseDialogMode, setKnowledgeBaseDialogMode] = useState<'view' | 'edit'>('view');
  const [knowledgeBaseDialogError, setKnowledgeBaseDialogError] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [conversion, setConversion] = useState<CNFConversionResponse | null>(null);
  const [resolution, setResolution] = useState<ResolutionResponse | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => setSplashDone(true), 2200);
    restoreSession()
      .then(() => getProjects())
      .then(items => {
        if (active) {
          setProjects(items);
          setReady(true);
        }
      })
      .catch(failure => {
        if (active) setStartupError(failure instanceof Error ? failure.message : 'Could not connect to your workspace.');
      });

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  async function navigate(section: Section) {
    if (locked) return;
    setError('');
    setScreen(section);
    if (section === 'projects') {
      try {
        setProjects(await getProjects());
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could not refresh projects.');
      }
    }
  }

  function clearProjectDrafts(id: string) {
    for (const key of Object.keys(drafts.current)) {
      if (key.startsWith(`${id}:`)) delete drafts.current[key];
    }
  }

  function updateProject(item: ProjectSummary) {
    setProjects(current => [...current.filter(existing => existing.id !== item.id), item]);
  }

  const rememberDraft = useCallback((data: WorkspaceData) => {
    const projectId = project?.id;
    if (!projectId) return;

    const key = `${projectId}:new`;
    const previous = drafts.current[key];
    if (previous && JSON.stringify([previous.name, previous.formulas, previous.goal, previous.annotations]) !== JSON.stringify([data.name, data.formulas, data.goal, data.annotations])) {
      setConversion(null);
      setResolution(null);
      setKbMessage('');
    }
    drafts.current[key] = data;
  }, [project?.id]);

  function blankWorkspace(item: ProjectSummary): WorkspaceData {
    return {
      name: '',
      formulas: [],
      annotations: [],
      goal: item.goal ?? '',
      editor: {rows: [], files: [], pendingFormula: ''},
    };
  }

  function openProject(item: ProjectSummary) {
    setProject(item);
    const draft = drafts.current[`${item.id}:new`];
    setEditorData(draft ?? blankWorkspace(item));
    setBuilderVersion(current => current + 1);
    setViewKnowledgeBase(null);
    setKnowledgeBaseDialogMode('view');
    setKnowledgeBaseDialogError('');
    setConversion(null);
    setResolution(null);
    setError('');
    setKbMessage('');
    setScreen('workspace');
  }

  function openKnowledgeBase(id: string, mode: 'view' | 'edit' = 'view') {
    if (!project || locked) return;
    const selected = project.knowledgeBases?.find(kb => kb.id === id);
    if (!selected) return;
    setKnowledgeBaseDialogError('');
    setKnowledgeBaseDialogMode(mode);
    setViewKnowledgeBase(selected);
  }

  function exportKnowledgeBase(id: string) {
    if (!project || locked) return;
    const selected = project.knowledgeBases?.find(kb => kb.id === id);
    if (!selected) return;

    const annotations = selected.formulas.map((_, index) => selected.annotations?.[index] ?? '');
    const goal = selected.goal?.trim() || project.goal?.trim();
    const payload = {
      name: selected.name,
      formulas: selected.formulas,
      annotations,
      ...(goal ? {goal} : {}),
    };
    const controlCharsPattern = new RegExp(
      '[' + Array.from({length: 32}, (_, index) => String.fromCharCode(index)).join('') + ']',
      'g',
    );
    const safeName = selected.name
      .trim()
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(controlCharsPattern, '-')
      .replace(/\s+/g, '_')
      .replace(/[. ]+$/g, '')
      .slice(0, 100) || 'knowledge-base';
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeName}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function openDemo() {
    if (locked) return;
    setBusy(true);
    setError('');
    try {
      const existing = projects.find(item => item.id === 'demo-a');
      openProject(existing
        ? await getProject(existing.id)
        : await createProject({id: 'demo-a', name: 'Demo A', description: 'Sample project with two formulas', formulas: ['(P -> Q)', 'P'], goal: 'Q'}));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open demo.');
    } finally {
      setBusy(false);
    }
  }

  async function saveKnowledgeBase(data: WorkspaceData, convert = false): Promise<boolean> {
    if (!project || locked) return false;

    setBusy(true);
    setError('');
    setKbMessage('');

    try {
      const pendingFormula = data.editor?.pendingFormula?.trim() ?? '';
      const draftHasContent = Boolean(data.name.trim() || data.formulas.length || pendingFormula);
      const goal = data.goal.trim();

      if (pendingFormula) {
        throw new Error('Press Enter to add the pending formula before saving or continuing.');
      }
      if (convert && !goal) {
        throw new Error('Enter a goal formula before converting.');
      }

      if (goal && goal !== (project.goal ?? '').trim()) {
        await saveQuery(project.id, goal);
      }

      let knowledgeBases = project.knowledgeBases ?? [];
      let updatedProject: ProjectSummary = {
        ...project,
        goal: goal || project.goal || '',
        status: 'draft',
      };

      if (draftHasContent) {
        if (!data.name.trim()) throw new Error('Enter a name for the knowledge base.');
        if (!data.formulas.length) throw new Error('Add at least one formula to the knowledge base.');

        const validation = await validateKnowledgeBase(data.formulas);
        const invalid = validation.results.find(item => !item.valid);
        if (invalid) {
          throw new Error(`Invalid formula "${invalid.formula}": ${invalid.error || 'Check formula syntax.'}`);
        }

        const saved = await saveNamedKnowledgeBase(
          project.id,
          data.name.trim(),
          data.formulas.map(formula => formula.trim()),
          goal || project.goal || null,
          data.annotations?.map(note => note.trim()),
        );
        const entry: SavedProjectKB = {
          id: saved.id,
          name: saved.name,
          formulas: data.formulas.map(formula => formula.trim()),
          annotations: data.annotations?.map(note => note.trim()) ?? data.formulas.map(() => ''),
          goal: goal || project.goal || null,
        };

        knowledgeBases = [...knowledgeBases.filter(kb => kb.id !== entry.id), entry];
        updatedProject = {
          ...updatedProject,
          knowledgeBases,
          activeKnowledgeBaseId: entry.id,
          formulas: entry.formulas,
          annotations: entry.annotations,
          goal: goal || project.goal || '',
        };
        setKbMessage(`${entry.name} added to the project.`);
        delete drafts.current[`${project.id}:new`];
        setEditorData(blankWorkspace(updatedProject));
      }

      const projectHasFormulas = knowledgeBases.some(kb => kb.formulas.length > 0)
        || Boolean(project.formulas?.length);
      if (convert && !projectHasFormulas) {
        throw new Error('Add at least one knowledge base before continuing to CNF.');
      }

      setProject(updatedProject);
      updateProject(updatedProject);
      setConversion(null);
      setResolution(null);

      if (convert) {
        setConversion(await convertProjectToCnf(project.id));
        setScreen('cnf');
      }

      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the knowledge base.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveKnowledgeBaseEdits(id: string, name: string, formulas: string[], annotations: string[]): Promise<boolean> {
    if (!project || locked) return false;

    setBusy(true);
    setKnowledgeBaseDialogError('');
    try {
      const validation = await validateKnowledgeBase(formulas);
      const invalid = validation.results.find(item => !item.valid);
      if (invalid) {
        throw new Error(`Invalid formula "${invalid.formula}": ${invalid.error || 'Check formula syntax.'}`);
      }

      await updateNamedKnowledgeBase(project.id, id, name, formulas, project.goal || null, annotations);
      const existing = project.knowledgeBases?.find(kb => kb.id === id);
      const edited: SavedProjectKB = {
        id,
        name,
        formulas,
        annotations,
        goal: project.goal || existing?.goal || null,
      };
      const updated: ProjectSummary = {
        ...project,
        formulas,
        annotations,
        activeKnowledgeBaseId: id,
        knowledgeBases: (project.knowledgeBases ?? []).map(kb => kb.id === id ? edited : kb),
        status: 'draft',
      };

      setProject(updated);
      updateProject(updated);
      setViewKnowledgeBase(edited);
      setConversion(null);
      setResolution(null);
      setKbMessage(`${name} updated.`);
      return true;
    } catch (failure) {
      setKnowledgeBaseDialogError(failure instanceof Error ? failure.message : 'Could not update the knowledge base.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function requestDeleteKnowledgeBase(id: string) {
    if (!project || locked) return;
    const target = project.knowledgeBases?.find(kb => kb.id === id);
    if (target) {
      setDeleteKbError('');
      setDeleteKb(target);
    }
  }

  async function deleteKnowledgeBase() {
    if (!project || !deleteKb || locked) return;
    setBusy(true);
    setDeleteKbError('');

    try {
      await deleteSavedKnowledgeBase(project.id, deleteKb.id);
      const remaining = (project.knowledgeBases ?? []).filter(kb => kb.id !== deleteKb.id);
      const local: ProjectSummary = {
        ...project,
        knowledgeBases: remaining,
        status: 'draft',
      };
      const updated = await getProject(project.id).catch(() => local);

      delete drafts.current[`${project.id}:${deleteKb.id}`];
      if (viewKnowledgeBase?.id === deleteKb.id) setViewKnowledgeBase(null);
      setProject(updated);
      updateProject(updated);
      setConversion(null);
      setResolution(null);
      setError('');
      setKbMessage(`${deleteKb.name} deleted from this project.`);
      setDeleteKb(null);
    } catch (failure) {
      setDeleteKbError(failure instanceof Error ? failure.message : 'Could not delete knowledge base.');
    } finally {
      setBusy(false);
    }
  }

  async function renameCurrentProject(requested: string) {
    if (!project || locked) return;
    if (requested === project.name) {
      setRenameOpen(false);
      return;
    }

    setBusy(true);
    setRenameError('');
    try {
      const renamed = await renameProject(project.id, requested);
      setProject(renamed);
      updateProject(renamed);
      setRenameOpen(false);
    } catch (failure) {
      setRenameError(failure instanceof Error ? failure.message : 'Could not rename project.');
    } finally {
      setBusy(false);
    }
  }

  async function markCurrentProjectCompleted(): Promise<void> {
    if (!project || project.status === 'completed') return;

    try {
      const completed = await completeProject(project.id);
      setProject(completed);
      updateProject(completed);
      setError('');
    } catch (failure) {
      const message = failure instanceof Error
        ? failure.message
        : 'The proof is complete, but the project status could not be saved.';
      setError(message);
      throw failure;
    }
  }

  async function beginResolution() {
    if (!project || locked) return;
    setBusy(true);
    setError('');
    try {
      setResolution(await resolveProject(project.id));
      setScreen('resolution');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not run resolution.');
    } finally {
      setBusy(false);
    }
  }

  if (!splashDone || (!ready && !startupError)) return <SplashScreen />;
  if (startupError) {
    return <main className="connection-error">
      <h1>Could not open your workspace</h1>
      <p>{startupError}</p>
      <p>Check that the ResViz backend is running, then try again.</p>
      <button className="button primary" onClick={() => window.location.reload()}>Try again</button>
    </main>;
  }

  if (screen === 'landing') {
    return <>
      <LandingView onNavigate={section => void navigate(section)} onStart={() => void navigate('projects')} onDemo={() => void openDemo()} />
      {busy && <div className="global-status" role="status">Opening demo…</div>}
      {error && <div className="global-status field-error" role="alert">{error}</div>}
    </>;
  }

  const workspace = screen === 'workspace' || screen === 'cnf' || screen === 'resolution';
  const stage = screen === 'resolution' ? 3 : screen === 'cnf' ? 2 : 1;

  return <AppShell
    section={screen === 'learn' || screen === 'help' ? screen : 'projects'}
    projectName={workspace ? project?.name : undefined}
    stage={stage}
    busy={locked}
    knowledgeBases={workspace ? project?.knowledgeBases : undefined}
    activeKnowledgeBaseId={viewKnowledgeBase?.id}
    onKnowledgeBase={id => openKnowledgeBase(id, 'view')}
    onEditKnowledgeBase={id => openKnowledgeBase(id, 'edit')}
    onExportKnowledgeBase={exportKnowledgeBase}
    onDeleteKnowledgeBase={requestDeleteKnowledgeBase}
    onRename={() => {
      if (!locked) {
        setRenameError('');
        setRenameOpen(true);
      }
    }}
    onNavigate={section => void navigate(section)}
    onHome={() => {
      if (!locked) setScreen('landing');
    }}
    onStage={number => {
      if (!locked) {
        setError('');
        if (number === 1 || (number === 2 && conversion) || (number === 3 && resolution)) {
          setScreen(number === 1 ? 'workspace' : number === 2 ? 'cnf' : 'resolution');
        }
      }
    }}
  >
    {!workspace && <div className="dashboard-tools"><ThemeToggle /><SessionMenu /></div>}

    {screen === 'projects' && <>
      <ProjectView
        projects={projects}
        onContinue={openProject}
        onProjectCreated={updateProject}
        onProjectImported={item => {
          clearProjectDrafts(item.id);
          updateProject(item);
        }}
        onProjectDeleted={id => {
          clearProjectDrafts(id);
          setProjects(current => current.filter(item => item.id !== id));
          if (project?.id === id) {
            setProject(null);
            setConversion(null);
            setResolution(null);
            setViewKnowledgeBase(null);
            setRenameOpen(false);
          }
        }}
      />
      {error && <p className="dashboard-error field-error" role="alert">{error}</p>}
    </>}

    {(screen === 'learn' || screen === 'help') && <GuideView section={screen} />}

    {screen === 'workspace' && project && editorData && <KBWorkspace
      key={`${project.id}:builder:${builderVersion}`}
      projectName={project.name}
      initialFormulas={editorData.formulas}
      initialAnnotations={editorData.annotations}
      initialGoal={editorData.goal}
      initialName={editorData.name}
      initialEditor={editorData.editor}
      entries={project.knowledgeBases ?? []}
      busy={busy}
      error={error}
      message={kbMessage}
      onBack={() => void navigate('projects')}
      onSave={data => saveKnowledgeBase(data)}
      onConvert={data => saveKnowledgeBase(data, true)}
      onDraftChange={rememberDraft}
      onReading={setReading}
    />}

    {screen === 'cnf' && conversion && <CnfCompleteView
      conversion={conversion}
      busy={busy}
      error={error}
      goal={project?.goal ?? ''}
      onBack={() => {
        setError('');
        setScreen('workspace');
      }}
      onStartResolution={() => void beginResolution()}
    />}

    {screen === 'resolution' && resolution && <ResolutionView
      resolution={resolution}
      goal={project?.goal ?? ''}
      onBack={() => setScreen('cnf')}
      onBackToKnowledgeBase={() => setScreen('workspace')}
      onContradictionReached={() => markCurrentProjectCompleted()}
    />}

    {screen === 'resolution' && error && <div className="global-status field-error" role="alert">{error}</div>}

    {viewKnowledgeBase && <KnowledgeBaseDialog
      key={viewKnowledgeBase.id}
      knowledgeBase={viewKnowledgeBase}
      initialEditing={knowledgeBaseDialogMode === 'edit'}
      busy={busy}
      error={knowledgeBaseDialogError}
      onClose={() => {
        if (!locked) {
          setViewKnowledgeBase(null);
          setKnowledgeBaseDialogMode('view');
          setKnowledgeBaseDialogError('');
        }
      }}
      onSave={saveKnowledgeBaseEdits}
    />}

    {deleteKb && <DeleteKnowledgeBaseDialog
      name={deleteKb.name}
      formulaCount={deleteKb.formulas.length}
      busy={busy}
      error={deleteKbError}
      onClose={() => {
        if (!locked) setDeleteKb(null);
      }}
      onDelete={deleteKnowledgeBase}
    />}

    {renameOpen && project && <RenameProjectDialog
      name={project.name}
      busy={busy}
      error={renameError}
      onClose={() => {
        if (!locked) setRenameOpen(false);
      }}
      onSave={renameCurrentProject}
    />}
  </AppShell>;
}
