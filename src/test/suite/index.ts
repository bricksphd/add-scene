import * as path from 'path';
import * as Mocha from 'mocha';

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    // Teardown retries file deletion and can exceed Mocha's 2s default on slow Windows runners.
    timeout: 20000,
  });

  mocha.addFile(path.resolve(__dirname, 'integration.test.js'));

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
