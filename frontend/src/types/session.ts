// types.ts 

// Define a session object using interface
export interface Session {
    session_id: string;
    active_project_id: string | null;
    project_ids: string[];
    created_at: string;
}