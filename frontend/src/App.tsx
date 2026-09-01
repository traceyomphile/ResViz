// src/App.tsx
import { useEffect, useState } from 'react';
import './App.css';
import type { Session } from './types/session';
import { restoreSession } from './api/session';
import { getProjects, type ProjectSummary } from './api/projects';
import SplashScreen from './components/SplashScreen';
import { ProjectView } from './components/ProjectView';
import { KBChoiceView } from './components/KBChoiceView.tsx';
import { KBInputView, type SavedKB } from './components/KBInputview.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { KBData } from './types.ts';

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

    const [kbName, setKbName] = useState('');
    const [formulas, setFormulas] = useState<string[]>([]);
    const [goal, setGoal] = useState('');
    const [uploadedKB,setUploadedKB] =useState<KBData | null > (null);
    const [isUploading, setIsUploading] =useState (false);
    const [uploadError, setUploadError] = useState("");

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
     * Temporary upload handler. To call backend uplaod endpoint later
     */
    async function uploadKBFile(file: File) {
      setIsUploading(true);
      setUploadError("");

    try {
        const content = await file.text();
        let uploadedFormulas: string[];

        if (file.name.toLowerCase().endsWith(".json")) {
          const parsed = JSON.parse(content) as unknown;
          let formulaData: unknown;

          if (Array.isArray(parsed)) {
            formulaData = parsed;
          } else if (typeof parsed === "object" && parsed !== null) {
            const object = parsed as Record<string, unknown>;
            formulaData =
              object.formulas ?? object.knowledgeBase ?? object.knowledge_base;
          }

          if (!Array.isArray(formulaData)) {
            throw new Error('The JSON file must contain a "formulas" array.');
          }

          uploadedFormulas = formulaData
            .filter((formula): formula is string => typeof formula === "string")
            .map((formula) => formula.trim())
            .filter(Boolean);
        } else {
          uploadedFormulas = content
            .split(/\r?\n/)
            .map((formula) => formula.trim())
            .filter(Boolean);
        }

        const uploadedData: KBData = {
          fileName: file.name,
          formulas: uploadedFormulas,
          goal,
        };

        setUploadedKB(uploadedData);
        setFormulas(uploadedFormulas);
      } catch (uploadFailure) {
        setUploadedKB(null);
        setFormulas([]);
        setUploadError(
          uploadFailure instanceof Error
            ? uploadFailure.message
            : "The knowledge-base file could not be loaded.",
        );
      } finally {
        setIsUploading(false);
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

              <TopBar onImportProject={() => {}} />
              
              {screen === 'projects' && (
                <ProjectView
                  projects={projects}
                  onNewProject={() => {
                    console.log('New project selected');

                    setProjectName(null);
                    setFormulas([]);
                    setGoal('');
                    setUploadedKB(null);
                    setUploadError("")

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
                  kbName={kbName}
                  formulas={formulas}

                  upload={uploadedKB}
                  isUploading={isUploading}
                  isSaving={false}
                  uploadError={uploadError}

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

                  KBNameChange={(newName: string) => {
                    setKbName(newName);
                  }}

                  SaveKB={(kb: SavedKB) => {
                    console.log('Saved KB:', kb);

                    setKbName(kb.name);
                    setFormulas(kb.formulas);
                    setUploadedKB(kb.upload);

                    setScreen('kb-choice');
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

