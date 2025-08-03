const { build } = require('esbuild');
const { nodeExternalsPlugin } = require('esbuild-node-externals');
const { copy } = require('esbuild-plugin-copy');

const isProduction = process.env.NODE_ENV === 'production';

async function buildBundle() {
  try {
    console.log('Building mark2pdf...');
    
    // Build main bundle
    await build({
      entryPoints: ['./src/bin/mark2pdf.ts'],
      bundle: true,
      platform: 'node',
      target: 'node16',
      format: 'cjs',
      outfile: 'dist/bin/mark2pdf.js',
      external: ['puppeteer', 'markdown-pdf', 'pdf-lib'],
      plugins: [
        nodeExternalsPlugin(),
        copy({
          assets: [
            {
              from: ['./assets/**/*'],
              to: './assets',
            },
            {
              from: ['./src/**/*.js'],
              to: './src',
            },
          ],
        }),
      ],
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
      minify: isProduction,
      sourcemap: !isProduction,
    });

    // Generate TypeScript declarations using tsc
    const { execSync } = require('child_process');
    try {
      execSync('tsc --declaration --emitDeclarationOnly --outDir dist/types', { 
        stdio: 'inherit' 
      });
      console.log('✓ Type declarations generated');
    } catch (error) {
      console.warn('Warning: Failed to generate type declarations:', error.message);
    }

    console.log('✓ Build completed successfully!');
    
    if (isProduction) {
      console.log('✓ Production build ready');
    } else {
      console.log('✓ Development build ready');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Watch mode for development
if (process.argv.includes('--watch')) {
  console.log('Starting watch mode...');
  buildBundle();
  
  // Simple file watcher (in production, you might want to use chokidar)
  const fs = require('fs');
  const path = require('path');
  
  const watchDirs = ['./src'];
  
  watchDirs.forEach(dir => {
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (filename && (eventType === 'change' || eventType === 'rename')) {
        console.log(`File changed: ${path.join(dir, filename)}`);
        buildBundle();
      }
    });
  });
} else {
  buildBundle();
}