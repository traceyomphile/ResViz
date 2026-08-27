import { useState } from 'react'
import './App.css'
import { SplashView } from './components/SplashView.tsx'
import {ProjectView} from  './components/ProjectView.tsx'


function App() {
  const[screen, setScreen]=useState('splash');
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
        console.log("Selected project:", project)
      }}
      />
    )}
    </>
  )
}

export default App
