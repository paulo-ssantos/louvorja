<template>
  <v-dialog v-model="isOpen" max-width="520" scrollable>
    <v-card style="border-radius:8px;">

      <!-- Title row 44px -->
      <div class="lfc-title-row">
        <span class="lfc-title-text">{{ t('config.dialog_title') }}</span>
        <v-btn
          :size="28"
          icon
          variant="text"
          @click="isOpen = false"
          style="flex-shrink:0;"
        >
          <v-icon :size="18">mdi-close</v-icon>
        </v-btn>
      </div>

      <!-- Column header row 28px -->
      <div class="lfc-header-row">
        <span class="lfc-col-type">{{ t('config.col_type') }}</span>
        <span class="lfc-col-handler">{{ t('config.col_handler') }}</span>
      </div>

      <!-- 6 kind rows -->
      <div
        v-for="(kind, idx) in KINDS"
        :key="kind"
        class="lfc-kind-row"
        :class="idx % 2 === 0 ? 'lfc-kind-row--even' : ''"
      >
        <!-- Left: colored square icon + kind label -->
        <div class="lfc-kind-cell">
          <div
            class="lfc-kind-icon"
            :style="{ background: KIND_META[kind].color }"
          >
            <v-icon :size="16" color="white">{{ KIND_META[kind].icon }}</v-icon>
          </div>
          <span class="lfc-kind-label">{{ t('config.' + KIND_META[kind].label) }}</span>
        </div>

        <!-- Right: v-select handler -->
        <div class="lfc-handler-cell">
          <v-select
            :model-value="handlers[kind]"
            @update:model-value="(v) => setHandler(kind, v)"
            :items="handlerItems(kind)"
            density="compact"
            variant="outlined"
            hide-details
            style="width:200px;"
          >
            <template v-slot:item="{ item, props: itemProps }">
              <v-list-item v-bind="itemProps" density="compact" style="font-size:12px;" />
            </template>
          </v-select>
        </div>
      </div>

      <!-- Document note -->
      <div class="lfc-doc-note">
        {{ t('config.document_note') }}
      </div>

      <!-- Footer 48px -->
      <div class="lfc-footer-row">
        <v-btn
          variant="text"
          size="small"
          @click="onRestoreDefaults"
        >
          {{ t('config.restore_defaults') }}
        </v-btn>
        <v-spacer />
        <v-btn
          variant="flat"
          color="primary"
          size="small"
          @click="isOpen = false"
        >
          {{ t('time.close_btn') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import {
  KINDS,
  KIND_META,
  ALLOWED,
  HANDLERS,
  DEFAULTS,
  restoreDefaults,
} from '../../helpers/LiturgiaFileConfig.js';

export default {
  name: 'LiturgiaFileConfigDialog',

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['update:modelValue', 'restored'],

  data: () => ({
    KINDS,
    KIND_META,
    ALLOWED,
    HANDLERS,
    DEFAULTS,
  }),

  computed: {
    isOpen: {
      get() { return this.modelValue; },
      set(v) { this.$emit('update:modelValue', v); },
    },

    handlers() {
      const result = {};
      for (const kind of KINDS) {
        result[kind] = this.$userdata.get(
          `modules.liturgia.file_handlers.${kind}`,
          DEFAULTS[kind]
        );
      }
      return result;
    },
  },

  watch: {
    isOpen(val) {
      if (val) {
        // setIfNull each kind so selects show sane defaults
        for (const kind of KINDS) {
          const key = `modules.liturgia.file_handlers.${kind}`;
          if (this.$userdata.get(key, null) === null) {
            this.$userdata.set(key, DEFAULTS[kind]);
          }
        }
        this.$userdata.save();
      }
    },
  },

  methods: {
    t(key) {
      return this.$t(`modules.liturgia.${key}`);
    },

    handlerItems(kind) {
      return (ALLOWED[kind] || []).map(id => ({
        title: this.t('config.' + HANDLERS[id]),
        value: id,
      }));
    },

    setHandler(kind, value) {
      this.$userdata.set(`modules.liturgia.file_handlers.${kind}`, value);
      this.$userdata.save();
    },

    onRestoreDefaults() {
      restoreDefaults();
      this.$emit('restored');
    },
  },
};
</script>

<style scoped>
.lfc-title-row {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 16px;
  flex-shrink: 0;
}

.lfc-title-text {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  color: inherit;
}

.lfc-header-row {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 16px;
  background: rgba(0, 0, 0, 0.04);
}

.lfc-col-type {
  flex: 1;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(0, 0, 0, 0.45);
}

.lfc-col-handler {
  width: 200px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(0, 0, 0, 0.45);
}

.lfc-kind-row {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  transition: background 100ms;
}

.lfc-kind-row:hover {
  background: rgba(0, 0, 0, 0.04) !important;
}

.lfc-kind-row--even {
  background: rgba(0, 0, 0, 0.02);
}

.lfc-kind-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.lfc-kind-icon {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lfc-kind-label {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lfc-handler-cell {
  width: 200px;
  flex-shrink: 0;
}

.lfc-handler-cell :deep(.v-field__input) {
  min-height: 32px !important;
  font-size: 12px !important;
  padding: 2px 8px !important;
}

.lfc-doc-note {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
  padding: 4px 16px 8px;
  line-height: 1.4;
}

.lfc-footer-row {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
</style>
