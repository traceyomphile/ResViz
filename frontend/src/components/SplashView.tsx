import {useEffect, useState} from 'react';
// CSS is processed by the bundler and has no TypeScript module declaration.
// @ts-ignore
import './SplashView.css';

interface SplashViewProps{
    onComplete():void;
}

const TITLE="ResViz";
const WELCOME_DURATION=5000;

export function SplashView({onComplete}:SplashViewProps){
    const [typedTitle,setTypedTitle]=useState("");
    const [showTagline, setShowTagline]=useState(false);

    useEffect(()=>{
        const timers: number[]=[];

        function runWelcomeSequence(){
            TITLE.split("").forEach((_, index)=>{
                timers.push(window.setTimeout(()=> setTypedTitle(TITLE.slice(0,index+1)), (index+1)*120),);  
            });
            timers.push(window.setTimeout(()=> setShowTagline(true), 1000));
            timers.push(window.setTimeout(()=> onComplete(), WELCOME_DURATION)); //final timer
    }

    runWelcomeSequence();
    return ()=> timers. forEach((timer)=> window.clearTimeout(timer));

}, [onComplete]);

return(
    <main className="screen screen--center splash-screen" aria-live="polite">
        <div className="title welcome-title" aria-label="ResViz">
            {typedTitle}
            <span className="typing-cursor" aria-hidden="true">|</span>
        </div>
        <p className={`tagline welcome-tagline ${showTagline ? "welcome-tagline--visible" : ""}`} >
            Find your resolution, visualize your world.
        </p>
    </main>
);

}