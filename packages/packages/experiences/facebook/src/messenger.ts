import type { FileManager } from '@/types/utils'

// Messenger conversations, read from JSON or HTML exports.
// Each conversation is a folder messages/<folder>/<thread>/ holding
// message_1.json … message_N.json (JSON exports) or message_1.html (HTML exports).
// Only counts, dates and lengths are kept: message text never leaves this file.

export const MESSENGER_FILE_ID = 'messenger'
export const MESSENGER_GLOB = '**/messages/**/message_*.{json,html}'

// Threads whose ID is at least this large are "long IDs" (the threshold used by
// the offline analysis in pdehaye/facebook-exports; operational, not a documented boundary)
const LONG_ID = 5e15

type Format = 'json' | 'html'

type Message = {
  sender: string
  timestamp: number | null
  textLength: number
  hasMedia: boolean
  // JSON: content is exactly "". HTML: no text and no attachment.
  isEmpty: boolean
  isUnsent: boolean
  isGeoblocked: boolean
}

type Thread = {
  key: string
  folder: string
  name: string
  numericId: string | null
  format: Format
  title: string
  participants: string[]
  isGroup: boolean
  owner: string | null
  messages: Message[]
  // paths of the conversation's files in the export, to find them again
  files: string[]
}

// Labels Facebook uses for deleted or unavailable accounts, lowercase
const PLACEHOLDER_NAMES = new Set([
  'facebook user',
  'utilisateur(ice) facebook',
  'utilisateur(trice) facebook',
  'utilisateur facebook',
  'utilisatrice facebook',
  'usuario de facebook',
  'facebook-nutzer',
  'facebook-nutzer*in',
  'utente di facebook',
  'facebook-gebruiker',
  'utilizador do facebook',
  'usuário do facebook'
])

export function isPlaceholderName(name: string | undefined | null) {
  const normalized = (name ?? '').normalize('NFC').trim().toLowerCase()
  return normalized === '' || PLACEHOLDER_NAMES.has(normalized)
}

/* ---------- paths ---------- */

// "…/messages/inbox/alice_123/message_1.json" → folder "inbox", thread "alice_123"
function threadLocation(path: string) {
  const parts = path.split('/')
  const index = parts.lastIndexOf('messages')
  if (index === -1 || parts.length - index < 4) {
    return null
  }
  const folder = parts[index + 1]
  const name = parts[index + 2]
  const numericId = /(?:^|_)(\d+)$/.exec(name)?.[1] ?? null
  return {
    key: parts.slice(0, index + 3).join('/'),
    folder,
    name,
    numericId
  }
}

/* ---------- JSON ---------- */

type JsonMessage = {
  sender_name?: string
  timestamp_ms?: number
  content?: unknown
  is_unsent?: boolean
  is_geoblocked_for_viewer?: boolean
  [key: string]: unknown
}

const MEDIA_KEYS = [
  'photos',
  'videos',
  'gifs',
  'audio_files',
  'files',
  'sticker',
  'share'
]

function jsonMessage(m: JsonMessage): Message {
  const content = typeof m.content === 'string' ? m.content : null
  return {
    sender: m.sender_name ?? '',
    timestamp: typeof m.timestamp_ms === 'number' ? m.timestamp_ms : null,
    textLength: content?.length ?? 0,
    hasMedia: MEDIA_KEYS.some(key => m[key] !== undefined),
    isEmpty: content === '',
    isUnsent: m.is_unsent === true,
    isGeoblocked: m.is_geoblocked_for_viewer === true
  }
}

function parseJsonChunk(text: string) {
  const json = JSON.parse(text)
  const participants: string[] = Array.isArray(json.participants)
    ? json.participants.map((p: { name?: string }) => p?.name ?? '')
    : []
  const messages: Message[] = Array.isArray(json.messages)
    ? json.messages.map(jsonMessage)
    : []
  return {
    title: typeof json.title === 'string' ? json.title : '',
    participants,
    messages
  }
}

