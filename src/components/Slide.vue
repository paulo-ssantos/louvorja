<template>
  <div ref="container" class="w-100 h-100">
    <transition
      name="fade"
      v-for="(slide, index) in slides.slice().reverse()"
      :key="index"
    >
      <div
        v-if="!slide.destroy"
        v-show="slide.active"
        class="position-absolute top-0 left-0 w-100 h-100"
        :style="style_bg(slide)"
      >
        <div
          class="position-absolute top-0 left-0 w-100 h-100 d-flex justify-center align-center"
        >
          <div>
            <div
              v-if="slide.aux_text"
              v-html="slide.aux_text"
              :style="style_aux_text()"
            />
            <div
              v-if="slide.text"
              v-html="slide.text"
              :style="style_text(slide)"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: "SlideComponent",
  props: {
    slide_number: Number,
    cover: Boolean,
    text: String,
    aux_text: String,
    image: String,
    image_position: Number,
  },
  data: () => ({
    slides: [{}, {}],
    repeat: false,
    width: 0,
    height: 0,
  }),
  computed: {
    props_slide() {
      return {
        slide_number: this.slide_number,
        cover: this.cover,
        text: this.text,
        aux_text: this.aux_text,
        image: this.image,
        image_position: this.image_position,
      };
    },
    screenSize() {
      return { width: this.width, height: this.height };
    },
  },
  watch: {
    props_slide() {
      this.setSlide();
    },
    screenSize() {
      const self = this;
      setTimeout(function () {
        self.windowResize();
      }, 100);
    },
  },
  methods: {
    setSlide() {
      if (
        this.$string.clean(this.slides[1].text) ==
          this.$string.clean(this.props_slide.text) &&
        this.$string.clean(this.slides[1].aux_text) ==
          this.$string.clean(this.props_slide.aux_text) &&
        this.slides[1].image == this.props_slide.image &&
        this.slides[1].cover == this.props_slide.cover
      ) {
        this.repeat = !this.repeat;
      } else {
        this.repeat = false;
      }

      this.slides.unshift({});
      this.slides[1] = {
        ...this.props_slide,
        active: true,
      };

      if (this.slides.length > 3) {
        this.slides[3].destroy = true;
      }
    },
    style_bg(slide) {
      return {
        overflow: "hidden",
        backgroundColor: "rgb(0, 0, 0)",
        backgroundImage: `url(${slide.image})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: [
          "top left",
          "top center",
          "top right",
          "center left",
          "center center",
          "center right",
          "bottom left",
          "bottom center",
          "bottom right",
        ][this.image_position || 5],
        backgroundSize: "cover",
      };
    },
    style_aux_text() {
      return {
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        fontSize: `${this.fontSizePc(10)}px`,
        color: "rgb(246, 195, 42)",
        padding: `0px ${this.fontSizePc(5)}px`,
        fontFamily: "DINCondensedBold",
        textTransform: "uppercase",
      };
    },
    style_text(slide) {
      let style = {
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        padding: `0px ${this.fontSizePc(5)}px`,
        textAlign: "center",
        fontFamily: "DINCondensedBold",
        textTransform: "uppercase",
      };

      if (slide.cover) {
        return {
          ...style,
          fontSize: `${this.fontSizePc(25)}px`,
          color: "rgb(246, 195, 42)",
        };
      } else {
        return {
          ...style,
          fontSize: `${this.fontSizePc(20)}px`,
          color: this.repeat ? "rgb(246, 195, 42)" : "rgb(255, 255, 255)",
        };
      }
    },
    fontSizePc(pc) {
      const v = Math.min(this.width, this.height);
      return (pc * v) / 100 / 2;
    },
    windowResize() {
      const container = this.$refs.container;
      if (container) {
        this.width = container.offsetWidth;
        this.height = container.offsetHeight;

        if (this.width <= 0 || this.height <= 0) {
          const self = this;
          setTimeout(function () {
            self.windowResize();
          }, 100);
        }
      }
    },
  },
  mounted() {
    this.setSlide();
    this.windowResize();
    window.addEventListener("resize", this.windowResize);
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
  },
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
