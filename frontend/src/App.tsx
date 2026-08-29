// src/App.tsx
import { useEffect, useState } from 'react';
import './App.css';
import type { Session } from './types/session';
import { restoreSession } from './api/session';
import { getProjects, type ProjectSummary } from './api/projects';
import SplashScreen from './components/SplashScreen';
import { ProjectView } from './components/ProjectView';
import { KBChoiceView } from './components/KBChoiceView.tsx';
import { KBInputView } from './components/KBInputView.tsx';

const SPLASH_DURATION_MS =6400;

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

      if (error) {
        setSplashFinished(true);
        return;
      }

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
     * Temporary upload handler. To call backend uplaod endpoint later
     */
    async function uploadKBFile(file: File) {
      console.log('Selected KB file:', file);
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
              {screen === 'projects' && (
                <ProjectView
                  projects={projects}
                  onNewProject={() => {
                    console.log('New project selected');

                    setProjectName(null);
                    setFormulas([]);
                    setGoal('');

                    setScreen('kb-choice');
                  }}

                  onContinue={(project) => {
                    console.log('Selected project:', project);

                    setProjectName(project.name);

                    /**
                     * Demo projects contain formuals and a goal
                     */
                    const projectFormulas = 'formulas' in project &&
                      Array.isArray(project.formulas) ? project.formulas.filter(
                        (formula): formula is string => typeof formula === 'string',
                      )
                      : [];

                    const projectGoal = 'goal' in project && 
                      typeof project.goal === 'string' ? project.goal : '';

                    setFormulas(projectFormulas);
                    setGoal(projectGoal);

                    setScreen('kb-choice');
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

                  upload={null}
                  isUploading={false}
                  isConverting={false}
                  uploadError=''

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

                  Convert={() => {
                    console.log('Convert clicked');
                  }}

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

