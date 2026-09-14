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

const PROJECT_RECENCY_STORAGE_KEY = 'resviz_project_last_used';
type ProjectRecency = Record<string, number>;

function loadProjectRecency(): ProjectRecency {
    try {
        const stored = localStorage.getItem(PROJECT_RECENCY_STORAGE_KEY);
        if (!stored) return {};

        const parsed: unknown = JSON.parse(stored);
        if (!parsed || typeof parsed != 'object' || Array.isArray(parsed)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(parsed).filter(
                (entry): entry is [string, number] => 
                    typeof entry[1] === 'number' && Number.isFinite(entry[1]),
            ),
        );
    } catch {
        return {};
    }
}

function saveProjectRecency(recency: ProjectRecency): void {
    try {
        localStorage.setItem(
            PROJECT_RECENCY_STORAGE_KEY,
            JSON.stringify(recency),
        );
    } catch {
        // Project opening must still work if browser storage is unavailable
    }
}

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
    const [projectRecency, setProjectRecency] = useState<ProjectRecency>(loadProjectRecency);
    const [isBusy, setIsBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const allSavedProjects = [...projects];
    importedProjects.forEach((imported) => {
        const index = allSavedProjects.findIndex((project) => project.id ===
            imported.id);
        if (index >= 0) allSavedProjects[index] = imported;
        else allSavedProjects.push(imported);
    });

    const isLegacyDemoCopy = (project: ProjectSummary) => 
        DEMO_PROJECTS.some(
            (demo) => 
                project.id !== demo.id
                && project.name === demo.name 
                && project.description === demo.description,
        );

    const savedProjects = allSavedProjects.filter(
        (project) => 
            !DEMO_PROJECTS.some((demo) => demo.id === project.id)
            && !isLegacyDemoCopy(project),
    );

    const displayProjects: ProjectSummary[] = [
        ...DEMO_PROJECTS,
        ...savedProjects,
    ];

    displayProjects.sort(
        (first, second) =>
        (projectRecency[second.id] ?? 0)
        - (projectRecency[first.id] ?? 0),
    );

    const markProjectAsUsed = (projectId: string) => {
        setProjectRecency((current) => {
            const updated = {
                ...current,
                [projectId]: Date.now(),
            };

            saveProjectRecency(updated);
            return updated;
        });
    };

    const handleOpen = async (id: string) => {
        if (isBusy) return;

        setIsBusy(true);
        setMessage(null);

        try {
            if (id === 'new') {
                const created = await createProject({
                    name: `Project ${savedProjects.length + 1}`,
                    description: 'New ResViz project',
                })
                markProjectAsUsed(created.id);
                onProjectCreated(created);
                onContinue(created)
                return;
            }

            const selectedDemoProject = DEMO_PROJECTS.find(
                (project) => project.id == id,
            );

            if (selectedDemoProject) {
                const savedDemoProject = allSavedProjects.find(
                    (project) => project.id === selectedDemoProject.id,
                );

                if (savedDemoProject) {
                    const openedProject = await getProject(savedDemoProject.id);
                    markProjectAsUsed(selectedDemoProject.id);
                    onContinue(openedProject);
                    return;
                }
                const created = await createProject({
                    id: selectedDemoProject.id,
                    name: selectedDemoProject.name,
                    description: selectedDemoProject.description,
                    formulas: selectedDemoProject.formulas,
                    goal: selectedDemoProject.goal,
                });
                markProjectAsUsed(created.id);
                onProjectCreated(created);
                onContinue(created);
                return;
            }
            const selectedProject = savedProjects.find(
                (project) => project.id === id,
            );

            if (selectedProject) {
                const openedProject = await getProject(selectedProject.id);
                markProjectAsUsed(openedProject.id);
                onContinue({
                    ...openedProject,
                    name: selectedProject.name,
                });
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
            markProjectAsUsed(imported.id);
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

                {displayProjects.map((project) => (
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
                        
                        {project.description && (
                            <small>{project.description}</small>
                        )}
                    </button>
                ))}
            </div>

            <div className="project-actions">
                <p className="project-selection-hint">
                    {selectedProjectId
                        ? 'Ready when you are - open the selected workspace to continue.'
                        : 'Select a workspace to begin.'}
                </p>
                <button
                    className="nav-button project-continue"
                    type="button"
                    disabled={!selectedProjectId || isBusy}
                    onClick={() => selectedProjectId && void handleOpen(selectedProjectId)}
                >
                    {isBusy ? 'Opening workspace...' : 'Open workspace'}
                </button>
            </div>

        </section>
    </main>
    </>
    );
}
