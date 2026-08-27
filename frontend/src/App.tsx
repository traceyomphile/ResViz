// src/App.tsx

import {useEffect, useState} from 'react';
import {restoreSession} from './api/session';
import SplashScreen from './components/SplashScreen';

export default function App() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        restoreSession()
            .then(() => {})
            .catch((err) => {
                alert('CAUGHT:' + String( err));
                setError('Could not restore your session');
                })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <SplashScreen />;
    if (error) return <div>{error}</div>;

    return <SplashScreen />;
}