/* ---------- HTML ---------- */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

// Text of an HTML fragment. Tags are dropped, never interpreted.
function textOf(html: string) {
  return decodeEntities(
    html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
  ).trim()
}

// Month abbreviations in the dates of HTML exports ("mar 02, 2007 1:55:35 am"),
// in French and English
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  fév: 1,
  mar: 2,
  apr: 3,
  avr: 3,
  may: 4,
  mai: 4,
  jun: 5,
  juin: 5,
  jul: 6,
  juil: 6,
  aug: 7,
  août: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  déc: 11
}

/**
 * Parses a date of an HTML export, e.g. "mar 02, 2007 1:55:35 am".
 * The export shows local time without a time zone (in an export made in
 * France, winter dates are UTC+1), so the date is read in the time zone
 * of the browser running the experience. Returns milliseconds, or null.
 */
export function parseHtmlDate(text: string) {
  const match =
    /^([^\s\d.,]+)\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?m?\.?$/i.exec(
      text.normalize('NFC').trim()
    )
  if (!match) {
    return null
  }
  const month = MONTHS[match[1].toLowerCase()]
  if (month === undefined) {
    return null
  }
  let hour = Number(match[4])
  const meridiem = match[7]?.toLowerCase()
  if (meridiem === 'p' && hour < 12) {
    hour += 12
  } else if (meridiem === 'a' && hour === 12) {
    hour = 0
  }
  const date = new Date(
    Number(match[3]),
    month,
    Number(match[2]),
    hour,
    Number(match[5]),
    Number(match[6] ?? 0)
  )
  return isNaN(date.getTime()) ? null : date.getTime()
}

// "Participants : A, B, C et D" → ["A", "B", "C", "D"]
export function parseParticipants(text: string) {
  const list = text.replace(/^[^:]*:\s*/, '')
  const parts = list.split(/,\s*/)
  const last = parts.pop() ?? ''
  const split = /^(.*)\s+(?:et|and|y|und|e)\s+(.*)$/.exec(last)
  if (split) {
    parts.push(split[1], split[2])
  } else {
    parts.push(last)
  }
  return parts.map(name => name.trim())
}

