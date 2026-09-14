//src.components.layout.Sidebar.tsx
import { useState } from 'react';
import type { WorkspaceScreen } from '../../types/navigation';
import './Sidebar.css';

interface SidebarProps {
    projectName: string | null;
    currentScreen: WorkspaceScreen;
    onBackToProjects(): void;
    onRenameProject(name: string): void | Promise<void>;
}

interface SidebarStepProps {
    number: number;
    title: string;
    description: string;
    state: 'complete' | 'active' | 'upcoming'
}

function SidebarStep({
    number,
    title,
    description,
    state,
}: SidebarStepProps) {
    return (
        <div className={`sidebar-step sidebar-step--${state}`}>
            <div className="sidebar-step-marker">
                {state === 'complete' ? '✓' : number}
            </div>

            <div className="sidebar-step-content">
                <span className="sidebar-step-title">
                    {title}
                </span>

                <span className="sidebar-step-description">
                    {description}
                </span>
            </div>
        </div>
    );
}

function getStage(screen: WorkspaceScreen): number {
    switch (screen) {
        case 'kb-choice':
        case 'kb-input':
            return 1;

        case 'cnf-complete':
            return 2;

        case 'proof-intro':
        case 'resolution':
            return 3;

        default:
            return 1;
    }
}

export function Sidebar({
    projectName,
    currentScreen,
    onBackToProjects,
    onRenameProject,
}: SidebarProps) {
    const currentStage = getStage(currentScreen);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(() => projectName ?? '');

    function saveProjectName() {
        const trimmedName = editedName.trim();

        if (!trimmedName) {
            setEditedName(projectName ?? '');
            setIsEditingName(false);
            return;
        }

        void onRenameProject(trimmedName);
        setEditedName(trimmedName);
        setIsEditingName(false);
    }

    function cancelProjectNameEdit() {
        setEditedName(projectName ?? '');
        setIsEditingName(false);
    }

    function getStepState(step: number): 'complete' | 'active' | 'upcoming' {
        if (step < currentStage) {
            return 'complete';
        }

        if (step === currentStage) {
            return 'active';
        }

        return 'upcoming';
    }

    return (
        <aside className="dashboard-sidebar">
            <div className="sidebar-content">

                <section className="sidebar-project">
                    <span className="sidebar-section-label">
                        CURRENT PROJECT
                    </span>

                    {isEditingName ? (
                        <div className="sidebar-project-edit">
                            <input
                                className="sidebar-project-input"
                                type="text"
                                value={editedName}
                                autoFocus
                                maxLength={80}
                                onChange={(event) => setEditedName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        saveProjectName();
                                    }
                                    if (event.key === 'Escape') {
                                        cancelProjectNameEdit();
                                    }
                                }}
                            />

                            <button
                                type="button"
                                className="sidebar-project-action sidebar-project-save"
                                onClick={saveProjectName}
                                aria-label="Save project name"
                                title="Save"
                            >
                                ✓
                            </button>

                            <button
                                type="button"
                                className="sidebar-project-action"
                                onClick={cancelProjectNameEdit}
                                aria-label="Cancel editing project name"
                                title="Cancel"
                            >
                                ×
                            </button>
                        </div>
                    ): (
                        <div className="sidebar-project-title-row">
                            <h2 className="sidebar-project-name">
                                {projectName || 'Untitled Project'}
                            </h2>

                            <button
                                type="button"
                                className='sidebar-project-edit-button'
                                onClick={() => setIsEditingName(true)}
                                aria-label='Edit project name'
                                title="Edit project name"
                            >
                                <svg
                                    viewBox='0 0 24 24'
                                    width='18'
                                    height='18'
                                    aria-hidden='true'
                                    fill="currentColor"
                                >
                                    <path 
                                        d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'
                                    />
                                </svg>
                            </button>
                        </div>
                    )}
                    
                </section>

                <div className="sidebar-divider" />

                <section className="sidebar-workflow">
                    <span className="sidebar-section-label">
                        REASONING PIPELINE
                    </span>

                    <div className="sidebar-steps">
                        <SidebarStep
                            number={1}
                            title="Knowledge Base"
                            description="Build or select your KB"
                            state={getStepState(1)}
                        />

                        <SidebarStep
                            number={2}
                            title="CNF Conversion"
                            description="Convert formulas to clauses"
                            state={getStepState(2)}
                        />

                        <SidebarStep
                            number={3}
                            title="Resolution"
                            description="Trace the proof"
                            state={getStepState(3)}
                        />
                    </div>
                </section>

                <div className="sidebar-spacer" />

                <button
                    className="sidebar-back-button"
                    type="button"
                    onClick={onBackToProjects}
                >
                    <span
                        className="sidebar-back-icon"
                        aria-hidden="true"
                    >
                        ←
                    </span>

                    Back to Projects
                </button>

            </div>
        </aside>
    );
}