import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    // Run the integration test suite inside a real VS Code instance.
    await runTests({
      extensionDevelopmentPath: path.resolve(__dirname, '..', '..'),
      extensionTestsPath: path.resolve(__dirname, 'suite', 'index.js'),
      launchArgs: ['--disable-extensions'],
    });
  } catch (err) {
    console.error('Failed to run VS Code integration tests:', err);
    process.exit(1);
  }
}

main();
