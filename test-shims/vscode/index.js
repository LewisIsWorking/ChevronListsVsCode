// Re-exports the hand-written mock so a bare `import ... from 'vscode'`
// resolves during tests. See test-shims/README.md for why this exists.
module.exports = require('../../src/__mocks__/vscode.ts');
