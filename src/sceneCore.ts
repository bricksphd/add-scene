/**
 * Pure (VS Code-independent) logic for the Add Scene extension.
 * Kept separate so it can be unit-tested without launching VS Code.
 */

/** Matches a valid JavaScript identifier (scene name). */
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Marker text (matched case-insensitively) that anchors scene script tags. */
export const SCENE_COMMENT_MARKER = 'game-specific scenes';

/** Marker text (matched case-insensitively) that anchors game object tags. */
export const GAME_OBJECT_COMMENT_MARKER = 'game-specific game objects';

/** Marker text (matched case-insensitively) that anchors component tags. */
export const COMPONENT_COMMENT_MARKER = 'game-specific components';

/**
 * Validates a scene name. Returns an error message, or undefined when valid.
 */
export function validateSceneName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Scene name is required.';
  }
  if (!IDENTIFIER_RE.test(trimmed)) {
    return 'Scene name must start with a letter (or _ or $) and contain only letters, digits, _ or $.';
  }
  return undefined;
}

/**
 * Finds the offset of the closing </body> tag (case-insensitive),
 * or the end of the text when no </body> tag exists.
 */
export function findBodyCloseOffset(html: string): number {
  const match = /<\/body\s*>/i.exec(html);
  if (!match) {
    return html.length;
  }
  return match.index;
}

/**
 * Computes the insertion offset for the script tag: the start of the line
 * containing </body> (so the tag is placed on its own line above it).
 */
export function findScriptInsertOffset(html: string): number {
  const bodyClose = findBodyCloseOffset(html);
  let start = bodyClose;
  while (start > 0 && (html[start - 1] === ' ' || html[start - 1] === '\t')) {
    start--;
  }
  if (start > 0 && html[start - 1] !== '\n') {
    // </body> is not at the start of its line; insert right before the tag.
    return bodyClose;
  }
  return start;
}

/**
 * Extracts the indentation of the line containing </body>.
 */
export function getBodyIndent(html: string): string {
  const bodyClose = findBodyCloseOffset(html);
  const lineStart = html.lastIndexOf('\n', bodyClose - 1) + 1;
  const indentMatch = /^[ \t]*/.exec(html.slice(lineStart, bodyClose));
  return indentMatch ? indentMatch[0] : '';
}

/**
 * Builds the src attribute for the scene script tag. When a scenes folder
 * name is given, the src points into that folder (forward slashes so the
 * tag works when served over HTTP on any platform).
 */
export function buildScriptSrc(name: string, scenesFolder?: string): string {
  return scenesFolder ? `${scenesFolder}/${name}.js` : `${name}.js`;
}

/**
 * Builds the script tag line for a scene src, using the given indentation
 * and line ending.
 */
export function buildScriptTag(src: string, indent = '', eol = '\n'): string {
  return `${indent}<script src="${src}"></script>${eol}`;
}

/** Where and what to insert for a scene script tag. */
export interface ScriptTagInsertion {
  /** Offset in the HTML text where the tag should be inserted. */
  offset: number;
  /** The exact text to insert (includes indentation and line ending). */
  text: string;
}

/** Location of a marker comment such as "Game-Specific Scenes". */
interface CommentLocation {
  /** Offset just after the comment's closing "-->". */
  commentEnd: number;
  /** Indentation of the line the comment starts on. */
  indent: string;
  /** True when non-whitespace content follows the comment on its line. */
  sameLine: boolean;
  /** Offset of the start of the line after the comment (own-line only). */
  nextLineStart: number;
}

/**
 * Finds the first comment containing the given marker text
 * (case-insensitive). Returns undefined when the HTML has no such comment.
 */
