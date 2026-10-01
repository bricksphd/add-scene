import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  validateSceneName,
  planScriptTagInsertion,
  buildScriptSrc,
  buildSceneFileContent,
  buildGameObjectFileContent,
  buildComponentFileContent,
  SCENE_COMMENT_MARKER,
  GAME_OBJECT_COMMENT_MARKER,
  COMPONENT_COMMENT_MARKER,
} from './sceneCore';

/** Describes one kind of addable entity (scene or game object). */
interface EntityKind {
  /** Command id, e.g. addScene.addScene. */
  commandId: string;
  /** Human-readable label used in prompts and messages. */
  label: string;
  /** Name placeholder shown in the input box. */
  placeHolder: string;
  /** Folder next to the HTML file that receives the new file. */
  folder: string;
  /** Comment marker that anchors the script tag, when present. */
  commentMarker: string;
  /** Builds the contents of the new JS file. */
  buildContent: (name: string) => string;
}

const SCENE: EntityKind = {
  commandId: 'addScene.addScene',
  label: 'Add Scene',
  placeHolder: 'myScene',
  folder: 'scenes',
  commentMarker: SCENE_COMMENT_MARKER,
  buildContent: buildSceneFileContent,
};

const GAME_OBJECT: EntityKind = {
  commandId: 'addScene.addGameObject',
  label: 'Add Game Object',
  placeHolder: 'myGameObject',
  folder: 'gameObjects',
  commentMarker: GAME_OBJECT_COMMENT_MARKER,
  buildContent: buildGameObjectFileContent,
};

const COMPONENT: EntityKind = {
  commandId: 'addScene.addComponent',
  label: 'Add Component',
  placeHolder: 'myComponent',
  folder: 'components',
  commentMarker: COMPONENT_COMMENT_MARKER,
  buildContent: buildComponentFileContent,
};

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    registerAddEntityCommand(SCENE),
    registerAddEntityCommand(GAME_OBJECT),
    registerAddEntityCommand(COMPONENT)
  );
}

export function deactivate(): void {}

function registerAddEntityCommand(kind: EntityKind): vscode.Disposable {
  return vscode.commands.registerCommand(
    kind.commandId,
    async (uri?: vscode.Uri, nameArg?: string) => {
      const htmlUri = resolveHtmlUri(uri);
      if (!htmlUri) {
        vscode.window.showWarningMessage(
          `${kind.label}: please right-click an .html file.`
        );
        return;
      }

      let name: string | undefined;
      if (typeof nameArg === 'string') {
        // A name was passed explicitly (e.g. keybinding arg or test).
        const error = validateInput(kind, nameArg, htmlUri);
        if (error) {
          vscode.window.showWarningMessage(`${kind.label}: ${error}`);
          return;
        }
        name = nameArg.trim();
      } else {
        name = await vscode.window.showInputBox({
          prompt: `Enter the name of the ${kind.label.replace('Add ', '').toLowerCase()}`,
          placeHolder: kind.placeHolder,
          validateInput: (value) => validateInput(kind, value, htmlUri),
        });
      }
      if (!name) {
        return; // cancelled by the user
      }

      try {
        await addEntity(kind, htmlUri, name);
        vscode.window.showInformationMessage(
          `${kind.label}: created ${name}.js and added a script tag to ${path.basename(htmlUri.fsPath)}.`
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `${kind.label}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );
}

function validateInput(
  kind: EntityKind,
  value: string,
  htmlUri: vscode.Uri
): string | undefined {
  const error = validateSceneName(value);
  if (error) {
    return error;
  }
  const jsPath = entityJsPath(kind, htmlUri, value.trim());
  if (fs.existsSync(jsPath)) {
    return `A file named "${value.trim()}.js" already exists in this folder.`;
  }
  return undefined;
}

/** The folder that receives new files of this kind: its folder when it exists. */
function entityTargetDir(kind: EntityKind, htmlUri: vscode.Uri): string {
  const htmlDir = path.dirname(htmlUri.fsPath);
  const dir = path.join(htmlDir, kind.folder);
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory()
    ? dir
    : htmlDir;
}

/** Absolute path of the entity JS file for the given HTML file and name. */
function entityJsPath(
  kind: EntityKind,
  htmlUri: vscode.Uri,
  name: string
): string {
  return path.join(entityTargetDir(kind, htmlUri), `${name}.js`);
}

function resolveHtmlUri(uri?: vscode.Uri): vscode.Uri | undefined {
  if (uri && uri.scheme === 'file' && uri.path.toLowerCase().endsWith('.html')) {
    return uri;
  }
  const activeEditor = vscode.window.activeTextEditor;
  if (
    activeEditor &&
    activeEditor.document.uri.scheme === 'file' &&
    activeEditor.document.fileName.toLowerCase().endsWith('.html')
  ) {
    return activeEditor.document.uri;
  }
  return undefined;
}

async function addEntity(
  kind: EntityKind,
  htmlUri: vscode.Uri,
  name: string
): Promise<void> {
  const htmlDir = path.dirname(htmlUri.fsPath);
  const targetDir = entityTargetDir(kind, htmlUri);
  const jsPath = path.join(targetDir, `${name}.js`);
  const folder =
    targetDir === htmlDir ? undefined : kind.folder;

  // Create the new file with the class stub.
  await fs.promises.writeFile(jsPath, kind.buildContent(name), 'utf8');

  // Insert <script src="..."> directly after the kind's marker comment when
  // present, otherwise just before </body>. Respects the document's line
  // endings and points at the new file's folder.
  const htmlDoc = await vscode.workspace.openTextDocument(htmlUri);
  const text = htmlDoc.getText();
  const eol = htmlDoc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  const { offset, text: insertText } = planScriptTagInsertion(
    text,
    buildScriptSrc(name, folder),
    eol,
    kind.commentMarker
  );
  const edit = new vscode.WorkspaceEdit();
  edit.insert(htmlUri, htmlDoc.positionAt(offset), insertText);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    throw new Error('Failed to insert the script tag into the HTML file.');
  }
  await htmlDoc.save();

  // Open the new file and give it keyboard focus.
  const jsDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(jsPath));
  await vscode.window.showTextDocument(jsDoc, { preview: false });
}
