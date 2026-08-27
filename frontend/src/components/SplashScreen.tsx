import {useEffect, useState} from 'react';

const LOGO_TEXT = 'ResViz';
const TYPE_SPEED_MS = 150;

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
        <div style={styles.wrapper}>
            <div style={styles.logo}>
                {typedText}
                <span style={styles.cursor}>|</span>
            </div>
            <div
                style={{
                    ...styles.tagline,
                    opacity: showTagline ? 1 : 0,
                }}
            >
                Find your resolution
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
    },
    logo: {
        fontFamily: "'Georgia', serif",
        fontStyle: 'italic',
        fontSize: '8rem',
        fontWeight: 1000,
        background: 'linear-gradient(195deg, #6fe3ff 50%, #e916ca 40%, #c20d73 15%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        textShadow: '0 0 2px rgba(11, 41, 112, 0), 0 0 2px rgba(24, 58, 153, 0.88)',
        letterSpacing: '2px',
        marginBottom: '0px',
        minHeight: '0.8em',
    },
    cursor: {
        color: '#020303f9',
        WebkitTextFillColor: '#010101ef',
        animation: 'blink 0.8s step-end infinite',
    },
    tagline: {
        marginTop: '0px',
        fontFamily: "'Georgia', serif",
        fontStyle: 'italic',
        fontSize: '2rem',
        color: '#8a8a8a',
        letterSpacing: '5px',
        transition: 'opacity 0.5s ease-in',
    },
};