export function findMarkerComment(
  html: string,
  marker: string
): CommentLocation | undefined {
  const commentRe = /<!--([\s\S]*?)-->/gi;
  let match: RegExpExecArray | null;
  while ((match = commentRe.exec(html)) !== null) {
    if (!match[1].toLowerCase().includes(marker.toLowerCase())) {
      continue;
    }
    const commentEnd = match.index + match[0].length;
    const lineStart = html.lastIndexOf('\n', match.index) + 1;
    const indentMatch = /^[ \t]*/.exec(html.slice(lineStart, match.index));
    const indent = indentMatch ? indentMatch[0] : '';

    // Skip spaces/tabs after "-->" to see what else shares the line.
    let i = commentEnd;
    while (i < html.length && (html[i] === ' ' || html[i] === '\t')) {
      i++;
    }
    if (i < html.length && html[i] !== '\n' && html[i] !== '\r') {
      return { commentEnd, indent, sameLine: true, nextLineStart: i };
    }
    // Own-line comment (or comment at end of file): tag goes on next line.
    const nextLineStart =
      i + 1 < html.length && html[i] === '\r' && html[i + 1] === '\n'
        ? i + 2
        : i + 1;
    return { commentEnd, indent, sameLine: false, nextLineStart };
  }
  return undefined;
}

/**
 * Finds the first comment containing "Game-Specific Scenes"
 * (case-insensitive). Returns undefined when the HTML has no such comment.
 */
export function findSceneComment(html: string): CommentLocation | undefined {
  return findMarkerComment(html, SCENE_COMMENT_MARKER);
}

/**
 * Plans the script tag insertion: directly after the marker comment when
 * present, otherwise just before </body> (or at the end of the file when
 * there is no </body> tag).
 */
export function planScriptTagInsertion(
  html: string,
  src: string,
  eol = '\n',
  marker = SCENE_COMMENT_MARKER
): ScriptTagInsertion {
  const comment = findMarkerComment(html, marker);
  if (comment) {
    if (comment.sameLine) {
      // Content follows on the comment's line: append the tag right after it.
      return { offset: comment.commentEnd, text: buildScriptTag(src, '', '') };
    }
    if (comment.commentEnd >= html.length) {
      // The comment ends the file: start a new line for the tag.
      return {
        offset: comment.commentEnd,
        text: eol + buildScriptTag(src, comment.indent, eol),
      };
    }
    // Own-line comment: put the tag on the line below, same indentation.
    return {
      offset: comment.nextLineStart,
      text: buildScriptTag(src, comment.indent, eol),
    };
  }
  return {
    offset: findScriptInsertOffset(html),
    text: buildScriptTag(src, getBodyIndent(html), eol),
  };
}

/**
 * Inserts the script tag into the HTML text: directly after the marker
 * comment when present, otherwise just before </body>.
 */
export function insertScriptTag(html: string, src: string, marker?: string): string {
  const { offset, text } = planScriptTagInsertion(html, src, '\n', marker);
  return html.slice(0, offset) + text + html.slice(offset);
}

/**
 * Builds the contents for a new scene JS file.
 */
