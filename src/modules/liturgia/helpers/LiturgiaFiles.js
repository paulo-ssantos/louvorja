// Non-persisted runtime registry for File objects (browser File API).
// File objects are not serializable, so they live here — not in appdata/userdata.
// After a page reload the registry is empty; rows show a re-attach prompt.

const registry = new Map()
const urls = new Map()

export default {
  /** Store a File under its item id. */
  register(id, file) {
    registry.set(id, file)
  },

  /** Returns true when a live File handle exists for the given id. */
  has(id) {
    return registry.has(id)
  },

  /** Returns the stored File or undefined. */
  get(id) {
    return registry.get(id)
  },

  /**
   * Creates (or recreates) a fresh object URL for the stored File.
   * Revokes the previous URL for this id first to avoid memory leaks.
   * Returns null when no File is registered for the id.
   */
  objectUrl(id) {
    const old = urls.get(id)
    if (old) URL.revokeObjectURL(old)
    const f = registry.get(id)
    if (!f) return null
    const u = URL.createObjectURL(f)
    urls.set(id, u)
    return u
  },

  /**
   * Derives a human-readable kind from a File's MIME type and name.
   * Returns one of: 'video' | 'audio' | 'image' | 'document'
   */
  kindFromFile(file) {
    const m = (file.type || '').toLowerCase()
    const n = (file.name || '').toLowerCase()
    if (m.startsWith('video/') || /\.(mp4|mov|mkv|avi|webm)$/.test(n)) return 'video'
    if (m.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(n)) return 'audio'
    if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return 'image'
    return 'document'
  },

  /**
   * Plays audio via a dedicated hidden <audio> element that lives on document.body.
   * Creates the element on first call.
   */
  playAudio(url) {
    let el = document.getElementById('__liturgia_audio')
    if (!el) {
      el = document.createElement('audio')
      el.id = '__liturgia_audio'
      document.body.appendChild(el)
    }
    el.src = url
    el.play().catch(() => {})
  },

  /** Pauses the hidden audio element and clears its src. */
  stopAudio() {
    const el = document.getElementById('__liturgia_audio')
    if (el) {
      el.pause()
      el.removeAttribute('src')
    }
  },

  /** Opens a document/unknown file in a new browser tab. */
  openDocument(url) {
    window.open(url, '_blank')
  },
}
