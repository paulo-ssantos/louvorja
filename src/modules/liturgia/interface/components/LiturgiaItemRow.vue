<template>
  <div
    class="lrow-wrapper"
    :data-item-id="item.id"
  >

    <!-- ========== CATEGORY BAR — 36px ========== -->
    <div
      v-if="item.type === 'category'"
      class="lrow-cat"
      :style="catStyle"
    >
      <!-- Centered bold white text -->
      <div class="lrow-cat-text text-truncate">
        {{ item.display_name || '(sem nome)' }}
      </div>

      <!-- Yellow edit pencil -->
      <v-btn
        icon
        :size="24"
        variant="text"
        class="lrow-cat-edit"
        :style="{ color: isDark ? '#f1c40f' : '#c49000' }"
        :title="$t('modules.liturgia.edit_item')"
        @click.stop="$emit('edit-toggle', item.id)"
      >
        <v-icon size="14">mdi-pencil</v-icon>
      </v-btn>

      <!-- Drag handle -->
      <v-btn
        icon
        :size="24"
        variant="text"
        class="liturgia-drag-handle lrow-cat-drag"
        style="cursor: grab;"
      >
        <v-icon size="14">mdi-drag-vertical</v-icon>
      </v-btn>
    </div>

    <!-- ========== NORMAL ROW (music / file) — 56px ========== -->
    <div
      v-else
      class="lrow"
      :class="rowClasses"
      :style="rowStyle"
      @click="$emit('execute', { item, mode: null })"
    >

      <!-- 1. CHECKBOX — 24x24 in 36px column -->
      <v-checkbox
        density="compact"
        hide-details
        :model-value="isSelected"
        class="lrow-check"
        @click.stop
        @update:model-value="toggleSelect"
      />

      <!-- 2. ICON BLOCK — 36x36, radius 6px -->
      <div class="lrow-icon-block" :style="iconBlockStyle">
        <!-- Equalizer (now-playing) with stop overlay on hover -->
        <div
          v-if="isNowPlaying"
          class="lrow-eq-wrap"
          @click.stop="$emit('stop', item)"
        >
          <!-- Stop overlay on hover -->
          <div class="lrow-stop-overlay">
            <v-icon size="18" color="white">mdi-stop</v-icon>
          </div>
          <!-- Equalizer bars -->
          <div class="lrow-equalizer" :class="{ 'lrow-equalizer--paused': isPaused }">
            <span /><span /><span />
          </div>
        </div>

        <!-- Play overlay on hover (not playing) -->
        <div v-else class="lrow-play-overlay">
          <v-icon size="18" color="white">mdi-play</v-icon>
        </div>

        <!-- Type icon (always behind overlays) -->
        <v-icon size="20" color="white" class="lrow-type-icon">{{ typeIcon }}</v-icon>

        <!-- Re-attach amber badge -->
        <v-icon
          v-if="needsReattach"
          size="14"
          color="amber"
          class="lrow-reattach-badge"
          :title="$t('modules.liturgia.reattach_hint')"
        >
          mdi-alert
        </v-icon>
      </div>

      <!-- 3. TEXT BLOCK — flex:1 1 auto -->
      <div class="lrow-text">
        <!-- Line 1: title -->
        <div
          class="lrow-title"
          :class="{
            'lrow-title--playing': isNowPlaying,
            'lrow-title--completed': completed,
          }"
        >
          {{ item.display_name || '(sem nome)' }}
        </div>

        <!-- Line 2: meta (chips + text) -->
        <div class="lrow-meta">
          <!-- Music chips -->
          <template v-if="item.type === 'music'">
            <!-- Hymn chip (only when song_number) -->
            <v-chip
              v-if="hymnNumber"
              size="x-small"
              color="primary"
              variant="tonal"
              class="lrow-chip"
            >
              Hino nº {{ hymnNumber }}
            </v-chip>

            <!-- Planned duration chip (only when tracking on AND planned_duration) -->
            <v-chip
              v-if="showPlannedChip"
              size="x-small"
              color="grey"
              variant="tonal"
              class="lrow-chip"
            >
              <v-icon size="10" class="mr-1">mdi-timer-outline</v-icon>
              {{ $t('modules.liturgia.time.minutes_chip', { n: item.planned_duration }) }}
            </v-chip>

            <!-- Duration chip (F4: only when music_ref.duration present) -->
            <v-chip
              v-if="musicDuration"
              size="x-small"
              color="grey"
              variant="tonal"
              class="lrow-chip"
            >
              {{ musicDuration }}
            </v-chip>

            <!-- Hymnal label text (only when hymn number present, fixes "Shekinah / Shekinah") -->
            <span v-if="hymnNumber" class="lrow-meta-text text-truncate">
              {{ hymnalLabel }}
            </span>
          </template>

          <!-- File chips -->
          <template v-else-if="item.type === 'file'">
            <!-- Kind chip -->
            <v-chip
              size="x-small"
              variant="tonal"
              class="lrow-chip"
              :style="{ color: kindChipColor, borderColor: kindChipColor + '40', backgroundColor: kindChipColor + '20' }"
            >
              {{ kindChipLabel }}
            </v-chip>

            <!-- Planned duration chip -->
            <v-chip
              v-if="showPlannedChip"
              size="x-small"
              color="grey"
              variant="tonal"
              class="lrow-chip"
            >
              <v-icon size="10" class="mr-1">mdi-timer-outline</v-icon>
              {{ $t('modules.liturgia.time.minutes_chip', { n: item.planned_duration }) }}
            </v-chip>

            <!-- Re-attach chip (click = trigger re-attach picker) -->
            <v-chip
              v-if="needsReattach"
              size="x-small"
              color="amber"
              variant="tonal"
              class="lrow-chip"
              style="cursor: pointer;"
              @click.stop="$emit('execute', { item, mode: null })"
            >
              {{ $t('modules.liturgia.reattach_chip') }}
            </v-chip>

            <!-- Handler hint icon -->
            <v-tooltip v-if="handlerHintIcon" :text="handlerHintTooltip" location="top" :open-delay="400">
              <template #activator="{ props }">
                <v-icon v-bind="props" size="12" class="lrow-handler-icon">{{ handlerHintIcon }}</v-icon>
              </template>
            </v-tooltip>

            <!-- File name text -->
            <span
              class="lrow-meta-text text-truncate"
              :title="item.file_ref?.path || item.file_ref?.name"
            >
              {{ item.file_ref?.name || '' }}
            </span>
          </template>
        </div>
      </div>

      <!-- 4. ACTION STRIP -->
      <div class="lrow-actions">

        <!-- Music: 4 buttons (slide sung / slide playback / slide none / overflow) -->
        <template v-if="item.type === 'music'">
          <!-- Slide Cantado -->
          <v-btn
            icon
            :size="28"
            variant="text"
            class="lrow-act"
            :class="{ 'lrow-act--active': isNowPlaying && nowPlayingMode === 'sung' }"
            :title="$t('modules.liturgia.strip.slide_sung')"
            @click.stop="emitExec('sung')"
          >
            <v-icon size="18">mdi-play-box-multiple</v-icon>
          </v-btn>

          <!-- Slide Playback (disabled when no instrumental) -->
          <span
            v-if="!hasInstrumental"
            :title="$t('modules.liturgia.strip.playback_unavailable')"
            style="display: inline-flex;"
          >
            <v-btn
              icon
              :size="28"
              variant="text"
              class="lrow-act"
              disabled
              style="opacity: .3;"
            >
              <v-icon size="18">mdi-play-box-multiple-outline</v-icon>
            </v-btn>
          </span>
          <v-btn
            v-else
            icon
            :size="28"
            variant="text"
            class="lrow-act"
            :class="{ 'lrow-act--active': isNowPlaying && nowPlayingMode === 'playback' }"
            :title="$t('modules.liturgia.strip.slide_playback')"
            @click.stop="emitExec('playback')"
          >
            <v-icon size="18">mdi-play-box-multiple-outline</v-icon>
          </v-btn>

          <!-- Slide Sem áudio -->
          <v-btn
            icon
            :size="28"
            variant="text"
            class="lrow-act"
            :class="{ 'lrow-act--active': isNowPlaying && nowPlayingMode === 'none' }"
            :title="$t('modules.liturgia.strip.slide_none')"
            @click.stop="emitExec('none')"
          >
            <v-icon size="18">mdi-checkbox-multiple-blank-outline</v-icon>
          </v-btn>

          <!-- Overflow menu (audio-only + letra) -->
          <v-menu location="bottom end">
            <template #activator="{ props }">
              <v-btn
                icon
                :size="28"
                variant="text"
                class="lrow-act"
                v-bind="props"
                @click.stop
              >
                <v-icon size="18">mdi-dots-vertical</v-icon>
              </v-btn>
            </template>
            <v-list density="compact" min-width="200">
              <v-list-item
                :title="$t('modules.liturgia.strip.audio_only_sung')"
                prepend-icon="mdi-music-note"
                @click="emitExec('audio_only_sung')"
              />
              <v-list-item
                :title="hasInstrumental ? $t('modules.liturgia.strip.audio_only_playback') : $t('modules.liturgia.strip.playback_unavailable')"
                prepend-icon="mdi-music-note-outline"
                :disabled="!hasInstrumental"
                @click="emitExec('audio_only_playback')"
              />
              <v-list-item
                :title="$t('modules.liturgia.strip.lyric')"
                prepend-icon="mdi-text"
                @click="emitExec('lyric')"
              />
            </v-list>
          </v-menu>
        </template>

        <!-- File: 1 execute button -->
        <v-btn
          v-else-if="item.type === 'file'"
          icon
          :size="28"
          variant="text"
          class="lrow-act"
          :title="$t('modules.liturgia.execute')"
          @click.stop="$emit('execute', { item, mode: null })"
        >
          <v-icon size="18">mdi-play</v-icon>
        </v-btn>
      </div>

      <!-- 5. DIVIDER -->
      <div class="lrow-div" :class="isDark ? 'lrow-div--dark' : ''" />

      <!-- 6. EDIT -->
      <v-btn
        icon
        :size="28"
        variant="text"
        class="lrow-edit"
        :style="{ color: isDark ? '#f1c40f' : '#c49000' }"
        :title="$t('modules.liturgia.edit_item')"
        @click.stop="$emit('edit-toggle', item.id)"
      >
        <v-icon size="16">mdi-pencil</v-icon>
      </v-btn>

      <!-- 7. DRAG HANDLE -->
      <v-btn
        icon
        :size="28"
        variant="text"
        class="liturgia-drag-handle lrow-drag"
        :style="{ color: isDark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)' }"
      >
        <v-icon size="16">mdi-drag-vertical</v-icon>
      </v-btn>

    </div>

    <!-- Inline edit panel -->
    <LiturgiaItemEditPanel
      :item="item"
      :visible="editOpen"
      @update:item="$emit('update:item', $event)"
      @close="$emit('edit-toggle', item.id)"
    />
  </div>
