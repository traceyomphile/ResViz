// src/App.tsx

import { useEffect, useState } from 'react';
import './App.css';
import type { Session } from './types/session';
import { restoreSession } from './api/session';
import { getProjects, type ProjectSummary } from './api/projects';
import SplashScreen from './components/SplashScreen';
import { ProjectView } from './components/ProjectView';

const SPLASH_DURATION_MS =6400;

export default function App() {
    const [showSplash, setShowSplash] = useState(true);
    const [splashFinished, setSplashFinished] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [projects, setProjects] = useState<ProjectSummary[]>([]);

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

    useEffect(() => {
      const timer = setTimeout(() => setSplashFinished(true), SPLASH_DURATION_MS);
      return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
      if (!splashFinished) {return;}

      if (error) {
        setShowSplash(false); 
        return;
      }

      if (!session) {return;}

      getProjects()
        .then((loadedProjects) => {
          console.log('Loaded projects:', loadedProjects);
          setProjects(loadedProjects);
          setShowSplash(false);
      })
        .catch((err) => {
          console.error('Failed to load projects:', err);
          setError('Could not load your projects');
          setShowSplash(false);
      });
    }, [splashFinished, session, error]);

    return (
      <>
        {showSplash ? (
          <SplashScreen />
        ) : error ? (
          <div>{error}</div>
        ) : session ? (
          <ProjectView
            projects={projects}
            onNewProject={() => {
              console.log('New project selected');
            }}
            onContinue={(project) => {
              console.log('Selected project:', project);
            }}
          />
        ) : (
            <div>NO SESSION FOUND</div>
        )}
      </>
    );
}
