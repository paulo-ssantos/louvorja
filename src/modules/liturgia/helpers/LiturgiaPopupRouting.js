/**
 * LiturgiaPopupRouting.js
 * Centralizes popup window routing logic for the Liturgia module.
 * OWNED BY ENGINEER B. Package A imports restorePopup/onPopupModuleChanged/openTelao.
 * Package B calls ensurePopup from executeItem/_executeFileItem.
 *
 * State is kept in $appdata (non-persisted):
 *   modules.liturgia.popup_routed         bool
 *   modules.liturgia.popup_return_module  string|null
 */

import $appdata from '@/helpers/AppData'
import $userdata from '@/helpers/UserData'
import $popup from '@/helpers/Popup'

// ─── private helpers ──────────────────────────────────────────────────────────

function getPopupWindow() {
  return $appdata.get('popup', null)
}

function isPopupOpen() {
  const w = getPopupWindow()
  return w && !w.closed
}

function isAutoOpenEnabled() {
  return $userdata.get('modules.liturgia.config.auto_open_popup', true)
}

function setRouted(val) {
  $appdata.set('modules.liturgia.popup_routed', val)
}

function getRouted() {
  return $appdata.get('modules.liturgia.popup_routed', false)
}

function setReturnModule(mod) {
  $appdata.set('modules.liturgia.popup_return_module', mod)
}

function getReturnModule() {
  return $appdata.get('modules.liturgia.popup_return_module', 'presenter')
}

function getCurrentModule() {
  return $appdata.get('popup_module', null)
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Ensures the popup window is showing the target module.
 *
 * Behavior matrix:
 *   popup OPEN & module !== target:
 *     - capture popup_return_module ONLY if popup_routed is currently false
 *     - $popup.open({module:target}) (focuses the existing window)
 *     - set popup_routed=true iff target==='media'
 *   popup CLOSED & auto_open ON:
 *     - $popup.open({module:target})
 *     - if window.open returned null -> blocked snackbar, return {blocked:true}
 *     - playback continues regardless
 *   popup CLOSED & auto_open OFF:
 *     - no open; emit one-time hint with 'Abrir telão' action
 *   target==='presenter' never sets popup_routed.
 *
 * @param {'media'|'presenter'} target
 * @param {Object} opts
 * @param {Function} [opts.showSnackbar]  — function(text, action?) to show snackbar
 * @param {Function} [opts.t]             — translation function t(key)
 * @returns {{ opened: boolean, blocked: boolean, routed: boolean }}
 */
export async function ensurePopup(target, opts = {}) {
  const { showSnackbar, t } = opts
  const result = { opened: false, blocked: false, routed: false }

  if (isPopupOpen()) {
    const currentModule = getCurrentModule()
    if (currentModule !== target) {
      // Capture return module only when we are not already routed
      if (!getRouted()) {
        setReturnModule(currentModule || 'presenter')
      }
      await $popup.open({ module: target })
      result.opened = true
    }
    if (target === 'media') {
      setRouted(true)
      result.routed = true
    }
  } else {
    // Popup is closed
    if (isAutoOpenEnabled()) {
      // Capture return module before opening
      if (!getRouted()) {
        setReturnModule('presenter')
      }
      await $popup.open({ module: target })
      // Check if the window actually opened (null = blocked by browser)
      const w = getPopupWindow()
      if (!w || w.closed) {
        result.blocked = true
        if (showSnackbar && t) {
          showSnackbar(t('modules.liturgia.routing.popup_blocked'))
        }
        return result
      }
      result.opened = true
      if (target === 'media') {
        setRouted(true)
        result.routed = true
      }
    } else {
      // Auto-open is OFF — do not open, show one-time hint
      if (showSnackbar && t) {
        showSnackbar(t('modules.liturgia.routing.popup_hint'), {
          label: t('modules.liturgia.routing.open_telao'),
          action: openTelao,
        })
      }
    }
  }

  return result
}

/**
 * Restores the popup to popup_return_module after a media session ends.
 * Uses a DIRECT $appdata.set (no window.open) per the architect decision.
 * Called by A's Index.vue on mediaVisible true->false.
 */
export function restorePopup() {
  if (!getRouted()) return
  const returnModule = getReturnModule()
  $appdata.set('popup_module', returnModule || 'presenter')
  setRouted(false)
}

/**
 * Safety guard: clears popup_routed when an external actor routes the popup
 * away from 'media'. Called by A's popup_module watcher.
 *
 * @param {string} newModule — the new popup_module value
 */
export function onPopupModuleChanged(newModule) {
  if (newModule !== 'media') {
    setRouted(false)
  }
}

/**
 * Opens (or focuses) the popup on the presenter module.
 * Used by the "Abrir telão" action in the routing hint snackbar.
 */
export function openTelao() {
  $popup.open({ module: 'presenter' })
}
