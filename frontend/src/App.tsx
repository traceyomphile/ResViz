import { useState } from 'react'
import './App.css'
import { SplashView } from './components/SplashView.tsx'

function App() {
  return (
    <SplashView onComplete={() => {
        console.log("Splash screen complete");
    }} />
  )
}

export default App
