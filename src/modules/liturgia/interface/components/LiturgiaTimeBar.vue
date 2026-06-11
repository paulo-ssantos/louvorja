<template>
  <div v-if="enabled" class="liturgia-time-bar d-flex align-center px-2 py-1 text-caption">

    <!-- Live dot + current item name + per-item elapsed (only while an entry is open) -->
    <template v-if="openEntry">
      <v-icon size="10" color="error" class="mr-1 liturgia-time-bar__live-dot">mdi-circle</v-icon>
      <span class="mr-1 text-medium-emphasis liturgia-time-bar__item-name">{{ openEntry.display_name }}</span>
      <span class="mr-2 liturgia-time-bar__item-elapsed" :class="itemElapsedClass">{{ itemElapsedLabel }}</span>
    </template>

    <!-- Schedule status chip -->
    <v-chip
      v-if="status.code !== 'no_plan'"
      :color="statusColor"
      size="x-small"
      variant="tonal"
      class="mr-2 liturgia-time-bar__status"
    >
      {{ statusLabel }}
    </v-chip>

    <v-spacer />

    <!-- Total elapsed -->
    <v-icon size="14" class="mr-1 text-medium-emphasis">mdi-timer-outline</v-icon>
    <span class="mr-2 text-medium-emphasis liturgia-time-bar__elapsed" :title="t('time.total_elapsed')">
      {{ elapsedLabel }}
    </span>

    <!-- Stop current item button (only while something is playing) -->
    <v-btn
      v-if="nowPlaying"
      size="x-small"
      variant="tonal"
      color="warning"
      class="mr-1 liturgia-time-bar__stop"
      @click="stopCurrentItem"
    >
      <v-icon size="14" class="mr-1">mdi-stop-circle-outline</v-icon>
      {{ t('time.stop_item') }}
    </v-btn>

    <!-- Report button -->
    <v-btn
      size="x-small"
      variant="text"
      class="liturgia-time-bar__report"
      @click="showReport = true"
    >
      <v-icon size="14" class="mr-1">mdi-chart-bar</v-icon>
      {{ t('time.report_btn') }}
    </v-btn>

    <!-- Report dialog -->
    <LiturgiaReportDialog
      v-model="showReport"
      :day-index="dayIndex"
    />
  </div>
</template>

<script>
import {
  isEnabled,
  getLog,
  computeStatus,
  formatDuration,
  closeEntryForItem,
} from '../../helpers/LiturgiaTimeTracking.js';
import LiturgiaReportDialog from './LiturgiaReportDialog.vue';

export default {
  name: 'LiturgiaTimeBar',

  components: { LiturgiaReportDialog },

  props: {
    dayIndex: {
      type: Number,
      required: true,
    },
  },

  data: () => ({
    now: new Date(),
    tickTimer: null,
    showReport: false,
  }),

  computed: {
    enabled() {
      return isEnabled();
    },

    nowPlaying() {
      return this.$appdata.get('modules.liturgia.now_playing', null);
    },

    log() {
      // Reactive dependency on userdata — read via $userdata so changes propagate
      return this.$userdata.get(`modules.liturgia.time_log.${this.dayIndex}`, { session_started_at: null, entries: [] });
    },

    /** The currently-open time log entry (ended_at === null), or null. */
    openEntry() {
      const entries = this.log.entries;
      if (!entries || entries.length === 0) return null;
      return entries.find(e => e.ended_at === null) || null;
    },

    /** Per-item elapsed formatted as mm:ss, ticking each second. */
    itemElapsedLabel() {
      if (!this.openEntry) return '';
      const ms = this.now.getTime() - new Date(this.openEntry.started_at).getTime();
      const totalSec = Math.max(0, Math.round(ms / 1000));
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    },

    /**
     * Returns 'text-error' when the open entry has exceeded its planned_duration,
     * otherwise returns an empty string.
     */
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
      return computeStatus(this.dayIndex);
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
  },

  mounted() {
    this.tickTimer = setInterval(() => {
      this.now = new Date();
    }, 1000);
  },

  beforeUnmount() {
    clearInterval(this.tickTimer);
  },

  methods: {
    t(text) {
      return this.$t(`modules.liturgia.${text}`);
    },

    stopCurrentItem() {
      const np = this.nowPlaying;
      if (!np) return;

      // Close the time log entry
      closeEntryForItem(this.dayIndex, np.item_id);

      // Clear now_playing
      this.$appdata.set('modules.liturgia.now_playing', null);
    },
  },
};
</script>

<style scoped>
.liturgia-time-bar {
  background: rgba(0, 0, 0, 0.06);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  min-height: 28px;
  font-size: 11px;
}

.liturgia-time-bar__elapsed {
  font-variant-numeric: tabular-nums;
  min-width: 36px;
}

.liturgia-time-bar__item-elapsed {
  font-variant-numeric: tabular-nums;
}

.liturgia-time-bar__status {
  font-size: 10px;
}

.liturgia-time-bar__stop,
.liturgia-time-bar__report {
  font-size: 10px;
  min-height: 22px !important;
  height: 22px !important;
}
</style>
