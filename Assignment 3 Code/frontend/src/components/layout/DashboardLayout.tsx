import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar.tsx';
import type { WorkspaceScreen } from '../../types/navigation.ts';
import './DashboardLayout.css';

interface DashboardLayoutProps {
    children: ReactNode;
    projectName: string | null;
    currentScreen: WorkspaceScreen;
    onBackToProjects(): void;
    onRenameProject(name: string): void | Promise<void>;
}

export function DashboardLayout({
    children,
    projectName,
    currentScreen,
    onBackToProjects,
    onRenameProject,
}: DashboardLayoutProps) {
    return (
        <div className="dashboard-layout">
            <Sidebar
                projectName={projectName}
                currentScreen={currentScreen}
                onBackToProjects={onBackToProjects}
                onRenameProject={onRenameProject}
            />

            <main className="dashboard-main">
                <div className="dashboard-main-content">
                    {children}
                </div>
            </main>
        </div>
    );
}