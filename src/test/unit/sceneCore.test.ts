import * as assert from 'assert';
import {
  validateSceneName,
  findBodyCloseOffset,
  findScriptInsertOffset,
  getBodyIndent,
  buildScriptSrc,
  buildScriptTag,
  insertScriptTag,
  buildSceneFileContent,
  buildGameObjectFileContent,
  buildComponentFileContent,
  GAME_OBJECT_COMMENT_MARKER,
  COMPONENT_COMMENT_MARKER,
} from '../../sceneCore';

suite('validateSceneName', () => {
  test('accepts valid identifiers', () => {
    assert.strictEqual(validateSceneName('myScene'), undefined);
    assert.strictEqual(validateSceneName('Scene1'), undefined);
    assert.strictEqual(validateSceneName('_private'), undefined);
    assert.strictEqual(validateSceneName('$dollar'), undefined);
    assert.strictEqual(validateSceneName('  padded  '), undefined);
  });

  test('rejects invalid names', () => {
    assert.ok(validateSceneName(''));
    assert.ok(validateSceneName('   '));
    assert.ok(validateSceneName('1starts'));
    assert.ok(validateSceneName('has space'));
    assert.ok(validateSceneName('has-dash'));
    assert.ok(validateSceneName('has.dot'));
  });
});

suite('findBodyCloseOffset', () => {
  test('finds </body> offset', () => {
    const html = '<html><body></body></html>';
    assert.strictEqual(findBodyCloseOffset(html), 12);
  });

  test('is case-insensitive', () => {
    const html = '<html><body></BODY></html>';
    assert.strictEqual(findBodyCloseOffset(html), 12);
  });

  test('returns end of text when no </body>', () => {
    const html = '<html><body><p>hi</p></html>';
    assert.strictEqual(findBodyCloseOffset(html), html.length);
  });
});

suite('findScriptInsertOffset', () => {
  test('inserts at line start above </body>', () => {
    const html = '<html>\n<body>\n  <p>hi</p>\n</body>\n</html>';
    const offset = findScriptInsertOffset(html);
    assert.strictEqual(html.indexOf('</body>'), 26);
    assert.strictEqual(offset, 26);
  });

  test('keeps indentation of </body> line', () => {
    const html = '<html>\n<body>\n  <p>hi</p>\n  </body>\n</html>';
    const offset = findScriptInsertOffset(html);
    assert.strictEqual(offset, html.indexOf('  </body>'));
  });

  test('falls back to end when no </body>', () => {
    const html = '<html><body>hi</html>';
    assert.strictEqual(findScriptInsertOffset(html), html.length);
  });
});

suite('getBodyIndent', () => {
  test('returns indentation of </body> line', () => {
    const html = '<html>\n<body>\n  <p>hi</p>\n  </body>\n</html>';
    assert.strictEqual(getBodyIndent(html), '  ');
  });

  test('returns empty when unindented', () => {
    const html = '<html>\n<body>\n</body>\n</html>';
    assert.strictEqual(getBodyIndent(html), '');
  });
});

suite('buildScriptSrc', () => {
  test('points at the html folder by default', () => {
    assert.strictEqual(buildScriptSrc('myScene'), 'myScene.js');
  });

  test('points into the scenes folder when given', () => {
    assert.strictEqual(buildScriptSrc('myScene', 'scenes'), 'scenes/myScene.js');
  });
});

suite('buildScriptTag', () => {
  test('builds tag with src and indent', () => {
    assert.strictEqual(
      buildScriptTag('myScene.js', '  '),
      '  <script src="myScene.js"></script>\n'
    );
  });

  test('defaults to no indent', () => {
    assert.strictEqual(
      buildScriptTag('foo.js'),
      '<script src="foo.js"></script>\n'
    );
  });

  test('supports CRLF line endings', () => {
    assert.strictEqual(
      buildScriptTag('foo.js', '', '\r\n'),
      '<script src="foo.js"></script>\r\n'
    );
  });

  test('builds tag for a scenes-folder src', () => {
    assert.strictEqual(
      buildScriptTag('scenes/foo.js'),
      '<script src="scenes/foo.js"></script>\n'
    );
  });
});

