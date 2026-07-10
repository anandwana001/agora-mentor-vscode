import type { QuickActionId, SelectedCodeContext } from './types';

const ACTION_HINTS: Record<QuickActionId, string> = {
  explain: 'Explain what the code does, the main control flow, and any important tradeoffs.',
  'find-bugs': 'Review the code for bugs, edge cases, and reliability risks.',
  refactor: 'Suggest a cleaner or more maintainable version of the code.',
  tests: 'Propose meaningful tests that would protect the current behavior.',
  summarize: 'Summarize the code in concise, developer-friendly language.',
};

export function buildMentorPrompt(
  context: SelectedCodeContext,
  action: QuickActionId = 'explain',
): string {
  const surrounding = context.surroundingText?.trim();
  const fileHeader = [
    `Project: ${context.workspaceName}`,
    `File: ${context.filePath}`,
    `Language: ${context.language}`,
    `Selection: lines ${context.startLine + 1}-${context.endLine + 1}, ${context.characterCount} characters`,
  ].join('\n');

  const sections: string[] = [
    'You are a senior software mentor helping a developer understand and improve code.',
    'Stay practical, precise, and language-agnostic.',
    'Do not assume any specific framework unless the code shows it.',
    '',
    `Task: ${ACTION_HINTS[action]}`,
    '',
    fileHeader,
    '',
    'Selected code:',
    context.selectedText.trim(),
  ];

  if (surrounding) {
    sections.push('', 'Surrounding context:', surrounding);
  }

  return sections.join('\n');
}
