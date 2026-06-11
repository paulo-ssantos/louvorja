<template>
  <div class="liturgia-item-row-wrapper">

    <!-- ========== CATEGORY BAR ========== -->
    <div
      v-if="item.type === 'category'"
      class="liturgia-category-bar d-flex align-center"
      style="
        background: linear-gradient(#3a3f44, #2c2f33);
        padding: 8px 12px;
        min-height: 40px;
        border-radius: 2px;
      "
    >
      <!-- Centered bold white text -->
      <div class="flex-grow-1 text-center font-weight-bold" style="color: #fff; font-size: 13px; letter-spacing: 0.5px;">
        {{ item.display_name || '(sem nome)' }}
      </div>

      <!-- Pencil (theme-aware) -->
      <v-btn
        icon
        size="34"
        variant="text"
        :color="$vuetify.theme.current.dark ? '#f1c40f' : '#c49000'"
        :title="$t('modules.liturgia.edit_item')"
        @click.stop="$emit('edit-toggle', item.id)"
      >
        <v-icon size="18">mdi-pencil</v-icon>
      </v-btn>

      <!-- Drag handle -->
      <v-btn
        icon
        size="34"
        variant="text"
        class="liturgia-drag-handle ml-1"
        style="cursor: grab;"
      >
        <v-icon size="18">mdi-drag-vertical</v-icon>
      </v-btn>
    </div>

    <!-- ========== NORMAL ROW (music / file) ========== -->
    <div
      v-else
      class="liturgia-item-row d-flex align-center"
      :class="{ 'liturgia-item-row--completed': completed }"
      :style="rowStyle"
      style="min-height: 52px; cursor: pointer; background: #fff; border-bottom: 1px solid rgba(0,0,0,0.07);"
      @click="$emit('execute', { item, mode: null })"
    >
      <!-- (a) Selection checkbox -->
      <v-checkbox
        density="compact"
        hide-details
        :model-value="isSelected"
        class="mx-1 flex-shrink-0"
        style="pointer-events: auto;"
        @click.stop
        @update:model-value="toggleSelect"
      />

      <!-- (b) Colored type-icon block with hover overlay + re-attach amber alert -->
      <div
        class="d-flex align-center justify-center flex-shrink-0 mr-2 liturgia-icon-block-wrap"
        style="position: relative;"
      >
        <!-- Now-playing CSS equalizer OR normal icon -->
        <div
          :style="{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: item.color || '#1a3a5c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }"
          class="liturgia-icon-block"
        >
          <!-- CSS equalizer (now-playing) -->
          <div v-if="isNowPlaying" class="liturgia-eq" :class="{ 'liturgia-eq--paused': isPaused }">
            <span class="liturgia-eq__bar liturgia-eq__bar--1"></span>
            <span class="liturgia-eq__bar liturgia-eq__bar--2"></span>
            <span class="liturgia-eq__bar liturgia-eq__bar--3"></span>
          </div>
          <!-- Normal icon -->
          <v-icon v-else size="18" color="white">{{ typeIcon }}</v-icon>

          <!-- Hover play overlay (UX) -->
          <v-tooltip :text="$t('modules.liturgia.row.click_to_execute')" location="top" :open-delay="700">
            <template v-slot:activator="{ props: tipProps }">
              <div
                v-bind="tipProps"
                class="liturgia-icon-block-hover"
                style="
                  position: absolute; inset: 0; display: flex; align-items: center;
                  justify-content: center; border-radius: 6px;
                  background: rgba(255,255,255,0.18); opacity: 0; transition: opacity 0.15s;
                  pointer-events: none;
                "
              >
                <v-icon size="16" color="white">mdi-play</v-icon>
              </div>
            </template>
          </v-tooltip>
        </div>

        <!-- Re-attach hint (file only, no live handle) -->
        <v-icon
          v-if="needsReattach"
          size="14"
          color="amber"
          style="position: absolute; top: -4px; right: -6px;"
          :title="$t('modules.liturgia.reattach_hint')"
        >
          mdi-alert
        </v-icon>
      </div>

      <!-- (c)+(d) Title + subtitle -->
      <div class="flex-grow-1 mr-2 text-truncate" style="min-width: 0;">
        <div
          class="font-weight-bold text-truncate"
          style="font-size: 13px; color: #1a1a1a; line-height: 1.3;"
          :class="{ 'text-decoration-line-through text-medium-emphasis': completed }"
        >
          {{ item.display_name || '(sem nome)' }}
        </div>
        <div
          v-if="subtitle"
          class="text-caption text-medium-emphasis text-truncate d-flex align-center"
          style="font-size: 11px; line-height: 1.2;"
        >
          <span>{{ subtitle }}</span>
          <!-- F4: planned duration chip -->
          <v-chip
            v-if="item.planned_duration && timeTrackingEnabled"
            x-small
            size="x-small"
            color="grey"
            variant="tonal"
            class="ml-1"
            style="height: 16px; font-size: 10px;"
          >
            {{ $t('modules.liturgia.time.minutes_chip', { n: item.planned_duration }) }}
          </v-chip>
        </div>
      </div>

      <!-- (e) Music strip (music only) — new 4-button strip -->
      <template v-if="item.type === 'music'">
        <!-- (1) Slide cantado -->
        <v-tooltip :text="$t('modules.liturgia.strip.slide_sung')" location="top" :open-delay="400">
          <template v-slot:activator="{ props: tipProps }">
            <v-btn
              v-bind="tipProps"
              icon
              size="34"
              variant="text"
              :color="isNowPlaying && nowPlayingMode === 'sung' ? 'primary' : undefined"
              :style="isNowPlaying && nowPlayingMode !== 'sung' ? 'opacity:0.6' : ''"
              @click.stop="emitExec('sung')"
            >
              <v-icon size="20">mdi-play-box-multiple</v-icon>
            </v-btn>
          </template>
        </v-tooltip>

        <!-- (2) Slide playback -->
        <v-tooltip
          :text="hasInstrumental === false
            ? $t('modules.liturgia.strip.playback_unavailable')
            : $t('modules.liturgia.strip.slide_playback')"
          location="top"
          :open-delay="400"
        >
          <template v-slot:activator="{ props: tipProps }">
            <span v-bind="tipProps">
              <v-btn
                icon
                size="34"
                variant="text"
                :disabled="hasInstrumental === false"
                :color="isNowPlaying && nowPlayingMode === 'playback' ? 'primary' : undefined"
                :style="isNowPlaying && nowPlayingMode !== 'playback' ? 'opacity:0.6' : ''"
                @click.stop="emitExec('playback')"
              >
                <v-icon size="20">mdi-play-box-multiple-outline</v-icon>
              </v-btn>
            </span>
          </template>
        </v-tooltip>

        <!-- (3) Slide sem áudio -->
        <v-tooltip :text="$t('modules.liturgia.strip.slide_none')" location="top" :open-delay="400">
          <template v-slot:activator="{ props: tipProps }">
            <v-btn
              v-bind="tipProps"
              icon
              size="34"
              variant="text"
              :color="isNowPlaying && nowPlayingMode === 'none' ? 'primary' : undefined"
              :style="isNowPlaying && nowPlayingMode !== 'none' ? 'opacity:0.6' : ''"
              @click.stop="emitExec('none')"
            >
              <v-icon size="20">mdi-checkbox-multiple-blank-outline</v-icon>
            </v-btn>
          </template>
        </v-tooltip>

        <!-- (4) Overflow menu -->
        <v-menu location="start" :close-on-content-click="true">
          <template v-slot:activator="{ props: menuProps }">
            <v-tooltip :text="''" location="top" :open-delay="400">
              <template v-slot:activator="{ props: tipProps }">
                <v-btn
                  v-bind="{ ...menuProps, ...tipProps }"
                  icon
                  size="34"
                  variant="text"
                  @click.stop
                >
                  <v-icon size="20">mdi-dots-vertical</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
          </template>
          <v-list density="compact">
            <!-- Audio only sung -->
            <v-list-item
              :title="$t('modules.liturgia.strip.audio_only_sung')"
              prepend-icon="mdi-file-music"
              @click.stop="$emit('audio-only', { item, mode: 'sung' })"
            />
            <!-- Audio only playback -->
            <v-list-item
              :title="$t('modules.liturgia.strip.audio_only_playback')"
              prepend-icon="mdi-file-music-outline"
              :disabled="hasInstrumental === false"
              @click.stop="$emit('audio-only', { item, mode: 'playback' })"
            />
            <!-- Letra -->
            <v-list-item
              :title="$t('modules.liturgia.strip.lyric')"
              prepend-icon="mdi-text-box-outline"
              @click.stop="$emit('lyric', { item })"
            />
          </v-list>
        </v-menu>
      </template>

      <!-- File row: single Executar button -->
      <template v-if="item.type === 'file'">
        <v-tooltip :text="$t('modules.liturgia.execute')" location="top" :open-delay="400">
          <template v-slot:activator="{ props: tipProps }">
            <v-btn
              v-bind="tipProps"
              icon
              size="34"
              variant="text"
              @click.stop="$emit('execute', { item, mode: null })"
            >
              <v-icon size="20">mdi-play</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </template>

      <!-- Vertical divider before edit/drag -->
      <v-divider vertical class="mx-1" style="height: 24px; align-self: center;" />

      <!-- (f) Pencil (theme-aware) -->
      <v-tooltip :text="$t('modules.liturgia.edit_item')" location="top" :open-delay="400">
        <template v-slot:activator="{ props: tipProps }">
          <v-btn
            v-bind="tipProps"
            icon
            size="34"
            variant="text"
            :color="$vuetify.theme.current.dark ? '#f1c40f' : '#c49000'"
            @click.stop="$emit('edit-toggle', item.id)"
          >
            <v-icon size="18">mdi-pencil</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- (g) Drag handle -->
      <v-btn
        icon
        size="34"
        variant="text"
        class="liturgia-drag-handle ml-1 mr-1 flex-shrink-0"
        style="cursor: grab;"
      >
        <v-icon size="18">mdi-drag-vertical</v-icon>
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

  emits: ["execute", "audio-only", "lyric", "delete", "edit-toggle", "update:item"],

  computed: {
    completed() {
      const states = this.$appdata.get("modules.liturgia.item_states", {});
      return states[this.item.id]?.completed === true;
    },

    isSelected() {
      return this.$appdata.get("modules.liturgia.selected_ids", []).includes(this.item.id);
    },

    needsReattach() {
      return this.item.type === "file" && !LiturgiaFiles.has(this.item.id);
    },

    // F7: now-playing reactive state
    nowPlaying() {
      return this.$appdata.get("modules.liturgia.now_playing", null);
    },

    isNowPlaying() {
      const np = this.nowPlaying;
      return np && np.day_index === this.dayIndex && np.item_id === this.item.id;
    },

    nowPlayingMode() {
      return this.isNowPlaying ? this.nowPlaying.mode : null;
    },

    isPaused() {
      return this.$appdata.get("modules.media.config.is_paused", false);
    },

    // F4: time tracking enabled
    timeTrackingEnabled() {
      return this.$userdata.get("modules.liturgia.time_tracking.enabled", false);
    },

    // F3: has_instrumental check
    hasInstrumental() {
      const v = this.item.music_ref?.has_instrumental;
      // undefined/null = unknown = treated as available (backward compat)
      if (v === false) return false;
      return true;
    },

    typeIcon() {
      if (this.item.type === "music") return "mdi-music-note";
      if (this.item.type === "file") {
        const kind = this.item.file_ref?.kind;
        if (kind === "video") return "mdi-video";
        if (kind === "audio") return "mdi-volume-high";
        if (kind === "image") return "mdi-image";
        return "mdi-file";
      }
      return "mdi-tag-outline";
    },

    subtitle() {
      if (this.item.type === "music" && this.item.music_ref) {
        const ref = this.item.music_ref;
        const num = ref.song_number;
        const hymnalLabel =
          ref.hymnal_type === "new"
            ? this.$t("modules.liturgia.hinario_adventista")
            : this.$t("modules.liturgia.hinario_other");
        const namePart = this.item.display_name || "";
        return num
          ? `Hino nº ${num} - ${namePart} (${hymnalLabel})`
          : namePart;
      }
      if (this.item.type === "file" && this.item.file_ref) {
        return this.$t("modules.liturgia.file_prefix") + " " + this.item.file_ref.path;
      }
      return "";
    },

    // F7: left border + background tint when now-playing
    rowStyle() {
      if (!this.isNowPlaying) return {};
      const color = this.item.color || "#1a3a5c";
      return {
        borderLeft: `3px solid ${color}`,
        background: "rgba(var(--v-theme-primary), 0.06)",
      };
    },
  },

  watch: {
    // F7/3.5: self-scroll when this row becomes now-playing
    isNowPlaying(val) {
      if (val) {
        this.$nextTick(() => {
          const el = this.$el.querySelector(".liturgia-item-row");
          if (el) el.scrollIntoView({ block: "nearest" });
        });
      }
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
.liturgia-item-row--completed {
  opacity: 0.5;
}

/* Hover: show the overlay on the icon block */
.liturgia-item-row:hover .liturgia-icon-block .liturgia-icon-block-hover {
  opacity: 1 !important;
}

/* CSS equalizer animation */
.liturgia-eq {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  height: 18px;
}

.liturgia-eq__bar {
  display: block;
  width: 3px;
  background: #fff;
  border-radius: 1px;
  animation: liturgia-eq-bounce 900ms ease-in-out infinite;
}

.liturgia-eq__bar--1 {
  height: 6px;
  animation-delay: 0ms;
}
.liturgia-eq__bar--2 {
  height: 14px;
  animation-delay: 150ms;
}
.liturgia-eq__bar--3 {
  height: 10px;
  animation-delay: 300ms;
}

.liturgia-eq--paused .liturgia-eq__bar {
  animation-play-state: paused;
}

@keyframes liturgia-eq-bounce {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.4); }
}
</style>
