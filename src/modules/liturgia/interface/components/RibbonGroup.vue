<template>
  <div class="rib-group" :class="{ 'rib-group--off': disabled }">
    <slot />
    <div class="rib-group__caption">{{ caption }}</div>
  </div>
</template>

<script>
export default {
  name: 'RibbonGroup',

  props: {
    caption: {
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
.rib-group {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 2px;
  padding: 0 8px 16px;
  height: 78px;
  flex-shrink: 0;
}

.rib-group__caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 16px;
  line-height: 16px;
  font-size: 10px;
  text-align: center;
  color: var(--rib-muted);
  pointer-events: none;
}

.rib-group--off {
  opacity: 0.45;
  pointer-events: none;
}
</style>
