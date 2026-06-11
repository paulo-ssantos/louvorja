<template>
  <v-dialog v-model="isOpen" max-width="720" scrollable>
    <v-card>
      <!-- Title bar -->
      <v-card-title class="text-body-1 font-weight-bold pa-4 d-flex align-center">
        <v-icon size="18" class="mr-2">mdi-chart-bar</v-icon>
        {{ t('time.report_title') }}
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="isOpen = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <!-- Header summary -->
      <v-card-subtitle v-if="headerText" class="pt-3 pb-1 px-4 text-caption text-medium-emphasis">
        {{ headerText }}
      </v-card-subtitle>

      <!-- Open entry warning -->
      <v-card-text v-if="openEntry" class="px-4 pt-2 pb-0">
        <v-btn
          size="small"
          color="warning"
          variant="tonal"
          @click="closeOpenEntry"
        >
          <v-icon size="14" class="mr-1">mdi-stop-circle-outline</v-icon>
          {{ t('time.close_open_entry') }}
        </v-btn>
      </v-card-text>

      <v-card-text class="pa-0">
        <!-- Empty state -->
        <div v-if="rows.length === 0" class="pa-6 text-center text-medium-emphasis text-caption">
          {{ t('time.report_empty') }}
        </div>

        <!-- Report table -->
        <v-table v-else density="compact" class="liturgia-report-table">
          <thead>
            <tr>
              <th class="text-caption">{{ t('time.col_order') }}</th>
              <th class="text-caption">{{ t('time.col_item') }}</th>
              <th class="text-caption">{{ t('time.col_type') }}</th>
              <th class="text-caption">{{ t('time.col_start') }}</th>
              <th class="text-caption">{{ t('time.col_end') }}</th>
              <th class="text-caption">{{ t('time.col_duration') }}</th>
              <th class="text-caption">{{ t('time.col_planned') }}</th>
              <th class="text-caption">{{ t('time.col_desvio') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.order"
              :class="row.in_progress ? 'liturgia-report-row--active' : ''"
            >
              <td class="text-caption">{{ row.order }}</td>
              <td class="text-caption liturgia-report-name">{{ row.display_name }}</td>
              <td class="text-caption">{{ row.type }}</td>
              <td class="text-caption font-variant-tabular">{{ formatTime(row.started_at) }}</td>
              <td class="text-caption font-variant-tabular">
                <span v-if="row.in_progress" class="text-warning">
                  {{ t('time.in_progress') }}
                </span>
                <span v-else>{{ formatTime(row.ended_at) }}</span>
              </td>
              <td class="text-caption font-variant-tabular">{{ formatDuration(row.duration_ms) }}</td>
              <td class="text-caption font-variant-tabular">
                {{ row.planned_duration != null ? row.planned_duration + 'm' : '—' }}
              </td>
              <td
                class="text-caption font-variant-tabular"
                :class="desvioClass(row.desvio_ms)"
              >
                {{ formatDesvio(row.desvio_ms) }}
              </td>
            </tr>

            <!-- Totals row -->
            <tr class="liturgia-report-totals">
              <td colspan="5" class="text-caption font-weight-bold">
                {{ t('time.totals_label') }}
              </td>
              <td class="text-caption font-weight-bold font-variant-tabular">
                {{ formatDuration(totalDurationMs) }}
              </td>
              <td class="text-caption font-weight-bold font-variant-tabular">
                {{ totalPlannedMinutes != null ? totalPlannedMinutes + 'm' : '—' }}
              </td>
              <td></td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>

      <!-- Footer summary -->
      <v-card-subtitle v-if="rows.length > 0" class="pb-2 pt-1 px-4 text-caption text-medium-emphasis">
        {{ footerText }}
      </v-card-subtitle>

      <v-divider />

      <!-- Actions -->
      <v-card-actions class="pa-3">
        <v-btn
          size="small"
          variant="tonal"
          :disabled="rows.length === 0"
          @click="copyTsv"
        >
          <v-icon size="14" class="mr-1">mdi-content-copy</v-icon>
          {{ t('time.copy_btn') }}
        </v-btn>

        <v-btn
          size="small"
          variant="tonal"
          :disabled="rows.length === 0"
          @click="downloadCsv"
        >
          <v-icon size="14" class="mr-1">mdi-download</v-icon>
          {{ t('time.download_csv_btn') }}
        </v-btn>

        <!-- Reset button -->
        <v-btn
          size="small"
          variant="text"
          color="error"
          :disabled="rows.length === 0"
          @click="confirmReset = true"
        >
          <v-icon size="14" class="mr-1">mdi-delete-sweep-outline</v-icon>
          {{ t('time.reset_btn') }}
        </v-btn>

        <v-spacer />

        <v-btn
          size="small"
          variant="flat"
          @click="isOpen = false"
        >
          {{ t('time.close_btn') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Copy snackbar feedback -->
    <v-snackbar v-model="copiedSnack" timeout="1800" color="success" location="bottom">
      {{ t('time.copy_btn') }} ✓
    </v-snackbar>
  </v-dialog>

  <!-- Reset confirm dialog (rendered outside the main dialog to avoid nesting issues) -->
  <v-dialog v-model="confirmReset" max-width="380">
    <v-card>
      <v-card-text class="pt-4">{{ t('time.reset_confirm') }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" size="small" @click="confirmReset = false">
          {{ t('cancel_btn') }}
        </v-btn>
        <v-btn color="error" variant="flat" size="small" @click="doReset">
          {{ t('time.reset_btn') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import {
  buildReportRows,
  toCsv,
  toTsv,
  formatDuration,
  formatTime,
  formatDesvio,
  resetDay,
  getLog,
  getPlannedStart,
  closeEntryForItem,
} from '../../helpers/LiturgiaTimeTracking.js';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default {
  name: 'LiturgiaReportDialog',

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    dayIndex: {
      type: Number,
      required: true,
    },
  },

  emits: ['update:modelValue'],

  data: () => ({
    copiedSnack: false,
    confirmReset: false,
  }),

  computed: {
    isOpen: {
      get() { return this.modelValue; },
      set(v) { this.$emit('update:modelValue', v); },
    },

    rows() {
      // Re-compute every time the dialog is open; reads from $userdata for reactivity
      if (!this.isOpen) return [];
      return buildReportRows(this.dayIndex);
    },

    totalDurationMs() {
      return this.rows.reduce((acc, r) => acc + r.duration_ms, 0);
    },

    totalPlannedMinutes() {
      const hasPlan = this.rows.some(r => r.planned_duration != null);
      if (!hasPlan) return null;
      return this.rows.reduce((acc, r) => acc + (r.planned_duration || 0), 0);
    },

    dayItems() {
      return this.$userdata.get(`modules.liturgia.days.${this.dayIndex}.items`, []);
    },

    headerText() {
      const log = getLog(this.dayIndex);
      const planned = getPlannedStart(this.dayIndex);

      if (!log.session_started_at && !planned) return null;

      const actualStr = log.session_started_at ? formatTime(log.session_started_at) : '—';
      const plannedStr = planned || '—';

      let delta = '—';
      if (log.session_started_at && planned) {
        const [h, m] = planned.split(':').map(Number);
        const plannedDate = new Date();
        plannedDate.setHours(h, m, 0, 0);
        const actualDate = new Date(log.session_started_at);
        const diffMin = Math.round((actualDate.getTime() - plannedDate.getTime()) / 60000);
        if (diffMin > 0) delta = `+${diffMin}min`;
        else if (diffMin < 0) delta = `${diffMin}min`;
        else delta = '0min';
      }

      return this.t('time.report_header')
        .replace('{planned}', plannedStr)
        .replace('{actual}', actualStr)
        .replace('{delta}', delta);
    },

    footerText() {
      const total = this.dayItems.filter(i => i.type !== 'category').length;
      const executed = this.rows.length;
      return this.t('time.report_footer')
        .replace('{executed}', executed)
        .replace('{total}', total);
    },

    openEntry() {
      if (!this.isOpen) return null;
      const log = getLog(this.dayIndex);
      return log.entries.find(e => e.ended_at === null) || null;
    },
  },

  methods: {
    t(key) {
      return this.$t(`modules.liturgia.${key}`);
    },

    formatTime,
    formatDuration,
    formatDesvio,

    desvioClass(ms) {
      if (ms === null || ms === undefined || Math.abs(ms) < 60000) return '';
      return ms > 0 ? 'text-error' : 'text-success';
    },

    async copyTsv() {
      const tsv = toTsv(this.rows, (k) => this.t(k));
      try {
        await navigator.clipboard.writeText(tsv);
        this.copiedSnack = true;
      } catch {
        // Fallback: show content in a textarea approach
        const el = document.createElement('textarea');
        el.value = tsv;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        this.copiedSnack = true;
      }
    },

    downloadCsv() {
      const csv = toCsv(this.rows, (k) => this.t(k));
      const dayKey = DAY_KEYS[this.dayIndex] || String(this.dayIndex);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `liturgia-tempos-${dayKey}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    },

    doReset() {
      resetDay(this.dayIndex);
      this.confirmReset = false;
    },

    closeOpenEntry() {
      if (!this.openEntry) return;
      closeEntryForItem(this.dayIndex, this.openEntry.item_id);
    },
  },
};
</script>

<style scoped>
.liturgia-report-table {
  font-size: 12px;
}

.liturgia-report-table thead th {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  padding: 6px 8px;
}

.liturgia-report-table tbody td {
  padding: 4px 8px;
  white-space: nowrap;
}

.liturgia-report-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.liturgia-report-row--active {
  background: rgba(255, 193, 7, 0.08);
}

.liturgia-report-totals {
  background: rgba(0, 0, 0, 0.04);
  border-top: 2px solid rgba(0, 0, 0, 0.1);
}

.font-variant-tabular {
  font-variant-numeric: tabular-nums;
}
</style>
