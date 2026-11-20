import type { ViewBlocks } from '@/types'

import sqlViews from './sql/views.sql'
import sqlInteractions from './sql/interactions.sql'
import sqlAdvertisers from './sql/advertisers.sql'
import sqlInterests from './sql/interests.sql'
import sqlAdInteractions from './sql/ad-interactions.sql'
import sqlLocations from './sql/locations.sql'
import sqlLogins from './sql/logins.sql'

import sqlTime from './sql/time.sql'

import { genericDateViewer } from '@/pipelines/generic'

import { makeSessions } from './postprocessors'

const blocks: ViewBlocks = [
  {
    id: 'consumption',
    sql: sqlViews,
    showTable: false,
    files: ['postsViewed'],
    visualization: 'ChartViewDashboard.vue',
    vizProps: {
      graphs: [
        {
          title: 'Content viewed',
          valueLabel: 'views',
          cols: '12',
          type: 'TimelineChart.vue',
          dateAccessor: 'actionDate'
        },
        {
          valueLabel: 'interactions',
          title: 'Type of content',
          cols: '6',
          height: 220,
          type: 'PieChart.vue',
          valueAccessor: 'actionType'
        },
        {
          valueLabel: 'interactions',
          title: 'Top Account',
          cols: '6',
          height: 220,
          type: 'TopChart.vue',
          isScrollable: true,
          topK: 100,
          valueAccessor: 'accountName'
        }
      ]
    },
    title: 'Consumption',
    text: 'See how much content you watch over time.'
  },
  {
    id: 'consumption-time',
    sql: sqlTime,
    showTable: false,
    postprocessor: makeSessions,
    visualization: 'ChartViewDashboard.vue',
    vizProps: {
      graphs: [
        {
          title: 'Time spent',
          valueLabel: 'minutes',
          cols: '12',
          type: 'TimelineChart.vue',
          dateAccessor: 'start_date',
          valueAccessor: 'duration_m'
        },
        {
          valueLabel: 'minutes',
          type: 'WeekChart.vue',
          cols: '4',
          height: 220,
          dateAccessor: 'start_date',
          valueAccessor: 'duration_m'
        },
        {
          valueLabel: 'minutes',
          type: 'HourChart.vue',
          cols: '4',
          height: 220,
          dateAccessor: 'start_date',
          valueAccessor: 'duration_m'
        },
        {
          valueLabel: 'actions',
          title: 'Actions',
          cols: '4',
          height: 220,
          type: 'TopChart.vue',
          valueAccessor: 'actions',
          valueAsArray: true
        }
      ]
    },
    title: 'Consommation (durée)',
    text: 'See which advertisers are using your information on Instagram.'
  },
  {
    id: 'interactions',
    sql: sqlInteractions,
    files: ['likedPosts', 'followings', 'messages', 'personalInfos'],
    showTable: false,
    visualization: 'ChartViewDashboard.vue',
    vizProps: {
      graphs: [
        {
          title: 'Number of interactions',
          valueLabel: 'action',
          cols: '8',
          type: 'TimelineChart.vue',
          dateAccessor: '_date'
        },
        {
          valueLabel: 'interactions',
          title: 'Interaction Type',
          cols: '4',
          type: 'TopChart.vue',
          valueAccessor: 'interactionType'
        },
        {
          valueLabel: 'interactions',
          type: 'WeekChart.vue',
          cols: '4',
          height: 220,
          dateAccessor: '_date'
        },
        {
          valueLabel: 'interactions',
          type: 'HourChart.vue',
          cols: '4',
          height: 220,
          dateAccessor: '_date'
        },
        {
          valueLabel: 'interactions',
          title: 'User',
          cols: '4',
          height: 220,
          type: 'TopChart.vue',
          isScrollable: true,
          topK: 100,
          valueAccessor: 'accountName'
        }
      ]
    },
    title: 'Interactions',
    text: 'See which actions you do most when using Instagram.'
  },
  {
    id: 'ad-interactions',
    sql: sqlAdInteractions,
    files: ['adsViewed'],
    showTable: false,
    visualization: 'ChartViewDashboard.vue',
    vizProps: {
      graphs: [
        {
          title: 'Ads viewed',
          valueLabel: 'action',
          cols: '8',
          type: 'TimelineChart.vue',
          dateAccessor: '_date'
        },
        {
          valueLabel: 'ads',
          title: 'Top advertisers',
          cols: '4',
          type: 'TopChart.vue',
          isScrollable: true,
          topK: 100,
          valueAccessor: 'title'
        }
      ]
    },
    title: 'Ads 1/3 (Interactions)',
    text: 'See how many ads you viewed and which advertisers showed you the most.'
  },
  {
    id: 'ad-interests',
    sql: sqlInterests,
    visualization: 'ChartViewDashboard.vue',
    files: ['adsInterests'],
    vizProps: {
      graphs: [
        {
          title: 'Theme',
          valueLabel: 'value',
          cols: '12',
          type: 'TopChart.vue',
          valueAccessor: '_type',
          height: 220
        }
      ]
    },
    showTable: true,
    title: 'Ads 2/3 (Interests)',
    text: 'See which interests are inferred about you.'
  },
  {
    id: 'ad-advertisers',
    sql: sqlAdvertisers,
    files: ['advertisers'],
    showTable: true,
    title: 'Ads 3/3 (Advertisers)',
    text: 'See which advertisers have used your information on Instagram.'
  },
  {
    id: 'locations',
    sql: sqlLocations,
    files: ['profileBasedIn'],
    showTable: true,
    visualization: 'ChartViewDashboard.vue',
    vizProps: {
      graphs: [
        {
          title: 'Locations',
          valueLabel: 'locations',
          cols: '12',
          type: 'TopChart.vue',
          valueAccessor: 'location',
          sumAccessor: 'n',
          height: 220,
          isScrollable: true,
          topK: 100
        }
      ]
    },
    title: 'Locations',
    text: 'See the coarse places Instagram associates with you.'
  },
  {
    id: 'logins',
    sql: sqlLogins,
    files: ['loginActivity'],
    showTable: false,
    visualization: 'ChartViewDashboard.vue',
    vizProps: {
      graphs: [
        {
          title: 'Logins over time',
          valueLabel: 'logins',
          cols: '8',
          type: 'TimelineChart.vue',
          dateAccessor: '_date'
        },
        {
          valueLabel: 'logins',
          title: 'Top IP addresses',
          cols: '4',
          height: 220,
          type: 'TopChart.vue',
          isScrollable: true,
          topK: 100,
          valueAccessor: 'ipAddress'
        }
      ]
    },
    title: 'Connexions',
    text: 'See when and from which IP addresses your account was logged into.'
  },
  genericDateViewer
]

export default blocks
