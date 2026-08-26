// src/App.tsx

import {useEffect, useState} from 'react';
import {restoreSession} from './api/session';
import type {Session} from './types/session';

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        restoreSession()
            .then(setSession)
            .catch(() => setError('Could not restore your session'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div>loading...</div>;
    if (error) return <div>{error}</div>;

    return <div>Welcome - active project: {session?.active_project_id ?? "none"}</div>;
}
