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
      <div class="liturgia-ribbon">
        <!-- Ribbon tab row -->
        <v-tabs density="compact" class="liturgia-ribbon-tabs" :model-value="0">
          <v-tab :value="0" class="text-caption">{{ t('ribbon.tab') }}</v-tab>
        </v-tabs>

        <!-- Ribbon groups row -->
        <div class="liturgia-ribbon-groups d-flex align-start pa-1">

          <!-- Group: Adicionar -->
          <div class="liturgia-ribbon-group d-flex flex-column align-center">
            <div class="d-flex flex-row align-center">
              <div class="liturgia-ribbon-cmd d-flex flex-column align-center">
                <v-btn
                  variant="text"
                  size="small"
                  @click="addDialog = true"
                  class="liturgia-cmd-btn"
                >
                  <div class="d-flex flex-column align-center">
                    <v-icon size="22">mdi-playlist-plus</v-icon>
                    <span class="text-caption mt-1">{{ t('add_item') }}</span>
                  </div>
                </v-btn>
              </div>
            </div>
            <div class="text-caption text-medium-emphasis text-center liturgia-group-caption">{{ t('ribbon.group_add') }}</div>
          </div>

          <v-divider vertical class="mx-2" />

          <!-- Group: Item (bulk operations) -->
          <div class="liturgia-ribbon-group d-flex flex-column align-center">
            <div class="d-flex flex-row align-center flex-wrap">
              <div class="liturgia-ribbon-cmd d-flex flex-column align-center">
                <v-btn
                  variant="text"
                  size="small"
                  @click="markAll"
                  class="liturgia-cmd-btn"
                >
                  <div class="d-flex flex-column align-center">
                    <v-icon size="22">mdi-checkbox-multiple-marked-outline</v-icon>
                    <span class="text-caption mt-1">{{ t('bulk.mark_all') }}</span>
                  </div>
                </v-btn>
              </div>
              <div class="liturgia-ribbon-cmd d-flex flex-column align-center">
                <v-btn
                  variant="text"
                  size="small"
                  @click="deselectAll"
                  class="liturgia-cmd-btn"
                >
                  <div class="d-flex flex-column align-center">
                    <v-icon size="22">mdi-checkbox-multiple-blank-outline</v-icon>
                    <span class="text-caption mt-1">{{ t('bulk.deselect_all') }}</span>
                  </div>
                </v-btn>
              </div>
              <div class="liturgia-ribbon-cmd d-flex flex-column align-center">
                <v-btn
                  variant="text"
                  size="small"
                  @click="invertSelection"
                  class="liturgia-cmd-btn"
                >
                  <div class="d-flex flex-column align-center">
                    <v-icon size="22">mdi-swap-horizontal</v-icon>
                    <span class="text-caption mt-1">{{ t('bulk.invert') }}</span>
                  </div>
                </v-btn>
              </div>
              <div class="liturgia-ribbon-cmd d-flex flex-column align-center">
                <v-btn
                  variant="text"
                  size="large"
                  color="error"
                  :disabled="selectedIds.length === 0"
                  @click="deleteSelected"
                  class="liturgia-cmd-btn"
                >
                  <div class="d-flex flex-column align-center">
                    <v-icon size="28">mdi-close-thick</v-icon>
                    <span class="text-caption mt-1">{{ t('bulk.delete_selected') }}</span>
                  </div>
                </v-btn>
              </div>
            </div>
            <div class="text-caption text-medium-emphasis text-center liturgia-group-caption">{{ t('ribbon.group_item') }}</div>
          </div>

          <v-divider vertical class="mx-2" />

          <!-- Group: Opções -->
          <div class="liturgia-ribbon-group d-flex flex-column align-center">
            <div class="d-flex flex-column align-start px-1">
              <v-checkbox
                density="compact"
                hide-details
                :model-value="autoMarkEnabled"
                @update:model-value="toggleAutoMark"
                :label="t('options.auto_mark')"
                class="liturgia-options-check"
              />
              <v-checkbox
                density="compact"
                hide-details
                :model-value="notePanelOpen"
                @update:model-value="toggleNotes"
                :label="t('options.show_notes')"
                class="liturgia-options-check"
              />
            </div>
            <div class="text-caption text-medium-emphasis text-center liturgia-group-caption">{{ t('ribbon.group_options') }}</div>
          </div>

          <v-divider vertical class="mx-2" />

          <!-- Group: Backup -->
          <div class="liturgia-ribbon-group d-flex flex-column align-center">
            <div class="d-flex flex-row align-center">
              <div class="liturgia-ribbon-cmd d-flex flex-column align-center">
                <v-btn
                  variant="text"
                  size="small"
                  @click="onExport"
                  class="liturgia-cmd-btn"
                >
                  <div class="d-flex flex-column align-center">
                    <v-icon size="22">mdi-download</v-icon>
                    <span class="text-caption mt-1">{{ t('backup.export') }}</span>
                  </div>
                </v-btn>
              </div>
              <div class="liturgia-ribbon-cmd d-flex flex-column align-center">
                <v-btn
                  variant="text"
                  size="small"
                  @click="triggerImport"
                  class="liturgia-cmd-btn"
                >
                  <div class="d-flex flex-column align-center">
                    <v-icon size="22">mdi-upload</v-icon>
                    <span class="text-caption mt-1">{{ t('backup.import') }}</span>
                  </div>
                </v-btn>
              </div>
            </div>
            <div class="text-caption text-medium-emphasis text-center liturgia-group-caption">{{ t('ribbon.group_backup') }}</div>
          </div>

        </div>
      </div>

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
      show-arrows
      class="liturgia-day-tabs"
      @update:model-value="onDayChange"
    >
      <v-tab v-for="(label, i) in dayLabels" :key="i" :value="i">
        <v-icon :color="DAY_COLORS[i]" class="mr-1" size="16">mdi-calendar</v-icon>
        {{ label }}
      </v-tab>
    </v-tabs>

    <!-- Day content -->
    <v-window v-model="activeDayIndex">
      <v-window-item v-for="i in 7" :key="i - 1" :value="i - 1">
        <LiturgiaDayView :day-index="i - 1" />
      </v-window-item>
    </v-window>

    <!-- Add item dialog -->
    <LiturgiaAddDialog v-model="addDialog" @add="onAddItem" />

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

    <!-- Import error snackbar -->
    <v-snackbar v-model="importError" color="error" timeout="3000">
      {{ t('import.invalid') }}
    </v-snackbar>
  </l-window>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import LiturgiaDayView from "./components/LiturgiaDayView.vue";
