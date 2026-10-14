import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  validateSceneName,
  findClassDeclarations,
  findGameObjectNameString,
  findScriptSrcRefs,
  planScriptTagRemoval,
  ScriptSrcRef,
  replaceSrcFileName,
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
    registerAddEntityCommand(COMPONENT),
    registerCreateNewGameCommand(context),
    ...[
      ['Class', 'Class'],
      ['Component', 'Component'],
      ['GameObject', 'GameObject'],
      ['Scene', 'Scene'],
    ].flatMap(([id, label]) => [
      registerRenameClassCommand(`addScene.rename${id}`, `Rename ${label}`),
      registerDeleteClassCommand(`addScene.delete${id}`, `Delete ${label}`),
    ])
  );
}

export function deactivate(): void {}

function registerCreateNewGameCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'addScene.createNewGame',
    async (uri?: vscode.Uri, templateNameArg?: unknown) => {
      if (!uri || uri.scheme !== 'file') {
        vscode.window.showWarningMessage(
          'Create New Game: please right-click a folder in the Explorer.'
        );
        return;
      }

      try {
        const targetStat = await fs.promises.stat(uri.fsPath);
        if (!targetStat.isDirectory()) {
          vscode.window.showWarningMessage(
            'Create New Game: please right-click a folder in the Explorer.'
          );
          return;
        }

        const templatesDir = path.join(context.extensionUri.fsPath, 'templates');
        const templates = (await fs.promises.readdir(templatesDir, {
          withFileTypes: true,
        }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort((a, b) => a.localeCompare(b));
        if (templates.length === 0) {
          throw new Error('No game templates are available.');
        }

        // The Explorer passes the selected URIs as the 2nd argument, so only
        // a string counts as an explicit template name.
        let templateName =
          typeof templateNameArg === 'string' ? templateNameArg : undefined;
        if (templateName !== undefined && !templates.includes(templateName)) {
          throw new Error(`Template "${templateName}" does not exist.`);
        }
        if (templateName === undefined) {
          templateName = await vscode.window.showQuickPick(templates, {
            placeHolder: 'Select a game template',
            title: 'Create New Game',
          });
        }
        if (!templateName) {
          return;
        }

        const templateDir = path.join(templatesDir, templateName);
        const destDir = uniqueFolderPath(uri.fsPath, templateName);
        await fs.promises.cp(templateDir, destDir, { recursive: true });
        vscode.window.showInformationMessage(
          `Create New Game: created "${path.basename(destDir)}" in ${path.basename(uri.fsPath)}.`
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Create New Game: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );
}

/** First free folder name: name, then name2, name3, ... */
function uniqueFolderPath(parentDir: string, name: string): string {
  let candidate = path.join(parentDir, name);
  for (let i = 2; fs.existsSync(candidate); i++) {
    candidate = path.join(parentDir, `${name}${i}`);
  }
  return candidate;
}
function registerRenameClassCommand(
  commandId: string,
  title: string
): vscode.Disposable {
  return vscode.commands.registerCommand(
    commandId,
    async (uri?: vscode.Uri, newNameArg?: unknown) => {
      const fileUri = uri && uri.scheme === 'file' ? uri : undefined;
      if (!fileUri || !fileUri.path.toLowerCase().endsWith('.js')) {
        vscode.window.showWarningMessage(`${title}: please right-click a .js file.`);
        return;
      }

      try {
        const oldName = path.basename(fileUri.fsPath, '.js');
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const classes = findClassDeclarations(doc.getText());
        if (classes.length !== 1 || classes[0].name !== oldName) {
          vscode.window.showWarningMessage(
            `${title}: the file must define exactly one class, named "${oldName}" like the file.`
          );
          return;
        }

        const dir = path.dirname(fileUri.fsPath);
        const validate = (value: string): string | undefined => {
          const error = validateSceneName(value);
          if (error) {
            return error;
          }
          const name = value.trim();
          if (name !== oldName && fs.existsSync(path.join(dir, `${name}.js`))) {
            return `A file named "${name}.js" already exists in this folder.`;
          }
          return undefined;
        };

        let newName: string | undefined;
        if (typeof newNameArg === 'string') {
          const error = validate(newNameArg);
          if (error) {
            vscode.window.showWarningMessage(`${title}: ${error}`);
            return;
          }
          newName = newNameArg.trim();
        } else {
          newName = await vscode.window.showInputBox({
            prompt: `Enter the new name for class ${oldName}`,
            value: oldName,
            validateInput: validate,
          });
          newName = newName?.trim();
        }
        if (!newName || newName === oldName) {
          return;
        }

        const edit = new vscode.WorkspaceEdit();
        await addClassRenameEdits(edit, doc, classes[0].nameOffset, oldName, newName);

        const newUri = vscode.Uri.file(path.join(dir, `${newName}.js`));
        const updatedTags = await addScriptTagEdits(edit, fileUri, newName);

        // Apply and save text edits before renaming so none are lost in the move.
        if (!(await vscode.workspace.applyEdit(edit))) {
          throw new Error('Failed to apply the rename.');
        }
        await vscode.workspace.saveAll(false);
        for (const [entryUri] of edit.entries()) {
          const entryDoc = await vscode.workspace.openTextDocument(entryUri);
          if (entryDoc.isDirty) {
            await entryDoc.save();
          }
        }

        const renameEdit = new vscode.WorkspaceEdit();
        renameEdit.renameFile(fileUri, newUri);
        if (!(await vscode.workspace.applyEdit(renameEdit))) {
          throw new Error('Failed to rename the file.');
        }
        vscode.window.showInformationMessage(
          `${title}: renamed ${oldName} to ${newName} and updated ${updatedTags} script tag(s).`
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `${title}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );
}

/**
 * Adds the class rename to the edit, using the language's rename provider
 * (which also updates references in other files) and falling back to a
 * whole-word replacement within the file.
 */
async function addClassRenameEdits(
  edit: vscode.WorkspaceEdit,
  doc: vscode.TextDocument,
  nameOffset: number,
  oldName: string,
  newName: string
): Promise<void> {
  // A GameObject's name string (first super() argument) is not touched by the
  // language rename, so update it explicitly.
  const nameString = findGameObjectNameString(doc.getText(), oldName);
  if (nameString) {
    edit.replace(
      doc.uri,
      new vscode.Range(
        doc.positionAt(nameString.start),
        doc.positionAt(nameString.end)
      ),
      newName
    );
  }
  const insideNameString = (offset: number): boolean =>
    !!nameString && offset >= nameString.start && offset < nameString.end;

  let provided: vscode.WorkspaceEdit | undefined;
  try {
    provided = await vscode.commands.executeCommand<vscode.WorkspaceEdit | undefined>(
      'vscode.executeDocumentRenameProvider',
      doc.uri,
      doc.positionAt(nameOffset),
      newName
    );
  } catch {
    provided = undefined;
  }
  if (provided && provided.entries().length > 0) {
    for (const [entryUri, edits] of provided.entries()) {
      for (const textEdit of edits) {
        if (
          entryUri.fsPath === doc.uri.fsPath &&
          insideNameString(doc.offsetAt(textEdit.range.start))
        ) {
          continue;
        }
        edit.replace(entryUri, textEdit.range, textEdit.newText);
      }
    }
    return;
  }

  const text = doc.getText();
  const wordRe = new RegExp(`(?<![\\w$])${oldName.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
  let match: RegExpExecArray | null;
  while ((match = wordRe.exec(text)) !== null) {
    if (insideNameString(match.index)) {
      continue;
    }
    edit.replace(
      doc.uri,
      new vscode.Range(
        doc.positionAt(match.index),
        doc.positionAt(match.index + oldName.length)
      ),
      newName
    );
  }
}

/** Recursively lists .html files under a folder, skipping tooling folders. */
async function listHtmlFiles(dir: string): Promise<string[]> {
  const skip = new Set(['node_modules', '.git', '.vscode-test', 'out']);
  const result: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) {
        result.push(...(await listHtmlFiles(full)));
      }
    } else if (entry.name.toLowerCase().endsWith('.html')) {
      result.push(full);
    }
  }
  return result;
}

/** A <script src> in an HTML file that points at a given JS file. */
interface ScriptReference {
  htmlUri: vscode.Uri;
  htmlDoc: vscode.TextDocument;
  ref: ScriptSrcRef;
}

/** Finds every <script src> in the project's HTML files that points at the file. */
async function findScriptReferences(fileUri: vscode.Uri): Promise<ScriptReference[]> {
  const target = path.resolve(fileUri.fsPath).toLowerCase();
  // Search the workspace folder holding the file, else the folder above the
  // file's own folder (e.g. the game root for scenes/Foo.js).
  const root =
    vscode.workspace.getWorkspaceFolder(fileUri)?.uri.fsPath ??
    path.dirname(path.dirname(fileUri.fsPath));
  const found: ScriptReference[] = [];
  for (const htmlPath of await listHtmlFiles(root)) {
    const htmlUri = vscode.Uri.file(htmlPath);
    const htmlDoc = await vscode.workspace.openTextDocument(htmlUri);
    for (const ref of findScriptSrcRefs(htmlDoc.getText())) {
      if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(ref.value)) {
        continue; // absolute URL
      }
      let resolved: string;
      try {
        resolved = path
          .resolve(path.dirname(htmlUri.fsPath), decodeURIComponent(ref.value))
          .toLowerCase();
      } catch {
        continue; // malformed escape sequence
      }
      if (resolved === target) {
        found.push({ htmlUri, htmlDoc, ref });
      }
    }
  }
  return found;
}

/** Adds edits for every <script src> that points at the file; returns the count. */
async function addScriptTagEdits(
  edit: vscode.WorkspaceEdit,
  fileUri: vscode.Uri,
  newName: string
): Promise<number> {
  const refs = await findScriptReferences(fileUri);
  for (const { htmlUri, htmlDoc, ref } of refs) {
    edit.replace(
      htmlUri,
      new vscode.Range(htmlDoc.positionAt(ref.start), htmlDoc.positionAt(ref.end)),
      replaceSrcFileName(ref.value, `${newName}.js`)
    );
  }
  return refs.length;
}

function registerDeleteClassCommand(
  commandId: string,
  title: string
): vscode.Disposable {
  return vscode.commands.registerCommand(
    commandId,
    async (uri?: vscode.Uri, confirmedArg?: unknown) => {
      const fileUri = uri && uri.scheme === 'file' ? uri : undefined;
      if (!fileUri || !fileUri.path.toLowerCase().endsWith('.js')) {
        vscode.window.showWarningMessage(`${title}: please right-click a .js file.`);
        return;
      }

      try {
        const name = path.basename(fileUri.fsPath, '.js');
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const classes = findClassDeclarations(doc.getText());
        if (classes.length !== 1 || classes[0].name !== name) {
          vscode.window.showWarningMessage(
            `${title}: the file must define exactly one class, named "${name}" like the file.`
          );
          return;
        }

        const refs = await findScriptReferences(fileUri);
        if (confirmedArg !== true) {
          const choice = await vscode.window.showWarningMessage(
            `Delete class ${name}? This deletes ${name}.js and removes ${refs.length} script tag(s) from HTML files.`,
            { modal: true },
            'Delete'
          );
          if (choice !== 'Delete') {
            return;
          }
        }

        // Remove from the end of each file so earlier offsets stay valid.
        const edit = new vscode.WorkspaceEdit();
        const ordered = [...refs].sort((a, b) => b.ref.start - a.ref.start);
        for (const { htmlUri, htmlDoc, ref } of ordered) {
          const range = planScriptTagRemoval(htmlDoc.getText(), ref);
          edit.delete(
            htmlUri,
            new vscode.Range(htmlDoc.positionAt(range.start), htmlDoc.positionAt(range.end))
          );
        }
        if (refs.length > 0 && !(await vscode.workspace.applyEdit(edit))) {
          throw new Error('Failed to remove the script tags.');
        }
        for (const htmlUri of new Set(refs.map((r) => r.htmlUri.fsPath))) {
          const htmlDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(htmlUri));
          if (htmlDoc.isDirty) {
            await htmlDoc.save();
          }
        }

        const deleteEdit = new vscode.WorkspaceEdit();
        deleteEdit.deleteFile(fileUri);
        if (!(await vscode.workspace.applyEdit(deleteEdit))) {
          throw new Error('Failed to delete the file.');
        }
        vscode.window.showInformationMessage(
          `${title}: deleted ${name}.js and removed ${refs.length} script tag(s).`
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `${title}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );
}
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
