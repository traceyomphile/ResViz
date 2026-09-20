import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    }),
});

if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = () => 'blob:test';
}

if (!File.prototype.text) {
    File.prototype.text = function text(): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsText(this);
        });
    };
}
