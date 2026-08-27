import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiMarkdownContent } from './AiMarkdownContent';

describe('AiMarkdownContent sources', () => {
    it('numbers legacy Google redirects and shows direct-site details', () => {
        render(<AiMarkdownContent content={`**Sources**
- [https://vertexaisearch.cloud.google.com/grounding-api-redirect/one](https://vertexaisearch.cloud.google.com/grounding-api-redirect/one)
- [Google Search result](https://vertexaisearch.cloud.google.com/grounding-api-redirect/two)
- [Release notes - example.com](https://example.com/release-notes)`} />);

        expect(screen.getByText('Google Search source 1')).toBeInTheDocument();
        expect(screen.getByText('Google Search source 2')).toBeInTheDocument();
        expect(screen.getByText('Release notes')).toBeInTheDocument();
        expect(screen.getByText('example.com')).toBeInTheDocument();
    });
});
