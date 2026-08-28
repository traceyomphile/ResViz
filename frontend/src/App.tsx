// src/App.tsx

import { useEffect, useState } from 'react';
import './App.css';

import { restoreSession } from './api/session';
import { SplashView } from './components/SplashView';
import { ProjectView } from './components/ProjectView';

type Screen = 'splash' | 'projects';

export default function App() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [screen, setScreen] = useState<Screen>('splash');

    useEffect(() => {
        restoreSession()
            .catch((err) => {
                console.error('Failed to restore session:', err);
                setError('Could not restore your session');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <SplashView onComplete={() => {}} />;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <>
            {screen === 'splash' && (
                <SplashView
                    onComplete={() => {
                        setScreen('projects');
                    }}
                />
            )}

            {screen === 'projects' && (
                <ProjectView
                    onContinue={(project) => {
                        console.log('Selected project:', project);
                    }}
                />
            )}
        </>
    );
}