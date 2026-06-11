<template>
  <v-expand-transition>
    <div
      v-if="visible"
      class="liturgia-edit-panel pa-3"
      style="background: rgba(0,0,0,0.03); border-top: 1px solid rgba(0,0,0,0.1);"
    >
      <!-- Display name -->
      <v-text-field
        :model-value="item.display_name"
        :label="$t('modules.liturgia.display_name_label')"
        density="compact"
        hide-details
        variant="outlined"
        class="mb-3"
        @update:model-value="update('display_name', $event)"
      />

      <!-- Color swatches (selected ring = primary theme color) -->
      <div class="mb-3">
        <div class="text-caption text-medium-emphasis mb-1">{{ $t('modules.liturgia.color_label') }}</div>
        <div class="d-flex flex-wrap ga-1">
          <div
            v-for="color in colors"
            :key="color"
            :style="{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: color,
              cursor: 'pointer',
              border: item.color === color
                ? '2px solid rgb(var(--v-theme-primary))'
                : '2px solid transparent',
            }"
            @click="update('color', color)"
          />
        </div>
      </div>

      <!-- F4: Planned duration (time tracking enabled only) -->
      <v-text-field
        v-if="item.type === 'music' && timeTrackingEnabled"
        :model-value="item.planned_duration != null ? String(item.planned_duration) : ''"
        :label="$t('modules.liturgia.time.planned_duration_label')"
        type="number"
        density="compact"
        hide-details
        variant="outlined"
        class="mb-3"
        min="0"
        @update:model-value="updatePlannedDuration($event)"
      />

      <!-- Re-search song (music only) — F2: no playback-mode select -->
      <div v-if="item.type === 'music'">
        <div class="text-caption text-medium-emphasis mb-1">{{ $t('modules.liturgia.search_song_label') }}</div>
        <LiturgiaSongSearch
          :model-value="selectedSong"
          @update:model-value="updateSong($event)"
        />
      </div>

      <!-- File re-pick section (file only) -->
      <div v-if="item.type === 'file'" class="mt-2">
        <div v-if="item.file_ref" class="text-caption text-medium-emphasis mb-2">
          {{ item.file_ref.path }}
        </div>

        <v-btn
          variant="outlined"
          size="small"
          @click="$refs.fileRepickInput.click()"
        >
          <v-icon start size="16">mdi-folder-open-outline</v-icon>
          {{ $t('modules.liturgia.repick_file') }}
        </v-btn>

        <!-- Hidden file input -->
        <input
          ref="fileRepickInput"
          type="file"
          style="display: none;"
          @change="onRepickFile"
        />
      </div>

      <!-- UX: Concluir (close edit panel) button -->
      <div class="d-flex justify-end mt-3">
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-check"
          @click="$emit('close')"
        >
          {{ $t('modules.liturgia.done_btn') }}
        </v-btn>
      </div>
    </div>
  </v-expand-transition>
</template>

<script>
import { LITURGIA_COLORS } from "@/constants/liturgia-colors";
import LiturgiaSongSearch from "@/components/LiturgiaSongSearch.vue";
import LiturgiaFiles from "@/modules/liturgia/helpers/LiturgiaFiles";

export default {
  name: "LiturgiaItemEditPanel",

  components: { LiturgiaSongSearch },

  props: {
    item: {
      type: Object,
      required: true,
    },
    visible: {
      type: Boolean,
      default: false,
    },
  },

  emits: ["update:item", "close"],

  data: () => ({
    colors: LITURGIA_COLORS,
    selectedSong: null,
  }),

  computed: {
    // F4: time tracking enabled
    timeTrackingEnabled() {
      return this.$userdata.get("modules.liturgia.time_tracking.enabled", false);
    },
  },

  methods: {
    update(field, value) {
      this.$emit("update:item", { ...this.item, [field]: value });
    },

    // F4: planned duration update
    updatePlannedDuration(value) {
      const planned_duration = value === "" || value == null ? null : Number(value);
      this.$emit("update:item", { ...this.item, planned_duration });
    },

    // F3/5.2: updateSong also sets has_instrumental from the song record
    updateSong(song) {
      if (!song) return;

      let hasInstrumental;
      if (song.url_instrumental_music) {
        hasInstrumental = true;
      } else if (song.has_instrumental_music !== undefined) {
        hasInstrumental = !!song.has_instrumental_music;
      } else {
        hasInstrumental = undefined;
      }

      const music_ref = {
        ...(this.item.music_ref || {}),
        song_id: song.id_music,
        id_album: song.id_album ?? null,
        song_number: song.track ?? null,
        hymnal_type: song.hymnal_type || null,
        // F2: preserve playback_mode as 'sung' (always — mode chosen at execution)
        playback_mode: "sung",
        // F3: update has_instrumental
        ...(hasInstrumental !== undefined ? { has_instrumental: hasInstrumental } : {}),
      };

      this.$emit("update:item", {
        ...this.item,
        display_name: song.name || song.title || this.item.display_name,
        music_ref,
      });
      this.selectedSong = song;
    },

    onRepickFile(e) {
      const file = e.target.files[0];
      if (!file) return;

      LiturgiaFiles.register(this.item.id, file);

      this.$emit("update:item", {
        ...this.item,
        file_ref: {
          name: file.name,
          path: file.webkitRelativePath || file.name,
          kind: LiturgiaFiles.kindFromFile(file),
          mime: file.type,
        },
      });
    },
  },
};
</script>
