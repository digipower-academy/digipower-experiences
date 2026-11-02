import JSZip from 'jszip'
import { exportFilename, exportZip, resultTables, runViewBlock, tableToCsv, withoutTables } from './export'

describe('resultTables', () => {
  test('a flat result is one table, nested values in a cell as JSON', () => {
    const tables = resultTables({
      headers: ['title', 'files'],
      items: [{ title: 'Alice', files: ['a/message_1.json'] }, { title: 'Bo', extra: null }]
    })
    expect(tables).toEqual([{
      path: [],
      columns: ['title', 'files', 'extra'],
      rows: [
        { title: 'Alice', files: '["a/message_1.json"]', extra: '' },
        { title: 'Bo', files: '', extra: '' }
      ]
    }])
  })

  test('a single item of nested results becomes one table per entry, named by its path', () => {
    const tables = resultTables({
      headers: ['overview', 'ids'],
      items: [{
        overview: { headers: ['summary', 'folders'], items: [{ summary: { conversations: 2, first: null }, folders: [{ folder: 'inbox', n: 2 }] }] },
        ids: { headers: ['id'], items: [{ id: '1' }, { id: '2' }] }
      }]
    })
    expect(tables.map(t => [t.path.join('/'), t.columns, t.rows.length])).toEqual([
      ['overview/summary', ['key', 'value'], 2],
      ['overview/folders', ['folder', 'n'], 1],
      ['ids', ['id'], 2]
    ])
    expect(tables[0].rows).toEqual([{ key: 'conversations', value: 2 }, { key: 'first', value: '' }])
  })

  test('a one-row table of plain values stays a table', () => {
    expect(resultTables({ headers: ['a'], items: [{ a: 1, b: 'x' }] })).toEqual([
      { path: [], columns: ['a', 'b'], rows: [{ a: 1, b: 'x' }] }
    ])
  })

  test('lists of plain values and lone values', () => {
    expect(resultTables([1, 2])).toEqual([{ path: [], columns: ['value'], rows: [{ value: 1 }, { value: 2 }] }])
    expect(resultTables('text')).toEqual([{ path: [], columns: ['value'], rows: [{ value: 'text' }] }])
    expect(resultTables({ headers: [], items: [] })).toEqual([{ path: [], columns: [], rows: [] }])
  })
})

describe('withoutTables', () => {
  const result = {
    headers: ['overview', 'deletedAccounts', 'ids'],
    items: [{
      overview: { headers: ['summary'], items: [{ summary: { n: 2 } }] },
      deletedAccounts: { headers: ['summary', 'conversations'], items: [{ summary: { affected: 1 }, conversations: [{ id: '1' }] }] },
      ids: { headers: ['id'], items: [{ id: '1' }] }
    }]
  }

  test('leaves out the tables named by their path, nested or not', () => {
    const kept = withoutTables(result, ['ids', 'deletedAccounts/summary'])
    expect(kept.headers).toEqual(['overview', 'deletedAccounts'])
    expect(resultTables(kept).map(t => t.path.join('/'))).toEqual(['overview/summary', 'deletedAccounts/conversations'])
    expect(kept.items[0].deletedAccounts.headers).toEqual(['conversations'])
    // the tab's own result is unchanged
    expect(result.items[0].ids).toBeDefined()
    expect(result.items[0].deletedAccounts.items[0].summary).toBeDefined()
  })

  test('without anything to leave out, is the result itself', () => {
    expect(withoutTables(result)).toBe(result)
    expect(withoutTables(result, [])).toBe(result)
  })

  test('a plain object of tables', () => {
    expect(withoutTables({ a: [{ x: 1 }], b: { c: [1], d: 2 } }, ['b/c'])).toEqual({ a: [{ x: 1 }], b: { d: 2 } })
  })
})

test('tableToCsv quotes what needs quoting', () => {
  expect(tableToCsv({ columns: ['a', 'b'], rows: [{ a: 'x, y', b: 2 }] })).toBe('a,b\r\n"x, y",2')
})

test('exportZip has export.json, and per tab its result and tables', async() => {
  const date = new Date(Date.UTC(2026, 10, 2, 12))
  const zip = exportZip({
    experience: 'facebook',
    date,
    tabs: [{ index: 0, id: 'messenger', title: 'Messenger', result: { headers: ['ids'], items: [{ ids: [{ id: '1' }], summary: { n: 1 } }] } }]
  })
  const files = Object.keys(zip.files).filter(name => !name.endsWith('/'))
  expect(files).toEqual([
    'export.json',
    '01-messenger/result.json',
    '01-messenger/01-ids.csv',
    '01-messenger/02-summary.csv'
  ])
  const meta = JSON.parse(await zip.file('export.json').async('string'))
  expect(meta).toEqual({
    experience: 'facebook',
    exportedAt: '2026-11-02T12:00:00.000Z',
    tabs: [{ index: 0, id: 'messenger', title: 'Messenger' }]
  })
  expect(await zip.file('01-messenger/02-summary.csv').async('string')).toBe('key,value\r\nn,1')
  // the archive opens again
  const reloaded = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }))
  expect(Object.keys(reloaded.files)).toContain('01-messenger/result.json')
})

test('exportFilename', () => {
  expect(exportFilename('uber', new Date(2026, 0, 5))).toBe('uber-export-2026-01-05.zip')
})

describe('runViewBlock', () => {
  test('runs a custom pipeline with its options', async() => {
    const pipeline = jest.fn(async({ options }) => ({ headers: ['x'], items: [{ x: options.n }] }))
    const result = await runViewBlock({ customPipeline: pipeline, customPipelineOptions: { n: 3 } }, { fileManager: 'fm' })
    expect(result.items).toEqual([{ x: 3 }])
    expect(pipeline).toHaveBeenCalledWith({ fileManager: 'fm', options: { n: 3 } })
  })

  test('else runs the SQL query on the database', async() => {
    const db = { select: jest.fn(() => ({ headers: [], items: [] })) }
    await runViewBlock({ sql: 'SELECT 1' }, { db })
    expect(db.select).toHaveBeenCalledWith('SELECT 1')
  })

  test('fails clearly without a pipeline, or without a database', async() => {
    await expect(runViewBlock({}, {})).rejects.toThrow('Misconfigured pipeline')
    await expect(runViewBlock({ sql: 'SELECT 1' }, {})).rejects.toThrow('No database')
  })
})
