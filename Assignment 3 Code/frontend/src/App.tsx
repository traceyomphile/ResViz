import {useCallback, useEffect, useRef, useState} from 'react';
import './App.css';
import {restoreSession} from './api/session';
import {getProjects, getProject, createProject, renameProject, type ProjectSummary, type SavedProjectKB} from './api/projects';
import {deleteSavedKnowledgeBase, activateKnowledgeBase, convertProjectToCnf, resolveProject, saveNamedKnowledgeBase, updateNamedKnowledgeBase, validateKnowledgeBase, type CNFConversionResponse, type ResolutionResponse} from './api/knowledgeBase';
import {DeleteKnowledgeBaseDialog} from './components/DeleteKnowledgeBaseDialog';
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
  const [entryId, setEntryId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const locked = busy || reading;
  const [error, setError] = useState('');
  const [deleteKb, setDeleteKb] = useState<SavedProjectKB | null>(null);
  const [deleteKbError, setDeleteKbError] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [conversion, setConversion] = useState<CNFConversionResponse | null>(null);
  const [resolution, setResolution] = useState<ResolutionResponse | null>(null);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => setSplashDone(true), 2200);
    restoreSession().then(() => getProjects()).then(items => {if (active) {setProjects(items); setReady(true);}}).catch(failure => {if (active) setStartupError(failure instanceof Error ? failure.message : 'Could not connect to your workspace.');});
    return () => {active = false; window.clearTimeout(timer);};
  }, []);
  async function navigate(section: Section) {
    if (locked) return;
    setError(''); setScreen(section);
    if (section === 'projects') {
      try {setProjects(await getProjects());} catch (failure) {setError(failure instanceof Error ? failure.message : 'Could not refresh projects.');}
    }
  }
  function clearProjectDrafts(id: string) {
    for (const key of Object.keys(drafts.current)) if (key.startsWith(`${id}:`)) delete drafts.current[key];
  }
  function updateProject(item: ProjectSummary) {setProjects(current => [...current.filter(p => p.id !== item.id), item]);}
  const rememberDraft = useCallback((data: WorkspaceData) => {
    const projectId = project?.id;
    if (!projectId) return;
    const key = `${projectId}:${entryId ?? 'new'}`;
    const previous = drafts.current[key];
    if (previous && JSON.stringify([previous.name, previous.formulas, previous.goal]) !== JSON.stringify([data.name, data.formulas, data.goal])) {
      setConversion(null); setResolution(null); setKbMessage('');
    }
    if (previous && JSON.stringify(previous.annotations) !== JSON.stringify(data.annotations)) setKbMessage('');
    drafts.current[key] = data;
  }, [project?.id, entryId]);
  function openProject(item: ProjectSummary) {
    setProject(item);
    const saved = item.knowledgeBases?.find(kb => kb.id === item.activeKnowledgeBaseId)
      ?? item.knowledgeBases?.find(kb => JSON.stringify(kb.formulas) === JSON.stringify(item.formulas))
      ?? item.knowledgeBases?.[0];
    setEditorData(drafts.current[`${item.id}:${saved?.id ?? 'new'}`] ?? {name: saved?.name ?? '', formulas: saved?.formulas ?? item.formulas ?? [], annotations: saved?.annotations ?? item.annotations, goal: saved ? saved.goal ?? '' : item.goal ?? '', entryId: saved?.id});
    setEntryId(saved?.id); setConversion(null); setResolution(null); setError(''); setKbMessage(''); setScreen('workspace');
  }
  function startKnowledgeBase() {
    if (!project || locked) return;
    const key = `${project.id}:new`;
    drafts.current[key] ??= {name: '', formulas: [], goal: ''};
    setEditorData(drafts.current[key]);
    setEntryId(undefined); setConversion(null); setResolution(null); setError(''); setKbMessage(''); setScreen('workspace');
  }
  async function selectKnowledgeBase(id: string) {
    if (!project || locked) return;
    if (entryId === id) {setScreen('workspace'); return;}
    setBusy(true); setError(''); setKbMessage('');
    try {
      const selected = await activateKnowledgeBase(project.id, id);
      const updated = {...project, formulas: selected.formulas, annotations: selected.annotations, goal: selected.goal ?? '', activeKnowledgeBaseId: id, status: 'draft'};
      const entry = project.knowledgeBases?.find(kb => kb.id === id);
      setEditorData(drafts.current[`${project.id}:${id}`] ?? {name: entry?.name ?? '', formulas: selected.formulas, annotations: selected.annotations, goal: selected.goal ?? '', entryId: id});
      setProject(updated); updateProject(updated); setEntryId(id); setConversion(null); setResolution(null); setScreen('workspace');
    } catch (failure) {setError(failure instanceof Error ? failure.message : 'Could not open knowledge base.');}
    finally {setBusy(false);}
  }
  async function openDemo() {
    if (locked) return;
    setBusy(true); setError('');
    try {const existing = projects.find(item => item.id === 'demo-a'); openProject(existing ? await getProject(existing.id) : await createProject({id: 'demo-a', name: 'Demo A', description: 'Sample project with two formulas', formulas: ['(P -> Q)', 'P'], goal: 'Q'}));}
    catch (failure) {setError(failure instanceof Error ? failure.message : 'Could not open demo.');}
    finally {setBusy(false);}
  }
  async function saveKnowledgeBase(data: WorkspaceData, convert = false) {
    if (!project || locked) return;
    setBusy(true); setError(''); setKbMessage('');
    try {
      if (convert && !data.goal) throw new Error('Enter a goal formula before converting.');
      let knowledgeBases = project.knowledgeBases ?? [];
      const pending = convert ? knowledgeBases.filter(kb => kb.id !== data.entryId).map((kb): (WorkspaceData & {entryId: string}) | null => {
        const draft = drafts.current[`${project.id}:${kb.id}`];
        return draft ? {...draft, entryId: kb.id, name: draft.name.trim(), formulas: draft.formulas.map(formula => formula.trim()), goal: draft.goal.trim(), annotations: draft.annotations?.map(note => note.trim())} : null;
      }).filter((draft): draft is WorkspaceData & {entryId: string} => draft !== null) : [];
      // Validate every edited KB before persisting any of the conversion inputs.
      for (const input of [...pending, data]) {
        if (input.editor?.pendingFormula?.trim()) throw new Error(`Knowledge base "${input.name}": press Enter to add the pending formula before conversion.`);
        if (!input.name.trim()) throw new Error('Each knowledge base needs a name before conversion.');
        const formulas = [...input.formulas, ...(input.goal ? [input.goal] : [])];
        if (formulas.length) {
          const validation = await validateKnowledgeBase(formulas);
          const invalid = validation.results.find(item => !item.valid);
          if (invalid) throw new Error(`Knowledge base "${input.name}": invalid formula "${invalid.formula}": ${invalid.error || 'Check formula syntax.'}`);
        }
      }
      for (const draft of pending) {
        const previous = knowledgeBases.find(kb => kb.id === draft.entryId);
        if (JSON.stringify([previous?.name, previous?.formulas, previous?.goal ?? '', previous?.annotations ?? previous?.formulas.map(() => '')]) === JSON.stringify([draft.name, draft.formulas, draft.goal, draft.annotations ?? draft.formulas.map(() => '')])) continue;
        try {await updateNamedKnowledgeBase(project.id, draft.entryId, draft.name, draft.formulas, draft.goal || null, draft.annotations);}
        catch (failure) {throw new Error(`Could not save knowledge base "${draft.name}": ${failure instanceof Error ? failure.message : 'Try again.'}`, {cause: failure});}
        knowledgeBases = knowledgeBases.map(kb => kb.id === draft.entryId ? {id: kb.id, name: draft.name, formulas: draft.formulas, goal: draft.goal || null, annotations: draft.annotations} : kb);
        const savedProject = {...project, knowledgeBases, status: 'draft'};
        setProject(savedProject); updateProject(savedProject);
      }
      const saved = data.entryId
        ? await updateNamedKnowledgeBase(project.id, data.entryId, data.name, data.formulas, data.goal || null, data.annotations)
        : await saveNamedKnowledgeBase(project.id, data.name, data.formulas, data.goal || null, data.annotations);
      const entry = {id: saved.id, name: saved.name, formulas: data.formulas, annotations: data.annotations ?? data.formulas.map(() => ''), goal: data.goal || null};
      const updated = {...project, formulas: data.formulas, annotations: data.annotations, goal: data.goal, activeKnowledgeBaseId: entry.id,
        knowledgeBases: knowledgeBases.some(kb => kb.id === entry.id)
          ? knowledgeBases.map(kb => kb.id === entry.id ? entry : kb)
          : [...knowledgeBases, entry], status: 'draft'};
      drafts.current[`${project.id}:${entry.id}`] = {...data, entryId: entry.id};
      if (!data.entryId) delete drafts.current[`${project.id}:new`];
      setEditorData({...data, entryId: entry.id});
      setProject(updated); updateProject(updated); setEntryId(entry.id); setConversion(null); setResolution(null);
      setKbMessage(`${entry.name} ${data.entryId ? 'saved' : 'added to this project'}.`);
      if (convert) {setConversion(await convertProjectToCnf(project.id)); setScreen('cnf');}
    } catch (failure) {setError(failure instanceof Error ? failure.message : 'Could not save the knowledge base.');}
    finally {setBusy(false);}
  }
  function requestDeleteKnowledgeBase(id: string) {
    if (!project || locked) return;
    const target = project.knowledgeBases?.find(kb => kb.id === id);
    if (target) {setDeleteKbError(''); setDeleteKb(target);}
  }
  async function deleteKnowledgeBase() {
    if (!project || !deleteKb || locked) return;
    setBusy(true); setDeleteKbError('');
    try {
      await deleteSavedKnowledgeBase(project.id, deleteKb.id);
      const remaining = (project.knowledgeBases ?? []).filter(kb => kb.id !== deleteKb.id);
      const wasActive = project.activeKnowledgeBaseId === deleteKb.id || (!project.activeKnowledgeBaseId && JSON.stringify(project.formulas) === JSON.stringify(deleteKb.formulas));
      const fallback = remaining.at(-1);
      const local: ProjectSummary = {...project, knowledgeBases: remaining, status: 'draft',
        ...(wasActive ? {activeKnowledgeBaseId: fallback?.id ?? null, formulas: fallback?.formulas ?? [], annotations: fallback?.annotations ?? [], goal: fallback?.goal ?? ''} : {})};
      // A successful deletion stays successful even if the refresh is offline.
      const updated = await getProject(project.id).catch(() => local);
      delete drafts.current[`${project.id}:${deleteKb.id}`];
      if (entryId === deleteKb.id) {
        const next = updated.knowledgeBases?.find(kb => kb.id === updated.activeKnowledgeBaseId) ?? updated.knowledgeBases?.at(-1);
        setEntryId(next?.id);
        setEditorData(drafts.current[`${project.id}:${next?.id ?? 'new'}`] ?? {name: next?.name ?? '', formulas: next?.formulas ?? [], annotations: next?.annotations ?? [], goal: next?.goal ?? '', entryId: next?.id});
      }
      setProject(updated); updateProject(updated); setConversion(null); setResolution(null);
      setError(''); setKbMessage(`${deleteKb.name} deleted from this project.`); setScreen('workspace'); setDeleteKb(null);
    } catch (failure) {setDeleteKbError(failure instanceof Error ? failure.message : 'Could not delete knowledge base.');}
    finally {setBusy(false);}
  }
  async function renameCurrentProject(requested: string) {
    if (!project || locked) return;
    if (requested === project.name) {setRenameOpen(false); return;}
    setBusy(true); setRenameError('');
    try {
      const renamed = await renameProject(project.id, requested);
      setProject(renamed); updateProject(renamed); setRenameOpen(false);
    } catch (failure) {
      setRenameError(failure instanceof Error ? failure.message : 'Could not rename project.');
    } finally {setBusy(false);}
  }
  async function beginResolution() {
    if (!project || locked) return;
    setBusy(true); setError('');
    try {setResolution(await resolveProject(project.id)); setScreen('resolution');}
    catch (failure) {setError(failure instanceof Error ? failure.message : 'Could not run resolution.');}
    finally {setBusy(false);}
  }
  if (!splashDone || (!ready && !startupError)) return <SplashScreen />;
  if (startupError) return <main className="connection-error"><h1>Could not open your workspace</h1><p>{startupError}</p><p>Check that the ResViz backend is running, then try again.</p><button className="button primary" onClick={() => window.location.reload()}>Try again</button></main>;
  if (screen === 'landing') return <><LandingView onNavigate={section => void navigate(section)} onStart={() => void navigate('projects')} onDemo={() => void openDemo()} />{busy && <div className="global-status" role="status">Opening demo…</div>}{error && <div className="global-status field-error" role="alert">{error}</div>}</>;
  const workspace = screen === 'workspace' || screen === 'cnf' || screen === 'resolution';
  const stage = screen === 'resolution' ? 3 : screen === 'cnf' ? 2 : 1;
  return <AppShell section={screen === 'learn' || screen === 'help' ? screen : 'projects'} projectName={workspace ? project?.name : undefined} stage={stage} busy={locked} knowledgeBases={workspace ? project?.knowledgeBases : undefined} activeKnowledgeBaseId={entryId} onKnowledgeBase={id => void selectKnowledgeBase(id)} onAddKnowledgeBase={startKnowledgeBase} onDeleteKnowledgeBase={requestDeleteKnowledgeBase} onRename={() => {if (!locked) {setRenameError(''); setRenameOpen(true);}}} onNavigate={section => void navigate(section)} onHome={() => {if (!locked) setScreen('landing');}} onStage={number => {if (!locked) {setError(''); if (number === 1 || (number === 2 && conversion) || (number === 3 && resolution)) setScreen(number === 1 ? 'workspace' : number === 2 ? 'cnf' : 'resolution');}}}>
    {!workspace && <div className="dashboard-tools"><ThemeToggle /><SessionMenu /></div>}
    {screen === 'projects' && <><ProjectView projects={projects} onContinue={openProject} onProjectCreated={updateProject} onProjectImported={item => {clearProjectDrafts(item.id); updateProject(item);}} onProjectDeleted={id => {clearProjectDrafts(id); setProjects(current => current.filter(item => item.id !== id)); if (project?.id === id) {setProject(null); setConversion(null); setResolution(null); setEntryId(undefined); setRenameOpen(false);}}} />{error && <p className="dashboard-error field-error" role="alert">{error}</p>}</>}
    {(screen === 'learn' || screen === 'help') && <GuideView section={screen} />}
    {screen === 'workspace' && project && editorData && <KBWorkspace key={`${project.id}:${entryId ?? 'new'}`} projectName={project.name} initialFormulas={editorData.formulas} initialAnnotations={editorData.annotations} initialGoal={editorData.goal} initialName={editorData.name} initialEditor={editorData.editor} entryId={entryId} entries={project.knowledgeBases ?? []} busy={busy} error={error} message={kbMessage} onBack={() => void navigate('projects')} onSave={data => saveKnowledgeBase(data)} onConvert={data => saveKnowledgeBase(data, true)} onDraftChange={rememberDraft} onReading={setReading} onDelete={() => {if (entryId) requestDeleteKnowledgeBase(entryId);}} />}
    {screen === 'cnf' && conversion && <CnfCompleteView conversion={conversion} onBack={() => {setError(''); setScreen('workspace');}} onStartResolution={() => void beginResolution()} />}
    {screen === 'resolution' && resolution && <ResolutionView resolution={resolution} onBack={() => setScreen('cnf')} onBackToKnowledgeBase={() => setScreen('workspace')} />}
    {screen === 'resolution' && error && <div className="global-status field-error" role="alert">{error}</div>}
    {deleteKb && <DeleteKnowledgeBaseDialog name={deleteKb.name} formulaCount={deleteKb.formulas.length} busy={busy} error={deleteKbError} onClose={() => {if (!locked) setDeleteKb(null);}} onDelete={deleteKnowledgeBase} />}
    {renameOpen && project && <RenameProjectDialog name={project.name} busy={busy} error={renameError} onClose={() => {if (!locked) setRenameOpen(false);}} onSave={renameCurrentProject} />}
  </AppShell>;
}