export function buildSceneFileContent(name: string): string {
  return [
    `class ${name} extends Scene{`,
    '    constructor(){',
    '        super("white")',
    '        //this.instantiate(new MainController())',
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Builds the contents for a new game object JS file.
 */
export function buildGameObjectFileContent(name: string): string {
  return [
    `class ${name} extends GameObject{`,
    '    constructor(){',
    `        super("${name}", [], "default")`,
    `        //this.addComponent(new Polygon(), {fillStyle: 'magenta', points: Asssets.triangle})`,
    `        //this.addComponent(new ${name}Controller)`,
    `        //this.transform.scale = new Vector2(1,1)`,
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Builds the contents for a new component JS file.
 */
export function buildComponentFileContent(name: string): string {
  return [
    `class ${name} extends Component{`,
    '    start(){',
    '        ',
    '    }',
    '    update(){',
    '        ',
    '    }',
    '}',
    '',
  ].join('\n');
}

/** A class declaration found in JavaScript source. */
export interface ClassDeclaration {
  name: string;
  /** Offset of the class name within the source text. */
  nameOffset: number;
}

/** Blanks out comments (keeping offsets) so they are not parsed as code. */
function blankComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
    m.replace(/[^\r\n]/g, ' ')
  );
}

/** Finds every `class Name` declaration in the source (comments ignored). */
export function findClassDeclarations(source: string): ClassDeclaration[] {
  const code = blankComments(source);
  const re = /(^|[^\w$.])class\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  const result: ClassDeclaration[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const name = match[2];
    result.push({ name, nameOffset: match.index + match[0].length - name.length });
  }
  return result;
}

/** A src attribute value of a <script> tag. */
export interface ScriptSrcRef {
  /** Offset of the first character of the value. */
  start: number;
  /** Offset just past the last character of the value. */
  end: number;
  value: string;
}

/** Finds the src values of all <script src="..."> tags (comments ignored). */
export function findScriptSrcRefs(html: string): ScriptSrcRef[] {
  const code = html.replace(/<!--[\s\S]*?-->/g, (m) =>
    m.replace(/[^\r\n]/g, ' ')
  );
  const tagRe = /<script\b[^>]*>/gi;
  const srcRe = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
  const refs: ScriptSrcRef[] = [];
  let tag: RegExpExecArray | null;
  while ((tag = tagRe.exec(code)) !== null) {
    const src = srcRe.exec(tag[0]);
    if (!src) {
      continue;
    }
    const value = src[1] !== undefined ? src[1] : src[2];
    const start = tag.index + src.index + src[0].length - 1 - value.length;
    refs.push({ start, end: start + value.length, value });
  }
  return refs;
}

/** Replaces the last path segment of a src value, keeping its folder. */
export function replaceSrcFileName(src: string, newFileName: string): string {
  const slash = src.lastIndexOf('/');
  return src.slice(0, slash + 1) + newFileName;
}

/**
 * For `class Name extends GameObject`, finds the string passed as the first
 * argument to super() when it equals the class name (e.g. super("Name", ...)).
 * Returns the offsets of the text inside the quotes, or undefined.
 */
export function findGameObjectNameString(
  source: string,
  className: string
): { start: number; end: number } | undefined {
  const code = blankComments(source);
  const escaped = className.replace(/\$/g, '\\$');
  const decl = new RegExp(
    `(^|[^\\w$.])class\\s+${escaped}\\s+extends\\s+GameObject(?![\\w$])`
  ).exec(code);
  if (!decl) {
    return undefined;
  }
  const rest = code.slice(decl.index + decl[0].length);
  const sup = new RegExp(`\\bsuper\\s*\\(\\s*(["'\`])${escaped}\\1`).exec(rest);
  if (!sup) {
    return undefined;
  }
  const start =
    decl.index + decl[0].length + sup.index + sup[0].length - 1 - className.length;
  return { start, end: start + className.length };
}

/**
 * Computes the range to delete so the whole <script src="..."></script> tag
 * containing the given src value disappears. When the tag is alone on its
 * line, the entire line (including its line break) is removed.
 */
export function planScriptTagRemoval(
  html: string,
  ref: ScriptSrcRef
): { start: number; end: number } {
  let start = html.toLowerCase().lastIndexOf('<script', ref.start);
  if (start < 0) {
    start = ref.start;
  }
  let end = html.indexOf('>', ref.end) + 1;
  const close = /<\/script\s*>/i.exec(html.slice(end));
  if (close && /^\s*$/.test(html.slice(end, end + close.index))) {
    end += close.index + close[0].length;
  }

  let lineStart = start;
  while (lineStart > 0 && (html[lineStart - 1] === ' ' || html[lineStart - 1] === '\t')) {
    lineStart--;
  }
  let lineEnd = end;
  while (lineEnd < html.length && (html[lineEnd] === ' ' || html[lineEnd] === '\t')) {
    lineEnd++;
  }
  const startsLine = lineStart === 0 || html[lineStart - 1] === '\n';
  const endsLine = lineEnd >= html.length || html[lineEnd] === '\n' || html[lineEnd] === '\r';
  if (startsLine && endsLine) {
    if (html[lineEnd] === '\r' && html[lineEnd + 1] === '\n') {
      lineEnd += 2;
    } else if (lineEnd < html.length) {
      lineEnd += 1;
    }
    return { start: lineStart, end: lineEnd };
  }
  return { start, end };
}
