import { useEffect, useState } from 'react';
import './SplashScreen.css';

const LOGO_TEXT = 'ResViz';
const TYPE_SPEED_MS = 80;
const TAGLINE_HOLD_MS = 1100;

export default function SplashScreen() {
    const [typedText, setTypedText] = useState('');
    const [showTagline, setShowTagline] = useState(false);
    const [showDiagram, setShowDiagram] = useState(false);

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

    useEffect(() => {
        if (!showTagline) {return;}

        const timeout = setTimeout(() => {
            setShowDiagram(true);
        }, TAGLINE_HOLD_MS);

        return () => clearTimeout(timeout);
    }, [showTagline]);

    return (
        <div className="splash-screen">
            <div className={`splash-diagram ${showDiagram ? 'diagram-visible' : ''}`}>
                <svg
                    className='diagram-lines'
                    viewBox='0 0 100 100'
                    preserveAspectRatio='none'
                    aria-hidden='true'
                >
                    {/* core arc over the logo */}
                    <path
                        pathLength={1}
                        className="draw-path draw-1 line-cyan"
                        d="M21,21 Q50,6 79,21"
                    />
                    <path
                        pathLength={1}
                        className="draw-path draw-2 line-cyan"
                        d="M21,21 C10,28 4,40 4,50"
                    />
                    <path
                        pathLength={1}
                        className="draw-path draw-2 line-magenta"
                        d="M79,21 C90,28 96,40 96,50"
                    />

                    <circle className="dot dot-cyan dot-appear" cx="4" cy="50" r="0.9" />
                    <circle className="dot dot-magenta dot-appear" cx="96" cy="50" r="0.9" />

                    <g className="diagram-extras">
                        <path
                            pathLength={1}
                            className="dot-line dot-line-4 line-dotted line-cyan"
                            d="M4,50 Q6,58 12,58"
                        />
                        <path
                            pathLength={1}
                            className="dot-line dot-line-4 line-dotted line-magenta"
                            d="M96,50 Q94,58 90,58"
                        />
                        <path
                            pathLength={1}
                            className="dot-line dot-line-5 line-dotted line-cyan"
                            d="M18,68 Q26,66 30,62"
                        />

                        <path pathLength={1} className="draw-path draw-5 line-cyan" d="M36,64 Q45,66 51,66" />
                        <path pathLength={1} className="draw-path draw-5 line-magenta" d="M70,64 Q60,66 55,66" />
                        <path pathLength={1} className="draw-path draw-6 line-cyan" d="M53,70 L53,74" />
                        <path pathLength={1} className="dot-line dot-line-6 line-dotted line-magenta" d="M53,80 L53,85" />
                    </g>
                </svg>

                <div className="conn-circle conn-and fade-3">∧</div>
                <div className="conn-circle conn-or fade-3">∨</div>

                <div className="formula-line formula-line-1 fade-4">¬P ⇒ Q</div>
                <div className="formula-line formula-line-2 fade-4">P ∨ Q</div>

                <div className="splash-core">
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

                <div className="diagram-extras">
                    <table className="truth-table fade-5" aria-hidden="true">
                        <thead>
                            <tr>
                                <th>P</th>
                                <th>Q</th>
                                <th>P⇒Q</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>T</td><td>T</td><td>T</td></tr>
                            <tr><td>T</td><td>F</td><td>F</td></tr>
                            <tr><td>F</td><td>T</td><td>T</td></tr>
                            <tr><td>F</td><td>F</td><td>T</td></tr>
                        </tbody>
                    </table>

                    <div className="clause-box clause-c1 fade-5">
                        C<sub>1</sub>: Rain ∨ Sunny
                    </div>
                    <div className="clause-box clause-c2 fade-5">
                        C<sub>2</sub>: ¬Rain ∨ Windy
                    </div>

                    <div className="clause-node fade-6" />

                    <div className="clause-box clause-c3 fade-6">
                        C<sub>3</sub>: Sunny ∨ Windy
                    </div>

                    <div className="clause-bottom fade-7">⊥</div>

                    <div className="symbol-list">
                        <span className="fade-6">¬</span>
                        <span className="fade-6">∧</span>
                        <span className="fade-7">∨</span>
                        <span className="fade-7">⇒</span>
                        <span className="fade-7">⊥</span>
                    </div>
                </div>
            </div>
        </div>
    );
}