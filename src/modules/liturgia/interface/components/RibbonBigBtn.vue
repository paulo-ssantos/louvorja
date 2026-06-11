<template>
  <v-btn
    variant="text"
    :ripple="true"
    :disabled="disabled"
    class="rib-big"
    @click="$emit('click')"
  >
    <div class="rib-big__content">
      <slot name="icon">
        <v-icon :size="26" :color="iconColor">{{ icon }}</v-icon>
      </slot>
      <span class="rib-big__label">{{ label }}</span>
    </div>
  </v-btn>
</template>

<script>
export default {
  name: 'RibbonBigBtn',

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
.rib-big {
  height: 62px !important;
  min-width: 56px !important;
  max-width: 88px !important;
  padding: 4px 6px 2px !important;
  border-radius: 4px !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  color: var(--rib-fg) !important;
  flex-shrink: 0;
}

.rib-big:hover {
  background: var(--rib-hover) !important;
}

.rib-big:focus-visible {
  outline: 1px solid rgb(var(--v-theme-primary));
  outline-offset: -1px;
}

.rib-big :deep(.v-btn__content) {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 2px !important;
  white-space: normal !important;
  font-size: 11px !important;
  line-height: 12px !important;
  text-align: center !important;
  padding: 0 !important;
}

.rib-big__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.rib-big__label {
  font-size: 11px;
  line-height: 12px;
  text-align: center;
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: var(--rib-fg);
  max-width: 80px;
}
</style>
