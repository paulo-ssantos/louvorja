<template>
  <div class="liturgia-song-search">
    <v-text-field
      v-model="query"
      :placeholder="$t('modules.liturgia.song_search_placeholder')"
      prepend-inner-icon="mdi-magnify"
      clearable
      density="compact"
      hide-details
      variant="outlined"
      :error="notFound"
      @input="onInput"
      @click:clear="onClear"
    />

    <v-list
      v-if="results.length > 0"
      density="compact"
      class="liturgia-song-search__results mt-1"
      style="max-height: 260px; overflow-y: auto; border: 1px solid rgba(0,0,0,0.12); border-radius: 4px;"
    >
      <v-list-item
        v-for="song in results"
        :key="song.id_music + '_' + (song.hymnal_type || 'x')"
        :title="songTitle(song)"
        :subtitle="songSubtitle(song)"
        style="cursor: pointer;"
        @click="select(song)"
      >
        <template v-slot:prepend>
          <v-icon size="18" class="mr-1">mdi-music-note</v-icon>
        </template>
      </v-list-item>
    </v-list>

    <div
      v-else-if="notFound"
      class="text-caption text-medium-emphasis pa-2"
    >
      {{ $t('modules.liturgia.no_results') }}
    </div>

    <div v-if="loading" class="text-caption text-medium-emphasis pa-2">
      <v-progress-circular size="14" indeterminate class="mr-1" />
      Carregando...
    </div>
  </div>
</template>

<script>
export default {
  name: "LiturgiaSongSearch",

  props: {
    modelValue: {
      type: Object,
      default: null,
    },
  },

  emits: ["update:modelValue"],

  data: () => ({
    query: "",
    results: [],
    allSongs: null,
    loading: false,
    debounceTimer: null,
  }),

  computed: {
    notFound() {
      return (
        !!this.query &&
        this.query.length >= 2 &&
        !this.loading &&
        this.results.length === 0
      );
    },
  },

  methods: {
    onInput() {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.runSearch();
      }, 300);
    },

    onClear() {
      this.query = "";
      this.results = [];
    },

    async _loadAllSongs() {
      if (this.allSongs) return;
      this.loading = true;
      try {
        // Load new hymnal (pt_hymnal), old hymnal (pt_hymnal_1996), and general
        // songs (pt_musics) as three separate sources. Hymnal records expose
        // `track` as the hymn number. pt_musics records have no track number.
        const [newRaw, oldRaw, musicsRaw] = await Promise.all([
          this.$database.get("pt_hymnal").catch(() => []),
          this.$database.get("pt_hymnal_1996").catch(() => []),
          this.$database.get("pt_musics").catch(() => []),
        ]);

        const toArray = (d) => (Array.isArray(d) ? d : Object.values(d || {}));

        const newHymns = toArray(newRaw).map((s) => ({
          ...s,
          hymnal_type: "new",
          // `track` already present on hymnal records
        }));

        const oldHymns = toArray(oldRaw).map((s) => ({
          ...s,
          hymnal_type: "old",
        }));

        // pt_musics songs that are NOT already present in a hymnal (matched by
        // id_music). This avoids triple-listing a song that lives in all three
        // sources, while still letting a song that appears in BOTH hymnals show
        // as two separate rows (new + old).
        const hymnalIds = new Set([
          ...newHymns.map((s) => s.id_music),
          ...oldHymns.map((s) => s.id_music),
        ]);
        const nonHymnalSongs = toArray(musicsRaw)
          .filter((s) => !hymnalIds.has(s.id_music))
          .map((s) => ({
            ...s,
            hymnal_type: null,
            track: null,
          }));

        this.allSongs = [...newHymns, ...oldHymns, ...nonHymnalSongs];
      } catch (e) {
        this.allSongs = [];
      } finally {
        this.loading = false;
      }
    },

    async runSearch() {
      const q = (this.query || "").trim().toLowerCase();
      if (q.length < 2) {
        this.results = [];
        return;
      }

      await this._loadAllSongs();

      const songs = this.allSongs || [];
      const filtered = songs.filter((s) => {
        const name = (s.name || "").toLowerCase();
        // Hymn number lives in `track` (number on hymnal records).
        const num = String(s.track ?? "").toLowerCase();
        return name.includes(q) || num.includes(q);
      });

      // Sort: hymns by track number ascending; same track -> new hymnal first;
      // non-hymnal songs (track null) sort after all hymnal entries.
      filtered.sort((a, b) => {
        const numA = a.track != null ? parseInt(a.track, 10) : Infinity;
        const numB = b.track != null ? parseInt(b.track, 10) : Infinity;
        if (numA !== numB) return numA - numB;
        // same number: new hymnal ranks higher
        const typeA = a.hymnal_type === "new" ? 0 : 1;
        const typeB = b.hymnal_type === "new" ? 0 : 1;
        return typeA - typeB;
      });

      // Do NOT dedupe — both hymnals appear as separate results
      this.results = filtered.slice(0, 50);
    },

    select(song) {
      this.$emit("update:modelValue", song);
      this.query = song.name || "";
      this.results = [];
    },

    songTitle(song) {
      return song.name || "(sem título)";
    },

    songSubtitle(song) {
      const num = song.track;
      const name = song.name || "";
      if (num != null) {
        const hymnalLabel =
          song.hymnal_type === "new"
            ? this.$t("modules.liturgia.hinario_adventista")
            : this.$t("modules.liturgia.hinario_other");
        return `Hino nº ${num} - ${name} (${hymnalLabel})`;
      }
      // Non-hymnal song: show name only (or album names if available)
      if (song.albums && song.albums.length > 0) {
        return song.albums.map((a) => a.name).join(", ");
      }
      return name;
    },
  },
};
</script>
