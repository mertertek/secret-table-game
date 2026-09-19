import assert from 'node:assert/strict';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = resolve(root, 'apps/web');
const filename = resolve(web, 'tsconfig.json');
const { config, error } = ts.readConfigFile(filename, ts.sys.readFile);
assert.equal(error, undefined);
// Vercel's fixConfig applies defaults BEFORE resolving extends. Keep these
// explicit in the leaf config to avoid NodeNext/strict:false overriding the base.
// https://github.com/vercel/vercel/blob/main/packages/node/src/typescript.ts
assert.equal(config.compilerOptions.module, 'ESNext');
assert.equal(config.compilerOptions.moduleResolution, 'bundler');
assert.equal(config.compilerOptions.strict, true);
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, web, { noEmit: true }, filename);
const program = ts.createProgram(['api/game.ts', 'api/health.ts'].map(p => resolve(web, p)), parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: f => f,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }));
}
assert.equal(diagnostics.length, 0, 'API compiler diagnostics');
console.log('PASS: explicit Vercel API compiler options and complete API typecheck');
