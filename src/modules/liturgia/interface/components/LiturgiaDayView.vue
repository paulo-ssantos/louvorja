<template>
  <div class="liturgia-day-view d-flex" style="min-height: 0; flex: 1;">

    <!-- Hidden file input for re-attaching files -->
    <input
      ref="reattachInput"
      type="file"
      style="display: none;"
      @change="onReattachPicked"
    />

    <!-- Left: draggable item list -->
    <div class="flex-grow-1" style="min-width: 0; overflow-y: auto;">
      <!-- Empty state -->
      <div
        v-if="dayItems.length === 0"
        class="text-center text-medium-emphasis pa-8"
      >
        <v-icon size="40" class="mb-2 d-block">mdi-playlist-plus</v-icon>
        {{ $t('modules.liturgia.no_items') }}
      </div>

      <!-- Draggable item list -->
      <draggable
        v-else
        v-model="dayItems"
        item-key="id"
        handle=".liturgia-drag-handle"
        ghost-class="liturgia-ghost"
      >
        <template #item="{ element }">
          <LiturgiaItemRow
            :item="element"
            :day-index="dayIndex"
            :edit-open="editOpenId === element.id"
            @execute="executeItem($event)"
            @audio-only="onAudioOnly($event)"
            @lyric="onLyric($event)"
            @delete="deleteItem(element.id)"
            @edit-toggle="toggleEdit(element.id)"
            @update:item="updateItem($event)"
          />
        </template>
      </draggable>
    </div>

    <!-- Right: notes side panel (shown when note_panel_open) -->
    <div
      v-if="notePanelOpen"
      style="
        width: 280px;
        flex-shrink: 0;
        border-left: 1px solid rgba(0,0,0,0.12);
        padding: 12px;
        overflow-y: auto;
      "
    >
      <v-textarea
        :model-value="dayNotes"
        :label="$t('modules.liturgia.notes_label')"
        density="compact"
        hide-details
        variant="outlined"
        rows="8"
        auto-grow
        @update:model-value="saveNotes($event)"
      />
    </div>

    <!-- Execute snackbar (F7/UX) -->
    <v-snackbar
      v-model="execSnackbar"
      :timeout="2000"
      location="bottom"
      color="primary"
    >
      {{ execSnackbarText }}
    </v-snackbar>

  </div>
</template>

<script>
import draggable from "vuedraggable";
import LiturgiaItemRow from "./LiturgiaItemRow.vue";
import LiturgiaFiles from "@/modules/liturgia/helpers/LiturgiaFiles";

// LiturgiaTimeTracking is owned by Engineer A. Import defensively —
// if the file doesn't exist yet (before A merges), the module resolves
// to a no-op stub so all B's calls are safe.
let LiturgiaTimeTracking;
try {
  LiturgiaTimeTracking = require("@/modules/liturgia/helpers/LiturgiaTimeTracking").default;
} catch (_) {
  LiturgiaTimeTracking = {
    isEnabled: () => false,
    recordExecution: () => {},
    closeEntryForItem: () => {},
  };
}

