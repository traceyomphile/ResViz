import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it} from 'vitest';

import {ThemeProvider, useTheme} from '@resviz/context/ThemeContext';

function ThemeProbe() {
    const {theme, toggleTheme} = useTheme();
    return <button onClick={toggleTheme}>Theme: {theme}</button>;
}

describe('ThemeProvider', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });

    it('restores a saved theme', () => {
        localStorage.setItem('resviz-theme', 'light');
        render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
        expect(screen.getByRole('button')).toHaveTextContent('Theme: light');
        expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    });

    it('toggles and persists the selected theme', async () => {
        const user = userEvent.setup();
        localStorage.setItem('resviz-theme', 'dark');
        render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
        await user.click(screen.getByRole('button'));
        expect(screen.getByRole('button')).toHaveTextContent('Theme: light');
        expect(document.documentElement).toHaveAttribute('data-theme', 'light');
        expect(localStorage.getItem('resviz-theme')).toBe('light');
    });
});
