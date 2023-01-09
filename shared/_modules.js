import url from "node:url";

export class MetaModule {
  /**
   * Module URL.
   * @type {string}
   */
  url;
}

export class Module {
  /**
   * @type {MetaModule}
   */
  meta;
}

/**
 *
 * @param {MetaModule} meta.
 * @returns {string} Module directory (parent) path.
 */
export function parent(meta) {
  return url.fileURLToPath(meta.url.substring(0, meta.url.lastIndexOf("/")));
}

/**
 *
 * @param {MetaModule} meta.
 * @returns {string} Module directory name.
 */
export function dirname(meta) {
  const parentPath = parent(meta);
  return parentPath.substring(parentPath.indexOf("/") + 1);
}

/**
 *
 * @param {MetaModule} meta.
 * @returns {string} Module filename.
 */
export function filename(meta) {
  return meta.url.split("/").slice(-1)[0];
}

/**
 *
 * @param {MetaModule} meta.
 * @returns {string} Module basename (filename without extension).
 */
export function basename(meta) {
  return filename(meta).split(".")[0];
}