export default {
  name: "LiturgiaDayView",

  components: { draggable, LiturgiaItemRow },

  props: {
    dayIndex: {
      type: Number,
      required: true,
    },
  },

  data: () => ({
    editOpenId: null,
    // Holds the item pending re-attach so onReattachPicked knows which item to execute
    _pendingReattachItem: null,
    // Execute snackbar
    execSnackbar: false,
    execSnackbarText: "",
  }),

  computed: {
    dayItems: {
      get() {
        return this.$userdata.get(`modules.liturgia.days.${this.dayIndex}.items`, []);
      },
      set(items) {
        this.$userdata.setDebounced(
          `modules.liturgia.days.${this.dayIndex}.items`,
          items.map((it, i) => ({ ...it, order: i }))
        );
      },
    },

    dayNotes() {
      return this.$userdata.get(`modules.liturgia.days.${this.dayIndex}.notes`, "");
    },

    notePanelOpen() {
      return this.$appdata.get("modules.liturgia.note_panel_open", false);
    },

    // Finding 4: true while the media mini-player is shown or minimized
    mediaVisible() {
      return (
        this.$appdata.get("modules.media.show", false) ||
        this.$appdata.get("modules.media.minimized", false)
      );
    },
  },

  watch: {
    // Finding 4: auto-clear now_playing when the media mini-player is fully closed
    mediaVisible(val) {
      if (!val && this.$appdata.get("modules.liturgia.now_playing") !== null) {
        this.$appdata.set("modules.liturgia.now_playing", null);
      }
    },
  },

  methods: {
    // ── Playback mode label for snackbar ──────────────────────────────────
    _modeLabel(eff) {
      const key = eff === "sung" ? "playback.sung" : eff === "playback" ? "playback.playback" : "playback.none";
      return this.$t(`modules.liturgia.${key}`);
    },

    // ── Show execute snackbar ─────────────────────────────────────────────
    _showExecSnackbar(item, eff) {
      this.execSnackbarText = `${this.$t("modules.liturgia.executing")}: ${item.display_name} (${this._modeLabel(eff)})`;
      this.execSnackbar = false;
      this.$nextTick(() => { this.execSnackbar = true; });
    },

    // ── executeItem ───────────────────────────────────────────────────────
    async executeItem(payload) {
      const item = payload.item;
      const mode = payload.mode;

      if (item.type === "music") {
        // F2: always coerce to 'sung'; ignore stored playback_mode
        const eff = mode || "sung";
        const liturgia_index = Date.now();

        this.$appdata.set("modules.liturgia.active_item", {
          type: "song",
          song_id: item.music_ref?.song_id ?? null,
          id_album: item.music_ref?.id_album ?? null,
          playback_mode: eff,
          display_name: item.display_name,
          liturgia_index,
          media_url: null,
          media_type: null,
          timer_duration: null,
          timer_label: null,
        });

        // F1/F3: map domain → Media-native vocabulary; omit trigger for 'none'
        if (eff !== "none") {
          this.$appdata.set("modules.liturgia.audio_trigger", null);
          this.$appdata.set("modules.liturgia.audio_trigger", {
            song_id: item.music_ref.song_id,
            mode: eff === "playback" ? "instrumental" : "audio",
          });
        }

        // F7: write now_playing
        this.$appdata.set("modules.liturgia.now_playing", {
          day_index: this.dayIndex,
          item_id: item.id,
          mode: eff,
          liturgia_index,
        });

        // F7/UX: execute snackbar
        this._showExecSnackbar(item, eff);

        // F4: time tracking — before auto-mark so open entry isn't closed
        LiturgiaTimeTracking.recordExecution({ dayIndex: this.dayIndex, item, mode: eff });

        // F4: auto-mark after recordExecution
        this._autoMark(item);

      } else if (item.type === "file") {
        // If file handle is missing, open re-attach picker and defer execution
        if (!LiturgiaFiles.has(item.id)) {
          this._pendingReattachItem = item;
          this.$refs.reattachInput.value = "";
          this.$refs.reattachInput.click();
          return;
        }

        await this._executeFileItem(item);
      }
    },

    async _executeFileItem(item) {
      const url = LiturgiaFiles.objectUrl(item.id);
      const kind = item.file_ref?.kind;
      const liturgia_index = Date.now();

      if (kind === "video" || kind === "image") {
        this.$appdata.set("modules.liturgia.active_item", {
          type: "media",
          song_id: null,
          id_album: null,
          playback_mode: null,
          display_name: item.display_name,
          liturgia_index,
          media_url: url,
          media_type: kind,
          timer_duration: null,
          timer_label: null,
        });
      } else if (kind === "audio") {
        LiturgiaFiles.playAudio(url);
      } else {
        LiturgiaFiles.openDocument(url);
      }

      // F7: write now_playing for file items
      this.$appdata.set("modules.liturgia.now_playing", {
        day_index: this.dayIndex,
        item_id: item.id,
        mode: "none",
        liturgia_index,
      });

      // F7/UX: execute snackbar
      this._showExecSnackbar(item, "none");

      // F4: time tracking
      LiturgiaTimeTracking.recordExecution({ dayIndex: this.dayIndex, item, mode: "file" });

      // F4: auto-mark after recordExecution
      this._autoMark(item);
    },

    onReattachPicked(e) {
      const file = e.target.files[0];
      const item = this._pendingReattachItem;
      this._pendingReattachItem = null;

      if (!file || !item) return;

      LiturgiaFiles.register(item.id, file);
      this._executeFileItem(item);
    },

    // F3/F10: Audio-only handler (does NOT write active_item or now_playing)
    onAudioOnly(payload) {
      const { item, mode } = payload;
      if (!item.music_ref?.song_id) return;

      this.$appdata.set("modules.liturgia.audio_trigger", null);
      this.$appdata.set("modules.liturgia.audio_trigger", {
        song_id: item.music_ref.song_id,
        mode: mode === "playback" ? "instrumental" : "audio",
      });

      // F4: time tracking
      const trackMode = mode === "playback" ? "audio_only_playback" : "audio_only_sung";
      LiturgiaTimeTracking.recordExecution({ dayIndex: this.dayIndex, item, mode: trackMode });

      // auto-mark
      this._autoMark(item);
    },

    // F10: Lyric-only handler — opens lyric panel, no slide/audio/now_playing
    onLyric(payload) {
      const { item } = payload;
      if (!item.music_ref?.song_id) return;
      if (this.$media && typeof this.$media.openLyric === "function") {
        this.$media.openLyric({ id_music: item.music_ref.song_id });
      }
    },

    _autoMark(item) {
      if (this.$appdata.get("modules.liturgia.auto_mark_enabled")) {
        const prev = this.$appdata.get(`modules.liturgia.item_states.${item.id}`, {});
        this.$appdata.set(`modules.liturgia.item_states.${item.id}`, {
          ...prev,
          completed: true,
        });
      }
    },

    deleteItem(itemId) {
      const items = this.$userdata.get(`modules.liturgia.days.${this.dayIndex}.items`, []);
      const updated = items
        .filter((it) => it.id !== itemId)
        .map((it, i) => ({ ...it, order: i }));
      this.$userdata.set(`modules.liturgia.days.${this.dayIndex}.items`, updated);
    },

    toggleEdit(itemId) {
      this.editOpenId = this.editOpenId === itemId ? null : itemId;
    },

    updateItem(updatedItem) {
      const items = this.$userdata.get(`modules.liturgia.days.${this.dayIndex}.items`, []);
      const idx = items.findIndex((it) => it.id === updatedItem.id);
      if (idx === -1) return;
      const updated = [...items];
      updated[idx] = updatedItem;
      this.$userdata.setDebounced(`modules.liturgia.days.${this.dayIndex}.items`, updated);
    },

    saveNotes(value) {
      this.$userdata.setDebounced(`modules.liturgia.days.${this.dayIndex}.notes`, value);
    },
  },
};
</script>

<style>
.liturgia-ghost {
  opacity: 0.4;
  background: rgba(255, 255, 255, 0.1);
}
</style>
