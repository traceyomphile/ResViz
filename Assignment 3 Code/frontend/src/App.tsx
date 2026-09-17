import {useEffect, useState} from 'react';
import './App.css';
import type {Session} from './types/session';
import {restoreSession} from './api/session';
import {getProjects, updateProjectName, type ProjectSummary} from './api/projects';
import {
  activateKnowledgeBase,
  convertProjectToCnf,
  deleteSavedKnowledgeBase,
  resolveProject,
  saveNamedKnowledgeBase,
  saveQuery,
  saveTypedKnowledgeBase,
  uploadKnowledgeBase,
  validateKnowledgeBase,
  type CNFConversionResponse,
  type KnowledgeBaseEntrySummary,
  type ResolutionResponse,
} from './api/knowledgeBase';
import type {KBData} from './types';
import SplashScreen from './components/SplashScreen';
import {ProjectView} from './components/ProjectView';
import {KBChoiceView} from './components/KBChoiceView.tsx';
import {KBInputView, type SavedKB} from './components/KBInputview.tsx';
import {TopBar} from './components/TopBar.tsx';
import {CnfCompleteView, ProofIntroView, ResolutionView} from './components/ResolutionView.tsx';
import { DashboardLayout } from './components/layout/DashboardLayout.tsx';
import type { WorkspaceScreen } from './types/navigation.ts';
const SPLASH_DURATION_MS = 6000;
type Screen = 'projects' | WorkspaceScreen;