</template>

<script>
import LiturgiaItemEditPanel from "./LiturgiaItemEditPanel.vue";
import LiturgiaFiles from "@/modules/liturgia/helpers/LiturgiaFiles";
import { resolveHandler } from "@/modules/liturgia/helpers/LiturgiaFileConfig";

export default {
  name: "LiturgiaItemRow",

  components: { LiturgiaItemEditPanel },

  props: {
    item: {
      type: Object,
      required: true,
    },
    dayIndex: {
      type: Number,
      required: true,
    },
    editOpen: {
      type: Boolean,
      default: false,
    },
  },

  emits: ["execute", "stop", "delete", "edit-toggle", "update:item"],

  computed: {
    isDark() {
      return this.$appdata.get('is_dark', false)
    },

    completed() {
      const states = this.$appdata.get("modules.liturgia.item_states", {});
      return states[this.item.id]?.completed === true;
    },

    isSelected() {
      return this.$appdata.get("modules.liturgia.selected_ids", []).includes(this.item.id);
    },

    isNowPlaying() {
      const np = this.$appdata.get("modules.liturgia.now_playing");
      return !!(np && np.item_id === this.item.id);
    },

    nowPlayingMode() {
      const np = this.$appdata.get("modules.liturgia.now_playing");
      return np?.item_id === this.item.id ? np.mode : null;
    },

    isPaused() {
      return this.$appdata.get("modules.media.config.is_paused", false);
    },

    needsReattach() {
      return this.item.type === "file" && !LiturgiaFiles.has(this.item.id);
    },

    hasInstrumental() {
      // We don't have DB access here; check if music_ref indicates playback available
      // Fallback: assume instrumental available unless explicitly false
      return this.item.music_ref?.has_instrumental !== false;
    },

    // ─── text block ──────────────────────────────────────────────────────────

    hymnNumber() {
      return this.item.music_ref?.song_number ?? null;
    },

    hymnalLabel() {
      const ref = this.item.music_ref;
      if (!ref) return '';
      return ref.hymnal_type === 'new'
        ? this.$t('modules.liturgia.hinario_adventista')
        : this.$t('modules.liturgia.hinario_other');
    },

    musicDuration() {
      return this.item.music_ref?.duration ?? null;
    },

    showPlannedChip() {
      return !!(
        this.item.planned_duration &&
        this.$userdata.get('modules.liturgia.time_tracking.enabled', false)
      );
    },

    // ─── file-specific ────────────────────────────────────────────────────────

    /** Returns the row label for the kind chip (untranslated literals per spec) */
    kindChipLabel() {
      const kind = this.item.file_ref?.kind;
      const name = (this.item.file_ref?.name || '').toLowerCase();
      if (kind === 'video')  return 'VIDEO';
      if (kind === 'audio')  return 'AUDIO';
      if (kind === 'image')  return 'IMG';
      if (kind === 'pdf')    return 'PDF';
      if (kind === 'text')   return 'TXT';
      // document: distinguish PPTX vs generic DOC by extension
      if (kind === 'document') {
        if (/\.pptx?$/.test(name)) return 'PPTX';
        return 'DOC';
      }
      return 'FILE';
    },

    kindChipColor() {
      const kind = this.item.file_ref?.kind;
      const name = (this.item.file_ref?.name || '').toLowerCase();
      if (kind === 'video')    return '#8e44ad';
      if (kind === 'audio')    return '#16a085';
      if (kind === 'image')    return '#2980b9';
      if (kind === 'pdf')      return '#c0392b';
      if (kind === 'text')     return '#7f8c8d';
      if (kind === 'document') {
        if (/\.pptx?$/.test(name)) return '#d35400';
        return '#7f8c8d';
      }
      return '#7f8c8d';
    },

    handlerHintIcon() {
      const kind = this.item.file_ref?.kind;
      if (!kind) return null;
      const h = resolveHandler(kind);
      const map = {
        popup:        'mdi-monitor',
        tab:          'mdi-open-in-new',
        download:     'mdi-download',
        hidden_audio: 'mdi-volume-high',
      };
      return map[h] || null;
    },

    handlerHintTooltip() {
      const kind = this.item.file_ref?.kind;
      if (!kind) return '';
      const h = resolveHandler(kind);
      return this.$t(`modules.liturgia.handler_hint.${h}`) || h;
    },

    // ─── type icon ────────────────────────────────────────────────────────────

    typeIcon() {
      if (this.item.type === "music") return "mdi-music-note";
      if (this.item.type === "file") {
        const kind = this.item.file_ref?.kind;
        const name = (this.item.file_ref?.name || '').toLowerCase();
        if (kind === "video") return "mdi-video";
        if (kind === "audio") return "mdi-volume-high";
        if (kind === "image") return "mdi-image";
        if (kind === "pdf")   return "mdi-file-pdf-box";
        if (kind === "text")  return "mdi-text-box-outline";
        if (kind === "document") {
          if (/\.pptx?$/.test(name)) return "mdi-presentation";
          return "mdi-file";
        }
        return "mdi-file";
      }
      return "mdi-tag-outline";
    },

    // ─── styles ───────────────────────────────────────────────────────────────

    iconBlockStyle() {
      return {
        backgroundColor: this.item.color || '#1a3a5c',
      };
    },

    catStyle() {
      const bg = this.item.color
        ? this.item.color
        : null;
      return bg ? { background: bg } : {};
    },

    rowStyle() {
      if (this.isNowPlaying) {
        return {
          borderLeft: `3px solid ${this.item.color || '#1a3a5c'}`,
          background: 'rgba(var(--v-theme-primary), .06)',
          paddingLeft: '5px',
        };
      }
      if (this.isSelected) {
        return {
          background: 'rgba(var(--v-theme-primary), .05)',
        };
      }
      return {};
    },

    rowClasses() {
      return {
        'lrow--completed': this.completed,
        'lrow--playing':   this.isNowPlaying,
        'lrow--selected':  this.isSelected,
        'lrow--dark':      this.isDark,
      };
    },
  },

  methods: {
    toggleSelect() {
      const cur = this.$appdata.get("modules.liturgia.selected_ids", []);
      const next = cur.includes(this.item.id)
        ? cur.filter((x) => x !== this.item.id)
        : [...cur, this.item.id];
      this.$appdata.set("modules.liturgia.selected_ids", next);
    },

    emitExec(mode) {
      this.$emit("execute", { item: this.item, mode });
    },
  },
};
</script>

