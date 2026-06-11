<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    compact
    @close="close()"
    @minimize="$modules.minimize(module_id)"
    @resize="resize"
    :index="show ? 1 : 0"
    size="large"
  >
    <!-- Ribbon header -->
    <template v-slot:header>
      <LiturgiaRibbon
        v-model:ribbon-tab="ribbonTab"
        :is-dark="isDark"
        :selected-count="selectedIds.length"
        :auto-mark-enabled="autoMarkEnabled"
        :note-panel-open="notePanelOpen"
        :time-tracking-enabled="timeTrackingEnabled"
        :planned-start="plannedStart"
        :active-day-index="activeDayIndex"
        :auto-open-popup="autoOpenPopup"
        @add-dialog="addDialog = true"
        @mark-all="markAll"
        @deselect-all="deselectAll"
        @invert-selection="invertSelection"
        @delete-selected="deleteSelected"
        @toggle-auto-mark="toggleAutoMark"
        @toggle-notes="toggleNotes"
        @export="onExport"
        @import="triggerImport"
        @toggle-time-tracking="toggleTimeTracking"
        @planned-start-change="onPlannedStartChange"
        @stop-item="stopCurrentItem"
        @show-report="showReport = true"
        @copy-tsv="onCopyTsv"
        @download-csv="onDownloadCsv"
        @reset-day="onResetDay"
        @open-file-config="showFileConfig = true"
        @toggle-auto-open-popup="toggleAutoOpenPopup"
        @open-telao="openTelao()"
        @restore-defaults="onRestoreDefaults"
      />

      <!-- Hidden file input for import -->
      <input
        ref="ljInput"
        type="file"
        accept=".lj,application/json"
        style="display:none"
        @change="onImportFile"
      />
    </template>

    <!-- Day tabs -->
    <v-tabs
      v-model="activeDayIndex"
      density="compact"
      height="32"
      show-arrows
      class="liturgia-day-tabs"
      @update:model-value="onDayChange"
    >
      <v-tab v-for="(label, i) in dayLabels" :key="i" :value="i">
        <v-icon :color="DAY_COLORS[i]" size="14" style="margin-right:6px;">mdi-calendar</v-icon>
        <span :style="i === todayIndex ? 'font-weight:600;' : ''">{{ label }}</span>
      </v-tab>
    </v-tabs>

    <!-- Time bar (read-only strip — kept above day list, ticks on all tabs) -->
    <LiturgiaTimeBar :day-index="activeDayIndex" />

    <!-- Day content -->
    <v-window v-model="activeDayIndex">
      <v-window-item v-for="i in 7" :key="i - 1" :value="i - 1">
        <LiturgiaDayView :day-index="i - 1" />
      </v-window-item>
    </v-window>

    <!-- Add item dialog -->
    <LiturgiaAddDialog v-model="addDialog" @add="onAddItem" />

    <!-- File config dialog -->
    <LiturgiaFileConfigDialog
      v-model="showFileConfig"
      @restored="restoredSnackbar = true"
    />

    <!-- Import confirm dialog -->
    <v-dialog v-model="importConfirm" max-width="420">
      <v-card>
        <v-card-title class="text-body-1 font-weight-bold pa-4">{{ t('backup.import') }}</v-card-title>
        <v-card-text>{{ t('import.confirm_overwrite') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="importConfirm = false">{{ t('import.cancel_btn') }}</v-btn>
          <v-btn color="error" variant="flat" @click="confirmImport">{{ t('import.confirm_btn') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Report dialog (Tempos tab ribbon button) -->
    <LiturgiaReportDialog
      v-model="showReport"
      :day-index="activeDayIndex"
    />

    <!-- Reset confirm dialog -->
    <v-dialog v-model="resetConfirm" max-width="380">
      <v-card>
        <v-card-text class="pt-4">{{ t('time.reset_confirm') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" size="small" @click="resetConfirm = false">{{ t('cancel_btn') }}</v-btn>
          <v-btn color="error" variant="flat" size="small" @click="confirmResetDay">{{ t('time.reset_btn') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Import error snackbar -->
    <v-snackbar v-model="importError" color="error" timeout="3000">
      {{ t('import.invalid') }}
    </v-snackbar>

    <!-- Delete undo snackbar (F8) -->
    <v-snackbar
      v-model="undoSnackbar"
      timeout="4000"
      color="default"
      location="bottom"
    >
      {{ undoMessage }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          size="small"
          @click="undoDelete"
        >
          {{ t('undo.action') }}
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Copy done snackbar -->
    <v-snackbar v-model="copySnack" color="success" timeout="1800" location="bottom">
      {{ t('time.copy_btn') }} ✓
    </v-snackbar>

    <!-- Defaults restored snackbar -->
    <v-snackbar v-model="restoredSnackbar" timeout="2000" location="bottom">
      {{ t('config.restored') }}
    </v-snackbar>

  </l-window>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import LiturgiaDayView from "./components/LiturgiaDayView.vue";
import LiturgiaAddDialog from "./components/LiturgiaAddDialog.vue";
import LiturgiaTimeBar from "./components/LiturgiaTimeBar.vue";
import LiturgiaReportDialog from "./components/LiturgiaReportDialog.vue";
import LiturgiaFileConfigDialog from "./components/LiturgiaFileConfigDialog.vue";
import LiturgiaRibbon from "./components/LiturgiaRibbon.vue";
import { exportLj, parseLj } from "../helpers/LiturgiaBackup.js";
import {
  isEnabled as timeTrackingIsEnabled,
  getPlannedStart,
  setPlannedStart,
  buildReportRows,
  toCsv,
  toTsv,
  resetDay,
  closeEntryForItem,
  getLog,
} from "../helpers/LiturgiaTimeTracking.js";
import {
  restorePopup,
  onPopupModuleChanged,
  openTelao,
} from "../helpers/LiturgiaPopupRouting.js";
import LiturgiaFiles from "../helpers/LiturgiaFiles.js";

const TODAY = new Date();
const WEEK_START = (() => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
})();

const DAY_COLORS = [
  '#c0392b',
  '#e67e22',
  '#f1c40f',
  '#27ae60',
  '#16a085',
  '#1a3a5c',
  '#2980b9',
];

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default {
  name: manifest.id,

  components: {
    LWindow,
    LiturgiaDayView,
    LiturgiaAddDialog,
    LiturgiaTimeBar,
    LiturgiaReportDialog,
    LiturgiaFileConfigDialog,
    LiturgiaRibbon,
  },

  data: () => ({
    width: 0,
    height: 0,
    addDialog: false,
    importConfirm: false,
    importError: false,
    pendingImport: null,
    DAY_COLORS,
    // Undo (F8)
    undoSnackbar: false,
    undoMessage: '',
    _deletedItems: null,
    _deletedDayIndex: null,
    // Report dialog
    showReport: false,
    // Reset confirm
    resetConfirm: false,
    // File config dialog
    showFileConfig: false,
    // Snackbars
    copySnack: false,
    restoredSnackbar: false,
  }),

  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        }
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    show() {
      return this.module.show;
    },

    isDark() {
      return this.$appdata.get('is_dark', false);
    },

    todayIndex() {
      return new Date().getDay();
    },

    dayLabels() {
      return [
        this.t('days_full.sun'),
        this.t('days_full.mon'),
        this.t('days_full.tue'),
        this.t('days_full.wed'),
        this.t('days_full.thu'),
        this.t('days_full.fri'),
        this.t('days_full.sat'),
      ];
    },

    activeDayIndex: {
      get() {
        return this.$appdata.get('modules.liturgia.active_day_index', 0);
      },
      set(val) {
        this.$appdata.set('modules.liturgia.active_day_index', val);
      },
    },

    ribbonTab: {
      get() {
        return this.$appdata.get('modules.liturgia.ribbon_tab', 'home');
      },
      set(val) {
        this.$appdata.set('modules.liturgia.ribbon_tab', val);
      },
    },

    notePanelOpen() {
      return this.$appdata.get('modules.liturgia.note_panel_open', false);
    },

    autoMarkEnabled() {
      return this.$appdata.get('modules.liturgia.auto_mark_enabled', false);
    },

    selectedIds() {
      return this.$appdata.get('modules.liturgia.selected_ids', []);
    },

    activeDayItems() {
      return this.$userdata.get(`modules.liturgia.days.${this.activeDayIndex}.items`, []);
    },

    // Time tracking
    timeTrackingEnabled() {
      return this.$userdata.get('modules.liturgia.time_tracking.enabled', false);
    },

    plannedStart() {
      return getPlannedStart(this.activeDayIndex);
    },

    nowPlaying() {
      return this.$appdata.get('modules.liturgia.now_playing', null);
    },

    // Popup routing
    mediaVisible() {
      return this.$appdata.get('modules.media.show', false)
          || this.$appdata.get('modules.media.minimized', false);
    },

    popupModule() {
      return this.$appdata.get('popup_module', '');
    },

    // Config
    autoOpenPopup() {
      return this.$userdata.get('modules.liturgia.config.auto_open_popup', true);
    },
  },

  watch: {
    // Restore popup when media closes (true->false transition)
    mediaVisible(val, old) {
      if (old && !val) restorePopup();
    },

    // Guard: notify routing helper when popup_module changes externally
    popupModule(val) {
      onPopupModuleChanged(val);
    },
  },

  created() {
    this.seedIfNeeded();
    // Initialize setIfNull for auto_open_popup
    if (this.$userdata.get('modules.liturgia.config.auto_open_popup', null) === null) {
      this.$userdata.set('modules.liturgia.config.auto_open_popup', true);
    }
    if (this.$appdata.get('modules.liturgia.active_day_index') == null) {
      this.$appdata.set('modules.liturgia.active_day_index', new Date().getDay());
    }
    // Always reset ribbon_tab to 'home' on app start
    this.$appdata.set('modules.liturgia.ribbon_tab', 'home');
  },

  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIAS - FIM */

    resize(data) {
      this.width = data.container_width;
      this.height = data.container_height;
    },

    close() {
      this.$modules.close(this.module_id);
    },

    seedIfNeeded() {
      const existing = this.$userdata.get('modules.liturgia.days');
      if (!existing) {
        const days = Array.from({ length: 7 }, (_, i) => ({
          day_index: i,
          notes: '',
          items: [],
        }));
        this.$userdata.set('modules.liturgia', {
          active_day: 0,
          week_start_date: WEEK_START,
          days,
          templates: [],
        });
      }
    },

    onDayChange(index) {
      this.$appdata.set('modules.liturgia.active_day_index', index);
    },

    toggleNotes() {
      this.$appdata.toogle('modules.liturgia.note_panel_open');
    },

    toggleAutoMark() {
      this.$appdata.toogle('modules.liturgia.auto_mark_enabled');
    },

    // Bulk selection operations
    markAll() {
      const ids = this.activeDayItems
        .filter(i => i.type !== 'category')
        .map(i => i.id);
      this.$appdata.set('modules.liturgia.selected_ids', ids);
    },

    deselectAll() {
      this.$appdata.set('modules.liturgia.selected_ids', []);
    },

    invertSelection() {
      const sel = new Set(this.selectedIds);
      const next = this.activeDayItems
        .filter(i => i.type !== 'category')
        .filter(i => !sel.has(i.id))
        .map(i => i.id);
      this.$appdata.set('modules.liturgia.selected_ids', next);
    },

    deleteSelected() {
      if (!this.selectedIds.length) return;
      const sel = new Set(this.selectedIds);
      const dayIdx = this.activeDayIndex;

      // Save snapshot for undo (F8)
      const snapshot = this.activeDayItems.slice();
      const count = this.selectedIds.length;

      const kept = this.activeDayItems
        .filter(i => !sel.has(i.id))
        .map((i, idx) => ({ ...i, order: idx }));

      this.$userdata.set(`modules.liturgia.days.${dayIdx}.items`, kept);
      this.$appdata.set('modules.liturgia.selected_ids', []);

      // Store undo data
      this._deletedItems = snapshot;
      this._deletedDayIndex = dayIdx;
      this.undoMessage = this.t('undo.deleted').replace('{n}', count);
      this.undoSnackbar = true;
    },

    undoDelete() {
      if (!this._deletedItems || this._deletedDayIndex === null) return;
      this.$userdata.set(
        `modules.liturgia.days.${this._deletedDayIndex}.items`,
        this._deletedItems
      );
      this._deletedItems = null;
      this._deletedDayIndex = null;
      this.undoSnackbar = false;
    },

    // Add item
    onAddItem(item) {
      const dayIdx = this.activeDayIndex;
      const items = this.$userdata.get(`modules.liturgia.days.${dayIdx}.items`, []);
      const withOrder = { ...item, order: items.length };
      this.$userdata.set(`modules.liturgia.days.${dayIdx}.items`, [...items, withOrder]);
    },

    // Export/Import
    onExport() {
      exportLj();
    },

    triggerImport() {
      this.$refs.ljInput.value = '';
      this.$refs.ljInput.click();
    },

    onImportFile(e) {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = parseLj(r.result);
          this.pendingImport = parsed;
          this.importConfirm = true;
        } catch {
          this.importError = true;
        }
      };
      r.readAsText(f);
      e.target.value = '';
    },

    confirmImport() {
      this.$userdata.set('modules.liturgia.days', this.pendingImport.days);
      this.$userdata.save();
      this.importConfirm = false;
      this.pendingImport = null;
    },

    // Time tracking
    toggleTimeTracking(val) {
      this.$userdata.set('modules.liturgia.time_tracking.enabled', !!val);
    },

    onPlannedStartChange(val) {
      setPlannedStart(this.activeDayIndex, val);
    },

    stopCurrentItem() {
      const np = this.nowPlaying;
      if (!np) return;
      LiturgiaFiles.stopAudio();
      closeEntryForItem(this.activeDayIndex, np.item_id);
      this.$appdata.set('modules.liturgia.now_playing', null);
    },

    // Report copy/CSV from ribbon
    async onCopyTsv() {
      const rows = buildReportRows(this.activeDayIndex);
      const tsv = toTsv(rows, (k) => this.t(k));
      try {
        await navigator.clipboard.writeText(tsv);
      } catch {
        const el = document.createElement('textarea');
        el.value = tsv;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      this.copySnack = true;
    },

    onDownloadCsv() {
      const rows = buildReportRows(this.activeDayIndex);
      const csv = toCsv(rows, (k) => this.t(k));
      const dayKey = DAY_KEYS[this.activeDayIndex] || String(this.activeDayIndex);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `liturgia-tempos-${dayKey}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    },

    onResetDay() {
      this.resetConfirm = true;
    },

    confirmResetDay() {
      resetDay(this.activeDayIndex);
      this.resetConfirm = false;
    },

    // Config tab
    toggleAutoOpenPopup(val) {
      this.$userdata.set('modules.liturgia.config.auto_open_popup', !!val);
    },

    onRestoreDefaults() {
      // restoreDefaults() is called inside dialog; this is called from ribbon Padrões
      // Import restoreDefaults from helper and call it, then show snackbar
      import('../helpers/LiturgiaFileConfig.js').then(({ restoreDefaults }) => {
        restoreDefaults();
        this.restoredSnackbar = true;
      });
    },

    // Expose openTelao for ribbon wiring
    openTelao() {
      openTelao();
    },
  },
};
</script>

<style scoped>
.liturgia-day-tabs {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.liturgia-day-tabs :deep(.v-tab) {
  height: 32px !important;
  min-height: 32px !important;
  min-width: 0 !important;
  padding: 0 12px !important;
  font-size: 12px !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}
</style>