const PARTICIPANTS_HEADING = /^(participants|members|membres)\s*:/i
const OWNER_PREFIX = /^(?:générée? par|generated by)\s+(.+?)\s+(?:le|on)$/i
const MEDIA_LINK =
  /<a\b[^>]*href="[^"]*messages\/[^"]*\/(?:photos|videos|gifs|audio|files)\//i

export function parseHtmlThread(html: string) {
  const title = textOf(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
  const aside = /<aside\b[^>]*>([\s\S]*?)<time\b/i.exec(html)?.[1]
  const owner = aside ? OWNER_PREFIX.exec(textOf(aside))?.[1] ?? null : null
  const main = /<main\b[\s\S]*<\/main>/i.exec(html)?.[0] ?? html

  let participants: string[] | null = null
  const messages: Message[] = []
  const sections = /<section\b[^>]*>([\s\S]*?)<\/section>/gi
  let section: RegExpExecArray | null
  while ((section = sections.exec(main))) {
    const body = section[1]
    const heading = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(body)
    const footer = /<footer\b[^>]*>([\s\S]*?)<\/footer>/i.exec(body)
    const headingText = heading ? textOf(heading[1]) : ''
    if (!footer) {
      // thread metadata, e.g. the participants or the group's invitation link
      if (PARTICIPANTS_HEADING.test(headingText)) {
        participants = parseParticipants(headingText)
      }
      continue
    }
    const start = heading ? heading.index + heading[0].length : 0
    // lists in a message are its reactions: not part of its content
    const content = body
      .slice(start, footer.index)
      .replace(/<ul\b[\s\S]*?<\/ul>/gi, '')
    const text = textOf(content)
    const hasMedia =
      /<(img|video|audio)\b/i.test(content) || MEDIA_LINK.test(content)
    messages.push({
      sender: headingText,
      timestamp: parseHtmlDate(textOf(footer[1])),
      textLength: text.length,
      hasMedia,
      isEmpty: text === '' && !hasMedia,
      isUnsent: false,
      isGeoblocked: false
    })
  }
  return { title, owner, participants, messages }
}

/* ---------- conversations ---------- */

const cache = new WeakMap<FileManager, Promise<Thread[]>>()

// The conversations of the export, parsed once per loaded export
export function getThreads(fileManager: FileManager) {
  let threads = cache.get(fileManager)
  if (!threads) {
    threads = readThreads(fileManager)
    cache.set(fileManager, threads)
  }
  return threads
}

async function readThreads(fileManager: FileManager): Promise<Thread[]> {
  const threads = new Map<string, Thread>()
  for (const path of fileManager.getFilePathsFromId(MESSENGER_FILE_ID)) {
    const location = threadLocation(path)
    if (!location) {
      continue
    }
    const format: Format = path.endsWith('.html') ? 'html' : 'json'
    let thread = threads.get(location.key)
    if (!thread) {
      thread = {
        ...location,
        format,
        title: '',
        participants: [],
        isGroup: false,
        owner: null,
        messages: [],
        files: []
      }
      threads.set(location.key, thread)
    }
    thread.files.push(path)
    let text: string
    try {
      text = await fileManager.getPreprocessedText(path)
    } catch (error) {
      console.warn(`Could not read ${path}`, error)
      continue
    }
    if (format === 'json') {
      let chunk
      try {
        chunk = parseJsonChunk(text)
      } catch (error) {
        console.warn(`Could not parse ${path}`, error)
        continue
      }
      thread.title = thread.title || chunk.title
      if (!thread.participants.length) {
        thread.participants = chunk.participants
      }
      thread.messages.push(...chunk.messages)
    } else {
      const parsed = parseHtmlThread(text)
      thread.title = parsed.title
      thread.owner = parsed.owner
      thread.messages.push(...parsed.messages)
      thread.isGroup = parsed.participants !== null
      thread.participants = parsed.participants ?? []
    }
  }

  const list = [...threads.values()]
  const owner = findOwner(list)
  for (const thread of list) {
    if (thread.format === 'json') {
      thread.isGroup = thread.participants.length > 2
    } else if (!thread.isGroup) {
      // one-to-one HTML threads only name the other person, in the title
      thread.participants = [thread.owner ?? owner ?? '', thread.title]
    }
    thread.owner = thread.owner ?? owner
    thread.messages.sort(byTimestamp)
    thread.files.sort(byChunkNumber)
  }
  return list.sort((a, b) => a.key.localeCompare(b.key))
}

// message_2.json before message_10.json
function byChunkNumber(a: string, b: string) {
  const n = (path: string) => Number(/message_(\d+)\.\w+$/.exec(path)?.[1] ?? 0)
  return n(a) - n(b) || a.localeCompare(b)
}

// undated messages last
function byTimestamp(a: Message, b: Message) {
  if (a.timestamp === null || b.timestamp === null) {
    return Number(a.timestamp === null) - Number(b.timestamp === null)
  }
  return a.timestamp - b.timestamp
}

// The account holder: named in the header of HTML exports, otherwise
// the person who takes part in the most conversations
function findOwner(threads: Thread[]) {
  const named = threads.find(thread => thread.owner)?.owner
  if (named) {
    return named
  }
  const counts = new Map<string, number>()
  for (const thread of threads) {
    for (const name of new Set(thread.participants)) {
      if (!isPlaceholderName(name)) {
        counts.set(name, (counts.get(name) ?? 0) + 1)
      }
    }
  }
  let best: string | null = null
  for (const [name, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) {
      best = name
    }
  }
  return best
}

/* ---------- pipelines ---------- */

function isoDate(timestamp: number | null | undefined) {
  return typeof timestamp === 'number'
    ? new Date(timestamp).toISOString()
    : null
}

function year(timestamp: number) {
  return new Date(timestamp).getUTCFullYear()
}

function dated<M extends Message>(messages: M[]) {
  return messages.filter(m => m.timestamp !== null)
}

function firstLast(messages: Message[]) {
  const times = dated(messages).map(m => m.timestamp as number)
  return {
    first: isoDate(times.length ? Math.min(...times) : null),
    last: isoDate(times.length ? Math.max(...times) : null)
  }
}

// [{ year, ...counts }] for every year between the first and the last, zeros included
function perYear<K extends string>(
  entries: { timestamp: number; key: K }[],
  keys: K[]
) {
  if (!entries.length) {
    return []
  }
  const years = entries.map(e => year(e.timestamp))
  const min = Math.min(...years)
  const max = Math.max(...years)
  const counts: Record<K, number>[] = Array.from(
    { length: max - min + 1 },
    () => Object.fromEntries(keys.map(k => [k, 0]))
  ) as Record<K, number>[]
  entries.forEach((e, i) => {
    counts[years[i] - min][e.key] += 1
  })
  const rows = counts.map((row, i) => ({ year: min + i, ...row }))
  return rows
}

function formats(threads: Thread[]) {
  return {
    jsonConversations: threads.filter(t => t.format === 'json').length,
    htmlConversations: threads.filter(t => t.format === 'html').length
  }
}

function placeholderParticipants(thread: Thread) {
  return thread.participants.filter(isPlaceholderName).length
}

/** Key figures, conversations per folder, and messages sent and received per year. */
export async function messenger_overview({
  fileManager
}: {
  fileManager: FileManager
}) {
  const threads = await getThreads(fileManager)
  const messages = threads.flatMap(t =>
    t.messages.map(m => ({ ...m, sent: m.sender === t.owner }))
  )
  const sent = messages.filter(m => m.sent).length
  const folders = new Map<string, { conversations: number; messages: number }>()
  for (const thread of threads) {
    const row = folders.get(thread.folder) ?? { conversations: 0, messages: 0 }
    row.conversations += 1
    row.messages += thread.messages.length
    folders.set(thread.folder, row)
  }
  return {
    headers: ['summary', 'folders', 'years'],
    items: [
      {
        summary: {
          conversations: threads.length,
          oneToOne: threads.filter(t => !t.isGroup).length,
          groups: threads.filter(t => t.isGroup).length,
          messages: messages.length,
          sent,
          received: messages.length - sent,
          ...firstLast(messages),
          ...formats(threads)
        },
        folders: [...folders.entries()]
          .map(([folder, row]) => ({ folder, ...row }))
          .sort(
            (a, b) =>
              b.conversations - a.conversations ||
              a.folder.localeCompare(b.folder)
          ),
        years: perYear(
          dated(messages).map(m => ({
            timestamp: m.timestamp as number,
            key: m.sent ? ('sent' as const) : ('received' as const)
          })),
          ['sent', 'received']
        )
      }
    ]
  }
}

/** Conversations with a deleted or unnamed participant, and what the export still holds of them. */
export async function messenger_deleted_accounts({
  fileManager
}: {
  fileManager: FileManager
}) {
  const threads = await getThreads(fileManager)
  const affected = threads.filter(t => placeholderParticipants(t) > 0)
  const conversations = affected
    .map(thread => {
      const theirs = thread.messages.filter(m => isPlaceholderName(m.sender))
      return {
        title: thread.title,
        folder: thread.folder,
        id: thread.numericId,
        files: thread.files,
        group: thread.isGroup,
        participants: thread.participants.length,
        messages: thread.messages.length,
        theirMessages: theirs.length,
        theirMessagesWithText: theirs.filter(m => m.textLength > 0).length,
        ...firstLast(theirs)
      }
    })
    .sort(
      (a, b) =>
        b.theirMessages - a.theirMessages || a.title.localeCompare(b.title)
    )
  const theirs = affected.flatMap(t =>
    t.messages.filter(m => isPlaceholderName(m.sender))
  )
  return {
    headers: ['summary', 'conversations', 'years'],
    items: [
      {
        summary: {
          conversations: threads.length,
          affected: affected.length,
          oneToOne: affected.filter(t => !t.isGroup).length,
          groups: affected.filter(t => t.isGroup).length,
          theirMessages: theirs.length,
          theirMessagesWithText: theirs.filter(m => m.textLength > 0).length,
          withTheirMessages: conversations.filter(c => c.theirMessages > 0)
            .length
        },
        conversations,
        years: perYear(
          dated(theirs).map(m => ({
            timestamp: m.timestamp as number,
            key: 'messages' as const
          })),
          ['messages']
        )
      }
    ]
  }
}

/** Empty, unsent and geoblocked messages: signals used to compare exports. */
export async function messenger_anomalies({
  fileManager
}: {
  fileManager: FileManager
}) {
  const threads = await getThreads(fileManager)
  const rows = threads.map(thread => {
    const empty = thread.messages.filter(m => m.isEmpty).length
    return {
      title: thread.title,
      folder: thread.folder,
      id: thread.numericId,
      files: thread.files,
      format: thread.format,
      messages: thread.messages.length,
      empty,
      allEmpty: thread.messages.length > 0 && empty === thread.messages.length,
      unsent: thread.messages.filter(m => m.isUnsent).length,
      geoblocked: thread.messages.filter(m => m.isGeoblocked).length
    }
  })
  const sum = (
    key: 'messages' | 'empty' | 'unsent' | 'geoblocked',
    format: Format
  ) =>
    rows
      .filter(r => r.format === format)
      .reduce((total, r) => total + r[key], 0)
  return {
    headers: ['summary', 'conversations'],
    items: [
      {
        summary: {
          ...formats(threads),
          jsonMessages: sum('messages', 'json'),
          htmlMessages: sum('messages', 'html'),
          emptyJson: sum('empty', 'json'),
          emptyHtml: sum('empty', 'html'),
          allEmpty: rows.filter(r => r.allEmpty).length,
          unsent: sum('unsent', 'json'),
          geoblocked: sum('geoblocked', 'json')
        },
        conversations: rows
          .filter(r => r.empty || r.unsent || r.geoblocked)
          .sort(
            (a, b) =>
              b.empty +
                b.unsent +
                b.geoblocked -
                (a.empty + a.unsent + a.geoblocked) ||
              a.title.localeCompare(b.title)
          )
      }
    ]
  }
}

/** One row per conversation with a numeric ID: its first and last message dates. */
export async function messenger_ids({
  fileManager
}: {
  fileManager: FileManager
}) {
  const threads = await getThreads(fileManager)
  const items = threads
    .filter(t => t.numericId !== null)
    .map(thread => {
      const id = thread.numericId as string
      // approximate beyond 2^53, which is fine for plotting
      const idNumber = Number(id)
      return {
        id,
        idNumber,
        category: thread.isGroup
          ? 'group'
          : idNumber >= LONG_ID
          ? 'longId'
          : 'shortId',
        title: thread.title,
        folder: thread.folder,
        files: thread.files,
        deletedParticipant: placeholderParticipants(thread) > 0,
        messages: thread.messages.length,
        ...firstLast(thread.messages)
      }
    })
    // IDs can exceed Number.MAX_SAFE_INTEGER: compare them as strings
    .sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id))
  return {
    headers: [
      'id',
      'idNumber',
      'category',
      'title',
      'folder',
      'files',
      'deletedParticipant',
      'messages',
      'first',
      'last'
    ],
    items
  }
}