suite('insertScriptTag', () => {
  test('inserts indented tag before </body> when no scene comment', () => {
    const html = [
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
    const result = insertScriptTag(html, 'myScene.js');
    const expected = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '  <title>Test</title>',
      '</head>',
      '<body>',
      '  <h1>Hello</h1>',
      '<script src="myScene.js"></script>',
      '</body>',
      '</html>',
      '',
    ].join('\n');
    assert.strictEqual(result, expected);
  });

  test('inserts directly after a Game-Specific Scenes comment', () => {
    const html = [
      '<body>',
      '  <!-- Game-Specific Scenes -->',
      '  <script src="other.js"></script>',
      '</body>',
    ].join('\n');
    const result = insertScriptTag(html, 'myScene.js');
    const expected = [
      '<body>',
      '  <!-- Game-Specific Scenes -->',
      '  <script src="myScene.js"></script>',
      '  <script src="other.js"></script>',
      '</body>',
    ].join('\n');
    assert.strictEqual(result, expected);
  });

  test('matches the comment case-insensitively', () => {
    const html = '<body>\n<!-- game-specific SCENES -->\n</body>';
    const result = insertScriptTag(html, 's.js');
    assert.strictEqual(
      result,
      '<body>\n<!-- game-specific SCENES -->\n<script src="s.js"></script>\n</body>'
    );
  });

  test('uses the first matching comment when several exist', () => {
    const html = [
      '<body>',
      '<!-- Game-Specific Scenes -->',
      '<!-- Game-Specific Scenes (older) -->',
      '</body>',
    ].join('\n');
    const result = insertScriptTag(html, 's.js');
    assert.strictEqual(
      result,
      [
        '<body>',
        '<!-- Game-Specific Scenes -->',
        '<script src="s.js"></script>',
        '<!-- Game-Specific Scenes (older) -->',
        '</body>',
      ].join('\n')
    );
  });

  test('inserts after the comment even when it is before </body>', () => {
    const html = [
      '<body>',
      '  <h1>Hi</h1>',
      '  <!-- Game-Specific Scenes -->',
      '</body>',
    ].join('\n');
    const result = insertScriptTag(html, 's.js');
    assert.strictEqual(
      result,
      [
        '<body>',
        '  <h1>Hi</h1>',
        '  <!-- Game-Specific Scenes -->',
        '  <script src="s.js"></script>',
        '</body>',
      ].join('\n')
    );
  });

  test('appends a new line when the comment ends the file', () => {
    const html = '<body>\n  <!-- Game-Specific Scenes -->';
    const result = insertScriptTag(html, 's.js');
    assert.strictEqual(
      result,
      '<body>\n  <!-- Game-Specific Scenes -->\n  <script src="s.js"></script>\n'
    );
  });

  test('ignores comments without the marker', () => {
    const html = '<body>\n<!-- Other comment -->\n</body>';
    const result = insertScriptTag(html, 's.js');
    assert.strictEqual(
      result,
      '<body>\n<!-- Other comment -->\n<script src="s.js"></script>\n</body>'
    );
  });

  test('inserts with matching indentation', () => {
    const html = '<html>\n<body>\n    <p>hi</p>\n    </body>\n</html>';
    const result = insertScriptTag(html, 's.js');
    assert.strictEqual(
      result,
      '<html>\n<body>\n    <p>hi</p>\n    <script src="s.js"></script>\n    </body>\n</html>'
    );
  });

  test('appends at end when no </body>', () => {
    const html = '<html><body>hi</html>';
    const result = insertScriptTag(html, 'x.js');
    assert.strictEqual(
      result,
      '<html><body>hi</html><script src="x.js"></script>\n'
    );
  });
});

