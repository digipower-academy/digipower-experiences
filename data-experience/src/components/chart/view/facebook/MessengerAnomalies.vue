<template>
  <div class="messenger-anomalies">
    <p v-if="!summary || !conversationCount" class="text--secondary">
      {{ msg('noData') }}
    </p>
    <template v-else>
      <KpiTiles class="mt-3" :items="kpis" />

      <VAlert
        v-if="summary.htmlConversations"
        class="mt-3"
        type="info"
        text
        dense
      >
        {{ htmlNote }}
      </VAlert>

      <ViewCard class="mt-3" :title="msg('conversationsTitle')">
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
      const jsonOnly = value => (s.jsonConversations ? this.number(value) : '–')
      return [
        { label: this.msg('empty'), value: this.number(s.emptyJson + s.emptyHtml) },
        { label: this.msg('allEmpty'), value: this.number(s.allEmpty) },
        { label: this.msg('unsent'), value: jsonOnly(s.unsent) },
        { label: this.msg('geoblocked'), value: jsonOnly(s.geoblocked) }
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
        { text: this.msg('messages'), value: 'messages', align: 'end' },
        { text: this.msg('empty'), value: 'empty', align: 'end' },
        { text: this.msg('unsent'), value: 'unsent', align: 'end' },
        { text: this.msg('geoblocked'), value: 'geoblocked', align: 'end' }
      ]
    }
  },
  methods: {
    msg(key) {
      return this.messages?.[key] ?? DEFAULT_MESSAGES[key]
    },
    number(value) {
      return formatNumber(value, this.locale)
    }
  }
}
</script>