import LiturgiaAddDialog from "./components/LiturgiaAddDialog.vue";
import { exportLj, parseLj } from "../helpers/LiturgiaBackup.js";

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

export default {
  name: manifest.id,

  components: {
    LWindow,
    LiturgiaDayView,
    LiturgiaAddDialog,
  },

  data: () => ({
    width: 0,
    height: 0,
    addDialog: false,
    importConfirm: false,
    importError: false,
    pendingImport: null,
    DAY_COLORS,
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
  },

  created() {
    this.seedIfNeeded();
    if (this.$appdata.get('modules.liturgia.active_day_index') == null) {
      this.$appdata.set('modules.liturgia.active_day_index', new Date().getDay());
    }
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
      const kept = this.activeDayItems
        .filter(i => !sel.has(i.id))
        .map((i, idx) => ({ ...i, order: idx }));
      this.$userdata.set(`modules.liturgia.days.${this.activeDayIndex}.items`, kept);
      this.$appdata.set('modules.liturgia.selected_ids', []);
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
  },
};
</script>

<style scoped>
.liturgia-day-tabs {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.liturgia-ribbon {
  background: #f0f0f0;
  color: #222;
  width: 100%;
}

.liturgia-ribbon-tabs {
  min-height: 28px;
  height: 28px;
}

.liturgia-ribbon-tabs :deep(.v-tab) {
  color: #333 !important;
  font-size: 11px;
  min-height: 28px;
  height: 28px;
  background: #d0d0d0;
  border-radius: 4px 4px 0 0;
  margin-right: 2px;
  padding: 0 10px;
}

.liturgia-ribbon-tabs :deep(.v-tab--selected) {
  background: #f0f0f0;
  color: #111 !important;
  border-top: 2px solid #1565c0;
}

.liturgia-ribbon-groups {
  background: #f0f0f0;
  border-bottom: 1px solid #ccc;
  min-height: 72px;
}

.liturgia-ribbon-group {
  padding: 2px 4px;
  min-width: 60px;
}

.liturgia-group-caption {
  font-size: 10px;
  color: #888;
  margin-top: 2px;
  border-top: 1px solid #ddd;
  width: 100%;
  padding-top: 2px;
}

.liturgia-cmd-btn {
  min-width: 48px !important;
  height: auto !important;
  padding: 4px 6px !important;
}

.liturgia-cmd-btn :deep(.v-btn__content) {
  flex-direction: column;
}

.liturgia-options-check {
  font-size: 11px;
}

.liturgia-options-check :deep(.v-label) {
  font-size: 11px;
  color: #333;
}
</style>
