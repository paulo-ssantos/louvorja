/**
 * LiturgiaFileConfig.js  — STUB (Package B owns the real implementation)
 *
 * This stub is created by Package A so that LiturgiaFileConfigDialog.vue can
 * import KINDS / KIND_META / ALLOWED / HANDLERS / DEFAULTS / restoreDefaults
 * before Package B delivers the real file.
 *
 * CONTRACT (do not edit; B overwrites this file entirely):
 *   KINDS        string[]   — ordered list: ['video','audio','image','pdf','text','document']
 *   HANDLERS     Object     — { popup, hidden_audio, tab, download } -> pt.json sub-key
 *   ALLOWED      Object     — { kind: ['handler', ...], [0]=default }
 *   DEFAULTS     Object     — { kind: handlerId }
 *   KIND_META    Object     — { kind: { icon, color, label } }
 *   resolveHandler(kind)    -> handlerId (validated; falls back to default)
 *   restoreDefaults()       -> void
 */

import $userdata from '@/helpers/UserData';

export const KINDS = ['video', 'audio', 'image', 'pdf', 'text', 'document'];

export const HANDLERS = {
  popup:        'handler_popup',
  hidden_audio: 'handler_hidden',
  tab:          'handler_tab',
  download:     'handler_download',
};

// ALLOWED[kind] — index 0 is the default
export const ALLOWED = {
  video:    ['popup', 'tab', 'download'],
  audio:    ['hidden_audio', 'tab', 'download'],
  image:    ['popup', 'tab', 'download'],
  pdf:      ['popup', 'tab', 'download'],
  text:     ['popup', 'tab', 'download'],
  document: ['download', 'tab'],
};

export const DEFAULTS = {
  video:    'popup',
  audio:    'hidden_audio',
  image:    'popup',
  pdf:      'popup',
  text:     'popup',
  document: 'download',
};

export const KIND_META = {
  video:    { icon: 'mdi-video',         color: '#E53935', label: 'kind_video' },
  audio:    { icon: 'mdi-music-note',    color: '#8E24AA', label: 'kind_audio' },
  image:    { icon: 'mdi-image',         color: '#43A047', label: 'kind_image' },
  pdf:      { icon: 'mdi-file-pdf-box',  color: '#E64A19', label: 'kind_pdf' },
  text:     { icon: 'mdi-text-box',      color: '#039BE5', label: 'kind_text' },
  document: { icon: 'mdi-file-document', color: '#F4511E', label: 'kind_document' },
};

export function resolveHandler(kind) {
  const key = `modules.liturgia.file_handlers.${kind}`;
  const val = $userdata.get(key, null);
  const allowed = ALLOWED[kind] || [];
  if (val && allowed.includes(val)) return val;
  return DEFAULTS[kind] || 'download';
}

export function restoreDefaults() {
  for (const kind of KINDS) {
    $userdata.set(`modules.liturgia.file_handlers.${kind}`, DEFAULTS[kind]);
  }
  $userdata.save();
}
