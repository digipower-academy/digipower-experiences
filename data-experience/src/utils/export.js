import JSZip from 'jszip'
import Papa from 'papaparse'

// The Export step: running tabs on demand, laying out their results as tables,
// and packaging them in a ZIP made in the browser.

/**
 * Runs a tab's pipeline the way UnitPipeline.vue does:
 * its customPipeline (a function, or a generic pipeline by name), else its SQL query.
 * Returns the raw result, before any postprocessor (what the Share step sends too).
 */
export async function runViewBlock(viewBlock, { fileManager, db }) {
  const { customPipelineOptions: options, sql } = viewBlock
  let pipeline = viewBlock.customPipeline
  if (typeof pipeline === 'string') {
    pipeline = (await import('@/utils/generic-pipelines'))[pipeline]
  }
  if (pipeline) {
    return await pipeline({ fileManager, options })
  }
  if (sql) {
    if (!db) {
      throw new Error('No database for this experience')
    }
    return db.select(sql)
  }
  throw new Error('Misconfigured pipeline')
}

const isObject = value => value !== null && typeof value === 'object'
const isPlainObject = value => isObject(value) && !Array.isArray(value)
const isTable = value => isPlainObject(value) && Array.isArray(value.items) && Array.isArray(value.headers)

// nested values go in a single cell, as JSON
function cell(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return isObject(value) ? JSON.stringify(value) : value
}

/**
 * Lays out a tab's result as tables: [{ path, columns, rows }].
 * A result { headers, items } is one table, unless its single item only holds
 * nested results (as in the Facebook Messenger tab): then each becomes its own
 * tables, named by their path (["overview", "folders"]). Objects of plain values
 * become key / value tables.
 */
export function resultTables(result) {
  const tables = []

  function add(path, rows) {
    const columns = []
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (!columns.includes(key)) {
          columns.push(key)
        }
      }
    }
    tables.push({
      path,
      columns,
      rows: rows.map(row => Object.fromEntries(columns.map(column => [column, cell(row[column])])))
    })
  }

  function addList(path, list) {
    add(path, list.every(isPlainObject) ? list : list.map(value => ({ value })))
  }

  function walk(value, path) {
    if (isTable(value)) {
      const [first] = value.items
      const nested = value.items.length === 1 && isPlainObject(first) &&
        Object.keys(first).length > 0 && Object.values(first).every(isObject)
      if (nested) {
        Object.entries(first).forEach(([key, child]) => walk(child, [...path, key]))
      } else {
        addList(path, value.items)
      }
    } else if (Array.isArray(value)) {
      addList(path, value)
    } else if (isPlainObject(value)) {
      const entries = Object.entries(value)
      const plain = entries.filter(([, child]) => !isObject(child))
      if (plain.length) {
        add(path, plain.map(([key, child]) => ({ key, value: child })))
      }
      entries
        .filter(([, child]) => isObject(child))
        .forEach(([key, child]) => walk(child, [...path, key]))
    } else {
      add(path, [{ value }])
    }
  }

  walk(result, [])
  return tables
}

export function tableToCsv({ columns, rows }) {
  return Papa.unparse({ fields: columns, data: rows.map(row => columns.map(column => row[column])) })
}

const pad = n => String(n).padStart(2, '0')

/**
 * The ZIP of the chosen tabs: for each, its raw result (result.json) and its
 * tables as CSV, in a folder named after its position and id, plus export.json.
 * tabs: [{ index, id, title, result }]
 */
export function exportZip({ experience, tabs, date = new Date() }) {
  const zip = new JSZip()
  zip.file('export.json', JSON.stringify({
    experience,
    exportedAt: date.toISOString(),
    tabs: tabs.map(({ index, id, title }) => ({ index, id, title }))
  }, null, 2))
  for (const { index, id, result } of tabs) {
    const folder = zip.folder(`${pad(index + 1)}-${id}`)
    folder.file('result.json', JSON.stringify(result, null, 2))
    resultTables(result).forEach((table, i) => {
      const name = table.path.length ? table.path.join('-') : 'table'
      folder.file(`${pad(i + 1)}-${name}.csv`, tableToCsv(table))
    })
  }
  return zip
}

export function exportFilename(experience, date = new Date()) {
  return `${experience}-export-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`
}
