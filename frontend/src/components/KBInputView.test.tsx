import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {KBInputView} from '@resviz/components/KBInputview';

const baseProps = {
    method: 'type' as const,
    projectName: 'Admissions Project',
    kbName: '',
    editingKnowledgeBaseId: null,
    formulas: [] as string[],
    upload: null,
    isUploading: false,
    isSaving: false,
    uploadError: '',
    onUpload: vi.fn(async () => undefined),
    AddFormula: vi.fn(),
    RemoveFormula: vi.fn(),
    KBNameChange: vi.fn(),
    SaveKB: vi.fn(),
    onBack: vi.fn(),
};

describe('KBInputView manual entry', () => {
    beforeEach(() => vi.clearAllMocks());

    it('adds a valid formula when Enter is pressed', async () => {
        const user = userEvent.setup();
        render(<KBInputView {...baseProps} kbName="Rules" />);
        const input = screen.getByPlaceholderText(/Enter formula/);
        await user.type(input, 'A -> B{Enter}');
        expect(baseProps.AddFormula).toHaveBeenCalledWith('A -> B');
        expect(input).toHaveValue('');
    });

    it('does not add an invalid formula', async () => {
        const user = userEvent.setup();
        render(<KBInputView {...baseProps} kbName="Rules" />);
        await user.type(screen.getByPlaceholderText(/Enter formula/), 'A ->{Enter}');
        expect(baseProps.AddFormula).not.toHaveBeenCalled();
        expect(await screen.findByText(/Expected a proposition/)).toBeInTheDocument();
    });

    it('removes the selected numbered formula', async () => {
        const user = userEvent.setup();
        render(<KBInputView {...baseProps} kbName="Rules" formulas={['A', 'A -> B']} />);
        await user.click(screen.getByRole('button', {name: 'Remove formula 2'}));
        expect(baseProps.RemoveFormula).toHaveBeenCalledWith(1);
    });

    it('keeps Save KB disabled without a name or formula', () => {
        const {rerender} = render(<KBInputView {...baseProps} formulas={['A']} />);
        expect(screen.getByRole('button', {name: 'Save KB'})).toBeDisabled();
        rerender(<KBInputView {...baseProps} kbName="Rules" formulas={[]} />);
        expect(screen.getByRole('button', {name: 'Save KB'})).toBeDisabled();
    });

    it('saves the current valid draft together with existing formulas', async () => {
        const user = userEvent.setup();
        render(<KBInputView {...baseProps} kbName="Rules" formulas={['A']} />);
        await user.type(screen.getByPlaceholderText(/Enter formula/), 'A -> B');
        await user.click(screen.getByRole('button', {name: 'Save KB'}));
        expect(baseProps.SaveKB).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Rules',
            method: 'type',
            formulas: ['A', 'A -> B'],
        }));
    });

    it('calls the back handler', async () => {
        const user = userEvent.setup();
        render(<KBInputView {...baseProps} />);
        await user.click(screen.getByRole('button', {name: 'Back'}));
        expect(baseProps.onBack).toHaveBeenCalledOnce();
    });
});

describe('KBInputView upload', () => {
    beforeEach(() => vi.clearAllMocks());

    it('displays a successful upload summary', () => {
        render(<KBInputView
            {...baseProps}
            method="upload"
            kbName="Rules"
            upload={{fileName: 'rules.kb', formulas: ['A', 'A -> B']}}
        />);
        expect(screen.getByText('rules.kb')).toBeInTheDocument();
        expect(screen.getByText('Knowledge base uploaded successfully.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save KB'})).toBeEnabled();
    });

    it('shows a backend upload error', () => {
        render(<KBInputView {...baseProps} method="upload" uploadError="Upload failed" />);
        expect(screen.getByRole('alert')).toHaveTextContent('Upload failed');
    });
});
