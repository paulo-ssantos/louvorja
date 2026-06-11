<template>
  <v-dialog v-model="open" max-width="500" persistent>
    <v-card>
      <v-card-title class="text-h6 pa-4 pb-2">
        {{ $t('modules.liturgia.add_item') }}
      </v-card-title>

      <v-card-text class="pa-4 pt-2">
        <!-- Tab selector -->
        <v-tabs v-model="tab" density="compact" class="mb-4">
          <v-tab value="music">
            <v-icon size="16" class="mr-1">mdi-music-note</v-icon>
            {{ $t('modules.liturgia.add_music') }}
          </v-tab>
          <v-tab value="file">
            <v-icon size="16" class="mr-1">mdi-folder-file-outline</v-icon>
            {{ $t('modules.liturgia.add_file') }}
          </v-tab>
          <v-tab value="category">
            <v-icon size="16" class="mr-1">mdi-tag-outline</v-icon>
            {{ $t('modules.liturgia.add_category') }}
          </v-tab>
        </v-tabs>

        <v-window v-model="tab">
          <!-- Music tab -->
          <v-window-item value="music">
            <LiturgiaSongSearch
              v-model="selectedSong"
              class="mb-4"
            />

            <div v-if="selectedSong" class="mb-3">
              <v-chip size="small" color="blue" label class="mr-1">
                <v-icon start size="14">mdi-music-note</v-icon>
                {{ selectedSong.name || selectedSong.title }}
              </v-chip>
            </div>

            <!-- F2: Mode hint caption (replaces mode v-select) -->
            <div class="text-caption text-medium-emphasis mt-1">
              {{ $t('modules.liturgia.add.mode_hint') }}
            </div>
          </v-window-item>

          <!-- File tab -->
          <v-window-item value="file">
            <v-text-field
              v-model="fileName"
              :label="$t('modules.liturgia.display_name_label')"
              density="compact"
              hide-details
              variant="outlined"
              class="mb-3"
            />

            <div class="d-flex align-center ga-3">
              <v-btn
                variant="outlined"
                size="small"
                @click="$refs.fileInput.click()"
              >
                <v-icon start size="16">mdi-folder-open-outline</v-icon>
                {{ $t('modules.liturgia.browse') }}
              </v-btn>

              <span v-if="pickedFile" class="text-caption text-medium-emphasis">
                {{ pickedFile.name }}
              </span>
              <span v-else class="text-caption text-medium-emphasis">
                —
              </span>
            </div>

            <!-- Hidden file input -->
            <input
              ref="fileInput"
              type="file"
              style="display: none;"
              @change="onFilePicked"
            />
          </v-window-item>

          <!-- Category tab -->
          <v-window-item value="category">
            <v-text-field
              v-model="categoryName"
              :label="$t('modules.liturgia.category_name_label')"
              density="compact"
              hide-details
              variant="outlined"
              autofocus
              class="mb-3"
            />

            <!-- UX: Color swatches for category -->
            <div>
              <div class="text-caption text-medium-emphasis mb-1">{{ $t('modules.liturgia.color_label') }}</div>
              <div class="d-flex flex-wrap ga-1">
                <div
                  v-for="color in LITURGIA_COLORS"
                  :key="color"
                  :style="{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    backgroundColor: color,
                    cursor: 'pointer',
                    border: categoryColor === color
                      ? '2px solid rgb(var(--v-theme-primary))'
                      : '2px solid transparent',
                  }"
                  @click="categoryColor = color"
                />
              </div>
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions class="pa-4 pt-0">
        <v-spacer />
        <v-btn variant="text" @click="cancel">
          {{ $t('modules.liturgia.cancel_btn') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!canAdd"
          @click="confirm"
        >
          {{ $t('modules.liturgia.add_btn') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { uuid } from "@/helpers/Uuid";
import LiturgiaSongSearch from "@/components/LiturgiaSongSearch.vue";
import LiturgiaFiles from "@/modules/liturgia/helpers/LiturgiaFiles";
import { LITURGIA_COLORS } from "@/constants/liturgia-colors";

export default {
  name: "LiturgiaAddDialog",

  components: { LiturgiaSongSearch },

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },

  emits: ["update:modelValue", "add"],

  data: () => ({
    tab: "music",
    selectedSong: null,
    categoryName: "",
    categoryColor: "#1a3a5c",
    fileName: "",
    pickedFile: null,
    LITURGIA_COLORS,
  }),

  computed: {
    open: {
      get() {
        return this.modelValue;
      },
      set(val) {
        this.$emit("update:modelValue", val);
      },
    },

    canAdd() {
      if (this.tab === "music") return !!this.selectedSong;
      if (this.tab === "file") return !!this.pickedFile;
      return this.categoryName.trim().length > 0;
    },
  },

  watch: {
    modelValue(val) {
      if (val) {
        this.reset();
      }
    },
  },

  methods: {
    reset() {
      this.tab = "music";
      this.selectedSong = null;
      this.categoryName = "";
      this.categoryColor = "#1a3a5c";
      this.fileName = "";
      this.pickedFile = null;
    },

    cancel() {
      this.open = false;
    },

    onFilePicked(e) {
      this.pickedFile = e.target.files[0] || null;
      if (this.pickedFile && !this.fileName) {
        this.fileName = this.pickedFile.name;
      }
    },

    confirm() {
      if (!this.canAdd) return;

      const defaultColor = "#1a3a5c";

      let item;
      if (this.tab === "music") {
        // F3: set has_instrumental from the song record when available
        const song = this.selectedSong;
        let hasInstrumental;
        if (song.url_instrumental_music) {
          hasInstrumental = true;
        } else if (song.has_instrumental_music !== undefined) {
          hasInstrumental = !!song.has_instrumental_music;
        } else {
          hasInstrumental = undefined; // unknown — backward compat
        }

        item = {
          id: uuid(),
          type: "music",
          display_name: song.name || song.title || "",
          color: defaultColor,
          order: 0,
          music_ref: {
            song_id: song.id_music,
            id_album: null,
            song_number: song.track ?? null,
            hymnal_type: song.hymnal_type || null,
            // F2: always 'sung' — mode chosen at execution, not here
            playback_mode: "sung",
            // F3: has_instrumental (undefined = unknown = available)
            ...(hasInstrumental !== undefined ? { has_instrumental: hasInstrumental } : {}),
            // F3: duration chip snapshot (when the record provides it)
            ...(song.duration || song.time ? { duration: song.duration ?? song.time } : {}),
          },
          file_ref: null,
        };
      } else if (this.tab === "file") {
        const id = uuid();
        item = {
          id,
          type: "file",
          display_name: this.fileName || this.pickedFile.name,
          color: defaultColor,
          order: 0,
          music_ref: null,
          file_ref: {
            name: this.pickedFile.name,
            path: this.pickedFile.webkitRelativePath || this.pickedFile.name,
            kind: LiturgiaFiles.kindFromFile(this.pickedFile),
            mime: this.pickedFile.type,
          },
        };
        LiturgiaFiles.register(id, this.pickedFile);
      } else {
        item = {
          id: uuid(),
          type: "category",
          display_name: this.categoryName.trim(),
          color: this.categoryColor,
          order: 0,
          music_ref: null,
          file_ref: null,
        };
      }

      this.$emit("add", item);
      this.open = false;
    },
  },
};
</script>
