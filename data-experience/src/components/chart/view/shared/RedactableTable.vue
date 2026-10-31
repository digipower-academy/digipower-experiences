<template>
  <div class="redactable-table">
    <div class="d-flex align-center flex-wrap mb-2">
      <VBtn
        small
        outlined
        :color="redacting ? 'black' : undefined"
        :aria-pressed="String(redacting)"
        @click="redacting = !redacting"
      >
        <VIcon small left>
          {{ redacting ? '$vuetify.icons.mdiSquare' : '$vuetify.icons.mdiSquareOutline' }}
        </VIcon>
        {{ msg('blackOut') }}
      </VBtn>
      <VBtn v-if="hasRedactions" small text class="ml-2" @click="clearRedactions">
        {{ msg('showAll') }}
      </VBtn>
      <span v-if="redacting" class="text-caption text--secondary ml-3">
        {{ msg('blackOutHelp') }}
      </span>
    </div>

    <VDataTable
      :headers="tableHeaders"
      :items="keyedItems"
      item-key="_key"
      :item-class="rowClass"
      :items-per-page="itemsPerPage"
      :sort-by="sortBy"
      :sort-desc="sortDesc"
      dense
      @mouseleave.native="hovered = null"
    >
      <template
        v-for="header in headers"
        #[`header.${header.value}`]="{}"
      >
        <span
          :key="`header-${header.value}`"
          :class="{ 'redact-target': redacting }"
          @click.stop="redacting && toggle(columns, header.value)"
        >
          {{ header.text }}
          <VIcon v-if="redacting" x-small class="redact-control">
            {{ columns[header.value] ? '$vuetify.icons.mdiSquare' : '$vuetify.icons.mdiSquareOutline' }}
          </VIcon>
        </span>
      </template>

      <template #[`item._row`]="{ item }">
        <VBtn
          v-if="redacting"
          icon
          x-small
          class="redact-control"
          :aria-label="msg('blackOutRow')"
          @click="toggle(rows, item._key)"
        >
          <VIcon x-small :color="rows[item._key] ? 'white' : undefined">
            {{ rows[item._key] ? '$vuetify.icons.mdiSquare' : '$vuetify.icons.mdiSquareOutline' }}
          </VIcon>
        </VBtn>
      </template>

      <template
        v-for="header in headers"
        #[`item.${header.value}`]="{ item }"
      >
        <span
          :key="`cell-${header.value}`"
          class="cell"
          :class="{ redacted: isRedacted(item, header.value), 'redact-target': redacting }"
          :title="redacting ? '' : visibleFiles(item)"
          @mouseenter="hovered = item"
          @click="redacting && toggle(cells, cellKey(item, header.value))"
        >
          {{ header.format ? header.format(item[header.value], item) : item[header.value] }}
        </span>
      </template>

      <template #[`item._files`]="{ item }">
        <span
          :class="{ redacted: isRedacted(item, '_files') }"
          @mouseenter="hovered = item"
        >
          <VBtn
            icon
            x-small
            :disabled="!canDownload(item)"
            :title="[msg('download'), visibleFiles(item)].filter(Boolean).join(': ')"
            :aria-label="msg('download')"
            @click="download(item)"
          >
            <VIcon x-small>$vuetify.icons.mdiDownload</VIcon>
          </VBtn>
        </span>
      </template>
    </VDataTable>

    <p class="text-caption text--secondary mb-0 path">
      <template v-if="hoveredPath">
        {{ msg('files') }}: <code>{{ hoveredPath }}</code>
      </template>
      <template v-else>
        {{ msg('hoverHelp') }}
      </template>
    </p>
  </div>
</template>

<script>
import JSZip from 'jszip'
import { mapState } from '@/utils/store-helper'
import { createObjectURL } from '@/utils/utils'

// A table whose rows are files of the export: hovering a row shows the paths of
// its files, a button downloads them as they are in the export, and cells, rows
// and columns can be blacked out on screen (e.g. before a screenshot).
// Nothing leaves the browser: downloads are made from the files already loaded.

