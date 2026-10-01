# Add Scene

A VS Code extension that adds an **Add Scene** command to the context menu of `.html` files.

## Features

- Right-click a `.html` file in the Explorer (or an open `.html` editor) and choose **Add Scene**, **Add Game Object**, or **Add Component**. The three options appear together in their own section of the context menu, separated from the other entries by a divider.
- You are prompted for the name.
- A new file `[name].js` is created:
  - **Add Scene** — a scene class stub:
    ```js
    class myScene extends Scene{
        constructor(){
            super()
            //Camera.main.backgroundColor = "white"
        }
    }
    ```
  - **Add Game Object** — a game object class stub:
    ```js
    class myObject extends GameObject{
        constructor(){
            super("myObject", [], "default")
        }
    }
    ```
  - **Add Component** — a component class stub:
    ```js
    class myComponent extends Component{
        start(){
            
        }
    }
    ```
  - It is placed in a `scenes` (resp. `gameObjects`, `components`) subfolder
    when one exists next to the HTML file, otherwise next to the HTML file.
- A `<script src="...">` element pointing at the new file is inserted:
  - directly after an HTML comment containing **"Game-Specific Scenes"**
    (resp. **"Game-Specific Game Objects"**, **"Game-Specific
    Components"**), case-insensitive, when such a comment exists,
  - otherwise just before the `</body>` tag of the HTML file.
  The src points at `scenes/[name].js` (resp. `gameObjects/[name].js`,
  `components/[name].js`) when the folder is used.
- The new file is opened in the editor and receives keyboard focus.

## Usage

1. Right-click a `.html` file.
2. Select **Add Scene**, **Add Game Object**, or **Add Component**.
3. Enter a name (a valid JavaScript identifier, e.g. `myScene`).
4. The file is created (in the matching folder when present), the script
   tag is added to the HTML file, and the new file opens with focus.

## Development

```bash
npm install
npm run compile         # TypeScript -> out/
npm test                # unit tests (mocha)
npm run test:integration  # integration tests in a real VS Code instance
```

### Running the extension (F5)

Press `F5` ("Run Extension") to launch an Extension Development Host.

> **VS Code 1.139.x bug:** F5 may hang with *"Extension host did not start in
> 10 seconds"* and the extension's commands will do nothing. This is
> [microsoft/vscode#338110](https://github.com/microsoft/vscode/issues/338110):
> the built-in debugger attaches via `localhost`, which resolves IPv6-first
> (`::1`), while the paused extension host inspector listens on `127.0.0.1`
> only. Fixed in js-debug 1.140, which ships with **VS Code 1.140.0** —
> updating VS Code resolves it.
>
> Workarounds on 1.139.x:
> 1. Use **Ctrl+F5** (Run Without Debugging) instead of F5 — the extension
>    host is not launched paused, so it starts normally.
> 2. Or use the **"Attach to Extension Host (VS Code 1.139 workaround)"**
>    launch configuration, which launches the host with
>    `--inspect-extensions=9230` (no pause) and attaches to `127.0.0.1`
>    explicitly. Full debugging (breakpoints) works with this setup.

A packaged `.vsix` can be installed via:
```bash
code --install-extension add-scene-0.0.1.vsix
```

## Notes

- If the HTML file has no `</body>` tag, the script tag is appended at the end of the file.
- The command is only shown for `.html` files (`resourceExtname == '.html'`).
