//src.components.layout.Sidebar.tsx
import './Sidebar.css';

export type WorkspaceScreen = 
    | 'kb-choice'
    | 'kb-input'
    | 'chf-complete'
    | 'proof-intro'
    | 'resolution';

interface SidebarProps {
    projectName: string | null;
    currentScreen: WorkspaceScreen;
    onBackToProjects(): void;
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

        case 'chf-complete':
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
}: SidebarProps) {
    const currentStage = getStage(currentScreen);

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

                    <h2 className="sidebar-project-name">
                        {projectName || 'Untitled Project'}
                    </h2>
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