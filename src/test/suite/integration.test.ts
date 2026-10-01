import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Integration tests that run inside a real VS Code instance
 * (launched by @vscode/test-electron).
 */

const FIXTURE_DIR = path.resolve(__dirname, '..', '..', '..', 'testFixture');

function writeFixture(name: string, content: string): vscode.Uri {
  mkdirWithRetry(FIXTURE_DIR);
  const filePath = path.join(FIXTURE_DIR, name);
  fs.writeFileSync(filePath, content, 'utf8');
  return vscode.Uri.file(filePath);
}

/** mkdir that retries to survive Windows watcher/lock races. */
function mkdirWithRetry(dir: string): void {
  let lastErr;
  for (let i = 0; i < 10; i++) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return;
    } catch (err) {
      lastErr = err;
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  throw lastErr;
}

/** Retries rmSync with maxRetries to survive Windows file-lock races. */
function removeFixtureDir(): void {
  fs.rmSync(FIXTURE_DIR, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

/** Closes open editors so VS Code releases file handles, then cleans up. */
async function cleanup(): Promise<void> {
  try {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  } catch {
    // ignore if no editors are open
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  removeFixtureDir();
}

suite('Add Scene (integration)', () => {
  suiteSetup(async () => {
    removeFixtureDir();
    const ext = vscode.extensions.getExtension('add-scene.add-scene');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(async () => {
    await cleanup();
  });

  suiteTeardown(async () => {
    await cleanup();
  });

  test('command creates scene file and inserts script tag before </body>', async () => {
    const htmlUri = writeFixture(
      'index.html',
      [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <title>Test</title>',
        '</head>',
        '<body>',
        '  <h1>Hello</h1>',
        '</body>',
        '</html>',
        '',
      ].join('\n')
    );

    await vscode.commands.executeCommand(
      'addScene.addScene',
      htmlUri,
      'myScene'
    );

    const jsPath = path.join(FIXTURE_DIR, 'myScene.js');
    assert.ok(fs.existsSync(jsPath), 'scene js file created');
    assert.strictEqual(
      fs.readFileSync(jsPath, 'utf8'),
      [
        'class myScene extends Scene{',
        '    constructor(){',
        '        super()',
        '        //Camera.main.backgroundColor = "white"',
        '    }',
        '}',
        '',
      ].join('\n'),
      'scene file content'
    );

    const html = fs.readFileSync(htmlUri.fsPath, 'utf8');
    assert.ok(
      html.includes('<script src="myScene.js"></script>\n</body>'),
      `script tag inserted before </body>; got:\n${html}`
    );

    // The new scene file is open and has keyboard focus.
    const active = vscode.window.activeTextEditor;
    assert.ok(active, 'an editor has focus');
    assert.strictEqual(
      active!.document.uri.fsPath,
      jsPath,
      'scene file editor is focused'
    );
  });

  test('command places scene file in scenes folder when it exists', async () => {
    const scenesDir = path.join(FIXTURE_DIR, 'scenes');
    fs.mkdirSync(scenesDir, { recursive: true });
    const htmlUri = writeFixture(
      'withscenes.html',
      '<html>\n<body>\n  <p>hi</p>\n</body>\n</html>'
    );

    await vscode.commands.executeCommand(
      'addScene.addScene',
      htmlUri,
      'folderScene'
    );

    const jsPath = path.join(scenesDir, 'folderScene.js');
    assert.ok(fs.existsSync(jsPath), 'scene js file created in scenes folder');
    assert.strictEqual(
      fs.readFileSync(jsPath, 'utf8'),
      [
        'class folderScene extends Scene{',
        '    constructor(){',
        '        super()',
        '        //Camera.main.backgroundColor = "white"',
        '    }',
        '}',
        '',
      ].join('\n'),
      'scene file content'
    );
    assert.ok(
      !fs.existsSync(path.join(FIXTURE_DIR, 'folderScene.js')),
      'no scene file in the html folder'
    );

    const html = fs.readFileSync(htmlUri.fsPath, 'utf8');
    assert.ok(
      html.includes('<script src="scenes/folderScene.js"></script>'),
      `script tag points into scenes folder; got:\n${html}`
    );

    const active = vscode.window.activeTextEditor;
    assert.ok(active, 'an editor has focus');
    assert.strictEqual(
      active!.document.uri.fsPath,
      jsPath,
      'scene file editor is focused'
    );
  });

  test('command inserts with matching indentation', async () => {
    const htmlUri = writeFixture(
      'indented.html',
      '<html>\n<body>\n    <p>hi</p>\n    </body>\n</html>'
    );

    await vscode.commands.executeCommand(
      'addScene.addScene',
      htmlUri,
      'scene2'
    );

    const html = fs.readFileSync(htmlUri.fsPath, 'utf8');
    assert.ok(
      html.includes('    <script src="scene2.js"></script>\n    </body>'),
      `indented script tag; got:\n${html}`
    );
  });

  test('command appends at end when no </body> tag', async () => {
    // Note: a file with no line breaks gets the platform default EOL
    // (CRLF on Windows) from VS Code, so the assertion is EOL-aware.
    const htmlUri = writeFixture('nobody.html', '<html><body>hi</html>');

    await vscode.commands.executeCommand(
      'addScene.addScene',
      htmlUri,
      'scene3'
    );

    const html = fs.readFileSync(htmlUri.fsPath, 'utf8');
    assert.ok(
      html.endsWith('<script src="scene3.js"></script>\n') ||
        html.endsWith('<script src="scene3.js"></script>\r\n'),
      `appended at end; got:\n${JSON.stringify(html)}`
    );
  });

  test('command inserts after a Game-Specific Scenes comment', async () => {
    const htmlUri = writeFixture(
      'comment.html',
      [
        '<html>',
        '<body>',
        '  <h1>Hi</h1>',
        '  <!-- Game-Specific Scenes -->',
        '  <script src="existing.js"></script>',
        '</body>',
        '</html>',
      ].join('\n')
    );

    await vscode.commands.executeCommand(
      'addScene.addScene',
      htmlUri,
      'commentScene'
    );

    const html = fs.readFileSync(htmlUri.fsPath, 'utf8');
    const lines = html.split('\n');
    const commentIdx = lines.findIndex((l) =>
      l.includes('Game-Specific Scenes')
    );
    assert.ok(commentIdx >= 0, 'comment still present');
    assert.strictEqual(
      lines[commentIdx + 1],
      '  <script src="commentScene.js"></script>',
      `tag directly after the comment; got:\n${html}`
    );
    assert.ok(
      !html.includes('<script src="commentScene.js"></script>\n</body>'),
      'tag not placed before </body>'
    );
  });

  test('command does nothing for invalid scene name', async () => {
    const original = '<html><body></body></html>';
    const htmlUri = writeFixture('invalid.html', original);

    await vscode.commands.executeCommand(
      'addScene.addScene',
      htmlUri,
      '1bad'
    );

    assert.strictEqual(
      fs.readFileSync(htmlUri.fsPath, 'utf8'),
      original,
      'html unchanged'
    );
    assert.ok(
      !fs.existsSync(path.join(FIXTURE_DIR, '1bad.js')),
      'no js file created'
    );
  });

  test('add game object creates file and inserts tag before </body>', async () => {
    const htmlUri = writeFixture(
      'go.html',
      [
        '<html>',
        '<body>',
        '  <h1>Hi</h1>',
        '</body>',
        '</html>',
      ].join('\n')
    );

    await vscode.commands.executeCommand(
      'addScene.addGameObject',
      htmlUri,
      'myObject'
    );

    const jsPath = path.join(FIXTURE_DIR, 'myObject.js');
    assert.ok(fs.existsSync(jsPath), 'game object js file created');
    assert.strictEqual(
      fs.readFileSync(jsPath, 'utf8'),
      [
        'class myObject extends GameObject{',
        '    constructor(){',
        '        super("myObject", [], "default")',
        '    }',
        '}',
        '',
      ].join('\n'),
      'game object file content'
    );

    const html = fs.readFileSync(htmlUri.fsPath, 'utf8');
    assert.ok(
      html.includes('<script src="myObject.js"></script>\n</body>'),
      `script tag inserted before </body>; got:\n${html}`
    );

    const active = vscode.window.activeTextEditor;
    assert.ok(active, 'an editor has focus');
    assert.strictEqual(
      active!.document.uri.fsPath,
      jsPath,
      'game object editor is focused'
    );
  });

  test('add game object uses gameObjects folder and comment anchor', async () => {
    const goDir = path.join(FIXTURE_DIR, 'gameObjects');
    fs.mkdirSync(goDir, { recursive: true });
    const htmlUri = writeFixture(
      'go-comment.html',
      [
        '<html>',
        '<body>',
        '  <!-- Game-Specific Game Objects -->',
        '  <script src="existing.js"></script>',
        '</body>',
        '</html>',
      ].join('\n')
    );

    await vscode.commands.executeCommand(
      'addScene.addGameObject',
      htmlUri,
      'folderObject'
    );

    const jsPath = path.join(goDir, 'folderObject.js');
    assert.ok(fs.existsSync(jsPath), 'game object file in gameObjects folder');
    assert.ok(
      !fs.existsSync(path.join(FIXTURE_DIR, 'folderObject.js')),
      'no game object file in the html folder'
    );

    const html = fs.readFileSync(htmlUri.fsPath, 'utf8');
    const lines = html.split('\n');
    const commentIdx = lines.findIndex((l) =>
      l.includes('Game-Specific Game Objects')
    );
    assert.ok(commentIdx >= 0, 'comment still present');
    assert.strictEqual(
      lines[commentIdx + 1],
      '  <script src="gameObjects/folderObject.js"></script>',
      `tag directly after the comment; got:\n${html}`
    );
  });

  test('add component creates file and inserts tag before </body>', async () => {
    const htmlUri = writeFixture(
      'comp.html',
      [
        '<html>',
        '<body>',
        '  <h1>Hi</h1>',
        '</body>',
        '</html>',
      ].join('\n')
    );

    await vscode.commands.executeCommand(
      'addScene.addComponent',
      htmlUri,
      'myComponent'
    );

    const jsPath = path.join(FIXTURE_DIR, 'myComponent.js');
    assert.ok(fs.existsSync(jsPath), 'component js file created');
    assert.strictEqual(
      fs.readFileSync(jsPath, 'utf8'),
      [
        'class myComponent extends Component{',
        '    start(){',
        '        ',
        '    }',
        '}',
        '',
      ].join('\n'),
      'component file content'
    );

    const html = fs.readFileSync(htmlUri.fsPath, 'utf8');
    assert.ok(
      html.includes('<script src="myComponent.js"></script>\n</body>'),
      `script tag inserted before </body>; got:\n${html}`
    );

    const active = vscode.window.activeTextEditor;
    assert.ok(active, 'an editor has focus');
    assert.strictEqual(
      active!.document.uri.fsPath,
      jsPath,
      'component editor is focused'
    );
  });

  test('add component uses components folder and comment anchor', async () => {
    const compDir = path.join(FIXTURE_DIR, 'components');
    fs.mkdirSync(compDir, { recursive: true });
    const htmlUri = writeFixture(
      'comp-comment.html',
      [
        '<html>',
        '<body>',
        '  <!-- Game-Specific Components -->',
        '  <script src="existing.js"></script>',
        '</body>',
        '</html>',
      ].join('\n')
    );

    await vscode.commands.executeCommand(
      'addScene.addComponent',
      htmlUri,
      'folderComponent'
    );

    const jsPath = path.join(compDir, 'folderComponent.js');
    assert.ok(fs.existsSync(jsPath), 'component file in components folder');
    assert.ok(
      !fs.existsSync(path.join(FIXTURE_DIR, 'folderComponent.js')),
      'no component file in the html folder'
    );

    const html = fs.readFileSync(htmlUri.fsPath, 'utf8');
    const lines = html.split('\n');
    const commentIdx = lines.findIndex((l) =>
      l.includes('Game-Specific Components')
    );
    assert.ok(commentIdx >= 0, 'comment still present');
    assert.strictEqual(
      lines[commentIdx + 1],
      '  <script src="components/folderComponent.js"></script>',
      `tag directly after the comment; got:\n${html}`
    );
  });
});
