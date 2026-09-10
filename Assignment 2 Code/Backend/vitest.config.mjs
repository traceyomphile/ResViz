import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const sourceRoot = process.env.RESVIZ_SOURCE_ROOT
    ? path.resolve(process.env.RESVIZ_SOURCE_ROOT, 'src')
    : path.resolve(process.cwd(), 'src');

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@resviz': sourceRoot,
            'react/jsx-dev-runtime': path.resolve(process.cwd(), 'node_modules/react/jsx-dev-runtime.js'),
            'react/jsx-runtime': path.resolve(process.cwd(), 'node_modules/react/jsx-runtime.js'),
            'react-dom/client': path.resolve(process.cwd(), 'node_modules/react-dom/client.js'),
            'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom/index.js'),
            'react': path.resolve(process.cwd(), 'node_modules/react/index.js'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setup.ts',
    },
});