export default function App() {
  const [splashFinished, setSplashFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [screen, setScreen] = useState<Screen>('projects');
  const [method, setMethod] = useState<'upload' | 'type'>('upload');
  const [formulas, setFormulas] = useState<string[]>([]);
  const [goal, setGoal] = useState('');
  const [projectName, setProjectName] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeKnowledgeBaseId, setActiveKnowledgeBaseId] = useState<string | null>(null);
  const [knowledgeBaseRefreshKey, setKnowledgeBaseRefreshKey] = useState(0);
  const [kbName, setKbName] = useState('');
  const [uploadedKB, setUploadedKB] = useState<KBData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [kbError, setKbError] = useState('');
  const [conversion, setConversion] = useState<CNFConversionResponse | null>(null);
  const [resolution, setResolution] = useState<ResolutionResponse | null>(null);

  const showSplash = !splashFinished || (session === null && !error);

  /*
   * Restore browser/session state.
  */
  useEffect(() => {
    restoreSession()
      .then(setSession)
      .catch((failure: unknown) => {
        console.error('Failed to restore session:', failure);
        setError('Could not restore your session');
        setSplashFinished(false);
      });
  }, []);

  /**
   * Splash Screen timer.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => setSplashFinished(true), SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  /**
   * Load available projects once the session is ready.
   */
  useEffect(() => {
    if (!splashFinished || !session || error) return;

    getProjects()
      .then(setProjects)
      .catch((failure: unknown) => {
        console.error('Failed to load projects:', failure);
        setError('Could not load your projects');
      });
  }, [splashFinished, session, error]);

  /**
   * Ensures actions that need a project have one.
   */
  function requireProject(): string {
    if (!activeProjectId) throw new Error('No active project was selected.');
    return activeProjectId;
  }

  /**
   * Open an existing project.
   */
  function openProject(project: ProjectSummary) {
    setActiveProjectId(project.id);
    setProjectName(project.name);
    setKbName('');
    setActiveKnowledgeBaseId(null);
    setUploadedKB(null);
    setKbError('');
    setConversion(null);
    setResolution(null);
    setFormulas(Array.isArray(project.formulas)
      ? project.formulas.filter((item): item is string => typeof item === 'string')
      : []);
    setGoal(project.goal ?? '');
    setScreen('kb-choice');
  }

  /**
   * Return from the dashboard workspace to the projects page.
   */
  function backToProjects() {
    setKbError('');
    setScreen('projects');
  }

  /**
   * Update project name
   */
  async function renameCurrentProject(name: string) {
    console.log('RENAME STARTED:', {activeProjectId, name});
    if (!activeProjectId) {
      console.error('RENAME FAILED: no active project ID')
      return;
    }

    try {
      const updatedProject = await updateProjectName(activeProjectId, name);
      console.log('RENAME RESPONSE:', updatedProject)
      setProjectName(updatedProject.name);
      setProjects((currentProjects) => 
        currentProjects.map((project) => 
          project.id === activeProjectId
            ? {...project, name: updatedProject.name }
            : project
        )
      );
    } catch (error) {
      console.error('Failed to rename project:', error);
    }
  }

  /**
   * Upload a KB file.
   */
  async function uploadKBFile(file: File) {
    setIsUploading(true);
    setKbError('');

    try {
      const result = await uploadKnowledgeBase(requireProject(), file);
      setFormulas(result.formulas);
      if (result.goal) setGoal(result.goal);
      setUploadedKB({fileName: file.name, formulas: result.formulas, goal: result.goal ?? ''});
    } catch (failure) {
      setUploadedKB(null);
      setKbError(failure instanceof Error ? failure.message : 'Could not upload the knowledge base.');
    } finally {
      setIsUploading(false);
    }
  }

  /**
   * Save a KB created or edited by the user.
   */
  async function saveKnowledgeBase(kb: SavedKB) {
    setIsSaving(true);
    setKbError('');

    try {
      const projectId = requireProject();
      const validation = await validateKnowledgeBase(kb.formulas);
      const invalid = validation.results.find((result) => !result.valid);
      if (invalid) {
        throw new Error(invalid.error
          ? `Invalid formula "${invalid.formula}": ${invalid.error}`
          : `Invalid formula: ${invalid.formula}`);
      }

      if (kb.method === 'type') await saveTypedKnowledgeBase(projectId, kb.formulas);
      const saved = await saveNamedKnowledgeBase(projectId, kb.name, kb.formulas);

      if (kb.id && kb.id !== saved.id) await deleteSavedKnowledgeBase(projectId, kb.id);

      setKbName(kb.name);
      setActiveKnowledgeBaseId(saved.id);
      setFormulas(kb.formulas);
      setUploadedKB(kb.upload);
      setKnowledgeBaseRefreshKey((current) => current + 1);
      setScreen('kb-choice');
    } catch (failure) {
      setKbError(failure instanceof Error ? failure.message : 'Could not save the knowledge base.');
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Select one of the previously saved KBs.
   */
  async function selectSavedKnowledgeBase(kb: KnowledgeBaseEntrySummary) {
    setKbError('');
    try {
      const result = await activateKnowledgeBase(requireProject(), kb.id);
      setKbName(kb.name);
      setFormulas(result.formulas);
      setUploadedKB(null);
    } catch (failure) {
      setKbError(failure instanceof Error ? failure.message : 'Could not load the selected knowledge base.');
    }
  }

  /**
   * Save the goal and convert the project KB into CNF.
   */
  async function convertKnowledgeBase() {
    setIsConverting(true);
    setKbError('');

    try {
      const projectId = requireProject();
      const query = goal.trim();
      if (!query) throw new Error('Enter the goal formula you want to prove.');

      const validation = await validateKnowledgeBase([query]);
      const invalid = validation.results.find((result) => !result.valid);
      if (invalid) {
        throw new Error(invalid.error
          ? `Invalid formula "${invalid.formula}": ${invalid.error}`
          : `Invalid formula: ${invalid.formula}`);
      }

      await saveQuery(projectId, query);

      const converted = await convertProjectToCnf(projectId);
      setConversion(converted);
      setResolution(null);
      setScreen('cnf-complete');
    } catch (failure) {
      setKbError(failure instanceof Error ? failure.message : 'Could not convert the project to CNF.');
    } finally {
      setIsConverting(false);
    }
  }

  /**
   * Run resolution after the proof introduction.
   */
  async function beginResolution() {
    setIsResolving(true);
    setKbError('');

    try {
      const resolved = await resolveProject(requireProject());
      setResolution(resolved);
      setScreen('resolution');
    } catch (failure) {
      setKbError(failure instanceof Error ? failure.message : 'Could not run resolution.');
    } finally {
      setIsResolving(false);
    }
  }

  /**
   * Loading / session states
   */
  if (showSplash) {
    return <SplashScreen />
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!session) {
    return <div>NO SESSION FOUND</div>;
  }

  /**
   * Project selection stays outside the dashboard.
   */
  if (screen === 'projects') {
    return (
      <ProjectView 
        projects={projects}
        onProjectCreated={(project) => 
          setProjects((current) => [
            ...current.filter((item) => item.id !== project.id,),
            project,
          ])
        }
        onProjectImported={(project) => 
          setProjects((current) => [
            ...current.filter((item) => item.id !== project.id,),
            project,
          ])
        }
        onContinue={openProject}
      />
    );
  }

  /**
   * Everything lives inside the dashboard shell.
   */
  return (
    <>
      <TopBar />

      <DashboardLayout
        projectName={projectName}
        currentScreen={screen}
        onBackToProjects={backToProjects}
        onRenameProject={renameCurrentProject}
      >
        {screen === 'kb-choice' && <KBChoiceView
          projectId={activeProjectId ?? ''}
          refreshKey={knowledgeBaseRefreshKey}
          query={goal}
          activeKnowledgeBaseId={activeKnowledgeBaseId}
          isConverting={isConverting}
          error={kbError}
          onQueryChange={setGoal}
          onChoose={(selectedMethod) => {
            setMethod(selectedMethod);
            setKbName('');
            setActiveKnowledgeBaseId(null);
            setFormulas([]);
            setUploadedKB(null);
            setKbError('');
            setScreen('kb-input');
          }}
          onSelectKnowledgeBase={(kb) => {
            setActiveKnowledgeBaseId(kb.id);
            void selectSavedKnowledgeBase(kb);
          }}
          onConvert={() => void convertKnowledgeBase()}
          onBack={() => setScreen('projects')}
        />}

        {screen === 'kb-input' && <KBInputView
          method={method}
          projectName={projectName}
          kbName={kbName}
          editingKnowledgeBaseId={activeKnowledgeBaseId}
          formulas={formulas}
          upload={uploadedKB}
          isUploading={isUploading}
          isSaving={isSaving}
          uploadError={kbError}
          onUpload={uploadKBFile}
          AddFormula={(formula) => {
            setKbError('');
            setFormulas((current) => [...current, formula]);
          }}
          RemoveFormula={(index) => {
            setKbError('');
            setFormulas((current) => current.filter((_, currentIndex) => currentIndex !== index));
          }}
          KBNameChange={setKbName}
          SaveKB={(kb) => void saveKnowledgeBase(kb)}
          onBack={() => setScreen('kb-choice')}
        />}

        {screen === 'cnf-complete' && conversion && <CnfCompleteView
          conversion={conversion}
          onBack={() => setScreen('kb-choice')}
          onStartResolution={() => setScreen('proof-intro')}
        />}

        {screen === 'proof-intro' && conversion && <ProofIntroView
          goal={goal}
          negatedGoal={conversion.negated_goal}
          isResolving={isResolving}
          error={kbError}
          onBack={() => setScreen('cnf-complete')}
          onBegin={() => void beginResolution()}
        />}

        {screen === 'resolution' && resolution && <ResolutionView
          resolution={resolution}
          onBack={() => setScreen('proof-intro')}
          onBackToKnowledgeBase={() => setScreen('kb-choice')}
        />}
      </DashboardLayout>
    </>
  );
}
