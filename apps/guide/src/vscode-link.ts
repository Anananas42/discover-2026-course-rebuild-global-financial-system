/** Deep link that opens a file (optionally at a line) in VS Code. */
export const vscodeHref = (abs: string, line?: number): string =>
  `vscode://file${abs}${line ? `:${line}` : ''}`;
