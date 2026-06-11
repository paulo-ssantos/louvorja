<template>
  <v-btn
    variant="text"
    :disabled="disabled"
    class="rib-small"
    @click="$emit('click')"
  >
    <v-icon :size="16" style="margin-right:4px; flex-shrink:0;" :color="iconColor">{{ icon }}</v-icon>
    <span class="rib-small__label">{{ label }}</span>
  </v-btn>
</template>

<script>
export default {
  name: 'RibbonSmallBtn',

  emits: ['click'],

  props: {
    icon: {
      type: String,
      default: '',
    },
    iconColor: {
      type: String,
      default: undefined,
    },
    label: {
      type: String,
      default: '',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<style scoped>
.rib-small {
  height: 20px !important;
  min-width: 0 !important;
  padding: 0 8px 0 4px !important;
  border-radius: 3px !important;
  justify-content: flex-start !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  font-size: 11px !important;
  line-height: 20px !important;
  color: var(--rib-fg) !important;
  display: flex !important;
  width: 100% !important;
  flex-shrink: 0;
}

.rib-small:hover {
  background: var(--rib-hover) !important;
}

.rib-small:focus-visible {
  outline: 1px solid rgb(var(--v-theme-primary));
  outline-offset: -1px;
}

.rib-small :deep(.v-btn__content) {
  justify-content: flex-start !important;
  font-size: 11px !important;
  letter-spacing: normal !important;
  gap: 0 !important;
}

.rib-small__label {
  font-size: 11px;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
