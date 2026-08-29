// src/App.tsx

import { useEffect, useState } from 'react';
import './App.css';
import type { Session } from './types/session';
import { restoreSession } from './api/session';
import SplashScreen from './components/SplashScreen';
import { ProjectView } from './components/ProjectView';

const SPLASH_DURATION_MS =6400;

export default function App() {
    const [showSplash, setShowSplash] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<Session | null>(null);

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
      const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
      return () => clearTimeout(timer);
    }, []);

    return (
      <>
        {showSplash ? (
          <SplashScreen />
        ) : error ? (
          <div>{error}</div>
        ) : session ? (
          <ProjectView
            onContinue={(project) => {
              console.log('Selected project', project);
            }}
          />
        ) : (
            <div>NO SESSION FOUND</div>
        )}
      </>
    );
}