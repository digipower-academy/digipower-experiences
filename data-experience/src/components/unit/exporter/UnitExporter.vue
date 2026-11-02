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
          <p v-if="outputs[tab.id].tables.length > 1" class="text-body-2 mb-1">
            {{ $t('export-data.tables') }}
          </p>
          <div
            v-for="(table, i) in outputs[tab.id].tables"
            :key="`export-table-${tab.id}-${i}`"
            class="mb-4"
          >
            <!-- several tables: each has its own box, some unticked by default (exportDefaultOff) -->
            <VCheckbox
              v-if="outputs[tab.id].tables.length > 1"
              v-model="outputs[tab.id].included[tableKey(table)]"
              class="export-table-toggle mt-0 pt-0 mb-1"
              dense
              hide-details
            >
              <template #label>
                <span class="text-body-2 font-weight-medium">{{ table.path.join(' › ') }}</span>
                <span v-if="!outputs[tab.id].included[tableKey(table)]" class="text-caption ml-2">
                  ({{ $t('export-data.tableOff') }})
                </span>
              </template>
            </VCheckbox>
            <VDataTable
              :class="{ 'export-table-off': !outputs[tab.id].included[tableKey(table)] }"
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

const tableKey = table => table.path.join('/')

// The Export step: one checkbox per tab, none ticked. Ticking a tab computes its
// results if the tab hasn't been opened yet, and shows them as tables below.
// When a tab has several tables, each can be left out of the export; those
// listed in its view block's exportDefaultOff start unticked and greyed out.
// The download is a ZIP made in the browser: nothing is sent anywhere.
export default {
  name: 'UnitExporter',
  components: { BaseAlert },
  data() {
    return {
      selected: [],
      // tab id → { loading, error, result, tables, included: { table path → ticked } }
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
    tableKey,
    async compute(tab) {
      this.$set(this.outputs, tab.id, { loading: true })
      try {
        // a tab that was opened already has its result
        const result = this.results[tab.id] ??
          await runViewBlock(tab.viewBlock, { fileManager: this.fileManager, db: this.currentDB })
        const tables = resultTables(result)
        const off = tab.viewBlock.exportDefaultOff || []
        const included = Object.fromEntries(tables.map(table => [tableKey(table), !off.includes(tableKey(table))]))
        this.$set(this.outputs, tab.id, { result, tables, included })
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
          .map(({ index, id, title }) => {
            const { result, included } = this.outputs[id]
            // unticked tables are left out of the CSVs and of result.json
            const leftOut = Object.keys(included).filter(key => !included[key])
            return { index, id, title, result: withoutTables(result, leftOut) }
          })
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

<style scoped>
.export-table-off {
  opacity: 0.4;
}
</style>
