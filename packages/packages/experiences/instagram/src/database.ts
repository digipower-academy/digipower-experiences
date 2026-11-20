import type { DatabaseConfig } from '@/types'
import { SQLType, JSONPathRecord } from '@/types/database-config'
import { toDateString, SUPPORTED_LOCALE } from '@/utils'

const { TEXT } = SQLType

const deepFindLabel = (node: any, label: string): string => {
  if (Array.isArray(node)) {
    for (const x of node) {
      const r = deepFindLabel(x, label)
      if (r) return r
    }
    return ''
  }
  if (node && typeof node === 'object') {
    if (node.label === label && node.value) return node.value
    if (Array.isArray(node.dict)) return deepFindLabel(node.dict, label)
  }
  return ''
}

const OWNER_TITLES = ['Propriétaire', 'Owner']
const PROFILE_LABELS = ['Nom de profil', 'Username']
const findOwner = (node: any): any => {
  if (Array.isArray(node)) {
    for (const x of node) {
      const r = findOwner(x)
      if (r) return r
    }
    return null
  }
  if (node && typeof node === 'object') {
    if (OWNER_TITLES.includes(node.title) && Array.isArray(node.dict))
      return node
    if (Array.isArray(node.dict)) return findOwner(node.dict)
  }
  return null
}
const ownerProfileName = (labelValues: any[]): string => {
  const owner = findOwner(labelValues || [])
  if (!owner) return ''
  for (const label of PROFILE_LABELS) {
    const v = deepFindLabel(owner, label)
    if (v) return v
  }
  return ''
}

const labelValuesCallback = (output: unknown) => {
  const o = output as JSONPathRecord
  const lv: any[] = (o['label_values'] as any[]) || []
  o['accountName'] = ownerProfileName(lv)
  o['date'] = toDateString(String(o['timestamp']), '%s', SUPPORTED_LOCALE.FR)
}

const labelValuesKind = (kind: string) => (output: unknown) => {
  labelValuesCallback(output)
  ;(output as JSONPathRecord)['kind'] = kind
}

const stringMapDateCallback = (timeKey: string) => (output: unknown) => {
  const o = output as JSONPathRecord
  const ts = (o[timeKey] as any)?.timestamp
  o['date'] = toDateString(String(ts), '%s', SUPPORTED_LOCALE.FR)
}

const smdValue = (o: any, keys: string[], field = 'value'): any => {
  for (const k of keys) {
    const v = o?.[k]?.[field]
    if (v !== undefined && v !== '') return v
  }
  return undefined
}

