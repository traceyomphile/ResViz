import { useRef, useState } from "react";
import {
    createProject,
    exportProject,
    importProject,
    getProject,
    ProjectImportConflictError,
} from '../api/projects';
import type { ProjectSummary } from "../api/projects";
import "./ProjectView.css";
import { TopBar } from "./TopBar";

interface DemoProject {
    id: string;
    name: string;
    description: string;
    formulas: string[];
    goal: string;
}
interface ProjectViewProps{
    projects: ProjectSummary[];
    onContinue(project: ProjectSummary): void;
    onProjectCreated(project: ProjectSummary): void;
    onProjectImported?(project: ProjectSummary): void;
} 

const DEMO_PROJECTS: DemoProject[] = [
    {
        id: "demo-a",
        name: "DEMO A",
        description: "Sample project with two formulas",
        formulas: ["(P -> Q)", "P"],
        goal: "Q",
    },
    {
        id: "demo-b",
        name: "DEMO B",
        description: "Sample project with four formulas",
        formulas: ["(M -> A)", "(D -> A)", "(A -> S)", "M"],
        goal: "S",
    },
]

export function ProjectView({
    projects,
    onContinue,
    onProjectCreated,
    onProjectImported,
}: ProjectViewProps){
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [importedProjects, setImportedProjects] = useState<ProjectSummary[]>([]);
    const [isBusy, setIsBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const availableProjects = [...projects];
    importedProjects.forEach((imported) => {
        const index = availableProjects.findIndex((project) => project.id ===
            imported.id);
        if (index >= 0) availableProjects[index] = imported;
        else availableProjects.push(imported);
    });

    const handleOpen = async (id: string) => {
        if (isBusy) return;

        setIsBusy(true);
        setMessage(null);

        try {
            if (id === 'new') {
                const created = await createProject({
                    name: `Project ${availableProjects.length + 1}`,
                    description: 'New ResViz project',
                })
                onProjectCreated(created);
                onContinue(created)
                return;
            }

            const selectedDemoProject = DEMO_PROJECTS.find(
                (project) => project.id == id,
            );

            if (selectedDemoProject) {
                const created = await createProject({
                    name: selectedDemoProject.name,
                    description: selectedDemoProject.description,
                    formulas: selectedDemoProject.formulas,
                    goal: selectedDemoProject.goal,
                });
                onProjectCreated(created);
                onContinue(created);
                return;
            }
            const selectedProject = availableProjects.find(
                (project) => project.id === id,
            );

            if (selectedProject) {
                onContinue(await getProject(selectedProject.id));
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not open project.');
        } finally {
            setIsBusy(false);
        }
    };

    const handleImport = async (file: File) => {
        setIsBusy(true);
        setMessage(null);

        try {
            let imported: ProjectSummary;

            try {
                imported = await importProject(file)
            } catch (error) {
                if (!(error instanceof ProjectImportConflictError)) throw error;

                const overwrite = window.confirm(
                    'A project with this ID already exists. Replace it with the imported project?',
                );
                if (!overwrite) {
                    setMessage('Import cancelled. The existing project was not changed.');
                    return;
                }
                imported = await importProject(file, true);
            }

            setImportedProjects((current) => [
                ...current.filter((project) => project.id !== imported.id),
                imported,
            ]);
            setSelectedProjectId(imported.id);
            setMessage(`Imported ${imported.name} successfully.`);
            onProjectImported?.(imported);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not import project.');
        } finally {
            setIsBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleExport = async () => {
        if (!selectedProjectId) return;
        setIsBusy(true);
        setMessage(null);

        try {
            await exportProject(selectedProjectId);
            setMessage('Project exported successfully.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not export project.');
        } finally {
            setIsBusy(false);
        }
    };

    const canExport = selectedProjectId !== null
        && selectedProjectId !== 'new'
        && !selectedProjectId.startsWith('demo-');

    return (
    <>
        <TopBar
            onImportProject={() => fileInputRef.current?.click()}
            onExportProject={() => void handleExport()}
            canExportProject={canExport}
            projectActionBusy={isBusy}
            projectActionMessage={message}
        />

        <input 
            ref={fileInputRef}
            className="project-file-input"
            type='file'
            accept="application/json,.json"
            onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
            }}
        />
    <main className="project-screen">

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
                    onDoubleClick={() => handleOpen('new')}
                    aria-busy={isBusy && selectedProjectId === 'new'}
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
                        onDoubleClick={() => handleOpen(project.id)}
                        aria-busy={isBusy && selectedProjectId === project.id}
                    >
                        <span>{project.name}</span>
                        
                        <small>{project.description}</small>
                    </button>
                ))}

                {availableProjects.map((project) => (
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
                        onDoubleClick={() => handleOpen(project.id)}
                        aria-busty={isBusy && selectedProjectId === project.id}
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
    </>
    );
}