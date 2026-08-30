import {useTheme} from '../context/ThemeContext';
import './TopBar.css';

export function TopBar() {
    const { theme, toggleTheme } = useTheme();

    return (
        <nav className='app-top-bar'>
            <span className="app-top-bar-logo">ResViz</span>

            <div className='app-top-bar-actions'>
                <button
                    className='app-theme-toggle'
                    type='button'
                    aria-label="Toggle light/dark mode"
                    onClick={toggleTheme}
                >
                    {theme == 'dark' ? '🔆':'🌙'}
                </button>

                <button
                    className="app-menu-toggle"
                    type='button'
                    aria-label='Open Menu'
                    onClick={() => {
                        // menu logic to go here later.
                    }}
                >
                    ⁞
                </button>
            </div>
        </nav>
    );
}