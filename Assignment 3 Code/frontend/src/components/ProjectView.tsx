import { useRef, useState } from "react";
import {
    createProject,
    deleteProject,
    exportProject,
    importProject,
    getProject,
    ProjectImportConflictError,
} from '../api/projects';
import type { ProjectSummary } from "../api/projects";
import {DeleteProjectDialog} from './DeleteProjectDialog';
import {getSessionId} from '../api/session';
import {Icon} from "./Icons";


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

function recordProjectUse(projectId: string, current: ProjectRecency): ProjectRecency {
    const updated = {...current, [projectId]: Date.now()};
    saveProjectRecency(updated);
    return updated;
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
    onProjectDeleted(projectId: string): void;
    onContinue(project: ProjectSummary): void;
    onProjectCreated(project: ProjectSummary): void;
    onProjectImported?(project: ProjectSummary): void;
}

const DEMO_PROJECTS: DemoProject[] = [
    {
        id: "demo-a",
        name: "Demo A",
        description: "Sample project with two formulas",
        formulas: ["(P -> Q)", "P"],
        goal: "Q",
    },
    {
        id: "demo-b",
        name: "Demo B",
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
    onProjectDeleted,
}: ProjectViewProps){
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [importedProjects, setImportedProjects] = useState<ProjectSummary[]>([]);
    const [projectRecency, setProjectRecency] = useState<ProjectRecency>(loadProjectRecency);
    const hiddenSamplesKey = `resviz_hidden_samples_${getSessionId()}`;
    const [hiddenSamples, setHiddenSamples] = useState<string[]>(() => {
        try {const value: unknown = JSON.parse(sessionStorage.getItem(hiddenSamplesKey) ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];} catch {return [];}
    });
    const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
    const [deleteError, setDeleteError] = useState('');
    const [menuId, setMenuId] = useState<string | null>(null);
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
                && project.name.toLowerCase() === demo.name.toLowerCase()
                && project.description === demo.description,
        );

    const savedProjects = allSavedProjects.filter(
        (project) =>
            !DEMO_PROJECTS.some((demo) => demo.id === project.id)
            && !isLegacyDemoCopy(project),
    );

    const displayProjects: ProjectSummary[] = [
        ...DEMO_PROJECTS.filter(demo => !hiddenSamples.includes(demo.id) || allSavedProjects.some(project => project.id === demo.id)).map(demo => allSavedProjects.find(project => project.id === demo.id) ?? demo),
        ...savedProjects,
    ];

    displayProjects.sort(
        (first, second) =>
        (projectRecency[second.id] ?? 0)
        - (projectRecency[first.id] ?? 0),
    );

    const markProjectAsUsed = (projectId: string) => {
        const updated = recordProjectUse(projectId, projectRecency);
        setProjectRecency(updated);
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
                onContinue(openedProject);
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

    const handleDelete = async () => {
        if (!deleteTarget || isBusy) return;
        const target = deleteTarget;
        setIsBusy(true); setDeleteError('');
        try {
            if (allSavedProjects.some(item => item.id === target.id)) await deleteProject(target.id);
            if (DEMO_PROJECTS.some(item => item.id === target.id)) {
                const hidden = [...new Set([...hiddenSamples, target.id])];
                setHiddenSamples(hidden);
                try {sessionStorage.setItem(hiddenSamplesKey, JSON.stringify(hidden));} catch { /* Removal still works when storage is unavailable. */ }
            }
            setImportedProjects(current => current.filter(item => item.id !== target.id));
            const recency = {...projectRecency}; delete recency[target.id];
            setProjectRecency(recency); saveProjectRecency(recency);
            if (selectedProjectId === target.id) setSelectedProjectId(null);
            onProjectDeleted(target.id); setDeleteTarget(null);
            setMessage(`Deleted ${target.name}.`);
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Could not delete project.');
        } finally {setIsBusy(false);}
    };

    const handleExport = async (projectId: string) => {
        if (!projectId) return;
        setIsBusy(true);
        setMessage(null);

        try {
            await exportProject(projectId);
            setMessage('Project exported successfully.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not export project.');
        } finally {
            setIsBusy(false);
        }
    };


    return <main className="project-screen">
      <input ref={fileInputRef} className="project-file-input" type="file" accept="application/json,.json" onChange={event => {const file = event.target.files?.[0]; if (file) void handleImport(file);}} />
      <header className="project-page-heading"><div><h1>Projects</h1><p className="page-subtitle">Create a workspace or continue your reasoning.</p></div><div className="project-header-actions"><button className="button primary" disabled={isBusy} onClick={() => void handleOpen('new')}><Icon name="plus" size={25} />New project</button><button className="text-button project-import" disabled={isBusy} onClick={() => fileInputRef.current?.click()}><Icon name="upload" size={13} />Import project</button></div></header>
      <h2 className="recent-heading">Recent projects</h2>
      <div className="project-grid" aria-label="Projects">{displayProjects.map(item => {
        const demo = item.id.startsWith('demo-');
        const knowledgeBases = item.knowledgeBases ?? [];
        // The project-level formulas mirror the active KB, so don't add them twice.
        const formulaCount = knowledgeBases.length
          ? knowledgeBases.reduce((total, kb) => total + kb.formulas.length, 0)
          : item.formulas?.length ?? 0;
        // Samples and older projects store their single KB at project level.
        const knowledgeBaseCount = knowledgeBases.length || (formulaCount > 0 ? 1 : 0);
        const used = projectRecency[item.id];
        const date = used ? new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'}).format(used) : demo ? 'Ready to explore' : 'Not opened yet';
        return <article key={item.id} className={`project-card ${selectedProjectId === item.id ? 'project-card--selected' : ''}`}>
          <div className="project-card-menu"><button aria-label={`Options for ${item.name}`} aria-expanded={menuId === item.id} onClick={() => setMenuId(menuId === item.id ? null : item.id)}>•••</button>{menuId === item.id && <div className="card-menu"><button disabled={isBusy} onClick={() => {setMenuId(null); void handleOpen(item.id);}}><Icon name="folder" size={16} />Open project</button><button disabled={isBusy || !allSavedProjects.some(p => p.id === item.id)} onClick={() => {setMenuId(null); void handleExport(item.id);}}><Icon name="download" size={16} />Export project</button><button className="delete-project-option" disabled={isBusy} onClick={() => {setMenuId(null); setDeleteError(''); setDeleteTarget(item);}}><Icon name="trash" size={16} />Delete project</button></div>}</div>
          <div className="project-card-header"><span className={`project-card-icon ${!demo ? 'project-card-icon--cnf' : item.id === 'demo-b' ? 'project-card-icon--formula' : ''}`}>{!demo ? <><Icon name="file" size={51} /><b>CNF</b></> : item.id === 'demo-b' ? <span>(p ∨ q)<br />¬r</span> : <Icon name="tree" size={45} />}</span><div><h3>{item.name}</h3><span className={`badge ${demo ? 'sample' : 'progress'}`}>{demo ? 'Sample' : 'In progress'}</span></div></div>
          <p className="project-formula-count"><span>{formulaCount} {formulaCount === 1 ? 'formula' : 'formulas'}</span><span aria-hidden="true">·</span><span>{knowledgeBaseCount} {knowledgeBaseCount === 1 ? 'knowledge base' : 'knowledge bases'}</span></p>
          <footer className="project-card-footer"><div className="project-last-opened"><Icon name="clock" size={21} /><div><span>{used ? 'Last opened' : demo ? 'Sample project' : 'Last opened'}</span><span>{date}</span></div></div><button className="button primary" disabled={isBusy} onClick={() => {setSelectedProjectId(item.id); void handleOpen(item.id);}}>{isBusy && selectedProjectId === item.id ? 'Opening…' : 'Open'}</button></footer>
        </article>;
      })}</div>{message && <p className="project-message" role="status">{message}</p>}
      {deleteTarget && <DeleteProjectDialog name={deleteTarget.name} saved={allSavedProjects.some(item => item.id === deleteTarget.id)} busy={isBusy} error={deleteError} onClose={() => {if (!isBusy) setDeleteTarget(null);}} onDelete={handleDelete} />}
    </main>;
}
