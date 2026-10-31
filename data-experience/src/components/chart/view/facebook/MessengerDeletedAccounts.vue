<template>
  <div class="messenger-deleted-accounts">
    <p v-if="!summary || !summary.conversations" class="text--secondary">
      {{ msg('noData') }}
    </p>
    <template v-else>
      <KpiTiles class="mt-3" :items="kpis" />

      <ViewCard v-if="years.length" class="mt-3" :title="msg('perYear')">
        <ApexChart
          type="bar"
          height="280"
          :options="chartOptions"
          :series="series"
        />
      </ViewCard>

      <ViewCard class="mt-3" :title="msg('conversationsTitle')" :info="msg('labelNote')">
        <RedactableTable
          v-if="conversations.length"
          :headers="tableHeaders"
          :items="conversations"
          :messages="messages"
          sort-by="theirMessages"
          sort-desc
        />
        <p v-else class="text--secondary mb-0">
          {{ msg('none') }}
        </p>
      </ViewCard>
    </template>
  </div>
</template>

<script>
import VueApexCharts from 'vue-apexcharts'
import mixin from '@/components/chart/view/mixin'
import KpiTiles from '../shared/KpiTiles.vue'
import RedactableTable from '../shared/RedactableTable.vue'
import ViewCard from '../shared/ViewCard.vue'
import { formatDate, formatNumber } from './messenger'

const DEFAULT_MESSAGES = {
  affected: 'Conversations with a deleted or unnamed account',
  theirMessages: 'Their messages still in the export',
  withText: 'Of which with text',
  perYear: 'Messages from deleted or unnamed accounts, per year',
  conversationsTitle: 'Conversations',
  labelNote: 'Facebook names accounts that were deleted or are unavailable "Facebook user" (in French, "Utilisateur(ice) Facebook"). The label alone does not prove that an account was deleted.',
  conversation: 'Conversation',
  kind: 'Type',
  folder: 'Folder',
  messages: 'All messages',
  first: 'Their first message',
  last: 'Their last message',
  group: 'Group',
  oneToOne: 'One-to-one',
  none: 'No conversation in this export has a deleted or unnamed participant.',
  noData: 'No Messenger conversations were found in this export.',
  folder_inbox: 'Inbox',
  folder_filtered_threads: 'Filtered (spam)',
  folder_message_requests: 'Message requests',
  folder_archived_threads: 'Archived',
  folder_legacy_threads: 'Legacy',
  folder_e2ee_cutover: 'Moved to end-to-end encryption'
}

export default {
  name: 'MessengerDeletedAccounts',
  components: { ApexChart: VueApexCharts, KpiTiles, RedactableTable, ViewCard },
  mixins: [mixin],
  computed: {
    locale() {
      return this.$i18n?.locale || 'en'
    },
    // pipeline: one item { summary, conversations, years }
    data() {
      return this.values[0] || {}
    },
    summary() {
      return this.data.summary
    },
    conversations() {
      return this.data.conversations || []
    },
    years() {
      return this.data.years || []
    },
    kpis() {
      const s = this.summary
      return [
        { label: this.msg('affected'), value: `${this.number(s.affected)} / ${this.number(s.conversations)}` },
        { label: this.msg('theirMessages'), value: this.number(s.theirMessages) },
        { label: this.msg('withText'), value: this.number(s.theirMessagesWithText) }
      ]
    },
    tableHeaders() {
      return [
        { text: this.msg('conversation'), value: 'title' },
        { text: this.msg('kind'), value: 'group', format: group => (group ? this.msg('group') : this.msg('oneToOne')) },
        { text: this.msg('folder'), value: 'folder', format: folder => this.msg(`folder_${folder}`) || folder },
        { text: this.msg('theirMessages'), value: 'theirMessages', align: 'end' },
        { text: this.msg('withText'), value: 'theirMessagesWithText', align: 'end' },
        { text: this.msg('messages'), value: 'messages', align: 'end' },
        { text: this.msg('first'), value: 'first', format: this.date },
        { text: this.msg('last'), value: 'last', format: this.date }
      ]
    },
    series() {
      return [{ name: this.msg('theirMessages'), data: this.years.map(row => row.messages) }]
    },
    chartOptions() {
      return {
        chart: { toolbar: { show: false }, animations: { enabled: false } },
        dataLabels: { enabled: false },
        colors: [this.$vuetify?.theme?.themes?.light?.primary || '#58539e'],
        xaxis: { categories: this.years.map(row => String(row.year)) }
      }
    }
  },
  methods: {
    msg(key) {
      return this.messages?.[key] ?? DEFAULT_MESSAGES[key]
    },
    number(value) {
      return formatNumber(value, this.locale)
    },
    date(iso) {
      return formatDate(iso, this.locale)
    }
  }
}
</script>
