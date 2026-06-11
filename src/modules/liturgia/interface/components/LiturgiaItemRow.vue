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

      <!-- Yellow edit pencil -->
      <v-btn
        icon
        size="x-small"
        variant="text"
        color="#f1c40f"
        :title="$t('modules.liturgia.edit_item')"
        @click.stop="$emit('edit-toggle', item.id)"
      >
        <v-icon size="16">mdi-pencil</v-icon>
      </v-btn>

      <!-- Black drag handle -->
      <v-icon
        size="18"
        class="liturgia-drag-handle ml-1"
        style="cursor: grab; color: #111;"
      >
        mdi-drag-vertical
      </v-icon>
    </div>

    <!-- ========== NORMAL ROW (music / file) ========== -->
    <div
      v-else
      class="liturgia-item-row d-flex align-center"
      :class="{ 'liturgia-item-row--completed': completed }"
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

      <!-- (b) Colored type-icon block + re-attach amber alert -->
      <div
        class="d-flex align-center justify-center flex-shrink-0 mr-2"
        style="position: relative;"
      >
        <div
          :style="{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: item.color || '#1a3a5c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }"
        >
          <v-icon size="16" color="white">{{ typeIcon }}</v-icon>
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
          class="text-caption text-medium-emphasis text-truncate"
          style="font-size: 11px; line-height: 1.2;"
        >
          {{ subtitle }}
        </div>
      </div>

      <!-- (e) Music quick-action icons (music only) -->
      <template v-if="item.type === 'music'">
        <v-btn
          icon
          size="x-small"
          variant="text"
          :title="$t('modules.liturgia.playback.sung')"
          @click.stop="emitExec('sung')"
        >
          <v-icon size="16">mdi-microphone</v-icon>
        </v-btn>
        <v-btn
          icon
          size="x-small"
          variant="text"
          :title="$t('modules.liturgia.playback.playback')"
          @click.stop="emitExec('playback')"
        >
          <v-icon size="16">mdi-play-box-outline</v-icon>
        </v-btn>
        <v-btn
          icon
          size="x-small"
          variant="text"
          :title="$t('modules.liturgia.playback.none')"
          @click.stop="emitExec('none')"
        >
          <v-icon size="16">mdi-volume-off</v-icon>
        </v-btn>
      </template>

      <!-- (f) Yellow edit pencil -->
      <v-btn
        icon
        size="x-small"
        variant="text"
        color="#f1c40f"
        :title="$t('modules.liturgia.edit_item')"
        @click.stop="$emit('edit-toggle', item.id)"
      >
        <v-icon size="16">mdi-pencil</v-icon>
      </v-btn>

      <!-- (g) Black drag handle -->
      <v-icon
        size="18"
        class="liturgia-drag-handle ml-1 mr-1 flex-shrink-0"
        style="cursor: grab; color: #111;"
      >
        mdi-drag-vertical
      </v-icon>
    </div>

    <!-- Inline edit panel -->
    <LiturgiaItemEditPanel
      :item="item"
      :visible="editOpen"
      @update:item="$emit('update:item', $event)"
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

  emits: ["execute", "delete", "edit-toggle", "update:item"],

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
</style>
