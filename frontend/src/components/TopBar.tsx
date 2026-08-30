import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import './TopBar.css';

interface TopBarProps {
    onImportProject(): void;
    onExportProject?(): void;
    canExportProject?: boolean;
    projectActionBusy?: boolean;
    projectActionMessage?: string | null;
}

export function TopBar({
    onImportProject,
    onExportProject,
    canExportProject = false,
    projectActionBusy = false,
    projectActionMessage = null,
}: TopBarProps) {
    const { theme, toggleTheme } = useTheme();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isMenuOpen) return;

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsMenuOpen(false);
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isMenuOpen]);

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

                <div className='app-menu' ref={menuRef}>
                    <button
                        className="app-menu-toggle"
                        type='button'
                        aria-label='Project Menu'
                        aria-haspopup='menu'
                        aria-expanded={isMenuOpen}
                        onClick={() => setIsMenuOpen((open) => !open)}
                    >
                        ⁞
                    </button>

                    {isMenuOpen && (
                        <div className='app-menu-dropdown' role='menu'>
                            <button
                                className='app-menu-item'
                                type='button'
                                role='menuitem'
                                disabled={projectActionBusy || !onImportProject}
                                onClick={onImportProject}
                            >
                                <span aria-hidden='true'>⇧</span>
                                Import Project 
                            </button>

                            <button 
                                className='app-menu-item'
                                type='button'
                                role='menuitem'
                                disabled={
                                    projectActionBusy
                                    || !canExportProject
                                    || !onExportProject
                                }
                                title={!canExportProject ? 'Select a saved project first': undefined}
                                onClick={onExportProject}
                            >
                                <span aria-hidden='true'>⇩</span>
                                Export Project
                            </button>

                            {projectActionMessage && (
                                <p className='app-menu-message' role='status'>
                                    {projectActionMessage}
                                </p>
                            )}
                        </div>
                    )}
                </div>     
            </div>
        </nav>
    );
}