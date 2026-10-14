import * as assert from 'assert';
import {
  validateSceneName,
  findClassDeclarations,
  findGameObjectNameString,
  findScriptSrcRefs,
  planScriptTagRemoval,
  replaceSrcFileName,
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
        '        super("white")',
        '        //this.instantiate(new MainController())',
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
        "        //this.addComponent(new Polygon(), {fillStyle: 'magenta', points: Asssets.triangle})",
        '        //this.addComponent(new myObjectController)',
        '        //this.transform.scale = new Vector2(1,1)',
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
        '    update(){',
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

suite('findClassDeclarations', () => {
  test('finds a single class and its name offset', () => {
    const src = 'class Foo extends Scene{}\n';
    assert.deepStrictEqual(findClassDeclarations(src), [{ name: 'Foo', nameOffset: 6 }]);
  });

  test('finds multiple classes', () => {
    const names = findClassDeclarations('class A{}\nclass B{}').map((c) => c.name);
    assert.deepStrictEqual(names, ['A', 'B']);
  });

  test('ignores comments and member access', () => {
    const src = '// class Old{}\n/* class Older{} */\nclass Foo{ x(){ return this.class } }';
    assert.deepStrictEqual(findClassDeclarations(src).map((c) => c.name), ['Foo']);
  });
});

suite('findScriptSrcRefs', () => {
  test('finds src values with offsets', () => {
    const html = '<script src="scenes/A.js"></script>';
    const [ref] = findScriptSrcRefs(html);
    assert.strictEqual(ref.value, 'scenes/A.js');
    assert.strictEqual(html.slice(ref.start, ref.end), 'scenes/A.js');
  });

  test('supports single quotes and ignores comments and srcless tags', () => {
    const html = "<!-- <script src=\"x.js\"></script> --><script>1</script><script type='module' src='b.js'></script>";
    assert.deepStrictEqual(findScriptSrcRefs(html).map((r) => r.value), ['b.js']);
  });
});

suite('replaceSrcFileName', () => {
  test('keeps the folder', () => {
    assert.strictEqual(replaceSrcFileName('./scenes/A.js', 'B.js'), './scenes/B.js');
  });

  test('works without a folder', () => {
    assert.strictEqual(replaceSrcFileName('A.js', 'B.js'), 'B.js');
  });
});
suite('findGameObjectNameString', () => {
  test('finds the name string in super() of a GameObject', () => {
    const src = 'class Foo extends GameObject{\n  constructor(){\n    super("Foo", [], "default")\n  }\n}';
    const r = findGameObjectNameString(src, 'Foo')!;
    assert.strictEqual(src.slice(r.start, r.end), 'Foo');
    assert.strictEqual(src[r.start - 1], '"');
  });

  test('supports single quotes', () => {
    const src = "class Foo extends GameObject{ constructor(){ super('Foo') } }";
    assert.ok(findGameObjectNameString(src, 'Foo'));
  });

  test('ignores a different string, a non-GameObject class, and comments', () => {
    assert.strictEqual(findGameObjectNameString('class Foo extends GameObject{ constructor(){ super("Bar") } }', 'Foo'), undefined);
    assert.strictEqual(findGameObjectNameString('class Foo extends Scene{ constructor(){ super("Foo") } }', 'Foo'), undefined);
    assert.strictEqual(findGameObjectNameString('class Foo extends GameObject{ constructor(){ // super("Foo")\n super("x") } }', 'Foo'), undefined);
  });
});

suite('planScriptTagRemoval', () => {
  const remove = (html: string): string => {
    const [ref] = findScriptSrcRefs(html);
    const { start, end } = planScriptTagRemoval(html, ref);
    return html.slice(0, start) + html.slice(end);
  };

  test('removes the whole line when the tag is alone on it', () => {
    assert.strictEqual(
      remove('<body>\n  <script src="a.js"></script>\n</body>'),
      '<body>\n</body>'
    );
  });

  test('handles CRLF line endings', () => {
    assert.strictEqual(
      remove('<body>\r\n  <script src="a.js"></script>\r\n</body>'),
      '<body>\r\n</body>'
    );
  });

  test('removes only the tag when other content shares the line', () => {
    assert.strictEqual(
      remove('<p>x</p><script src="a.js"></script><p>y</p>'),
      '<p>x</p><p>y</p>'
    );
  });
});