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
    <div class="flex-grow-1" style="min-width: 0; overflow-y: auto;" ref="listEl">
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
            @stop="stopItem($event)"
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

    <!-- Execution snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :timeout="2500"
      location="bottom right"
      color="surface"
    >
      {{ snackbar.text }}
      <template v-if="snackbar.action" #actions>
        <v-btn variant="text" size="small" @click="snackbar.action.fn">
          {{ snackbar.action.label }}
        </v-btn>
      </template>
    </v-snackbar>

  </div>
</template>

<script>
import draggable from "vuedraggable";
import LiturgiaItemRow from "./LiturgiaItemRow.vue";
import LiturgiaFiles from "@/modules/liturgia/helpers/LiturgiaFiles";
import { resolveHandler } from "@/modules/liturgia/helpers/LiturgiaFileConfig";
import { ensurePopup } from "@/modules/liturgia/helpers/LiturgiaPopupRouting";
import { recordExecution, closeEntryForItem } from "@/modules/liturgia/helpers/LiturgiaTimeTracking";

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
    snackbar: {
      show: false,
      text: '',
      action: null,
    },
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

    // true while the media mini-player is shown or minimized
    mediaVisible() {
      return (
        this.$appdata.get("modules.media.show", false) ||
        this.$appdata.get("modules.media.minimized", false)
      );
    },
  },

  watch: {
    // auto-clear now_playing when the media mini-player is fully closed
    mediaVisible(val) {
      if (!val && this.$appdata.get("modules.liturgia.now_playing") !== null) {
        this.$appdata.set("modules.liturgia.now_playing", null);
      }
    },
  },

  methods: {
    // ─── snackbar helper ─────────────────────────────────────────────────────
    _showSnackbar(text, action = null) {
      this.snackbar.text = text;
      this.snackbar.action = action;
      this.snackbar.show = true;
    },

    // ─── routing opts factory ─────────────────────────────────────────────────
    _routingOpts() {
      return {
        showSnackbar: (text, action) => this._showSnackbar(text, action ? { label: action.label, fn: action.action } : null),
        t: (key) => this.$t(key),
      };
    },

    // ─── main execution entry point ──────────────────────────────────────────
    async executeItem(payload) {
      const item = payload.item;
      const mode = payload.mode;

      if (item.type === "music") {
        await this._executeMusicItem(item, mode);
      } else if (item.type === "file") {
        // Re-attach gate: no live handle -> open picker and defer
        if (!LiturgiaFiles.has(item.id)) {
          this._pendingReattachItem = item;
          this.$refs.reattachInput.value = "";
          this.$refs.reattachInput.click();
          return;
        }
        await this._executeFileItem(item);
      }
      // Category items: no execution (click on category does nothing)
    },

    // ─── music execution ──────────────────────────────────────────────────────
    async _executeMusicItem(item, modeOverride) {
      const eff = modeOverride || item.music_ref?.playback_mode || "sung";

      // Special-case: audio-only and lyric actions — no active_item / now_playing / popup changes
      if (eff === "audio_only_sung") {
        this.$appdata.set("modules.liturgia.audio_trigger", null);
        this.$appdata.set("modules.liturgia.audio_trigger", {
          song_id: item.music_ref?.song_id,
          mode: "audio",
        });
        return;
      }
      if (eff === "audio_only_playback") {
        this.$appdata.set("modules.liturgia.audio_trigger", null);
        this.$appdata.set("modules.liturgia.audio_trigger", {
          song_id: item.music_ref?.song_id,
          mode: "instrumental",
        });
        return;
      }
      if (eff === "lyric") {
        this.$media.openLyric({
          id_music: item.music_ref?.song_id,
          id_album: item.music_ref?.id_album,
        });
        return;
      }

      // 1. Write active_item (presenter loads song slides from this)
      this.$appdata.set("modules.liturgia.active_item", {
        type: "song",
        song_id: item.music_ref?.song_id ?? null,
        id_album: item.music_ref?.id_album ?? null,
        playback_mode: eff,
        display_name: item.display_name,
        liturgia_index: Date.now(),
        media_url: null,
        media_type: null,
        media_text: null,
        timer_duration: item.planned_duration ?? null,
        timer_label: item.display_name,
      });

      // 2. Audio trigger (null-then-set pattern; media watcher handles $media.open)
      if (eff !== "none") {
        const triggerMode = eff === "playback" ? "instrumental" : "audio";
        this.$appdata.set("modules.liturgia.audio_trigger", null);
        this.$appdata.set("modules.liturgia.audio_trigger", {
          song_id: item.music_ref.song_id,
          mode: triggerMode,
        });
      }

      // 3. Write now_playing
      this.$appdata.set("modules.liturgia.now_playing", {
        day_index: this.dayIndex,
        item_id: item.id,
        mode: eff,
        liturgia_index: Date.now(),
      });

      // 4. Exec snackbar
      this._showSnackbar(this.$t("modules.liturgia.executing") + ": " + (item.display_name || ""));

      // 5. Record execution for time tracking
      recordExecution({ dayIndex: this.dayIndex, item, mode: eff });

      // 6. Auto-mark completed
      this._autoMark(item);

      // 7. Popup routing (FINAL step)
      if (eff === "none") {
        await ensurePopup("presenter", this._routingOpts());
      } else {
        await ensurePopup("media", this._routingOpts());
      }

      // 8. Auto-scroll the row into view
      this._scrollToItem(item.id);
    },

    // ─── file execution ───────────────────────────────────────────────────────
    async _executeFileItem(item) {
      const liveFile = LiturgiaFiles.get(item.id);
      if (!liveFile) return;

      // F12: stop any prior hidden audio first
      LiturgiaFiles.stopAudio();

      // Self-heal: rederive kind from live File; persist if changed
      const healedRef = LiturgiaFiles.rederiveAndHeal(item, liveFile);
      if (healedRef !== item.file_ref) {
        // Persist the healed file_ref
        this._persistItemUpdate({ ...item, file_ref: healedRef });
        item = { ...item, file_ref: healedRef };
      }

      const kind = item.file_ref?.kind || "document";
      const handler = resolveHandler(kind);
      const url = LiturgiaFiles.objectUrl(item.id);

      // Dispatch by handler
      if (handler === "tab") {
        LiturgiaFiles.tab(url);

      } else if (handler === "download") {
        LiturgiaFiles.download(url, item.file_ref?.name || item.display_name);
        const doneKey = kind === "document"
          ? "modules.liturgia.download_done_doc"
          : "modules.liturgia.download_done";
        const msg = this.$t(doneKey, { name: item.file_ref?.name || item.display_name });
        this._showSnackbar(msg);

      } else if (handler === "hidden_audio") {
        LiturgiaFiles.onAudioEnded(() => {
          this.$appdata.set("modules.liturgia.now_playing", null);
          closeEntryForItem(this.dayIndex, item.id);
        });
        LiturgiaFiles.playAudio(url);

      } else if (handler === "popup") {
        // 'popup' — write active_item and route to presenter
        if (kind === "text") {
          // Read file text (200KB cap) before writing active_item
          const text = await this._readFileText(liveFile, 204800);
          this.$appdata.set("modules.liturgia.active_item", {
            type: "media",
            song_id: null,
            id_album: null,
            playback_mode: null,
            display_name: item.display_name,
            liturgia_index: Date.now(),
            media_url: url,
            media_type: "text",
            media_text: text,
            timer_duration: item.planned_duration ?? null,
            timer_label: item.display_name,
          });
        } else {
          this.$appdata.set("modules.liturgia.active_item", {
            type: "media",
            song_id: null,
            id_album: null,
            playback_mode: null,
            display_name: item.display_name,
            liturgia_index: Date.now(),
            media_url: url,
            media_type: kind,
            media_text: null,
            timer_duration: item.planned_duration ?? null,
            timer_label: item.display_name,
          });
        }
        await ensurePopup("presenter", this._routingOpts());
      }

      // Tail (every path)
      this.$appdata.set("modules.liturgia.now_playing", {
        day_index: this.dayIndex,
        item_id: item.id,
        mode: "file",
        liturgia_index: Date.now(),
      });
      this._showSnackbar(this.$t("modules.liturgia.executing") + ": " + (item.display_name || ""));
      recordExecution({ dayIndex: this.dayIndex, item, mode: "file" });
      this._autoMark(item);
      this._scrollToItem(item.id);
    },

    // ─── stop control (F13) ───────────────────────────────────────────────────
    stopItem(item) {
      const np = this.$appdata.get("modules.liturgia.now_playing");
      if (!np || np.item_id !== item.id) return;

      if (item.type === "music") {
        // Media-engine song: close(true) cascades restore via A's watcher
        this.$media.close(true);
      } else if (item.type === "file") {
        const kind = item.file_ref?.kind || "document";
        const handler = resolveHandler(kind);

        if (handler === "hidden_audio") {
          LiturgiaFiles.stopAudio();
          this.$appdata.set("modules.liturgia.now_playing", null);
          closeEntryForItem(this.dayIndex, item.id);
        } else if (handler === "popup") {
          // For video in popup: write a cover-only active_item to stop playback
          if (kind === "video") {
            this.$appdata.set("modules.liturgia.active_item", {
              type: "media",
              song_id: null,
              id_album: null,
              playback_mode: null,
              display_name: item.display_name,
              liturgia_index: Date.now(),
              media_url: null,
              media_type: null,
              media_text: null,
              timer_duration: null,
              timer_label: null,
            });
          }
          this.$appdata.set("modules.liturgia.now_playing", null);
          closeEntryForItem(this.dayIndex, item.id);
        }
      }
    },

    // ─── re-attach picker ─────────────────────────────────────────────────────
    onReattachPicked(e) {
      const file = e.target.files[0];
      const item = this._pendingReattachItem;
      this._pendingReattachItem = null;

      if (!file || !item) return;

      LiturgiaFiles.register(item.id, file);
      this._executeFileItem(item);
    },

    // ─── utilities ────────────────────────────────────────────────────────────
    _autoMark(item) {
      if (this.$appdata.get("modules.liturgia.auto_mark_enabled")) {
        const prev = this.$appdata.get(`modules.liturgia.item_states.${item.id}`, {});
        this.$appdata.set(`modules.liturgia.item_states.${item.id}`, {
          ...prev,
          completed: true,
        });
      }
    },

    _persistItemUpdate(updatedItem) {
      const items = this.$userdata.get(`modules.liturgia.days.${this.dayIndex}.items`, []);
      const idx = items.findIndex((it) => it.id === updatedItem.id);
      if (idx === -1) return;
      const updated = [...items];
      updated[idx] = updatedItem;
      this.$userdata.set(`modules.liturgia.days.${this.dayIndex}.items`, updated);
    },

    _scrollToItem(itemId) {
      this.$nextTick(() => {
        const el = this.$el.querySelector(`[data-item-id="${itemId}"]`);
        if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    },

    /**
     * Reads a File as text with a byte cap. Appends '...' if truncated.
     * @param {File} file
     * @param {number} maxBytes
     * @returns {Promise<string>}
     */
    _readFileText(file, maxBytes) {
      return new Promise((resolve) => {
        const slice = file.size > maxBytes ? file.slice(0, maxBytes) : file;
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result || "";
          resolve(file.size > maxBytes ? text + "..." : text);
        };
        reader.onerror = () => resolve("");
        reader.readAsText(slice);
      });
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
