<template>
  <div v-if="enabled" class="liturgia-time-bar d-flex align-center px-2">

    <!-- Live dot + current item name + per-item elapsed (only while entry is open) -->
    <template v-if="openEntry">
      <div class="liturgia-time-bar__live-dot" />
      <span class="liturgia-time-bar__item-name mr-1">{{ openEntry.display_name }}</span>
      <span class="liturgia-time-bar__item-elapsed mr-2" :class="itemElapsedClass">{{ itemElapsedLabel }}</span>
    </template>

    <!-- Schedule status chip -->
    <v-chip
      v-if="status.code !== 'no_plan'"
      :color="statusColor"
      size="x-small"
      variant="tonal"
      class="liturgia-time-bar__status"
      style="height:16px; font-size:10px;"
    >
      {{ statusLabel }}
    </v-chip>

    <v-spacer />

    <!-- Total elapsed -->
    <v-icon size="12" class="mr-1 liturgia-time-bar__muted-icon">mdi-timer-outline</v-icon>
    <span class="liturgia-time-bar__elapsed liturgia-time-bar__muted" :title="t('time.total_elapsed')">
      {{ elapsedLabel }}
    </span>

  </div>
</template>

<script>
import {
  isEnabled,
  getLog,
  computeStatus,
  formatDuration,
} from '../../helpers/LiturgiaTimeTracking.js';

export default {
  name: 'LiturgiaTimeBar',

  props: {
    dayIndex: {
      type: Number,
      required: true,
    },
  },

  data: () => ({
    now: new Date(),
    tickTimer: null,
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
  },
};
</script>

<style scoped>
.liturgia-time-bar {
  height: 24px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.05);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.liturgia-time-bar__live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(var(--v-theme-error));
  flex-shrink: 0;
  margin-right: 4px;
  animation: timebar-pulse 1s ease-in-out infinite;
}

@keyframes timebar-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.liturgia-time-bar__item-name {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.liturgia-time-bar__item-elapsed {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  flex-shrink: 0;
}

.liturgia-time-bar__status {
  flex-shrink: 0;
}

.liturgia-time-bar__elapsed {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  min-width: 36px;
}

.liturgia-time-bar__muted {
  opacity: 0.65;
}

.liturgia-time-bar__muted-icon {
  opacity: 0.65;
}
</style>
