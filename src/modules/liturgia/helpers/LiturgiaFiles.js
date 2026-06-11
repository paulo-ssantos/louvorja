// Non-persisted runtime registry for File objects (browser File API).
// File objects are not serializable, so they live here — not in appdata/userdata.
// After a page reload the registry is empty; rows show a re-attach prompt.

const registry = new Map()
const urls = new Map()

/** Registered ended-callback for the hidden audio element. */
let _audioEndedCb = null

// ─── registry ────────────────────────────────────────────────────────────────

/** Store a File under its item id. */
function register(id, file) {
  registry.set(id, file)
}

/** Returns true when a live File handle exists for the given id. */
function has(id) {
  return registry.has(id)
}

/** Returns the stored File or undefined. */
function get(id) {
  return registry.get(id)
}

/**
 * Creates (or recreates) a fresh object URL for the stored File.
 * Revokes the previous URL for this id first to avoid memory leaks.
 * Returns null when no File is registered for the id.
 */
function objectUrl(id) {
  const old = urls.get(id)
  if (old) URL.revokeObjectURL(old)
  const f = registry.get(id)
  if (!f) return null
  const u = URL.createObjectURL(f)
  urls.set(id, u)
  return u
}

// ─── 6-kind detection ────────────────────────────────────────────────────────

/**
 * Derives the storage kind from a File's MIME type and name extension.
 * Returns one of: 'video' | 'audio' | 'image' | 'pdf' | 'text' | 'document'
 *
 * Priority: MIME prefix > MIME exact > extension.
 */
function kindFromFile(file) {
  const m = (file.type || '').toLowerCase()
  const n = (file.name || '').toLowerCase()

  // video/* or common video extensions
  if (m.startsWith('video/') || /\.(mp4|m4v|mov|mkv|avi|webm|mpg|mpeg)$/.test(n)) return 'video'

  // audio/* or common audio extensions
  if (m.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|weba|mid|midi)$/.test(n)) return 'audio'

  // image/* or common image extensions
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(n)) return 'image'

  // PDF
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'

  // text/* or plain text extensions
  if (m.startsWith('text/') || /\.(txt|md|log)$/.test(n)) return 'text'

  // everything else (pptx, ppt, docx, doc, xlsx, odp, key, etc.)
  return 'document'
}

/**
 * Re-derives the kind from the live File and, when it differs from
 * item.file_ref, mutates file_ref in place (kind, mime, name) and returns
 * the corrected file_ref. When nothing changes, returns the existing file_ref.
 *
 * Call this at every execution and at re-attach so stale cycle-2 items
 * (e.g. stored kind='document' but actually an mp3) self-heal.
 *
 * @param {Object} item  — the full liturgia item (mutated in place)
 * @param {File}   file  — the live File object
 * @returns {Object}     — the (possibly updated) file_ref
 */
function rederiveAndHeal(item, file) {
  const newKind = kindFromFile(file)
  const ref = item.file_ref || {}
  const changed =
    ref.kind !== newKind ||
    ref.mime !== (file.type || '') ||
    ref.name !== (file.name || '')

  if (changed) {
    item.file_ref = {
      ...ref,
      kind: newKind,
      mime: file.type || '',
      name: file.name || ref.name || '',
    }
  }

  return item.file_ref
}

// ─── audio lifecycle ─────────────────────────────────────────────────────────

function _getOrCreateAudioEl() {
  let el = document.getElementById('__liturgia_audio')
  if (!el) {
    el = document.createElement('audio')
    el.id = '__liturgia_audio'
    // Attach ended listener ONCE so the caller can clear now_playing
    el.addEventListener('ended', () => {
      if (typeof _audioEndedCb === 'function') {
        _audioEndedCb()
      }
    })
    document.body.appendChild(el)
  }
  return el
}

/**
 * Registers a callback that is fired when the hidden audio element's
 * 'ended' event fires. Only one callback is active at a time.
 *
 * @param {Function|null} cb
 */
function onAudioEnded(cb) {
  _audioEndedCb = cb
}

/**
 * Plays audio via the dedicated hidden <audio> element (#__liturgia_audio).
 * Separate from the media engine's #__audio element.
 */
function playAudio(url) {
  const el = _getOrCreateAudioEl()
  el.src = url
  el.play().catch(() => {})
}

/** Pauses the hidden audio element and clears its src. */
function stopAudio() {
  const el = document.getElementById('__liturgia_audio')
  if (el) {
    el.pause()
    el.removeAttribute('src')
  }
  _audioEndedCb = null
}

// ─── file dispatch helpers ────────────────────────────────────────────────────

/**
 * Programmatic download that preserves the original filename.
 * window.open(blobUrl) yields a GUID filename; this approach keeps the name.
 *
 * @param {string} url  — object URL or data URL
 * @param {string} name — desired filename
 */
function download(url, name) {
  const a = document.createElement('a')
  a.href = url
  a.download = name || 'download'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Opens a URL in a new browser tab.
 * For non-renderable types the browser will download the file — accepted.
 *
 * @param {string} url
 */
function tab(url) {
  window.open(url, '_blank')
}

/** @deprecated Use tab() instead. Kept for any remaining callers. */
function openDocument(url) {
  tab(url)
}

// ─── export ──────────────────────────────────────────────────────────────────

export default {
  register,
  has,
  get,
  objectUrl,
  kindFromFile,
  rederiveAndHeal,
  onAudioEnded,
  playAudio,
  stopAudio,
  download,
  tab,
  openDocument,
}
