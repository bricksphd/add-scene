# CS2510 Game Engine

[![CI](https://github.com/bricksphd/add-scene/actions/workflows/ci.yml/badge.svg)](https://github.com/bricksphd/add-scene/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A VS Code extension that adds game-scaffolding commands to the Explorer context menu. It scaffolds Scenes, Game Objects, and Components for the CS2510 JavaScript game engine (the engine is bundled in the `templates/` game templates), keeping `<script>` tags in sync as you create, rename, and delete classes.

## Features

- Right-click a `.js` file and choose **Rename Class** to rename a class, its file, and the `<script src>` tags that reference it in one step. The menu reads **Rename Component**, **Rename GameObject**, or **Rename Scene** for files inside a `components`, `gameObjects`, or `scenes` folder. For a class that extends `GameObject`, a string passed as the first `super()` argument that equals the class name is renamed too. It only works when the file defines exactly one class and that class has the same name as the file; otherwise a message explains why nothing happened. HTML files are searched in the workspace folder (or, outside a workspace, the folder above the file's folder).
- Right-click a `.js` file and choose **Delete Class** (shown as **Delete Component**, **Delete GameObject**, or **Delete Scene** for files inside a `components`, `gameObjects`, or `scenes` folder) to delete the file and remove every `<script src>` tag that references it (the whole line when the tag is alone on it). It asks for confirmation first and has the same one-class-named-like-the-file requirement as Rename Class.
- Right-click a folder named `games` in the Explorer and choose **Create New Game**. Select a template from the folders in `templates/`; its contents are copied into a new folder of the same name inside the selected folder (`empty`, or `empty2`, `empty3`, ... if that name is taken). Existing files are never overwritten.
- Right-click a `.html` file in the Explorer (or an open `.html` editor) and choose **Add Scene**, **Add Game Object**, or **Add Component**. You are prompted for a name (a valid JavaScript identifier). The three options appear together in their own section of the context menu.
  - A new `[name].js` class stub is created (extending `Scene`, `GameObject`, or `Component`). It is placed in a `scenes`, `gameObjects`, or `components` subfolder when one exists next to the HTML file, otherwise next to the HTML file.
  - A `<script src="...">` tag for the new file is inserted directly after an HTML comment containing **"Game-Specific Scenes"**, **"Game-Specific Game Objects"**, or **"Game-Specific Components"** (case-insensitive) when one exists, otherwise just before `</body>`.
  - The new file is opened in the editor and receives focus.

Example stubs:

```js
class myScene extends Scene{
    constructor(){
        super("white")
        //this.instantiate(new MainController())
    }
}

class myObject extends GameObject{
    constructor(){
        super("myObject", [], "default")
        //this.addComponent(new Polygon(), {fillStyle: 'magenta', points: Assets.triangle})
        //this.addComponent(new myObjectController())
        //this.transform.scale = new Vector2(1,1)
    }
}

class myComponent extends Component{
    start(){
        
    }
    update(){
        
    }
}
```
## Usage

To create a game from a template:

1. Right-click a folder named `games` in the Explorer and select **Create New Game**.
2. Select a template name. The template folder is copied into the selected
   folder (numbered, e.g. `empty2`, if the name already exists).

To add a scene, game object, or component:

1. Right-click a `.html` file.
2. Select **Add Scene**, **Add Game Object**, or **Add Component**.
3. Enter a name (a valid JavaScript identifier, e.g. `myScene`).
4. The file is created (in the matching folder when present), the script
   tag is added to the HTML file, and the new file opens with focus.

To rename or delete a class:

1. Right-click a `.js` file that defines one class named like the file.
2. Select **Rename Class** (or **Component**/**GameObject**/**Scene**) and
   enter the new name, or select **Delete ...** and confirm.
3. The class, file name, `super("Name")` string (GameObjects), and the
   `<script src>` tags in HTML files are updated or removed.

## Install

Install from the VS Code Marketplace, or from a downloaded `.vsix`:

```bash
code --install-extension cs2510-game-engine-0.0.2.vsix
```

## Notes

- If the HTML file has no `</body>` tag, the script tag is appended at the end of the file.
- The Add Scene, Add Game Object, and Add Component commands are only shown for `.html` files (`resourceExtname == '.html'`).
- Create New Game is only shown when right-clicking a local folder named `games` in the Explorer. Template names come from the subfolders of `templates/`.
- Rename/Delete commands are only shown for `.js` files. Their labels depend on the parent folder name (`components`, `gameObjects`, `scenes`), since menu conditions cannot read file contents.
- Menu titles use emoji prefixes because VS Code ignores icons in context menus.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, and how to run the extension. Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Privacy

No telemetry is collected and no network requests are made.

## License

[MIT](LICENSE)