const DEFAULT_MESSAGES = {
  blackOut: 'Black out',
  blackOutHelp: 'Click a cell, a column title or a row\'s square to black it out; click again to show it.',
  blackOutRow: 'Black out this row',
  showAll: 'Show all',
  files: 'File',
  download: 'Download the original file',
  hoverHelp: 'Point at a row to see where its file is in your export.'
}

export default {
  name: 'RedactableTable',
  props: {
    // Vuetify headers; a header can have format(value, item) for its cells
    headers: {
      type: Array,
      required: true
    },
    // each item has `files`: the paths of its files in the export
    items: {
      type: Array,
      required: true
    },
    itemsPerPage: {
      type: Number,
      default: 10
    },
    sortBy: {
      type: String,
      default: undefined
    },
    sortDesc: {
      type: Boolean,
      default: false
    },
    messages: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      redacting: false,
      // blacked-out rows, columns and cells: { key: true }
      rows: {},
      columns: {},
      cells: {},
      hovered: null
    }
  },
  computed: {
    ...mapState(['fileManager']),
    keyedItems() {
      return this.items.map((item, index) => ({
        ...item,
        _key: (item.files || []).join('|') || `${index}`
      }))
    },
    tableHeaders() {
      const control = { text: '', value: '_row', sortable: false, width: 1 }
      const files = { text: '', value: '_files', sortable: false, width: 1 }
      return [...(this.redacting ? [control] : []), ...this.headers, files]
    },
    hasRedactions() {
      return [this.rows, this.columns, this.cells].some(set => Object.keys(set).length)
    },
    hoveredPath() {
      return this.hovered && !this.redacting ? this.visibleFiles(this.hovered) : ''
    }
  },
  methods: {
    msg(key) {
      return this.messages?.[key] ?? DEFAULT_MESSAGES[key]
    },
    toggle(set, key) {
      if (set[key]) {
        this.$delete(set, key)
      } else {
        this.$set(set, key, true)
      }
    },
    clearRedactions() {
      this.rows = {}
      this.columns = {}
      this.cells = {}
    },
    cellKey(item, column) {
      return `${item._key}\u0000${column}`
    },
    isRedacted(item, column) {
      return !!(this.rows[item._key] || this.columns[column] || this.cells[this.cellKey(item, column)])
    },
    rowClass(item) {
      return this.rows[item._key] ? 'redacted-row' : ''
    },
    // folder names contain people's names: no paths for a row with anything blacked out
    visibleFiles(item) {
      const columns = [...this.headers.map(header => header.value), '_files']
      if (columns.some(column => this.isRedacted(item, column))) {
        return ''
      }
      return (item.files || []).join(', ')
    },
    canDownload(item) {
      return !!item.files?.length && item.files.every(path => this.fileManager?.fileDict?.[path])
    },
    async download(item) {
      const files = item.files.map(path => [path, this.fileManager.fileDict[path].blob])
      // name after the conversation's folder, which the file names alone don't identify
      const folder = item.files[0].split('/').slice(-2, -1)[0] || 'conversation'
      let blob
      let filename
      if (files.length === 1) {
        blob = files[0][1]
        filename = `${folder}_${files[0][0].split('/').pop()}`
      } else {
        const zip = new JSZip()
        files.forEach(([path, content]) => zip.file(path, content))
        blob = await zip.generateAsync({ type: 'blob' })
        filename = `${folder}.zip`
      }
      const link = document.createElement('a')
      link.href = createObjectURL(blob)
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    }
  }
}
</script>

<style scoped>
.redact-target {
  cursor: pointer;
}

.cell {
  display: inline-block;
  min-width: 1.5em;
}

/* blacked out: the content stays in the page, but nothing of it shows */
.redacted {
  background: #000;
  color: #000 !important;
  user-select: none;
}

.redacted >>> * {
  visibility: hidden;
}

.redactable-table >>> tr.redacted-row > td {
  background: #000 !important;
  color: #000 !important;
}

.path code {
  word-break: break-all;
}
</style>
