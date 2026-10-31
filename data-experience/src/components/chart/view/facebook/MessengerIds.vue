<template>
  <div class="messenger-ids">
    <p v-if="!rows.length" class="text--secondary">
      {{ msg('noData') }}
    </p>
    <template v-else>
      <KpiTiles class="mt-3" :items="kpis" />

      <ViewCard class="mt-3" :title="msg('chartTitle')" :info="msg('categoriesNote')">
        <template #actions>
          <VBtnToggle v-model="dateField" mandatory dense color="primary">
            <VBtn value="first" small>
              {{ msg('first') }}
            </VBtn>
            <VBtn value="last" small>
              {{ msg('last') }}
            </VBtn>
          </VBtnToggle>
        </template>
        <ApexChart
          type="scatter"
          height="420"
          :options="chartOptions"
          :series="series"
        />
      </ViewCard>
    </template>
  </div>
</template>

<script>
import VueApexCharts from 'vue-apexcharts'
import mixin from '@/components/chart/view/mixin'
import KpiTiles from '../shared/KpiTiles.vue'
import ViewCard from '../shared/ViewCard.vue'
import { escapeHtml, formatDate, formatNumber } from './messenger'

const CATEGORIES = ['shortId', 'longId', 'group']

const DEFAULT_MESSAGES = {
  shortId: 'One-to-one, short ID',
  longId: 'One-to-one, long ID',
  group: 'Group',
  chartTitle: 'Conversation ID against message date',
  categoriesNote: 'Each point is a conversation: its ID (from the folder name, on a logarithmic scale) against the date of its first or last message. "Short" IDs are below 5,000,000,000,000,000, the threshold used by the offline analysis this tab is based on. These groups describe how IDs are structured, not whether an account still exists.',
  first: 'First message',
  last: 'Last message',
  deleted: 'deleted or unnamed participant',
  messages: 'Messages',
  files: 'File',
  noData: 'No Messenger conversations with a numeric ID were found in this export.'
}

export default {
  name: 'MessengerIds',
  components: { ApexChart: VueApexCharts, KpiTiles, ViewCard },
  mixins: [mixin],
  data() {
    return { dateField: 'first' }
  },
  computed: {
    locale() {
      return this.$i18n?.locale || 'en'
    },
    // pipeline rows: { id, idNumber, category, title, folder, deletedParticipant, messages, first, last }
    rows() {
      return this.values.filter(row => row.idNumber > 0)
    },
    kpis() {
      return CATEGORIES.map(category => ({
        label: this.msg(category),
        value: formatNumber(this.rows.filter(row => row.category === category).length, this.locale)
      }))
    },
    series() {
      return CATEGORIES.map(category => ({
        name: this.msg(category),
        data: this.rows
          .filter(row => row.category === category && row[this.dateField])
          .map(row => ({ x: new Date(row[this.dateField]).getTime(), y: row.idNumber, row }))
      }))
    },
    yBounds() {
      const ids = this.rows.map(row => row.idNumber)
      return {
        min: 10 ** Math.floor(Math.log10(Math.min(...ids))),
        max: 10 ** Math.ceil(Math.log10(Math.max(...ids)) + 1e-9)
      }
    },
    chartOptions() {
      const msg = this.msg
      const locale = this.locale
      return {
        chart: { toolbar: { show: false }, animations: { enabled: false }, zoom: { enabled: false } },
        colors: ['#58539e', '#e4572e', '#76b041'],
        markers: { size: 5 },
        xaxis: { type: 'datetime' },
        yaxis: {
          logarithmic: true,
          // whole powers of 10 around the IDs, so that no point sits on the edge
          min: this.yBounds.min,
          max: this.yBounds.max,
          // log-scale gridlines are not exact powers of 10: label each with the nearest one
          labels: { formatter: value => `1e${Math.round(Math.log10(value))}` }
        },
        legend: { position: 'top' },
        tooltip: {
          shared: false,
          intersect: true,
          // conversation titles come from the export: escape them
          custom({ seriesIndex, dataPointIndex, w }) {
            const { row } = w.config.series[seriesIndex].data[dataPointIndex]
            const deleted = row.deletedParticipant ? `<br>${escapeHtml(msg('deleted'))}` : ''
            return `<div class="pa-2"><strong>${escapeHtml(row.title)}</strong><br>` +
              `ID ${escapeHtml(row.id)}<br>` +
              `${escapeHtml(msg('files'))}: <code>${escapeHtml((row.files || []).join(', '))}</code><br>` +
              `${escapeHtml(formatDate(row.first, locale))} – ${escapeHtml(formatDate(row.last, locale))}` +
              ` · ${escapeHtml(msg('messages'))}: ${escapeHtml(formatNumber(row.messages, locale))}${deleted}</div>`
          }
        }
      }
    }
  },
  methods: {
    msg(key) {
      return this.messages?.[key] ?? DEFAULT_MESSAGES[key]
    }
  }
}
</script>
