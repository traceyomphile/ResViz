import { useState } from "react";
import type { ProjectSummary } from "../api/projects";
import "./ProjectView.css";

interface ProjectViewProps{
    projects: ProjectSummary[];
    onContinue(project: ProjectSummary): void;
    onNewProject(): void;
} 

export function ProjectView({
    projects,
    onContinue,
    onNewProject,
}: ProjectViewProps){
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const handleNext = () => {
        if (!selectedProjectId) {return;}

        if (selectedProjectId === 'new') {
            onNewProject();
            return;
        }

        const selectedProject = projects.find(
            (project) => project.id === selectedProjectId,
        );

        if (selectedProject) {
            onContinue(selectedProject);
        }
    };

    return (
    <main className="screen project-screen">
        <nav className='top-bar'>
            <span className="top-bar-logo">ResViz</span>

            <div className='top-bar-actions'>
                <button
                    className='theme-toggle'
                    type='button'
                    aria-label="Toggle light/dark mode"
                    onClick={() => {
                        // theme switching logic to go here later.
                    }}
                >
                    🔆
                </button>

                <button
                    className="menu-toggle"
                    type='button'
                    aria-label='Open Menu'
                    onClick={() => {
                        // menu logic to go here later.
                    }}
                >
                    ⁞
                </button>
            </div>
            
        </nav>

        <section className="content-shell content-shell--wide">
            <header className="page-heading">
                <h1> PROJECT</h1>
                <p> Create a new workspace or open an existing project.</p>
            </header>

            <div className="project-grid" role="list" aria-label="Projects">   
                <button
                    type='button'
                    role='listitem'
                    className={`project-card ${
                        selectedProjectId === 'new'
                            ? 'project-card--selected'
                            : ''
                    }`}
                    onClick={() => setSelectedProjectId('new')}
                >
                    <span>+ NEW PROJECT</span>

                    <small>
                        Start with an empty knowledge base
                    </small>
                </button>

                {projects.map((project) => (
                    <button
                        key={project.id}
                        type='button'
                        role='listitem'
                        className={`project-card ${
                            selectedProjectId === project.id
                                ? 'project-card--selected'
                                : ''
                        }`}
                        onClick={() => setSelectedProjectId(project.id)}
                    >
                        <span>{project.name}</span>

                        {project.description && (
                            <small>{project.description}</small>
                        )}
                    </button>
                ))}
            </div>

            <div className="project-actions">
                <button
                    type='button'
                    className='project-next-button'
                    disabled={!selectedProjectId}
                    onClick={handleNext}
                >
                    Next
                </button>
            </div>
        </section>
    </main>
    );
}