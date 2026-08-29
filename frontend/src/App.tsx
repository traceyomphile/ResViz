import { useState } from 'react'
import './App.css'
import { SplashView } from './components/SplashView.tsx'
import {ProjectView} from  './components/ProjectView.tsx'
import { KBChoiceView } from './components/KBChoiceView.tsx'
import { KBInputView } from './components/KBInputView.tsx'



function App() {
  const [screen, setScreen]= useState("splash");
  const [method, setMethod]= useState<"upload" | "type">("upload");
  const [formulas, setFormulas]=useState<string[]>([]);
  const [goal,setGoal] =useState("");
  const [projectName,setProjectName]= useState<string | null>(null);

  /*this is for testing for file selected, since i cannot use the uppload function on my component as i have not connected it to backend */
  async function uploadKB(file:File) {
    console.log("Selected file:",file);
  }

  return (
    <>
    {screen==="splash" &&(
      <SplashView
      onComplete={() =>{
        setScreen("projects");
      }}
     />
    )}
    
    {screen=== "projects" &&(
      <ProjectView
      onContinue= {(project)=>{
        console.log("Selected project:", project);
        setScreen("kb-choice");
      }}
      />
    )}

    {screen === "kb-choice" &&(
      <KBChoiceView
      onChoose={(method)=>{
        setMethod(method);
        setScreen("kb-input");
      }}
      onBack={()=>{
        setScreen("projects");
      }}
      />
    )}

    {screen === "kb-input" && (
      <KBInputView
        method={method}
        projectName={projectName}
        formulas={formulas}
        goal={goal}
        upload={null}
        isUploading={false}
        isConverting={false}
        uploadError=""

        onUpload={uploadKB}

        AddFormula={(formula: string)=> {
          setFormulas((current) => [...current, formula]);
        }}
        RemoveFormula= {(index: number) => {
          setFormulas((current) =>
            current.filter(
              (_,currentIndex) => currentIndex !== index
            )
          );
        }}
        GoalChange={(newGoal: string) => {
          setGoal(newGoal);
        }}

        convert ={() =>{
          console.log("Convert clicked")
        }}

        onBack={() =>{
          setScreen("kb-choice");
        }}

        />
    )}
    </>
  )
}

export default App