const INTEREST_THEMES: [string, RegExp][] = [
  ['Friends & family of', /^(friends of|amis? d|famille d|parents? d)/i],
  [
    'Devices & network',
    /(access \(|accès|mobile|smartphone|tablet|tablette|android|ios|iphone|wi-?fi|réseau|network|appareil|device|navigateur|browser)/i
  ],
  ['Page admins', /(page admin|administrat)/i],
  ['Travel', /(travel|voyag|touris)/i],
  [
    'Life events & demographics',
    /(birthday|anniversaire|away from|loin d|relationship|situation amoureuse|single|célibataire|married|mari[ée]|engaged|fiancé|moved|déménag|expat|abroad|étranger|parent|newlywed|graduat|diplôm|lives? in|habite)/i
  ]
]
const interestTheme = (title: string): string =>
  INTEREST_THEMES.find(([, re]) => re.test(title))?.[0] ??
  'Interests & behaviours'

const config: DatabaseConfig = {
  tables: [
    {
      name: 'InstagramMessage',
      columns: [
        ['senderName', TEXT],
        ['timestampMs', TEXT],
        ['messageContent', TEXT]
      ]
    },
    {
      name: 'InstagramFollower',
      columns: [
        ['accountName', TEXT],
        ['timestampMs', TEXT],
        ['accountUrl', TEXT]
      ]
    },
    {
      name: 'InstagramFollowing',
      columns: [
        ['accountName', TEXT],
        ['timestampMs', TEXT],
        ['accountUrl', TEXT]
      ]
    },
    {
      name: 'InstagramPostViewed',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT]
      ]
    },
    {
      name: 'InstagramVideoWatched',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT]
      ]
    },
    {
      name: 'InstagramAdViewed',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT]
      ]
    },
    {
      name: 'InstagramCommentLiked',
      columns: [
        ['accountName', TEXT],
        ['unixTimestamp', TEXT]
      ]
    },
    {
      name: 'InstagramPostLiked',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT]
      ]
    },
    {
      name: 'InstagramAdvertiser',
      columns: [['advertiserName', TEXT]]
    },
    {
      name: 'InstagramAdInterest',
      columns: [
        ['title', TEXT],
        ['theme', TEXT]
      ]
    },
    {
      name: 'InstagramInfo',
      columns: [['name', TEXT]]
    },
    {
      name: 'InstagramThreadViewed',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT]
      ]
    },
    {
      name: 'InstagramComment',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT]
      ]
    },
    {
      name: 'InstagramStoryInteraction',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT],
        ['kind', TEXT]
      ]
    },
    {
      name: 'InstagramStoryViewed',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT]
      ]
    },
    {
      name: 'InstagramRepost',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT]
      ]
    },
    {
      name: 'InstagramSaved',
      columns: [
        ['accountName', TEXT],
        ['datetime', TEXT]
      ]
    },
    {
      name: 'InstagramLocation',
      columns: [['location', TEXT]]
    },
    {
      name: 'InstagramLogin',
      columns: [
        ['ipAddress', TEXT],
        ['datetime', TEXT],
        ['userAgent', TEXT]
      ]
    }
  ],
  getters: [
    {
      fileId: 'adsInterests',
      path: '$.label_values[*].vec[*]',
      table: 'InstagramAdInterest',
      options: {
        callback: output => {
          const o = output as JSONPathRecord
          o['theme'] = interestTheme(String(o['value'] ?? '').trim())
        }
      },
      getters: [
        {
          column: 'title',
          path: '$.value'
        },
        {
          column: 'theme',
          path: '$.theme'
        }
      ]
    },
    {
      fileId: 'personalInfos',
      path: '$.profile_user[*].string_map_data',
      table: 'InstagramInfo',
      options: {
        callback: output => {
          const o = output as JSONPathRecord
          o['_displayName'] = smdValue(o, ['Nom', 'Name']) ?? ''
        }
      },
      getters: [{ column: 'name', path: '$._displayName' }]
    },
    {
      fileId: 'personalInfos',
      path: '$.profile_user[*].string_map_data',
      table: 'InstagramInfo',
      options: {
        callback: output => {
          const o = output as JSONPathRecord
          o['_handle'] =
            smdValue(o, ['Nom de profil', 'Username', "Nom d'utilisateur"]) ??
            ''
        }
      },
      getters: [{ column: 'name', path: '$._handle' }]
    },
    {
      fileId: 'advertisers',
      path: '$.label_values[*].vec[*]',
      table: 'InstagramAdvertiser',
      getters: [
        {
          column: 'advertiserName',
          path: '$.value'
        }
      ]
    },
    {
      fileId: 'messages',
      path: '$.messages[*]',
      table: 'InstagramMessage',
      getters: [
        {
          column: 'senderName',
          path: '$.sender_name'
        },
        {
          column: 'timestampMs',
          path: '$.timestamp_ms'
        },
        {
          column: 'messageContent',
          path: '$.content'
        }
      ]
    },
    {
      fileId: 'followers',
      path: '$[*].string_list_data[0]',
      table: 'InstagramFollower',
      getters: [
        {
          column: 'accountName',
          path: '$.value'
        },
        {
          column: 'timestampMs',
          path: '$.timestamp'
        },
        {
          column: 'accountUrl',
          path: '$.href'
        }
      ]
    },
    {
      fileId: 'followings',
      path: '$.relationships_following[*]',
      table: 'InstagramFollowing',
      getters: [
        {
          column: 'accountName',
          path: '$.title'
        },
        {
          column: 'timestampMs',
          path: '$.string_list_data[0].timestamp'
        },
        {
          column: 'accountUrl',
          path: '$.string_list_data[0].href'
        }
      ]
    },
    {
      fileId: 'postsViewed',
      path: '$[*]',
      table: 'InstagramPostViewed',
      options: { callback: labelValuesCallback },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'videosWatched',
      path: '$[*]',
      table: 'InstagramVideoWatched',
      options: { callback: labelValuesCallback },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'adsViewed',
      path: '$[*]',
      table: 'InstagramAdViewed',
      options: { callback: labelValuesCallback },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'likedComments',
      path: '$.likes_comment_likes[*]',
      table: 'InstagramCommentLiked',
      getters: [
        {
          column: 'accountName',
          path: '$.title'
        },
        {
          column: 'unixTimestamp',
          path: '$.string_list_data[0].timestamp'
        }
      ]
    },
    {
      fileId: 'likedPosts',
      path: '$[*]',
      table: 'InstagramPostLiked',
      options: { callback: labelValuesCallback },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'threadsViewed',
      path: '$.text_post_app_text_post_app_posts_seen[*].string_map_data',
      table: 'InstagramThreadViewed',
      options: { callback: stringMapDateCallback('Time') },
      getters: [
        { column: 'accountName', path: '$.Author.value' },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'comments',
      path: '$[*].string_map_data',
      table: 'InstagramComment',
      options: { callback: stringMapDateCallback('Time') },
      getters: [
        { column: 'accountName', path: "$['Media Owner'].value" },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'reelsComments',
      path: '$.comments_reels_comments[*].string_map_data',
      table: 'InstagramComment',
      options: { callback: stringMapDateCallback('Time') },
      getters: [
        { column: 'accountName', path: "$['Media Owner'].value" },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'storiesViewed',
      path: '$[*]',
      table: 'InstagramStoryViewed',
      options: { callback: labelValuesCallback },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'reposts',
      path: '$[*]',
      table: 'InstagramRepost',
      options: { callback: labelValuesCallback },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'storyLikes',
      path: '$[*]',
      table: 'InstagramStoryInteraction',
      options: { callback: labelValuesKind('Story Like') },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' },
        { column: 'kind', path: 'kind' }
      ]
    },
    {
      fileId: 'polls',
      path: '$[*]',
      table: 'InstagramStoryInteraction',
      options: { callback: labelValuesKind('Poll Vote') },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' },
        { column: 'kind', path: 'kind' }
      ]
    },
    {
      fileId: 'storyReactions',
      path: '$[*]',
      table: 'InstagramStoryInteraction',
      options: { callback: labelValuesKind('Story Reaction') },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' },
        { column: 'kind', path: 'kind' }
      ]
    },
    {
      fileId: 'saved',
      path: '$[*]',
      table: 'InstagramSaved',
      options: { callback: labelValuesCallback },
      getters: [
        { column: 'accountName', path: 'accountName' },
        { column: 'datetime', path: 'date' }
      ]
    },
    {
      fileId: 'locationsOfInterest',
      path: '$.label_values[*].vec[*]',
      table: 'InstagramLocation',
      getters: [{ column: 'location', path: '$.value' }]
    },
    {
      fileId: 'profileBasedIn',
      path: '$.inferred_data_primary_location[*].string_map_data',
      table: 'InstagramLocation',
      options: {
        callback: output => {
          const o = output as JSONPathRecord
          o['_city'] =
            smdValue(o, ['Nom de la ville', 'City name', 'City']) ?? ''
        }
      },
      getters: [{ column: 'location', path: '$._city' }]
    },
    {
      fileId: 'profileBasedIn',
      path: '$.label_values[?(@.dict)]',
      table: 'InstagramLocation',
      options: {
        callback: output => {
          const o = output as JSONPathRecord
          const dict: any[] = (o['dict'] as any[]) || []
          o['_city'] =
            dict.find((x: any) => ['Ville', 'City'].includes(x.label))?.value ||
            ''
        }
      },
      getters: [{ column: 'location', path: '$._city' }]
    },
    {
      fileId: 'loginActivity',
      path: '$.account_history_login_history[*].string_map_data',
      table: 'InstagramLogin',
      options: {
        callback: output => {
          const o = output as JSONPathRecord
          const ts = smdValue(o, ['Heure', 'Time'], 'timestamp')
          o['_date'] = toDateString(String(ts), '%s', SUPPORTED_LOCALE.FR)
          o['_ip'] = smdValue(o, ['Adresse IP', 'IP Address']) ?? ''
          o['_ua'] = smdValue(o, ['Agent utilisateur', 'User Agent']) ?? ''
        }
      },
      getters: [
        { column: 'ipAddress', path: '$._ip' },
        { column: 'datetime', path: '$._date' },
        { column: 'userAgent', path: '$._ua' }
      ]
    }
  ]
}

export default config
