import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');

await esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle:      true,
    outfile:     'dist/extension.js',
    external:    ['vscode'],          // provided by VS Code at runtime - must not be bundled
    format:      'cjs',               // VS Code extensions must use CommonJS
    platform:    'node',
    target:      'node20',
    sourcemap:   !production,
    minify:      production,
    logLevel:    'info',
});
