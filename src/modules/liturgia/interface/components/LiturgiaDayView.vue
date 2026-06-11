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

  </div>
</template>

<script>
import draggable from "vuedraggable";
import LiturgiaItemRow from "./LiturgiaItemRow.vue";
import LiturgiaFiles from "@/modules/liturgia/helpers/LiturgiaFiles";

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
  },

  methods: {
    async executeItem(payload) {
      const item = payload.item;
      const mode = payload.mode;

      if (item.type === "music") {
        const eff = mode || item.music_ref?.playback_mode || "sung";

        this.$appdata.set("modules.liturgia.active_item", {
          type: "song",
          song_id: item.music_ref?.song_id ?? null,
          id_album: item.music_ref?.id_album ?? null,
          playback_mode: eff,
          display_name: item.display_name,
          liturgia_index: Date.now(),
          media_url: null,
          media_type: null,
          timer_duration: null,
          timer_label: null,
        });

        if (eff !== "none") {
          this.$appdata.set("modules.liturgia.audio_trigger", null);
          this.$appdata.set("modules.liturgia.audio_trigger", {
            song_id: item.music_ref.song_id,
            mode: eff,
          });
        }

      } else if (item.type === "file") {
        // If file handle is missing, open re-attach picker and defer execution
        if (!LiturgiaFiles.has(item.id)) {
          this._pendingReattachItem = item;
          this.$refs.reattachInput.value = "";
          this.$refs.reattachInput.click();
          return;
        }

        await this._executeFileItem(item);
        return;
      }

      // Auto-mark completed
      this._autoMark(item);
    },

    async _executeFileItem(item) {
      const url = LiturgiaFiles.objectUrl(item.id);
      const kind = item.file_ref?.kind;

      if (kind === "video" || kind === "image") {
        this.$appdata.set("modules.liturgia.active_item", {
          type: "media",
          song_id: null,
          id_album: null,
          playback_mode: null,
          display_name: item.display_name,
          liturgia_index: Date.now(),
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
