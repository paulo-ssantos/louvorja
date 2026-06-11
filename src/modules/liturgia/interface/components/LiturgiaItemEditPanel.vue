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

      <!-- Color swatches -->
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
              border: item.color === color ? '2px solid #333' : '2px solid transparent',
            }"
            @click="update('color', color)"
          />
        </div>
      </div>

      <!-- Playback mode (music only) -->
      <v-select
        v-if="item.type === 'music'"
        :model-value="item.music_ref && item.music_ref.playback_mode"
        :label="$t('modules.liturgia.playback_mode_label')"
        :items="playbackModes"
        item-value="value"
        item-title="title"
        density="compact"
        hide-details
        variant="outlined"
        class="mb-3"
        @update:model-value="updatePlaybackMode($event)"
      />

      <!-- Re-search song (music only) -->
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

  emits: ["update:item"],

  data: () => ({
    colors: LITURGIA_COLORS,
    selectedSong: null,
  }),

  computed: {
    playbackModes() {
      return [
        { value: "sung", title: this.$t("modules.liturgia.playback.sung") },
        { value: "playback", title: this.$t("modules.liturgia.playback.playback") },
        { value: "none", title: this.$t("modules.liturgia.playback.none") },
      ];
    },
  },

  methods: {
    update(field, value) {
      this.$emit("update:item", { ...this.item, [field]: value });
    },

    updatePlaybackMode(mode) {
      const music_ref = { ...(this.item.music_ref || {}), playback_mode: mode };
      this.$emit("update:item", { ...this.item, music_ref });
    },

    updateSong(song) {
      if (!song) return;
      const music_ref = {
        ...(this.item.music_ref || {}),
        song_id: song.id_music,
        id_album: song.id_album ?? null,
        song_number: song.track ?? null,
        hymnal_type: song.hymnal_type || null,
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
