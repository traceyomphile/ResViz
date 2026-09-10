import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {KBChoiceView} from '@resviz/components/KBChoiceView';
import {deleteSavedKnowledgeBase, listKnowledgeBases} from '@resviz/api/knowledgeBase';

vi.mock('@resviz/api/knowledgeBase', () => ({
    listKnowledgeBases: vi.fn(),
    deleteSavedKnowledgeBase: vi.fn(),
}));

const mockedList = vi.mocked(listKnowledgeBases);
const mockedDelete = vi.mocked(deleteSavedKnowledgeBase);

const baseProps = {
    projectId: 'project-1',
    isConverting: false,
    query: 'Q',
    activeKnowledgeBaseId: null,
    onChoose: vi.fn(),
    onQueryChange: vi.fn(),
    onBack: vi.fn(),
    onConvert: vi.fn(),
    onSelectKnowledgeBase: vi.fn(),
};

describe('KBChoiceView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedList.mockResolvedValue({project_id: 'project-1', knowledge_bases: []});
    });

    it('shows the upload and manual-entry choices', async () => {
        render(<KBChoiceView {...baseProps} />);
        expect(screen.getByRole('button', {name: /Upload KB/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /TypeKB/})).toBeInTheDocument();
        await screen.findByText('No knowledge bases saved yet.');
    });

    it('reports the selected input method', async () => {
        const user = userEvent.setup();
        render(<KBChoiceView {...baseProps} />);
        await user.click(screen.getByRole('button', {name: /Upload KB/}));
        await user.click(screen.getByRole('button', {name: /TypeKB/}));
        expect(baseProps.onChoose).toHaveBeenNthCalledWith(1, 'upload');
        expect(baseProps.onChoose).toHaveBeenNthCalledWith(2, 'type');
    });

    it('lists every saved named knowledge base and enables conversion', async () => {
        mockedList.mockResolvedValue({
            project_id: 'project-1',
            knowledge_bases: [
                {id: 'kb-1', name: 'Admissions', formula_count: 2, created_at: '2026-09-01T00:00:00Z'},
                {id: 'kb-2', name: 'Rules', formula_count: 1, created_at: '2026-09-01T00:00:00Z'},
            ],
        });
        render(<KBChoiceView {...baseProps} />);
        expect(await screen.findByText('Admissions')).toBeInTheDocument();
        expect(screen.getByText('Rules')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Convert to CNF'})).toBeEnabled();
    });

    it('selects the requested saved knowledge base', async () => {
        const user = userEvent.setup();
        mockedList.mockResolvedValue({
            project_id: 'project-1',
            knowledge_bases: [{id: 'kb-1', name: 'Admissions', formula_count: 2, created_at: '2026-09-01T00:00:00Z'}],
        });
        render(<KBChoiceView {...baseProps} />);
        const label = await screen.findByText('Admissions');
        await user.click(label.closest('button')!);
        expect(baseProps.onSelectKnowledgeBase).toHaveBeenCalledWith(expect.objectContaining({id: 'kb-1'}));
    });

    it('deletes only the selected knowledge base', async () => {
        const user = userEvent.setup();
        mockedList.mockResolvedValue({
            project_id: 'project-1',
            knowledge_bases: [
                {id: 'kb-1', name: 'Admissions', formula_count: 2, created_at: '2026-09-01T00:00:00Z'},
                {id: 'kb-2', name: 'Rules', formula_count: 1, created_at: '2026-09-01T00:00:00Z'},
            ],
        });
        mockedDelete.mockResolvedValue();
        render(<KBChoiceView {...baseProps} />);
        await user.click(await screen.findByRole('button', {name: 'Remove Admissions'}));
        expect(mockedDelete).toHaveBeenCalledWith('project-1', 'kb-1');
        expect(screen.queryByText('Admissions')).not.toBeInTheDocument();
        expect(screen.getByText('Rules')).toBeInTheDocument();
    });

    it('keeps conversion disabled without a saved KB or valid query', async () => {
        const {rerender} = render(<KBChoiceView {...baseProps} query="" />);
        await screen.findByText('No knowledge bases saved yet.');
        expect(screen.getByRole('button', {name: 'Convert to CNF'})).toBeDisabled();
        rerender(<KBChoiceView {...baseProps} query="A ->" />);
        expect(screen.getByRole('button', {name: 'Convert to CNF'})).toBeDisabled();
    });

    it('returns to the project screen', async () => {
        const user = userEvent.setup();
        render(<KBChoiceView {...baseProps} />);
        await user.click(screen.getByRole('button', {name: 'Back'}));
        expect(baseProps.onBack).toHaveBeenCalledOnce();
    });
});
