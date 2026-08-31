// src/App.tsx
import { useEffect, useState } from 'react';
import './App.css';
import type { Session } from './types/session';
import { restoreSession } from './api/session';
import { getProjects, type ProjectSummary } from './api/projects';
import {
  convertProjectToCnf,
  saveQuery,
  saveTypedKnowledgeBase,
  uploadKnowledgeBase,
  validateKnowledgeBase,
} from './api/knowledgeBase';
import type { KBData } from './types';
import SplashScreen from './components/SplashScreen';
import { ProjectView } from './components/ProjectView';
import { KBChoiceView } from './components/KBChoiceView.tsx';
import { KBInputView } from './components/KBInputView.tsx';
import { TopBar } from './components/TopBar.tsx';

const SPLASH_DURATION_MS =6000;
type Screen = 'projects' | 'kb-choice' | 'kb-input';

export default function App() {
    const [splashFinished, setSplashFinished] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [projects, setProjects] = useState<ProjectSummary[]>([]);

    const showSplash = !splashFinished || (splashFinished && session === null && !error);

    const [screen, setScreen] = useState<Screen>('projects')
    const [method, setMethod] = useState<'upload' | 'type'>('upload');

    const [formulas, setFormulas] = useState<string[]>([]);
    const [goal, setGoal] = useState('');

    const [projectName, setProjectName] = useState<string | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [upload, setUpload] = useState<KBData | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [kbError, setKbError] = useState('');
    
    /**
     * Restore/create the current ResViz session.
     */
    useEffect(() => {
        restoreSession()
          .then((restoredSession) => {
            console.log('Restored session:', restoredSession);
            setSession(restoredSession);
          })
          .catch((err) => {
              console.error('Failed to restore session:', err);
              setError('Could not restore your session');
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
      if (!splashFinished) {return;}

      if (error) {return;}

      if (!session) {return;}

      getProjects()
        .then((loadedProjects) => {
          console.log('Loaded projects:', loadedProjects);
          setProjects(loadedProjects);
          setSplashFinished(true);
      })
        .catch((err) => {
          console.error('Failed to load projects:', err);
          setError('Could not load your projects');
          setSplashFinished(true);
      });
    }, [splashFinished, session, error]);

    /**
     * Call backend to upload KB file
     */
    async function uploadKBFile(file: File) {
      console.log('uploadKBFile called:', {
        fileName: file.name,
        activeProjectId,
      });

      if (!activeProjectId) {
        setKbError("No active project was selected.");
        return;
      }

      setIsUploading(true);
      setKbError('');

      try {
        const result = await uploadKnowledgeBase(activeProjectId, file);
        setFormulas(result.formulas);
        const uploadedGoal = result.goal ?? goal;
        setGoal(uploadedGoal);
        setUpload({
          fileName: file.name,
          formulas: result.formulas,
          goal: uploadedGoal,
        });
      } catch (err) {
        setUpload(null);
        setKbError(
          err instanceof Error
            ? err.message
            : 'Could not upload the knowledge base.'
        );
      } finally {
        setIsUploading(false);
      }
    }

    async function convertKnowledgeBase() {
      if (!activeProjectId) {
        setKbError('No active project was selected.');
        return;
      }

      if (!goal.trim()) {
        setKbError('Enter the query formula you want to prove.');
        return;
      }

      setIsConverting(true);
      setKbError('');

      try {
        const validation = await validateKnowledgeBase([
          ...formulas,
          goal.trim(),
        ]);
        const invalid = validation.results.find((result) => !result.valid);

        if (invalid) {
          throw new Error(
            invalid.error 
              ? `Invalid formula "${invalid.formula}": ${invalid.error}`
              : `Invalid formula: ${invalid.formula}`,
          );
        }

        if (method === 'type') {
          await saveTypedKnowledgeBase(activeProjectId, formulas);
        }

        await saveQuery(activeProjectId, goal.trim());
        const conversion = await convertProjectToCnf(activeProjectId);

        console.log('CNF Conversion completed:', conversion);
        // Will connect conversion.cnf_clauses and conversion steps to the screen later.
      } catch (err) {
        setKbError(
          err instanceof Error
            ? err.message
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
                    ]);
                  }}
                  onContinue={(project) => {
                    console.log('Selected project:', project);

                    setProjectName(project.name);
                    setActiveProjectId(project.id);
                    setUpload(null);
                    setKbError('');

                    /** Demo projects contain formulas and a goal */
                    const projectFormulas = 'formulas' in project && 
                      Array.isArray(project.formulas) ? project.formulas.filter(
                        (formula): formula is string => typeof formula === 'string',
                      )
                      : [];

                    const projectGoal = 'goal' in project && typeof project.goal === 'string'
                      ? project.goal : '';

                    
                    setFormulas(projectFormulas);
                    setGoal(projectGoal);

                    setScreen('kb-choice');
                  }}

                  onProjectImported={(project) => {
                    setProjects((current) => [
                      ...current.filter((item) => item.id !== project.id),
                      project,
                    ]);
                  }}
                />
              )}

              {screen === 'kb-choice' && (
                <KBChoiceView
                  onChoose={(selectedMethod) => {
                    setMethod(selectedMethod);
                    setScreen('kb-input');
                  }}

                  onBack={() => {
                    setScreen('projects');
                  }}
                />
              )}

              {screen === 'kb-input' && (
                <KBInputView
                  method={method}
                  projectName={projectName}
                  formulas={formulas}
                  goal={goal}

                  upload={upload}
                  isUploading={isUploading}
                  isConverting={isConverting}
                  uploadError={kbError}

                  onUpload={uploadKBFile}
                  AddFormula={(formula: string) => {
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

                  GoalChange={(newGoal: string) => {
                    setGoal(newGoal);
                  }}

                  Convert={() => void convertKnowledgeBase()}

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

