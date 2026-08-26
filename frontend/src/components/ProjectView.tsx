// @ts-expect-error CSS is handled by the bundler and has no TypeScript declarations.
import "./ProjectView.css";

interface ProjectViewProps{
    onContinue(project: {
        id: string;
        name: string;
        description: string;
        formulas: string[];
        goal: string;
    }): void;
}

const DEMO_PROJECTS: {
    id: string;
    name: string;
    description: string;
    formulas: string[];
    goal: string;
}[] = [
    {
    id: "new",
    name: "+ NEW WORKSPACE",
    description: "Start with an empty knowledge base",
    formulas: [],
    goal: "",
  },
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
];  

export function ProjectView({onContinue}: ProjectViewProps){
 return (
    <main className="screen project-screen">
        <section className="content-shell content-shell--wide">
            <header className="page-heading">
                <h1> PROJECT</h1>
                <p> Create a new workspace or open an existing project.</p>
            </header>

            <div className="project-grid" role="list" aria-label="Projects">   
                {DEMO_PROJECTS.map((project)=>(
                    <button
                     className="project-card"
                    key={project.id}
                    type="button"
                    onClick={()=>onContinue(project)}
                    role="listitem"
                 >
                    <span>{project.name}</span>
                    <small>{project.description}</small>
                </button>
                ))}
            </div>
        </section>
    </main>
 )
}