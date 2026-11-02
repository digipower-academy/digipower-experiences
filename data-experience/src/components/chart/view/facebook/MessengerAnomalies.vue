<template>
  <div class="messenger-anomalies">
    <p v-if="!summary || !conversationCount" class="text--secondary">
      {{ msg('noData') }}
    </p>
    <template v-else>
      <KpiTiles class="mt-3" :items="kpis" />
      <p class="text-caption text--secondary mt-1 mb-0">
        {{ msg('splitNote') }}
      </p>

      <VAlert
        v-if="summary.htmlConversations"
        class="mt-3"
        type="info"
        text
        dense
      >
        {{ htmlNote }}
      </VAlert>

      <ViewCard class="mt-3" :title="msg('conversationsTitle')" :subtitle="msg('tableNote')">
        <template #actions>
          <VSwitch
            v-model="showOthersAllEmpty"
            :label="msg('othersAllEmpty')"
            class="mt-0 pt-0"
            dense
            hide-details
          />
        </template>
        <RedactableTable
          v-if="conversations.length"
          :headers="tableHeaders"
          :items="conversations"
          :messages="messages"
        />
        <p v-else class="text--secondary mb-0">
          {{ msg('none') }}
        </p>
      </ViewCard>
    </template>
  </div>
</template>

<script>
import mixin from '@/components/chart/view/mixin'
import KpiTiles from '../shared/KpiTiles.vue'
import RedactableTable from '../shared/RedactableTable.vue'
import ViewCard from '../shared/ViewCard.vue'
import { fill, formatNumber } from './messenger'

const DEFAULT_MESSAGES = {
  empty: 'Empty messages',
  allEmpty: 'Conversations with only empty messages',
  unsent: 'Unsent messages',
  geoblocked: 'Geo-blocked messages',
  splitNote: 'Each count reads: your messages / other people\'s.',
  tableNote: 'For each kind of message, yours and other people\'s are counted in two columns.',
  yours: 'You',
  others: 'Others',
  group_messages: 'Messages',
  group_empty: 'Empty',
  group_unsent: 'Unsent',
  group_geoblocked: 'Geo-blocked',
  othersAllEmpty: 'Empty conversation?',
  othersAllEmptyHelp: 'Yes when every message from other people in this conversation is empty, whatever yours contain.',
  yes: 'Yes',
  no: 'No',
  htmlNote: 'Of these conversations, {html} come from an HTML export. HTML exports do not record unsent or geo-blocked messages, and cannot tell an empty message from a missing one: for them, "empty" counts the {emptyHtml} messages with neither text nor attachment.',
  conversationsTitle: 'Conversations with empty, unsent or geo-blocked messages',
  conversation: 'Conversation',
  folder: 'Folder',
  format: 'Format',
  messages: 'Messages',
  none: 'No conversation in this export has empty, unsent or geo-blocked messages.',
  noData: 'No Messenger conversations were found in this export.',
  folder_inbox: 'Inbox',
  folder_filtered_threads: 'Filtered (spam)',
  folder_message_requests: 'Message requests',
  folder_archived_threads: 'Archived',
  folder_legacy_threads: 'Legacy',
  folder_e2ee_cutover: 'Moved to end-to-end encryption'
}

export default {
  name: 'MessengerAnomalies',
  components: { KpiTiles, RedactableTable, ViewCard },
  mixins: [mixin],
  data() {
    return { showOthersAllEmpty: true }
  },
  computed: {
    locale() {
      return this.$i18n?.locale || 'en'
    },
    // pipeline: one item { summary, conversations }
    data() {
      return this.values[0] || {}
    },
    summary() {
      return this.data.summary
    },
    conversations() {
      return this.data.conversations || []
    },
    conversationCount() {
      return this.summary.jsonConversations + this.summary.htmlConversations
    },
    kpis() {
      const s = this.summary
      // JSON-only flags: not available when the whole export is HTML
      const jsonOnly = value => (s.jsonConversations ? value : '–')
      return [
        { label: this.msg('empty'), value: this.pair(s.emptyYours, s.emptyOthers) },
        { label: this.msg('allEmpty'), value: this.number(s.allEmpty) },
        { label: this.msg('unsent'), value: jsonOnly(this.pair(s.unsentYours, s.unsentOthers)) },
        { label: this.msg('geoblocked'), value: jsonOnly(this.pair(s.geoblockedYours, s.geoblockedOthers)) }
      ]
    },
    htmlNote() {
      return fill(this.msg('htmlNote'), {
        html: this.number(this.summary.htmlConversations),
        emptyHtml: this.number(this.summary.emptyHtml)
      })
    },
    tableHeaders() {
      return [
        { text: this.msg('conversation'), value: 'title' },
        { text: this.msg('folder'), value: 'folder', format: folder => this.msg(`folder_${folder}`) || folder },
        { text: this.msg('format'), value: 'format', format: format => format.toUpperCase() },
        ...(this.showOthersAllEmpty
          ? [{
              text: this.msg('othersAllEmpty'),
              title: this.msg('othersAllEmptyHelp'),
              value: 'othersAllEmpty',
              format: empty => (empty ? this.msg('yes') : this.msg('no'))
            }]
          : []),
        // each kind of message: two sortable columns, yours and other people's, under one title
        ...['messages', 'empty', 'unsent', 'geoblocked'].flatMap(key => [
          { text: this.msg('yours'), value: `${key}Yours`, align: 'end', class: 'count', cellClass: 'count', group: this.msg(`group_${key}`) },
          { text: this.msg('others'), value: `${key}Others`, align: 'end', class: 'count', cellClass: 'count', group: this.msg(`group_${key}`) }
        ])
      ]
    }
  },
  methods: {
    msg(key) {
      return this.messages?.[key] ?? DEFAULT_MESSAGES[key]
    },
    number(value) {
      return formatNumber(value, this.locale)
    },
    // "2 / 5": the account holder's messages, then everyone else's
    pair(yours, others) {
      return `${this.number(yours)} / ${this.number(others)}`
    }
  }
}
</script>

<style scoped>
/* eight count columns: less padding so that they fit next to each other */
.messenger-anomalies >>> .count {
  padding: 0 8px !important;
}
</style>
