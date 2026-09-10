import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {ResolutionView} from '@resviz/components/ResolutionView';
import type {ResolutionResponse} from '@resviz/api/knowledgeBase';

const resolution: ResolutionResponse = {
    project_id: 'project-1',
    entailed: true,
    status: 'entailed',
    initial_clauses: [],
    clauses: [
        {id: 'C1', expression: '~P | Q', source_formula: '(P -> Q)'},
        {id: 'C2', expression: 'P', source_formula: 'P'},
        {id: 'C3', expression: '~Q', source_formula: '~(Q)'},
        {id: 'C4', expression: '~P', source_formula: null},
        {id: 'C5', expression: '□', source_formula: null},
    ],
    steps: [
        {step_number: 1, parent_1: 'C3', parent_2: 'C1', pivot: '~Q', resolvent_id: 'C4', resolvent: '~P'},
        {step_number: 2, parent_1: 'C4', parent_2: 'C2', pivot: '~P', resolvent_id: 'C5', resolvent: '□'},
    ],
};

describe('ResolutionView', () => {
    it('shows parent clauses, complementary literals and the resolvent', () => {
        render(<ResolutionView resolution={resolution} onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);
        expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
        expect(screen.getByText('~P | Q')).toBeInTheDocument();
        expect(screen.getByText(/Complementary literals:/)).toHaveTextContent('~Q / Q');
        expect(screen.getByText('C4')).toBeInTheDocument();
    });

    it('navigates to the final step and displays entailment', async () => {
        const user = userEvent.setup();
        render(<ResolutionView resolution={resolution} onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);
        await user.click(screen.getByRole('button', {name: 'Next'}));
        expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
        expect(screen.getByText('Empty clause reached — the query is entailed.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
    });

    it('provides navigation when no steps exist', async () => {
        const user = userEvent.setup();
        const backToKb = vi.fn();
        render(<ResolutionView
            resolution={{...resolution, entailed: false, status: 'not_entailed', steps: []}}
            onBack={vi.fn()}
            onBackToKnowledgeBase={backToKb}
        />);
        expect(screen.getByText('No resolution steps could be derived.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'Back to Knowledge Base'}));
        expect(backToKb).toHaveBeenCalledOnce();
    });
});
