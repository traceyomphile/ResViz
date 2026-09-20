import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {ResolutionView} from '@resviz/components/ResolutionView';
import type {ResolutionResponse} from '@resviz/api/knowledgeBase';

const resolution: ResolutionResponse = {
    project_id: 'project-1',
    entailed: true,
    status: 'entailed',
    initial_clauses: [
        {id: 'C1', expression: '~P | Q', source_formula: '(P -> Q)', source_knowledge_base: 'Rules'},
        {id: 'C2', expression: 'P', source_formula: 'P', source_knowledge_base: 'Facts'},
        {id: 'C3', expression: '~Q', source_formula: '~(Q)', is_negated_goal: true},
    ],
    clauses: [
        {id: 'C1', expression: '~P | Q', source_formula: '(P -> Q)'},
        {id: 'C2', expression: 'P', source_formula: 'P'},
        {id: 'C3', expression: '~Q', source_formula: '~(Q)', is_negated_goal: true},
        {id: 'C4', expression: '~P', source_formula: null},
        {id: 'C5', expression: '□', source_formula: null},
    ],
    steps: [
        {step_number: 1, parent_1: 'C3', parent_2: 'C1', pivot: '~Q', resolvent_id: 'C4', resolvent: '~P'},
        {step_number: 2, parent_1: 'C4', parent_2: 'C2', pivot: '~P', resolvent_id: 'C5', resolvent: '□'},
    ],
};

describe('ResolutionView', () => {
    it('starts from the negated goal and shows independent resolution choices', () => {
        render(<ResolutionView resolution={resolution} goal="Q" onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);
        expect(screen.getByRole('heading', {name: 'Resolution visualisation'})).toBeInTheDocument();
        expect(screen.getByText('Entailed')).toBeInTheDocument();
        expect(screen.getByText('Goal:').parentElement).toHaveTextContent('Goal: Q');
        expect(screen.getByText(/3 input clauses/)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /C1:/})).toBeInTheDocument();
    });

    it('shows the project input clauses and identifies the negated goal', async () => {
        const user = userEvent.setup();
        render(<ResolutionView resolution={resolution} goal="Q" onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);
        await user.click(screen.getByRole('button', {name: 'Input clauses'}));
        expect(screen.getByRole('heading', {name: 'Input clauses'})).toBeInTheDocument();
        expect(screen.getAllByText('¬P | Q').length).toBeGreaterThan(0);
        expect(screen.getByText('Negated goal')).toBeInTheDocument();
        expect(screen.getByText('Rules')).toBeInTheDocument();
    });

    it('still provides navigation when a branch cannot derive a contradiction', () => {
        const unresolved: ResolutionResponse = {
            ...resolution,
            entailed: false,
            status: 'not_entailed',
            initial_clauses: [
                {id: 'C1', expression: 'P', source_formula: 'P'},
                {id: 'C2', expression: '~Q', source_formula: '~(Q)', is_negated_goal: true},
            ],
            steps: [],
        };
        render(<ResolutionView resolution={unresolved} goal="Q" onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);
        expect(screen.getByText('Not entailed')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Back to CNF'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Back to Knowledge Base'})).toBeInTheDocument();
    });
});
