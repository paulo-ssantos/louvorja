<template>
  <div
    class="liturgia-ribbon"
    :class="{ 'liturgia-ribbon--dark': isDark }"
  >
    <!-- Tab strip 26px -->
    <v-tabs
      :model-value="ribbonTab"
      @update:model-value="$emit('update:ribbonTab', $event)"
      density="compact"
      height="26"
      class="liturgia-ribbon-tabs"
    >
      <v-tab value="home">{{ t('ribbon.tab_home') }}</v-tab>
      <v-tab value="tempos">{{ t('ribbon.tab_time') }}</v-tab>
      <v-tab value="config">{{ t('ribbon.tab_config') }}</v-tab>
    </v-tabs>

    <!-- Body 84px — swaps by tab -->
    <div class="liturgia-ribbon-body">

      <!-- ══════════════════════════════════════════════════
           TAB 1: Configurar
           ══════════════════════════════════════════════════ -->
      <template v-if="ribbonTab === 'home'">

        <!-- Group: Adicionar -->
        <RibbonGroup :caption="t('ribbon.group_add')">
          <RibbonBigBtn
            icon="mdi-playlist-plus"
            icon-color="rgb(var(--v-theme-primary))"
            :label="t('add_item')"
            @click="$emit('add-dialog')"
          />
        </RibbonGroup>

        <div class="rib-sep" />

        <!-- Group: Itens -->
        <RibbonGroup :caption="t('ribbon.group_item')">
          <!-- 3 small commands column -->
          <div class="rib-col">
            <RibbonSmallBtn
              icon="mdi-checkbox-multiple-marked-outline"
              :label="t('bulk.mark_all')"
              @click="$emit('mark-all')"
            />
            <RibbonSmallBtn
              icon="mdi-checkbox-multiple-blank-outline"
              :label="t('bulk.deselect_all')"
              @click="$emit('deselect-all')"
            />
            <RibbonSmallBtn
              icon="mdi-swap-horizontal"
              :label="t('bulk.invert')"
              @click="$emit('invert-selection')"
            />
          </div>

          <!-- Big button: Apagar Selecionados -->
          <RibbonBigBtn
            :disabled="selectedCount === 0"
            :label="t('bulk.delete_selected')"
            @click="$emit('delete-selected')"
          >
            <template v-slot:icon>
              <v-badge
                v-if="selectedCount > 0"
                :content="selectedCount"
                color="error"
                style="font-size:9px;"
                offset-x="-2"
                offset-y="2"
              >
                <v-icon :size="26" color="rgb(var(--v-theme-error))">mdi-close-thick</v-icon>
              </v-badge>
              <v-icon v-else :size="26" color="rgb(var(--v-theme-error))">mdi-close-thick</v-icon>
            </template>
          </RibbonBigBtn>
        </RibbonGroup>

        <div class="rib-sep" />

        <!-- Group: Opções -->
        <RibbonGroup :caption="t('ribbon.group_options')">
          <div class="rib-col" style="padding-top:2px;">
            <v-tooltip :text="t('options.auto_mark')" location="bottom" :open-delay="500">
              <template v-slot:activator="{ props: tp }">
                <v-checkbox
                  v-bind="tp"
                  density="compact"
                  hide-details
                  :model-value="autoMarkEnabled"
                  @update:model-value="$emit('toggle-auto-mark')"
                  :label="t('options.auto_mark_short')"
                  class="rib-check"
                />
              </template>
            </v-tooltip>
            <v-tooltip :text="t('options.show_notes')" location="bottom" :open-delay="500">
              <template v-slot:activator="{ props: tp }">
                <v-checkbox
                  v-bind="tp"
                  density="compact"
                  hide-details
                  :model-value="notePanelOpen"
                  @update:model-value="$emit('toggle-notes')"
                  :label="t('options.show_notes_short')"
                  class="rib-check"
                />
              </template>
            </v-tooltip>
          </div>
        </RibbonGroup>

        <div class="rib-sep" />

        <!-- Group: Backup -->
        <RibbonGroup :caption="t('ribbon.group_backup')">
          <div class="rib-col">
            <RibbonSmallBtn
              icon="mdi-download"
              :label="t('backup.export')"
              @click="$emit('export')"
            />
            <RibbonSmallBtn
              icon="mdi-upload"
              :label="t('backup.import')"
              @click="$emit('import')"
            />
          </div>
        </RibbonGroup>

      </template>

      <!-- ══════════════════════════════════════════════════
           TAB 2: Tempos
           ══════════════════════════════════════════════════ -->
      <template v-else-if="ribbonTab === 'tempos'">

        <!-- Group: Registro -->
        <RibbonGroup :caption="t('ribbon.group_registro')">
          <!-- Row 1: Enable switch + label -->
          <div class="rib-col" style="width:180px; padding-top:2px;">
            <div class="rib-switch-row">
              <v-tooltip :text="t('time.enable_tooltip')" location="bottom" max-width="260">
                <template v-slot:activator="{ props: tp }">
                  <v-switch
                    v-bind="tp"
                    density="compact"
                    hide-details
                    color="primary"
                    :model-value="timeTrackingEnabled"
                    @update:model-value="$emit('toggle-time-tracking', $event)"
                    class="rib-switch"
                    style="flex-shrink:0;"
                  />
                </template>
              </v-tooltip>
              <span class="rib-switch-label">{{ t('time.enable_label') }}</span>
            </div>

            <!-- Row 2: Planned start always rendered (disabled when off) -->
            <div class="rib-time-start-row">
              <span class="rib-time-start-label">{{ t('time.planned_start_label').split(' ')[0] }}</span>
              <v-text-field
                type="time"
                density="compact"
                hide-details
                variant="outlined"
                :model-value="plannedStart"
                @update:model-value="$emit('planned-start-change', $event)"
                :disabled="!timeTrackingEnabled"
                class="rib-time-input"
                style="width:96px;"
              />
            </div>
          </div>
        </RibbonGroup>

        <div class="rib-sep" />

        <!-- Group: Item atual -->
        <RibbonGroup
          :caption="t('ribbon.group_current_item')"
          :disabled="!timeTrackingEnabled"
          style="width:220px; flex-shrink:0;"
        >
          <!-- When tracking enabled, show live entry -->
          <template v-if="timeTrackingEnabled">
            <div v-if="openEntry" class="rib-item-live" style="width:200px;">
              <!-- Row 1: dot + name -->
              <div class="rib-item-live__row1">
                <div class="rib-live-dot" />
                <span class="rib-item-live__name">{{ openEntry.display_name }}</span>
              </div>
              <!-- Row 2: elapsed / planned + stop btn -->
              <div class="rib-item-live__row2">
                <span
                  class="rib-item-live__elapsed"
                  :class="itemElapsedClass"
                >{{ itemElapsedLabel }}</span>
                <span
                  v-if="openEntry.planned_duration"
                  class="rib-item-live__planned"
                > / {{ openEntry.planned_duration }} min</span>
                <v-btn
                  size="x-small"
                  variant="tonal"
                  color="warning"
                  style="height:22px; font-size:10px; text-transform:none; margin-left:6px; flex-shrink:0;"
                  @click="$emit('stop-item')"
                >
                  <v-icon :size="14" style="margin-right:2px;">mdi-stop-circle-outline</v-icon>
                  {{ t('time.stop_item') }}
                </v-btn>
              </div>
            </div>
            <div v-else class="rib-no-item">
              {{ t('time.no_open_item') }}
            </div>
          </template>
        </RibbonGroup>

        <div class="rib-sep" />

        <!-- Group: Sessão -->
        <RibbonGroup
          :caption="t('ribbon.group_session')"
          :disabled="!timeTrackingEnabled"
          style="width:160px; flex-shrink:0;"
        >
          <div class="rib-col" style="padding-top:2px;">
            <!-- Row 1: total elapsed -->
            <div class="rib-session-row">
              <v-icon :size="14" style="color:var(--rib-muted); margin-right:4px;">mdi-timer-outline</v-icon>
              <span class="rib-session-elapsed">{{ elapsedLabel }}</span>
            </div>
            <!-- Row 2: status chip -->
            <div class="rib-session-row" style="padding-top:2px;">
              <v-chip
                v-if="status.code !== 'no_plan'"
                size="x-small"
                variant="tonal"
                :color="statusColor"
                style="height:18px; font-size:10px;"
              >
                {{ statusLabel }}
              </v-chip>
            </div>
            <!-- Row 3: real start -->
            <div v-if="sessionStartedAt" class="rib-session-row" style="padding-top:2px;">
              <span class="rib-session-realstart">
                {{ t('time.real_start').replace('{time}', sessionStartedAt) }}
              </span>
            </div>
          </div>
        </RibbonGroup>

        <div class="rib-sep" />

        <!-- Group: Relatório -->
        <RibbonGroup :caption="t('ribbon.group_report')">
          <RibbonBigBtn
            icon="mdi-chart-bar"
            :label="t('time.report_btn')"
            @click="$emit('show-report')"
          />
          <div class="rib-col">
            <RibbonSmallBtn
              icon="mdi-content-copy"
              :label="t('time.copy_btn')"
              @click="$emit('copy-tsv')"
            />
            <RibbonSmallBtn
              icon="mdi-download"
              :label="t('time.download_csv_btn')"
              @click="$emit('download-csv')"
            />
            <RibbonSmallBtn
              icon="mdi-restart"
              :label="t('time.reset_btn')"
              @click="$emit('reset-day')"
            />
          </div>
        </RibbonGroup>

      </template>

      <!-- ══════════════════════════════════════════════════
           TAB 3: Configurações
           ══════════════════════════════════════════════════ -->
      <template v-else-if="ribbonTab === 'config'">

        <!-- Group: Arquivos -->
        <RibbonGroup :caption="t('ribbon.group_files')">
          <RibbonBigBtn
            icon="mdi-file-cog"
            :label="t('config.file_types')"
            @click="$emit('open-file-config')"
          />
        </RibbonGroup>

        <div class="rib-sep" />

        <!-- Group: Projeção / Comportamentos -->
        <RibbonGroup :caption="t('ribbon.group_projection')">
          <div class="rib-col" style="padding-top:2px;">
            <!-- auto_open_popup checkbox -->
            <v-checkbox
              density="compact"
              hide-details
              :model-value="autoOpenPopup"
              @update:model-value="$emit('toggle-auto-open-popup', $event)"
              :label="t('config.auto_open_popup')"
              class="rib-check"
            />
            <!-- open popup now -->
            <RibbonSmallBtn
              icon="mdi-projector-screen-outline"
              :label="t('config.open_popup_now')"
              @click="$emit('open-telao')"
            />
          </div>
        </RibbonGroup>

        <div class="rib-sep" />

        <!-- Group: Padrões -->
        <RibbonGroup :caption="t('ribbon.group_defaults')">
          <div class="rib-col" style="padding-top:2px;">
            <RibbonSmallBtn
              icon="mdi-restore"
              :label="t('config.restore_defaults')"
              @click="$emit('restore-defaults')"
            />
          </div>
        </RibbonGroup>

      </template>

    </div><!-- /.liturgia-ribbon-body -->
  </div><!-- /.liturgia-ribbon -->
