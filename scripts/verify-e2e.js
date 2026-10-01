/**
 * End-to-end verification: loads the compiled extension with a mocked
 * 'vscode' module and exercises the command handler against a real
 * temp HTML file. Run: node scripts/verify-e2e.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');

const workspaceEdits = [];
const infoMessages = [];
const warnMessages = [];
const errorMessages = [];
const openedDocuments = [];
let inputBoxAnswer = null;

const mockVscode = {
  window: {
    showInputBox: async (opts) => {
      if (inputBoxAnswer === null) {
        throw new Error('unexpected input box');
      }
      const answer = inputBoxAnswer;
      const err = opts.validateInput ? opts.validateInput(answer) : undefined;
      if (err) {
        inputBoxAnswer = null;
        return undefined;
      }
      return answer;
    },
    showInformationMessage: (m) => infoMessages.push(m),
    showWarningMessage: (m) => warnMessages.push(m),
    showErrorMessage: (m) => errorMessages.push(m),
    showTextDocument: async (doc, options) => {
      openedDocuments.push({ fsPath: doc.fileName, options });
      return { document: doc };
    },
    activeTextEditor: undefined,
  },
  workspace: {
    openTextDocument: async (uri) => {
      const text = fs.readFileSync(uri.fsPath, 'utf8');
      return {
        getText: () => text,
        fileName: uri.fsPath,
        positionAt: (offset) => offset,
        save: async () => {},
      };
    },
    applyEdit: async (edit) => {
      workspaceEdits.push(edit);
      return true;
    },
  },
  commands: {
    registerCommand: (_cmd, handler) => ({ handler, dispose() {} }),
  },
  Uri: {
    file: (p) => ({ fsPath: p, scheme: 'file', path: p.replace(/\\/g, '/') }),
  },
  WorkspaceEdit: class {
    constructor() {
      this.ops = [];
    }
    replace(uri, range, text) {
      this.ops.push({ type: 'replace', uri, range, text });
    }
    insert(uri, pos, text) {
      this.ops.push({ type: 'insert', uri, pos, text });
    }
  },
  Range: class {
    constructor(a, b) {
      this.a = a;
      this.b = b;
    }
  },
  Position: class {},
  EndOfLine: { LF: 1, CRLF: 2 },
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') {
    return mockVscode;
  }
  return origLoad.apply(this, arguments);
};

const ext = require('../out/extension');
assert.strictEqual(typeof ext.activate, 'function');

// Activate and grab the command handlers.
const handlers = {};
mockVscode.commands.registerCommand = (cmd, h) => {
  handlers[cmd] = h;
  return { dispose() {} };
};
ext.activate({ subscriptions: [] });
assert.ok(handlers['addScene.addScene'], 'scene command registered');
assert.ok(handlers['addScene.addGameObject'], 'game object command registered');
assert.ok(handlers['addScene.addComponent'], 'component command registered');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'addscene-'));

function applyEditsToFile() {
  for (const edit of workspaceEdits) {
    for (const op of edit.ops) {
      if (op.type === 'insert') {
        const text = fs.readFileSync(op.uri.fsPath, 'utf8');
        const updated =
          text.slice(0, op.pos) + op.text + text.slice(op.pos);
        fs.writeFileSync(op.uri.fsPath, updated, 'utf8');
      }
    }
  }
}

function run(htmlContent, name, useArg, options = {}) {
  const command = options.command || 'addScene.addScene';
  const handler = handlers[command];
  assert.ok(handler, `handler for ${command}`);
  const htmlPath = path.join(tmpDir, 'index.html');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  if (options.scenesFolder) {
    fs.mkdirSync(path.join(tmpDir, 'scenes'), { recursive: true });
  }
  if (options.gameObjectsFolder) {
    fs.mkdirSync(path.join(tmpDir, 'gameObjects'), { recursive: true });
  }
  if (options.componentsFolder) {
    fs.mkdirSync(path.join(tmpDir, 'components'), { recursive: true });
  }
  workspaceEdits.length = 0;
  infoMessages.length = 0;
  openedDocuments.length = 0;
  inputBoxAnswer = useArg ? null : name;
  const uri = mockVscode.Uri.file(htmlPath);
  const promise = useArg
    ? handler(uri, name)
    : handler(uri);
  return promise.then(() => {
    applyEditsToFile();
    const jsDir = options.scenesFolder
      ? path.join(tmpDir, 'scenes')
      : options.gameObjectsFolder
      ? path.join(tmpDir, 'gameObjects')
      : options.componentsFolder
      ? path.join(tmpDir, 'components')
      : tmpDir;
    return {
      html: fs.readFileSync(htmlPath, 'utf8'),
      js: fs.existsSync(path.join(jsDir, `${name}.js`))
        ? fs.readFileSync(path.join(jsDir, `${name}.js`), 'utf8')
        : null,
      opened: openedDocuments.slice(),
    };
  });
}

const SCENE_FILE_CONTENT = [
  'class {NAME} extends Scene{',
  '    constructor(){',
  '        super()',
  '        //Camera.main.backgroundColor = "white"',
  '    }',
  '}',
  '',
].join('\n');

const GAME_OBJECT_FILE_CONTENT = [
  'class {NAME} extends GameObject{',
  '    constructor(){',
  '        super("{NAME}", [], "default")',
  '    }',
  '}',
  '',
].join('\n');

const COMPONENT_FILE_CONTENT = [
  'class {NAME} extends Component{',
  '    start(){',
  '        ',
  '    }',
  '}',
  '',
].join('\n');

function sceneContent(name) {
  return SCENE_FILE_CONTENT.replace(/\{NAME\}/g, name);
}

function gameObjectContent(name) {
  return GAME_OBJECT_FILE_CONTENT.replace(/\{NAME\}/g, name);
}

function componentContent(name) {
  return COMPONENT_FILE_CONTENT.replace(/\{NAME\}/g, name);
}

(async () => {
  // Case 1: normal HTML file, name provided via input box.
  const html1 = [
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
  ].join('\n');
  let r = await run(html1, 'myScene');
  if (errorMessages.length > 0) {
    console.error('unexpected error messages:', errorMessages);
  }
  assert.strictEqual(r.js, sceneContent('myScene'), 'scene file content');
  assert.ok(
    r.html.includes('<script src="myScene.js"></script>\n</body>'),
    'script tag inserted before </body>'
  );
  assert.strictEqual(infoMessages.length, 1, 'info message shown');
  assert.strictEqual(
    r.opened.length,
    1,
    'scene file opened in an editor'
  );
  assert.ok(
    r.opened[0].fsPath.endsWith('myScene.js'),
    'opened editor is the scene file'
  );

  // Case 2: indented </body>.
  const html2 = '<html>\n<body>\n    <p>hi</p>\n    </body>\n</html>';
  r = await run(html2, 'scene2');
  assert.ok(
    r.html.includes('    <script src="scene2.js"></script>\n    </body>'),
    'indented insertion'
  );

  // Case 3: no </body> tag.
  const html3 = '<html><body>hi</html>';
  r = await run(html3, 'scene3');
  assert.ok(
    r.html.endsWith('<script src="scene3.js"></script>\n'),
    'appended at end when no </body>'
  );

  // Case 4: invalid name passed as argument -> warning, no files created.
  const html4 = '<html><body></body></html>';
  warnMessages.length = 0;
  r = await run(html4, '1bad', true);
  assert.strictEqual(r.js, null, 'no js file for invalid name');
  assert.strictEqual(r.html, html4, 'html unchanged for invalid name');
  assert.ok(
    warnMessages.some((m) => m.includes('Scene name')),
    'warning shown for invalid name'
  );

  // Case 5: non-html uri -> warning.
  warnMessages.length = 0;
  await handlers['addScene.addScene'](
    mockVscode.Uri.file(path.join(tmpDir, 'notes.txt'))
  );
  assert.strictEqual(warnMessages.length, 1, 'warning for non-html');

  // Case 6: name passed as command argument (no input box).
  const html6 = '<html>\n<body>\n  <p>x</p>\n</body>\n</html>';
  r = await run(html6, 'argScene', true);
  assert.strictEqual(r.js, sceneContent('argScene'), 'arg scene file content');
  assert.ok(
    r.html.includes('<script src="argScene.js"></script>\n</body>'),
    'arg insertion'
  );

  // Case 7: scenes folder exists -> file placed there, src points into it.
  const html7 = '<html>\n<body>\n  <p>y</p>\n</body>\n</html>';
  r = await run(html7, 'folderScene', true, { scenesFolder: true });
  assert.strictEqual(
    r.js,
    sceneContent('folderScene'),
    'scene file content in scenes folder'
  );
  assert.ok(
    r.html.includes('<script src="scenes/folderScene.js"></script>'),
    'script tag points into scenes folder'
  );
  assert.ok(
    r.opened[0].fsPath.endsWith(path.join('scenes', 'folderScene.js')),
    'opened editor is the scenes-folder file'
  );

  // Case 8: Game-Specific Scenes comment -> tag directly after it.
  const html8 = [
    '<html>',
    '<body>',
    '  <!-- Game-Specific Scenes -->',
    '  <script src="existing.js"></script>',
    '</body>',
    '</html>',
  ].join('\n');
  r = await run(html8, 'commentScene', true);
  const lines8 = r.html.split('\n');
  const cIdx = lines8.findIndex((l) => l.includes('Game-Specific Scenes'));
  assert.ok(cIdx >= 0, 'comment still present');
  assert.strictEqual(
    lines8[cIdx + 1],
    '  <script src="commentScene.js"></script>',
    'tag directly after the comment'
  );

  // Case 9: Add Game Object -> GameObject file, tag before </body>.
  const html9 = '<html>\n<body>\n  <p>go</p>\n</body>\n</html>';
  r = await run(html9, 'myObject', true, { command: 'addScene.addGameObject' });
  assert.strictEqual(
    r.js,
    gameObjectContent('myObject'),
    'game object file content'
  );
  assert.ok(
    r.html.includes('<script src="myObject.js"></script>\n</body>'),
    'game object tag before </body>'
  );
  assert.ok(
    r.opened[0].fsPath.endsWith('myObject.js'),
    'opened editor is the game object file'
  );

  // Case 10: gameObjects folder + Game-Specific Game Objects comment.
  const html10 = [
    '<html>',
    '<body>',
    '  <!-- Game-Specific Game Objects -->',
    '  <script src="existing.js"></script>',
    '</body>',
    '</html>',
  ].join('\n');
  r = await run(html10, 'folderObject', true, {
    command: 'addScene.addGameObject',
    gameObjectsFolder: true,
  });
  assert.strictEqual(
    r.js,
    gameObjectContent('folderObject'),
    'game object file content in gameObjects folder'
  );
  const lines10 = r.html.split('\n');
  const gIdx = lines10.findIndex((l) =>
    l.includes('Game-Specific Game Objects')
  );
  assert.ok(gIdx >= 0, 'game objects comment still present');
  assert.strictEqual(
    lines10[gIdx + 1],
    '  <script src="gameObjects/folderObject.js"></script>',
    'tag directly after the game objects comment'
  );

  // Case 11: Add Component -> Component file, tag before </body>.
  const html11 = '<html>\n<body>\n  <p>comp</p>\n</body>\n</html>';
  r = await run(html11, 'myComponent', true, { command: 'addScene.addComponent' });
  assert.strictEqual(
    r.js,
    componentContent('myComponent'),
    'component file content'
  );
  assert.ok(
    r.html.includes('<script src="myComponent.js"></script>\n</body>'),
    'component tag before </body>'
  );
  assert.ok(
    r.opened[0].fsPath.endsWith('myComponent.js'),
    'opened editor is the component file'
  );

  // Case 12: components folder + Game-Specific Components comment.
  const html12 = [
    '<html>',
    '<body>',
    '  <!-- Game-Specific Components -->',
    '  <script src="existing.js"></script>',
    '</body>',
    '</html>',
  ].join('\n');
  r = await run(html12, 'folderComponent', true, {
    command: 'addScene.addComponent',
    componentsFolder: true,
  });
  assert.strictEqual(
    r.js,
    componentContent('folderComponent'),
    'component file content in components folder'
  );
  const lines12 = r.html.split('\n');
  const cIdx12 = lines12.findIndex((l) =>
    l.includes('Game-Specific Components')
  );
  assert.ok(cIdx12 >= 0, 'components comment still present');
  assert.strictEqual(
    lines12[cIdx12 + 1],
    '  <script src="components/folderComponent.js"></script>',
    'tag directly after the components comment'
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('E2E verification: all cases passed.');
})().catch((err) => {
  console.error('E2E verification FAILED:', err);
  process.exit(1);
});
