<template>
  <VContainer class="pt-8">
    <h2 class="mb-2">
      {{ $t('export-data.title') }}
    </h2>
    <p>
      {{ $t('export-data.intro') }}
    </p>

    <VCheckbox
      v-for="tab in tabs"
      :key="`export-${tab.id}`"
      v-model="selected"
      :value="tab.id"
      :label="tab.title"
      dense
      hide-details
    />

    <VRow class="mt-6 mb-2">
      <VCol>
        <VBtn
          outlined
          :disabled="!ready"
          :loading="zipping"
          @click="download"
        >
          <VIcon left>
            $vuetify.icons.mdiDownload
          </VIcon>
          {{ $t('export-data.download') }}
        </VBtn>
        <span v-if="!selected.length" class="text-caption text--secondary ml-3">
          {{ $t('export-data.noneSelected') }}
        </span>
      </VCol>
    </VRow>

    <VCard
      v-for="tab in selectedTabs"
      :key="`export-tables-${tab.id}`"
      outlined
      class="mb-4"
    >
      <VCardTitle class="text-subtitle-1 font-weight-bold">
        {{ tab.title }}
      </VCardTitle>
      <VCardText>
        <VProgressLinear v-if="!outputs[tab.id] || outputs[tab.id].loading" indeterminate />
        <BaseAlert v-else-if="outputs[tab.id].error">
          {{ $t('export-data.error') }} {{ outputs[tab.id].error }}
        </BaseAlert>
        <p v-else-if="!outputs[tab.id].tables.length" class="mb-0">
          {{ $t('export-data.empty') }}
        </p>
        <template v-else>
          <div
            v-for="(table, i) in outputs[tab.id].tables"
            :key="`export-table-${tab.id}-${i}`"
            class="mb-4"
          >
            <div v-if="table.path.length" class="text-body-2 font-weight-medium mb-1">
              {{ table.path.join(' › ') }}
            </div>
            <VDataTable
              :headers="table.columns.map(column => ({ text: column, value: column }))"
              :items="table.rows"
              :items-per-page="5"
              :footer-props="{ itemsPerPageOptions: [5, 10, 50, -1] }"
              dense
            />
          </div>
        </template>
      </VCardText>
    </VCard>
  </VContainer>
</template>

<script>
import { mapState, mapGetters } from '@/utils/store-helper'
import { kViewBlockPrefix } from '@/utils/i18n-utils'
import { exportFilename, exportZip, resultTables, runViewBlock, withoutTables } from '@/utils/export'
import BaseAlert from '@/components/base/BaseAlert.vue'

// The Export step: one checkbox per tab, none ticked. Ticking a tab computes its
// results if the tab hasn't been opened yet, and shows them as tables below.
// A tab can leave some of its tables out (exportExclude in the viewer JSON).
// The download is a ZIP made in the browser: nothing is sent anywhere.
export default {
  name: 'UnitExporter',
  components: { BaseAlert },
  data() {
    return {
      selected: [],
      // tab id → { loading, error, result, tables }
      outputs: {},
      zipping: false
    }
  },
  computed: {
    ...mapState(['experienceConfig', 'fileManager', 'currentDB', 'results']),
    ...mapGetters(['experienceNameAndTag']),
    tabs() {
      return this.experienceConfig.viewBlocks.map((viewBlock, index) => ({
        index,
        id: viewBlock.id,
        viewBlock,
        title: this.$tev(`${kViewBlockPrefix(this.experienceNameAndTag, viewBlock.id)}.title`, viewBlock.title)
      }))
    },
    selectedTabs() {
      return this.tabs.filter(tab => this.selected.includes(tab.id))
    },
    ready() {
      return this.selectedTabs.length > 0 &&
        this.selectedTabs.every(tab => this.outputs[tab.id] && !this.outputs[tab.id].loading)
    }
  },
  watch: {
    selected(ids) {
      this.tabs
        .filter(tab => ids.includes(tab.id) && !this.outputs[tab.id])
        .forEach(tab => this.compute(tab))
    },
    // new data loaded: start again
    fileManager() {
      this.selected = []
      this.outputs = {}
    }
  },
  methods: {
    async compute(tab) {
      this.$set(this.outputs, tab.id, { loading: true })
      try {
        // a tab that was opened already has its result
        const full = this.results[tab.id] ??
          await runViewBlock(tab.viewBlock, { fileManager: this.fileManager, db: this.currentDB })
        // tables the tab leaves out of the export are neither shown nor in the ZIP
        const result = withoutTables(full, tab.viewBlock.exportExclude)
        this.$set(this.outputs, tab.id, { result, tables: resultTables(result) })
      } catch (error) {
        console.error(error)
        this.$set(this.outputs, tab.id, { error: error instanceof Error ? error.message : String(error) })
      }
    },
    async download() {
      this.zipping = true
      try {
        const tabs = this.selectedTabs
          .filter(tab => !this.outputs[tab.id].error)
          .map(({ index, id, title }) => ({ index, id, title, result: this.outputs[id].result }))
        const experience = this.experienceConfig.slug
        const blob = await exportZip({ experience, tabs }).generateAsync({ type: 'blob' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = exportFilename(experience)
        link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      } finally {
        this.zipping = false
      }
    }
  }
}
</script>
