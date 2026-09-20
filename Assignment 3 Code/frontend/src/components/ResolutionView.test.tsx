import '@testing-library/jest-dom/vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {ResolutionView} from './ResolutionView';
import type {ResolutionResponse} from '../api/knowledgeBase';

const resolution: ResolutionResponse = {
    project_id: 'project-1',
    entailed: true,
    status: 'entailed',
    initial_clauses: [
        {id: 'C1', expression: '~P | Q', source_formula: '(P -> Q)', source_knowledge_base: 'Rules'},
        {id: 'C2', expression: 'P', source_formula: 'P', source_knowledge_base: 'Facts'},
        {id: 'C3', expression: '~Q', source_formula: '~(Q)', is_negated_goal: true},
        {id: 'C6', expression: 'R', source_formula: 'R', source_knowledge_base: 'Extra facts'},
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
    graph: {
        clauses: [
            {id: 'C1', expression: '~P | Q', source_formula: '(P -> Q)', source_knowledge_base: 'Rules'},
            {id: 'C2', expression: 'P', source_formula: 'P', source_knowledge_base: 'Facts'},
            {id: 'C3', expression: '~Q', source_formula: '~(Q)', is_negated_goal: true},
            {id: 'C4', expression: '~P', source_formula: null},
            {id: 'C5', expression: '□', source_formula: null},
            {id: 'C6', expression: 'R', source_formula: 'R', source_knowledge_base: 'Extra facts'},
        ],
        branches: [
            {id: 'R1', parent_1: 'C3', parent_2: 'C1', pivot: 'Q', result_id: 'C4', expression: '~P', kind: 'derived', reason: 'New clause', depth: 1},
            {id: 'R2', parent_1: 'C4', parent_2: 'C2', pivot: 'P', result_id: 'C5', expression: '□', kind: 'derived', reason: 'Empty clause', depth: 2},
        ],
        complete: true,
        limit_reason: null,
        pairs_examined: 4,
        pending_pairs: 0,
        shortest_proof: ['R1', 'R2'],
        shortest_is_optimal: true,
        entailed: true,
    },
};

describe('ResolutionView', () => {
    it('shows the final resolution proof tree instead of search alternatives', () => {
        render(<ResolutionView resolution={resolution} goal="Q" onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);

        expect(screen.getByRole('heading', {name: 'Resolution proof'})).toBeInTheDocument();
        expect(screen.getByText('Entailed')).toBeInTheDocument();
        expect(screen.getByText('Goal:').parentElement).toHaveTextContent('Goal: Q');
        expect(screen.getByText(/4 project clauses/)).toBeInTheDocument();
        expect(screen.getByText('3 used in proof')).toBeInTheDocument();
        expect(screen.getByText('1 not used in this proof')).toBeInTheDocument();
        expect(screen.getByText(/2 proof inferences/)).toBeInTheDocument();
        expect(screen.getByText('Verified shortest proof')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'C3: ¬Q, input clause'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'C5: □, derived at step 2'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'C6: R, input clause'})).toBeInTheDocument();
        expect(screen.queryByText(/independent resolution choices/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /First choice/i})).not.toBeInTheDocument();
    });

    it('lets a user click a clause and continue the proof step by step from there', async () => {
        const user = userEvent.setup();
        render(<ResolutionView resolution={resolution} goal="Q" onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);

        await user.click(screen.getByRole('button', {name: 'C4: ¬P, derived at step 1'}));
        expect(screen.getByText('Step 1', {selector: 'strong'}).parentElement).toHaveTextContent('Step 1 of 2');
        expect(screen.getByText(/¬Q\s+\+\s+¬P \| Q\s+⟶\s+¬P/)).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'Next'}));
        expect(screen.getByText('Step 2', {selector: 'strong'}).parentElement).toHaveTextContent('Step 2 of 2');
        expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();

        await user.click(screen.getByRole('button', {name: 'Show complete proof'}));
        expect(screen.getByRole('button', {name: 'Overview'})).toHaveClass('active');
    });

    it('announces the contradiction and completes the project when the final proof step is reached', async () => {
        const user = userEvent.setup();
        const onContradictionReached = vi.fn().mockResolvedValue(undefined);
        render(
            <ResolutionView
                resolution={resolution}
                goal="Q"
                onBack={vi.fn()}
                onBackToKnowledgeBase={vi.fn()}
                onContradictionReached={onContradictionReached}
            />,
        );

        await user.click(screen.getByRole('button', {name: 'Step through'}));
        await user.click(screen.getByRole('button', {name: 'Next'}));

        expect(screen.getByRole('dialog', {name: 'The goal is entailed'})).toBeInTheDocument();
        expect(screen.getByText(/Resolution derived the empty clause/)).toBeInTheDocument();
        await waitFor(() => expect(onContradictionReached).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByText('Project status updated to Completed.')).toBeInTheDocument());

        await user.click(screen.getByRole('button', {name: 'Return to proof'}));
        expect(screen.queryByRole('dialog', {name: 'The goal is entailed'})).not.toBeInTheDocument();
    });

    it('shows the project input clauses and identifies the negated goal', async () => {
        const user = userEvent.setup();
        render(<ResolutionView resolution={resolution} goal="Q" onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);
        await user.click(screen.getByRole('button', {name: 'Project clauses'}));
        expect(screen.getByRole('heading', {name: 'Project clauses'})).toBeInTheDocument();
        expect(screen.getAllByText('¬P | Q').length).toBeGreaterThan(0);
        expect(screen.getByText('Negated goal')).toBeInTheDocument();
        expect(screen.getByText('Rules')).toBeInTheDocument();
    });


    it('keeps unused project clauses visible and explains why they do not have a proof step', async () => {
        const user = userEvent.setup();
        render(<ResolutionView resolution={resolution} goal="Q" onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);

        await user.click(screen.getByRole('button', {name: 'C6: R, input clause'}));
        expect(screen.getByText('Not used in displayed proof')).toBeInTheDocument();
        expect(screen.getByText(/belongs to the project, but it is not required by the displayed proof/i)).toBeInTheDocument();
        expect(screen.queryByText(/Step 1 of 2/)).not.toBeInTheDocument();
    });

    it('shows a clear empty state when no contradiction proof exists', () => {
        const unresolved: ResolutionResponse = {
            ...resolution,
            entailed: false,
            status: 'not_entailed',
            initial_clauses: [
                {id: 'C1', expression: 'P', source_formula: 'P'},
                {id: 'C2', expression: '~Q', source_formula: '~(Q)', is_negated_goal: true},
            ],
            clauses: [],
            steps: [],
            graph: {
                clauses: [],
                branches: [],
                complete: true,
                limit_reason: null,
                pairs_examined: 1,
                pending_pairs: 0,
                shortest_proof: [],
                shortest_is_optimal: true,
                entailed: false,
            },
        };
        render(<ResolutionView resolution={unresolved} goal="Q" onBack={vi.fn()} onBackToKnowledgeBase={vi.fn()} />);
        expect(screen.getByText('Not entailed')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'No contradiction proof was produced'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Back to CNF'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Back to Knowledge Base'})).toBeInTheDocument();
    });
});