<style scoped>
/* ── wrapper ── */
.lrow-wrapper {
  display: block;
}

/* ── CATEGORY BAR — 36px ── */
.lrow-cat {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 10px;
  background: linear-gradient(#3a3f44, #2c2f33);
  border-radius: 2px;
}
.lrow-cat-text {
  flex: 1;
  text-align: center;
  color: #fff;
  font-size: 12px;
  line-height: 36px;
  font-weight: 700;
  letter-spacing: .5px;
}
.lrow-cat-edit,
.lrow-cat-drag {
  flex: none;
}

/* ── NORMAL ROW — 56px ── */
.lrow {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 6px 0 8px;
  cursor: pointer;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(0, 0, 0, .07);
  position: relative;
  transition: background .1s;
}
.lrow--dark {
  border-bottom-color: rgba(255, 255, 255, .07);
}
.lrow:hover {
  background: rgba(0, 0, 0, .03);
}
.lrow--dark:hover {
  background: rgba(255, 255, 255, .04);
}
.lrow--completed {
  opacity: .55;
}
/* playing and selected backgrounds handled via rowStyle binding */

/* ── 1. CHECKBOX ── */
.lrow-check {
  flex: none;
  margin: 0 6px 0 0;
}
.lrow-check :deep(.v-selection-control) {
  min-height: 0;
  height: 24px;
  width: 24px;
}
.lrow-check :deep(.v-selection-control__wrapper),
.lrow-check :deep(.v-selection-control__input) {
  width: 24px;
  height: 24px;
}
.lrow-check :deep(.v-selection-control__input .v-icon) {
  font-size: 18px;
}

/* ── 2. ICON BLOCK — 36x36 ── */
.lrow-icon-block {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  flex: none;
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}
.lrow-type-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Play overlay (shown on row hover when not playing) */
.lrow-play-overlay {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: rgba(0, 0, 0, .45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  z-index: 2;
  transition: opacity .15s;
}
.lrow:hover .lrow-play-overlay {
  opacity: 1;
}
/* Hide play overlay when playing (stop overlay takes over) */
.lrow--playing .lrow-play-overlay {
  display: none;
}

/* Equalizer + stop overlay wrap */
.lrow-eq-wrap {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
  cursor: pointer;
}
.lrow-stop-overlay {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: rgba(0, 0, 0, .55);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity .15s;
  z-index: 4;
}
.lrow-eq-wrap:hover .lrow-stop-overlay {
  opacity: 1;
}
.lrow-eq-wrap:hover .lrow-equalizer {
  opacity: 0;
}

/* Equalizer bars */
.lrow-equalizer {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 18px;
  z-index: 3;
}
.lrow-equalizer span {
  display: block;
  width: 3px;
  background: #fff;
  border-radius: 1px;
  animation: eq-bounce 0.6s ease-in-out infinite alternate;
}
.lrow-equalizer span:nth-child(1) { animation-delay: 0s;    height: 100%; }
.lrow-equalizer span:nth-child(2) { animation-delay: .15s;  height: 60%;  }
.lrow-equalizer span:nth-child(3) { animation-delay: .3s;   height: 80%;  }
.lrow-equalizer--paused span {
  animation-play-state: paused;
}
@keyframes eq-bounce {
  from { transform: scaleY(.3); }
  to   { transform: scaleY(1);  }
}

/* Re-attach amber badge */
.lrow-reattach-badge {
  position: absolute;
  top: -4px;
  right: -6px;
  z-index: 5;
}

/* ── 3. TEXT BLOCK ── */
.lrow-text {
  flex: 1 1 auto;
  min-width: 0;
  margin-right: 8px;
  padding: 11px 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0;
}

.lrow-title {
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lrow--dark .lrow-title {
  color: #eee;
}
.lrow-title--playing {
  color: rgb(var(--v-theme-primary));
}
.lrow-title--completed {
  text-decoration: line-through;
  color: rgba(0, 0, 0, .45);
}
.lrow--dark .lrow-title--completed {
  color: rgba(255, 255, 255, .4);
}

.lrow-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 16px;
  font-size: 11px;
  line-height: 16px;
  color: rgba(0, 0, 0, .55);
  overflow: hidden;
}
.lrow--dark .lrow-meta {
  color: rgba(255, 255, 255, .55);
}
.lrow-meta-text {
  font-size: 11px;
  line-height: 16px;
  min-width: 0;
}

/* Chip standard */
.lrow-chip {
  height: 16px !important;
  font-size: 10px !important;
  line-height: 16px !important;
  padding: 0 6px !important;
  border-radius: 8px !important;
  flex: none;
  letter-spacing: normal !important;
}

.lrow-handler-icon {
  opacity: .6;
  flex: none;
}

/* ── 4. ACTION STRIP ── */
.lrow-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

/* Subdued-always rule */
.lrow-act {
  color: rgba(0, 0, 0, .45);
  flex: none;
}
.lrow--dark .lrow-act {
  color: rgba(255, 255, 255, .5);
}
.lrow:hover .lrow-act {
  color: rgba(0, 0, 0, .70);
}
.lrow--dark:hover .lrow-act {
  color: rgba(255, 255, 255, .8);
}
.lrow-act--active {
  color: rgb(var(--v-theme-primary)) !important;
  opacity: 1 !important;
}

/* ── 5. DIVIDER ── */
.lrow-div {
  width: 1px;
  height: 28px;
  margin: 0 6px;
  background: rgba(0, 0, 0, .12);
  flex: none;
}
.lrow-div--dark {
  background: rgba(255, 255, 255, .12);
}

/* ── 6. EDIT ── */
.lrow-edit {
  flex: none;
  opacity: .75;
  transition: opacity .1s;
}
.lrow-edit:hover {
  opacity: 1;
}

/* ── 7. DRAG ── */
.lrow-drag {
  flex: none;
  cursor: grab;
}
</style>
