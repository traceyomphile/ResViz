import { useEffect, useState } from 'react';
import './SplashScreen.css';

const LOGO_TEXT = 'ResViz';
const TYPE_SPEED_MS = 70;

export default function SplashScreen() {
    const [typedText, setTypedText] = useState('');
    const [showTagline, setShowTagline] = useState(false);

    useEffect(() => {
        let index = 0;

        const typingInterval = setInterval(() => {
            index += 1;
            setTypedText(LOGO_TEXT.slice(0, index));

            if (index === LOGO_TEXT.length) {
                clearInterval(typingInterval);
                setShowTagline(true);
            }
        }, TYPE_SPEED_MS);

        return () => clearInterval(typingInterval);
    }, []);

    return (
        <div className="splash-screen">
            <div className='logic-background' aria-hidden='true'>
                <span className='logic-formula formula-1'>
                    C1: Rain v Sunny
                </span>

                <span className='logic-formula formula-2'>
                    P → Q
                </span>

                <span className='logic-formula formula-3'>
                    ¬P v Q
                </span>

                <span className='logic-formula formula-4'>
                    C7: (¬Sunny v Warm) → Raining
                </span>

                <span className='logic-formula formula-5'>
                    (¬R v Q) ↔ (R → Q)
                </span>

                <span className='logic-formula formula-6'>
                    ResViz
                </span>
            </div>
            <div className="splash-logo">
                {typedText}
                <span className="splash-cursor">|</span>
            </div>

            <div
                className={`splash-tagline ${
                    showTagline ? 'splash-tagline-visible' : ''
                }`}
            >
                Find your resolution, visualise your w0rld!
            </div>
        </div>
    );
}