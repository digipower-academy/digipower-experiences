<template>
  <div class="messenger-overview">
    <p v-if="!summary || !summary.conversations" class="text--secondary">
      {{ msg('noData') }}
    </p>
    <template v-else>
      <KpiTiles class="mt-3" :items="kpis" />

      <ViewCard class="mt-3" :title="msg('perYear')">
        <ApexChart
          type="bar"
          height="320"
          :options="chartOptions"
          :series="series"
        />
      </ViewCard>

      <ViewCard class="mt-3" :title="msg('folders')">
        <VSimpleTable dense>
          <thead>
            <tr>
              <th>{{ msg('folder') }}</th>
              <th class="text-right">{{ msg('conversations') }}</th>
              <th class="text-right">{{ msg('messages') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in folders" :key="row.folder">
              <td>{{ folderLabel(row.folder) }}</td>
              <td class="text-right">{{ number(row.conversations) }}</td>
              <td class="text-right">{{ number(row.messages) }}</td>
            </tr>
          </tbody>
        </VSimpleTable>
        <p class="text-caption text--secondary mt-3 mb-0">
          {{ sources }}
        </p>
      </ViewCard>
    </template>
  </div>
</template>

<script>
import VueApexCharts from 'vue-apexcharts'
import mixin from '@/components/chart/view/mixin'
import KpiTiles from '../shared/KpiTiles.vue'
import ViewCard from '../shared/ViewCard.vue'
import { fill, formatNumber } from './messenger'

const DEFAULT_MESSAGES = {
  conversations: 'Conversations',
  oneToOneAndGroups: 'One-to-one / groups',
  sent: 'Messages sent',
  received: 'Messages received',
  period: 'Period',
  perYear: 'Messages per year',
  folders: 'Conversations by folder',
  folder: 'Folder',
  messages: 'Messages',
  sources: 'Read from {json} conversations in JSON and {html} in HTML.',
  noData: 'No Messenger conversations were found in this export.',
  folder_inbox: 'Inbox',
  folder_filtered_threads: 'Filtered (spam)',
  folder_message_requests: 'Message requests',
  folder_archived_threads: 'Archived',
  folder_legacy_threads: 'Legacy',
  folder_e2ee_cutover: 'Moved to end-to-end encryption'
}

export default {
  name: 'MessengerOverview',
  components: { ApexChart: VueApexCharts, KpiTiles, ViewCard },
  mixins: [mixin],
  computed: {
    locale() {
      return this.$i18n?.locale || 'en'
    },
    // pipeline: one item { summary, folders, years }
    data() {
      return this.values[0] || {}
    },
    summary() {
      return this.data.summary
    },
    folders() {
      return this.data.folders || []
    },
    years() {
      return this.data.years || []
    },
    kpis() {
      const s = this.summary
      const from = s.first ? new Date(s.first).getFullYear() : '–'
      const to = s.last ? new Date(s.last).getFullYear() : '–'
      return [
        { label: this.msg('conversations'), value: this.number(s.conversations) },
        { label: this.msg('oneToOneAndGroups'), value: `${this.number(s.oneToOne)} / ${this.number(s.groups)}` },
        { label: this.msg('sent'), value: this.number(s.sent) },
        { label: this.msg('received'), value: this.number(s.received) },
        { label: this.msg('period'), value: `${from} – ${to}` }
      ]
    },
    series() {
      return [
        { name: this.msg('sent'), data: this.years.map(row => row.sent) },
        { name: this.msg('received'), data: this.years.map(row => row.received) }
      ]
    },
    chartOptions() {
      return {
        chart: { stacked: true, toolbar: { show: false }, animations: { enabled: false } },
        dataLabels: { enabled: false },
        colors: [this.$vuetify?.theme?.themes?.light?.primary || '#58539e', '#9ea3d8'],
        xaxis: { categories: this.years.map(row => String(row.year)) },
        legend: { position: 'top' }
      }
    },
    sources() {
      return fill(this.msg('sources'), {
        json: this.number(this.summary.jsonConversations),
        html: this.number(this.summary.htmlConversations)
      })
    }
  },
  methods: {
    msg(key) {
      return this.messages?.[key] ?? DEFAULT_MESSAGES[key]
    },
    number(value) {
      return formatNumber(value, this.locale)
    },
    folderLabel(folder) {
      return this.msg(`folder_${folder}`) || folder
    }
  }
}
</script>
