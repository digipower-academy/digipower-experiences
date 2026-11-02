<template>
  <div class="messenger">
    <nav class="mb-2">
      <VChip
        v-for="section in sections"
        :key="`link-${section.id}`"
        small
        outlined
        class="mr-2 mb-2"
        @click="scrollTo(section.id)"
      >
        {{ section.title }}
      </VChip>
    </nav>

    <section
      v-for="section in sections"
      :id="anchor(section.id)"
      :key="section.id"
      class="mb-8"
    >
      <h3 class="text-h6 mt-4 mb-1">
        {{ section.title }}
      </h3>
      <p class="text-body-2 text--secondary mb-0">
        {{ section.text }}
      </p>
      <component
        :is="section.component"
        :values="section.values"
        :messages="messages[section.id] || {}"
        :view-block-translation-prefix="viewBlockTranslationPrefix"
      />
    </section>
  </div>
</template>

<script>
import mixin from '@/components/chart/view/mixin'
import MessengerOverview from './MessengerOverview.vue'
import MessengerDeletedAccounts from './MessengerDeletedAccounts.vue'
import MessengerAnomalies from './MessengerAnomalies.vue'
import MessengerIds from './MessengerIds.vue'

// The Messenger tab: four sections, each one of the views below.
// Texts: messages.sections.<id>.{title,text}, and messages.<id> for each view.
const SECTIONS = [
  {
    id: 'overview',
    component: MessengerOverview,
    title: 'Your conversations',
    text: 'How many conversations, with whom (one-to-one or in groups), in which folders, and how many messages you sent and received each year.'
  },
  {
    id: 'deletedAccounts',
    component: MessengerDeletedAccounts,
    title: 'Deleted accounts in your conversations',
    text: 'Conversations with someone whose account was deleted or is unavailable, shown by Facebook as "Facebook user". Your export may still contain their messages, with their text: this section counts them.'
  },
  {
    id: 'anomalies',
    component: MessengerAnomalies,
    title: 'Empty, unsent and geo-blocked messages',
    text: 'Messages your export marks as unsent or geo-blocked, or whose text is empty. Comparing these counts between two exports of the same account shows whether messages disappeared or were emptied in between.'
  },
  {
    id: 'ids',
    component: MessengerIds,
    title: 'Conversation IDs over time',
    text: 'Each conversation folder ends with a numeric ID. Plotting these IDs against the dates of the messages shows how Facebook numbered conversations over the years.'
  }
]

export default {
  name: 'MessengerTab',
  mixins: [mixin],
  computed: {
    // pipeline: one item { overview, deletedAccounts, anomalies, ids }, each { headers, items }
    data() {
      return this.values[0] || {}
    },
    sections() {
      const texts = this.messages?.sections || {}
      return SECTIONS.map(section => ({
        ...section,
        title: texts[section.id]?.title ?? section.title,
        text: texts[section.id]?.text ?? section.text,
        values: this.data[section.id]?.items || []
      }))
    }
  },
  methods: {
    anchor(id) {
      return `messenger-${id}`
    },
    // no #anchor links: they would change the page's URL, which the site's router handles
    scrollTo(id) {
      document.getElementById(this.anchor(id))?.scrollIntoView({ behavior: 'smooth' })
    }
  }
}
</script>
