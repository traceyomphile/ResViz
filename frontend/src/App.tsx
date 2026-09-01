// src/App.tsx
import { useEffect, useState } from 'react';
import './App.css';
import type { Session } from './types/session';
import { restoreSession } from './api/session';
import { getProjects, type ProjectSummary } from './api/projects';
import {
  activateKnowledgeBase,
  convertProjectToCnf,
  saveNamedKnowledgeBase,
  saveTypedKnowledgeBase,
  uploadKnowledgeBase,
  validateKnowledgeBase,
  type KnowledgeBaseEntrySummary,
} from './api/knowledgeBase';
import type { KBData } from './types';
import SplashScreen from './components/SplashScreen';
import { ProjectView } from './components/ProjectView';
import { KBChoiceView } from './components/KBChoiceView.tsx';
import { KBInputView, type SavedKB } from './components/KBInputView.tsx';
import { TopBar } from './components/TopBar.tsx';

const SPLASH_DURATION_MS =6000;
type Screen = 'projects' | 'kb-choice' | 'kb-input';

export default function App() {
    const [splashFinished, setSplashFinished] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [projects, setProjects] = useState<ProjectSummary[]>([]);

    const showSplash = !splashFinished || (session === null && !error);

    const [screen, setScreen] = useState<Screen>('projects')
    const [method, setMethod] = useState<'upload' | 'type'>('upload');

    const [formulas, setFormulas] = useState<string[]>([]);
    //const [goal, setGoal] = useState('');

    const [projectName, setProjectName] = useState<string | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    
    const [kbName, setKbName] = useState("");
    
    const [uploadedKB, setUploadedKB] = useState<KBData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [kbError, setKbError] = useState('');
    
    /**
     * Restore/create the current ResViz session.
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
     * Allow the splash screen to finsh before moving on.
     */
    useEffect(() => {
      const timer = setTimeout(() => setSplashFinished(true), SPLASH_DURATION_MS);
      return () => clearTimeout(timer);
    }, []);

    /**
     * Load projects belonging to the current session after.
     */
    useEffect(() => {
      if (!splashFinished || !session || error) {return;}

      getProjects()
        .then(setProjects) 
        .catch((failure: unknown) => {
          console.error('Failed to load projects:', failure);
          setError('Could not load your projects');
          //setSplashFinished(true);
      });
    }, [splashFinished, session, error]);

    function requireProject(): string {
      if (!activeProjectId) throw new Error('No active project was selected.');
      return activeProjectId
    }

    function openProject(project: ProjectSummary) {
      setActiveProjectId(project.id);
      setProjectName(project.name);
      setKbName("");
      setUploadedKB(null);
      setKbError("");
      setFormulas(Array.isArray(project.formulas)
        ? project.formulas.filter((item): item is string => typeof item === 'string')
        : []);
      setScreen('kb-choice');
    }

    /**
     * Call backend to upload KB file
     */
    async function uploadKBFile(file: File) {
      setIsUploading(true);
      setKbError('');

      try {
        const result = await uploadKnowledgeBase(requireProject(), file);
        setFormulas(result.formulas);
        setUploadedKB({ fileName: file.name, formulas: result.formulas, goal: result.goal ?? ""});
      } catch (failure) {
        setUploadedKB(null);
        setKbError(
          failure instanceof Error
            ? failure.message
            : 'Could not upload the knowledge base.'
        );
      } finally {
        setIsUploading(false);
      }
    }

    async function saveKnowledgeBase(kb: SavedKB) {
      setIsSaving(true);
      setKbError("");
      try {
        const projectId = requireProject();
        const validation = await validateKnowledgeBase(kb.formulas);
        const invalid = validation.results.find((result) => !result.valid);
        if (invalid) throw new Error(invalid.error
          ? `Invalid formula "${invalid.formula}": ${invalid.error}`
          :  `Invalid formula: ${invalid.formula}`);

        // Typed mode.
        if (kb.method === 'type') await saveTypedKnowledgeBase(projectId, kb.formulas);
        await saveNamedKnowledgeBase(projectId, kb.name, kb.formulas);

        setKbName(kb.name);
        setFormulas(kb.formulas);
        setUploadedKB(kb.upload);
        setScreen('kb-choice');
      } catch (failure) {
        setKbError(failure instanceof Error ? failure.message : 'Could not save the knowledge base.');
      } finally {
        setIsSaving(false);
      }
    }

    async function selectSavedKnowledgeBase(kb:KnowledgeBaseEntrySummary) {
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

    async function convertKnowledgeBase() {
      setIsConverting(true);
      setKbError('');

      try {
        const conversion = await convertProjectToCnf(requireProject());
        console.log('CNF conversion completed:', conversion);
        //const invalid = conversion.results.find((result) => !result.valid);
        // Will connect conversion.cnf_clauses and conversion steps to the screen later.
      } catch (failure) {
        setKbError(
          failure instanceof Error
            ? failure.message
            : 'Could not convert the project to CNF.',
        );
      } finally {
        setIsConverting(false);
      }
    }

    return (
      <>
        {showSplash ? (
          <SplashScreen />
        ) : error ? (
          <div>{error}</div>
        ) : !session ? (
            <div>NO SESSION FOUND</div>
        ) : (
            <>

              <TopBar />
              
              {screen === 'projects' && (
                <ProjectView
                  projects={projects}
                  onProjectCreated={(project) => {
                    setProjects((current) => [
                      ...current.filter((item) => item.id !== project.id),
                      project,
                    ])}
                  }
                  onProjectImported={(project) => {
                    setProjects((current) => [
                        ...current.filter((item) => item.id !== project.id),
                        project
                    ])}
                  }
                  onContinue={openProject}
                />)}

              {screen === 'kb-choice' && (
                <KBChoiceView
                  projectId={activeProjectId ?? ''}
                  isConverting={isConverting}
                  error={kbError}
                  onChoose={(selectedMethod) => {
                    setMethod(selectedMethod);
                    setKbName('');
                    setKbError('');
                    setScreen('kb-input'); 
                  }}
                  onSelectKnowledgeBase={(kb) => void selectSavedKnowledgeBase(kb)}
                  onConvert={() => void convertKnowledgeBase()}
                  onBack={() => setScreen('projects')}
                />)}

              {screen === 'kb-input' && (
                <KBInputView
                  method={method}
                  projectName={projectName}
                  kbName={kbName}
                  formulas={formulas}
                  //goal={goal}

                  upload={uploadedKB}
                  isUploading={isUploading}
                  isSaving={isSaving}
                  //isConverting={isConverting}
                  uploadError={kbError}

                  onUpload={uploadKBFile}
                  AddFormula={(formula) => {
                    setFormulas((current) => [
                      ...current,
                      formula,
                    ]);
                  }}

                  RemoveFormula={(index: number) => {
                    setFormulas((current) => 
                      current.filter(
                        (_, currentIndex) =>
                            currentIndex !== index,
                      ),
                    );
                  }}

                  /*
                  GoalChange={(newGoal: string) => {
                    setGoal(newGoal);
                  }}
                  */
                 KBNameChange={setKbName}
                 SaveKB={saveKnowledgeBase}
                  onBack={() => {
                    setScreen('kb-choice');
                  }}
                />
              )}
          </>
      )}
    </>
  );
}

