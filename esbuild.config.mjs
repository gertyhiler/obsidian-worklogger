import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  external: ['obsidian', 'electron'],
  platform: 'node',
  target: 'es2022',
  format: 'cjs',
  outfile: 'main.js',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
});