suite('buildSceneFileContent', () => {
  test('builds the scene class stub', () => {
    assert.strictEqual(
      buildSceneFileContent('myScene'),
      [
        'class myScene extends Scene{',
        '    constructor(){',
        '        super()',
        '        //Camera.main.backgroundColor = "white"',
        '    }',
        '}',
        '',
      ].join('\n')
    );
  });
});

suite('buildGameObjectFileContent', () => {
  test('builds the game object class stub', () => {
    assert.strictEqual(
      buildGameObjectFileContent('myObject'),
      [
        'class myObject extends GameObject{',
        '    constructor(){',
        '        super("myObject", [], "default")',
        '    }',
        '}',
        '',
      ].join('\n')
    );
  });
});

suite('buildComponentFileContent', () => {
  test('builds the component class stub', () => {
    assert.strictEqual(
      buildComponentFileContent('myComponent'),
      [
        'class myComponent extends Component{',
        '    start(){',
        '        ',
        '    }',
        '}',
        '',
      ].join('\n')
    );
  });
});

suite('game object insertion', () => {
  test('inserts directly after a Game-Specific Game Objects comment', () => {
    const html = [
      '<body>',
      '  <!-- Game-Specific Game Objects -->',
      '  <script src="existing.js"></script>',
      '</body>',
    ].join('\n');
    const result = insertScriptTag(
      html,
      'gameObjects/myObject.js',
      GAME_OBJECT_COMMENT_MARKER
    );
    const expected = [
      '<body>',
      '  <!-- Game-Specific Game Objects -->',
      '  <script src="gameObjects/myObject.js"></script>',
      '  <script src="existing.js"></script>',
      '</body>',
    ].join('\n');
    assert.strictEqual(result, expected);
  });

  test('falls back to before </body> without the comment', () => {
    const html = '<body>\n  <p>hi</p>\n</body>';
    const result = insertScriptTag(
      html,
      'myObject.js',
      GAME_OBJECT_COMMENT_MARKER
    );
    assert.strictEqual(
      result,
      '<body>\n  <p>hi</p>\n<script src="myObject.js"></script>\n</body>'
    );
  });

  test('scene and game object markers are independent', () => {
    const html = [
      '<body>',
      '  <!-- Game-Specific Scenes -->',
      '  <!-- Game-Specific Game Objects -->',
      '</body>',
    ].join('\n');
    const sceneResult = insertScriptTag(html, 's.js');
    assert.ok(
      sceneResult.includes(
        '<!-- Game-Specific Scenes -->\n  <script src="s.js"></script>'
      ),
      'scene tag after the scenes comment'
    );
    const goResult = insertScriptTag(
      html,
      'go.js',
      GAME_OBJECT_COMMENT_MARKER
    );
    assert.ok(
      goResult.includes(
        '<!-- Game-Specific Game Objects -->\n  <script src="go.js"></script>'
      ),
      'game object tag after the game objects comment'
    );
  });

  test('component marker inserts after the components comment', () => {
    const html = [
      '<body>',
      '  <!-- Game-Specific Components -->',
      '  <script src="existing.js"></script>',
      '</body>',
    ].join('\n');
    const result = insertScriptTag(
      html,
      'components/myComponent.js',
      COMPONENT_COMMENT_MARKER
    );
    const expected = [
      '<body>',
      '  <!-- Game-Specific Components -->',
      '  <script src="components/myComponent.js"></script>',
      '  <script src="existing.js"></script>',
      '</body>',
    ].join('\n');
    assert.strictEqual(result, expected);
  });

  test('component falls back to before </body> without the comment', () => {
    const html = '<body>\n  <p>hi</p>\n</body>';
    const result = insertScriptTag(
      html,
      'myComponent.js',
      COMPONENT_COMMENT_MARKER
    );
    assert.strictEqual(
      result,
      '<body>\n  <p>hi</p>\n<script src="myComponent.js"></script>\n</body>'
    );
  });
});