</template>

<script>
import RibbonGroup from './RibbonGroup.vue';
import RibbonBigBtn from './RibbonBigBtn.vue';
import RibbonSmallBtn from './RibbonSmallBtn.vue';
import {
  getLog,
  computeStatus,
  formatDuration,
  getPlannedStart,
} from '../../helpers/LiturgiaTimeTracking.js';

export default {
  name: 'LiturgiaRibbon',

  components: { RibbonGroup, RibbonBigBtn, RibbonSmallBtn },

  emits: [
    'update:ribbonTab',
    // Tab 1 — Configurar
    'add-dialog',
    'mark-all',
    'deselect-all',
    'invert-selection',
    'delete-selected',
    'toggle-auto-mark',
    'toggle-notes',
    'export',
    'import',
    // Tab 2 — Tempos
    'toggle-time-tracking',
    'planned-start-change',
    'stop-item',
    'show-report',
    'copy-tsv',
    'download-csv',
    'reset-day',
    // Tab 3 — Configurações
    'open-file-config',
    'toggle-auto-open-popup',
    'open-telao',
    'restore-defaults',
  ],

  props: {
    ribbonTab: {
      type: String,
      default: 'home',
    },
    isDark: {
      type: Boolean,
      default: false,
    },
    selectedCount: {
      type: Number,
      default: 0,
    },
    autoMarkEnabled: {
      type: Boolean,
      default: false,
    },
    notePanelOpen: {
      type: Boolean,
      default: false,
    },
    timeTrackingEnabled: {
      type: Boolean,
      default: false,
    },
    plannedStart: {
      type: String,
      default: null,
    },
    activeDayIndex: {
      type: Number,
      default: 0,
    },
    autoOpenPopup: {
      type: Boolean,
      default: true,
    },
  },

  data: () => ({
    now: new Date(),
    tickTimer: null,
  }),

  computed: {
    log() {
      return this.$userdata.get(
        `modules.liturgia.time_log.${this.activeDayIndex}`,
        { session_started_at: null, entries: [] }
      );
    },

    openEntry() {
      const entries = this.log.entries;
      if (!entries || entries.length === 0) return null;
      return entries.find(e => e.ended_at === null) || null;
    },

    itemElapsedLabel() {
      if (!this.openEntry) return '';
      const ms = this.now.getTime() - new Date(this.openEntry.started_at).getTime();
      const totalSec = Math.max(0, Math.round(ms / 1000));
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    },

    itemElapsedClass() {
      if (!this.openEntry) return '';
      const planned = this.openEntry.planned_duration;
      if (typeof planned !== 'number' || planned <= 0) return '';
      const elapsedMs = this.now.getTime() - new Date(this.openEntry.started_at).getTime();
      return elapsedMs > planned * 60 * 1000 ? 'text-error' : '';
    },

    elapsedLabel() {
      if (!this.log.session_started_at) return this.t('time.bar_waiting');
      const start = new Date(this.log.session_started_at);
      const ms = this.now.getTime() - start.getTime();
      return formatDuration(ms);
    },

    status() {
      return computeStatus(this.activeDayIndex);
    },

    statusColor() {
      switch (this.status.code) {
        case 'late':   return 'error';
        case 'early':  return 'success';
        case 'ontime': return 'default';
        default:       return 'default';
      }
    },

    statusLabel() {
      const { code, minutes } = this.status;
      switch (code) {
        case 'late':   return this.t('time.status_late').replace('{n}', minutes);
        case 'early':  return this.t('time.status_early').replace('{n}', minutes);
        case 'ontime': return this.t('time.status_ontime');
        default:       return this.t('time.status_no_plan');
      }
    },

    sessionStartedAt() {
      if (!this.log.session_started_at) return null;
      const d = new Date(this.log.session_started_at);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
  },

  watch: {
    ribbonTab(val) {
      this._manageTick(val);
    },
    timeTrackingEnabled() {
      this._manageTick(this.ribbonTab);
    },
  },

  mounted() {
    this._manageTick(this.ribbonTab);
  },

  beforeUnmount() {
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  },

  methods: {
    t(key) {
      return this.$t(`modules.liturgia.${key}`);
    },

    _manageTick(tab) {
      if (tab === 'tempos' && this.timeTrackingEnabled) {
        if (!this.tickTimer) {
          this.tickTimer = setInterval(() => { this.now = new Date(); }, 1000);
        }
      } else {
        if (this.tickTimer) {
          clearInterval(this.tickTimer);
          this.tickTimer = null;
        }
      }
    },
  },
};
</script>

<style scoped>
/* ── CSS Custom Properties ────────────────────────────────────── */
.liturgia-ribbon {
  --rib-bg:     #f3f3f3;
  --rib-tabbg:  #e4e4e4;
  --rib-fg:     #333;
  --rib-fg2:    #555;
  --rib-muted:  #8a8a8a;
  --rib-line:   rgba(0,0,0,.12);
  --rib-hover:  rgba(var(--v-theme-primary),.08);
  --rib-border: #c8c8c8;

  /* Hard reset: override v-card-title cascade */
  font-size: 12px !important;
  line-height: 1.2 !important;
  letter-spacing: normal !important;
  font-weight: 400 !important;
  white-space: normal !important;

  /* Bleed to window edges (v-card-title padding ~8px 16px) */
  margin: -8px -16px;
  width: calc(100% + 32px);
}

.liturgia-ribbon.liturgia-ribbon--dark {
  --rib-bg:     #2b2b2b;
  --rib-tabbg:  #222;
  --rib-fg:     #ddd;
  --rib-fg2:    #bbb;
  --rib-muted:  #9e9e9e;
  --rib-line:   rgba(255,255,255,.14);
  --rib-hover:  rgba(var(--v-theme-primary),.18);
  --rib-border: #444;
}

/* ── Tab strip 26px ───────────────────────────────────────────── */
.liturgia-ribbon-tabs {
  height: 26px !important;
  min-height: 26px !important;
  background: var(--rib-tabbg) !important;
}

.liturgia-ribbon-tabs :deep(.v-tab) {
  height: 26px !important;
  min-height: 26px !important;
  min-width: 0 !important;
  padding: 0 12px !important;
  font-size: 11px !important;
  line-height: 26px !important;
  letter-spacing: normal !important;
  text-transform: none !important;
  color: var(--rib-fg2) !important;
  border-radius: 0 !important;
}

.liturgia-ribbon-tabs :deep(.v-tab--selected) {
  background: var(--rib-bg) !important;
  color: var(--rib-fg) !important;
  box-shadow: inset 0 2px 0 rgb(var(--v-theme-primary)) !important;
}

.liturgia-ribbon-tabs :deep(.v-tab__slider) {
  display: none !important;
}

/* ── Body 84px ───────────────────────────────────────────────── */
.liturgia-ribbon-body {
  display: flex;
  align-items: stretch;
  height: 84px;
  padding: 4px 6px 2px;
  background: var(--rib-bg);
  border-bottom: 1px solid var(--rib-border);
  overflow-x: auto;
  overflow-y: hidden;
}

/* ── Group separator ─────────────────────────────────────────── */
.rib-sep {
  width: 1px;
  height: 64px;
  margin: 2px 2px 0;
  align-self: flex-start;
  background: var(--rib-line);
  flex: none;
}

/* ── Column wrapper ──────────────────────────────────────────── */
.rib-col {
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: stretch;
}

/* ── Checkbox rows ───────────────────────────────────────────── */
.rib-check :deep(.v-selection-control) {
  min-height: 28px !important;
}

.rib-check :deep(.v-selection-control__wrapper),
.rib-check :deep(.v-selection-control__input) {
  width: 20px !important;
  height: 20px !important;
}

.rib-check :deep(.v-selection-control__input .v-icon) {
  font-size: 16px !important;
}

.rib-check :deep(.v-label) {
  font-size: 11px !important;
  line-height: 13px !important;
  opacity: 1 !important;
  color: var(--rib-fg) !important;
  letter-spacing: normal !important;
  white-space: normal !important;
  max-width: 170px !important;
  margin-left: 2px !important;
}

/* ── Tempos tab — switch ─────────────────────────────────────── */
.rib-switch-row {
  display: flex;
  align-items: center;
  height: 28px;
}

.rib-switch :deep(.v-switch__track) {
  height: 14px !important;
  width: 30px !important;
}

.rib-switch :deep(.v-switch__thumb) {
  height: 10px !important;
  width: 10px !important;
}

.rib-switch-label {
  font-size: 11px;
  line-height: 13px;
  color: var(--rib-fg);
  white-space: normal;
  max-width: 130px;
}

/* ── Tempos tab — planned start ──────────────────────────────── */
.rib-time-start-row {
  display: flex;
  align-items: center;
  height: 28px;
  gap: 4px;
}

.rib-time-start-label {
  font-size: 10px;
  color: var(--rib-muted);
  width: 34px;
  flex-shrink: 0;
}

.rib-time-input :deep(.v-field__input) {
  min-height: 26px !important;
  padding: 0 6px !important;
  font-size: 12px !important;
}

.rib-time-input :deep(.v-field) {
  --v-field-padding-top: 0;
}

/* ── Tempos tab — item live ──────────────────────────────────── */
.rib-item-live {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding-top: 4px;
}

.rib-item-live__row1 {
  display: flex;
  align-items: center;
  height: 20px;
  gap: 6px;
}

.rib-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(var(--v-theme-error));
  flex-shrink: 0;
  animation: rib-pulse 1s ease-in-out infinite;
}

@keyframes rib-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.rib-item-live__name {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
  color: var(--rib-fg);
}

.rib-item-live__row2 {
  display: flex;
  align-items: center;
  height: 24px;
}

.rib-item-live__elapsed {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--rib-fg);
}

.rib-item-live__planned {
  font-size: 11px;
  color: var(--rib-muted);
  margin-left: 2px;
}

.rib-no-item {
  font-size: 11px;
  color: var(--rib-muted);
  display: flex;
  align-items: center;
  height: 62px;
  padding: 0 4px;
  white-space: normal;
  max-width: 190px;
}

/* ── Tempos tab — session ────────────────────────────────────── */
.rib-session-row {
  display: flex;
  align-items: center;
  height: 20px;
}

.rib-session-elapsed {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--rib-fg);
}

.rib-session-realstart {
  font-size: 10px;
  color: var(--rib-muted);
  white-space: nowrap;
}
</style>
