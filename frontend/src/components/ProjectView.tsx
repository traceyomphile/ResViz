import { useState } from "react";
import type { ProjectSummary } from "../api/projects";
import { useTheme } from "../context/ThemeContext";
import "./ProjectView.css";

interface DemoProject {
    id: string;
    name: string;
    description: string;
    formulas: string[];
    goal: string;
}

type SelectableProject = ProjectSummary | DemoProject;
interface ProjectViewProps{
    projects: ProjectSummary[];
    onContinue(project: SelectableProject): void;
    onNewProject(): void;
} 

const DEMO_PROJECTS: DemoProject[] = [
    {
        id: "demo-a",
        name: "DEMO A",
        description: "Sample project with two formulas",
        formulas: ["P -> Q", "P"],
        goal: "Q",
    },
    {
        id: "demo-b",
        name: "DEMO B",
        description: "Sample project with four formulas",
        formulas: ["M -> A", "D -> A", "A -> S", "M"],
        goal: "S",
    },
]

export function ProjectView({
    projects,
    onContinue,
    onNewProject,
}: ProjectViewProps){
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const { theme, toggleTheme } = useTheme();

    const handleOPen = (id: string) => {
        if (id === 'new') {
            onNewProject();
            return;
        }

        const selectedDemoProject = DEMO_PROJECTS.find(
            (project) => project.id == id,
        );

        if (selectedDemoProject) {
            onContinue(selectedDemoProject);
            return;
        }

        const selectedProject = projects.find(
            (project) => project.id === id,
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
                    onClick={toggleTheme}
                >
                    {theme == 'dark' ? '🔆':'🌙'}
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
                    onDoubleClick={() => handleOPen('new')}
                >
                    <span>+ NEW PROJECT</span>

                    <small>
                        Start with an empty knowledge base
                    </small>
                </button>

                {DEMO_PROJECTS.map((project) => (
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
                        onDoubleClick={() => handleOPen(project.id)}
                    >
                        <span>{project.name}</span>
                        
                        <small>{project.description}</small>
                    </button>
                ))}

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
                        onDoubleClick={() => handleOPen(project.id)}
                    >
                        <span>{project.name}</span>

                        {project.description && (
                            <small>{project.description}</small>
                        )}
                    </button>
                ))}
            </div>
        </section>
    </main>
    );
}