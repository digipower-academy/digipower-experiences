/**
 * @jest-environment jsdom
 */
import Vue from 'vue'
import { mount, createLocalVue } from '@vue/test-utils'
import Vuex, { Store } from 'vuex'
import Vuetify from 'vuetify'
import JSZip from 'jszip'
import UnitExporter from '../UnitExporter.vue'

// Vuetify registers its components globally
Vue.use(Vuetify)
const localVue = createLocalVue()
localVue.use(Vuex)

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

// jsdom's Blob has no arrayBuffer()
function read(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsArrayBuffer(blob)
  })
}

function setup({ results = {}, exportOptions = {} } = {}) {
  const pipelines = {
    first: jest.fn(async() => ({ headers: ['a'], items: [{ a: 1 }, { a: 2 }] })),
    nested: jest.fn(async() => ({ headers: ['x', 'y'], items: [{ x: { n: 1 }, y: [{ b: 2 }] }] })),
    broken: jest.fn(async() => { throw new Error('boom') })
  }
  const store = new Store({
    modules: {
      xp: {
        namespaced: true,
        state: () => ({
          experienceConfig: {
            slug: 'demo',
            viewBlocks: Object.keys(pipelines).map(id => ({ id, title: `Tab ${id}`, customPipeline: pipelines[id], ...exportOptions[id] }))
          },
          fileManager: {},
          currentDB: null,
          results
        }),
        getters: { experienceNameAndTag: () => 'demo' }
      }
    }
  })
  const wrapper = mount(UnitExporter, {
    localVue,
    store,
    vuetify: new Vuetify(),
    mocks: { $t: key => key, $tev: (key, fallback) => fallback }
  })
  return { wrapper, store, pipelines }
}

const checkbox = (wrapper, label) =>
  wrapper.findAll('.v-input--checkbox').filter(c => c.text().includes(label)).at(0).find('input')

describe('UnitExporter', () => {
  let downloads
  beforeEach(() => {
    downloads = []
    global.URL.createObjectURL = (blob) => {
      downloads.push({ blob })
      return 'blob:test'
    }
    global.URL.revokeObjectURL = () => {}
    // the failing tab is logged
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function() {
      downloads[downloads.length - 1].filename = this.download
    })
  })
  afterEach(() => jest.restoreAllMocks())

  test('lists every tab, none ticked, and computes nothing', () => {
    const { wrapper, pipelines } = setup()
    expect(wrapper.findAll('.v-input--checkbox').wrappers.map(c => c.text())).toEqual(['Tab first', 'Tab nested', 'Tab broken'])
    expect(wrapper.findAll('input:checked')).toHaveLength(0)
    expect(Object.values(pipelines).every(p => p.mock.calls.length === 0)).toBe(true)
    expect(wrapper.find('button').attributes('disabled')).toBe('disabled')
  })

  test('ticking a tab computes it once and shows its tables', async() => {
    const { wrapper, pipelines } = setup()
    await checkbox(wrapper, 'Tab nested').trigger('click')
    await flush()
    await wrapper.vm.$nextTick()
    expect(pipelines.nested).toHaveBeenCalledTimes(1)
    const card = wrapper.findAll('.v-card').at(0)
    expect(card.text()).toContain('Tab nested')
    expect(card.text()).toContain('x')
    expect(card.text()).toContain('y')
    expect(card.findAll('table')).toHaveLength(2)

    // untick and tick again: no new computation
    await checkbox(wrapper, 'Tab nested').trigger('click')
    await checkbox(wrapper, 'Tab nested').trigger('click')
    await flush()
    expect(pipelines.nested).toHaveBeenCalledTimes(1)
  })

  test('leaves out the tables a tab excludes from the export, in the view and in the ZIP', async() => {
    const { wrapper } = setup({ exportOptions: { nested: { exportExclude: ['y'] } } })
    await checkbox(wrapper, 'Tab nested').trigger('click')
    await flush()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.v-card table')).toHaveLength(1)
    expect(wrapper.vm.outputs.nested.tables.map(t => t.path.join('/'))).toEqual(['x'])

    await wrapper.find('button').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 50))
    const zip = await JSZip.loadAsync(await read(downloads[0].blob))
    expect(Object.keys(zip.files).filter(name => !name.endsWith('/'))).toEqual([
      'export.json', '02-nested/result.json', '02-nested/01-x.csv'
    ])
    expect(JSON.parse(await zip.file('02-nested/result.json').async('string')).items[0]).toEqual({ x: { n: 1 } })
  })

  test('uses the result of a tab that was already opened', async() => {
    const { wrapper, pipelines } = setup({ results: { first: { headers: ['a'], items: [{ a: 'opened' }] } } })
    await checkbox(wrapper, 'Tab first').trigger('click')
    await flush()
    await wrapper.vm.$nextTick()
    expect(pipelines.first).not.toHaveBeenCalled()
    expect(wrapper.find('table').text()).toContain('opened')
  })

  test('shows a tab that fails, and downloads the others as a ZIP', async() => {
    const { wrapper } = setup()
    await checkbox(wrapper, 'Tab first').trigger('click')
    await checkbox(wrapper, 'Tab broken').trigger('click')
    await flush()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('export-data.error boom')

    await wrapper.find('button').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(downloads).toHaveLength(1)
    expect(downloads[0].filename).toMatch(/^demo-export-\d{4}-\d{2}-\d{2}\.zip$/)
    const zip = await JSZip.loadAsync(await read(downloads[0].blob))
    expect(Object.keys(zip.files).filter(name => !name.endsWith('/'))).toEqual([
      'export.json', '01-first/result.json', '01-first/01-table.csv'
    ])
    expect(await zip.file('01-first/01-table.csv').async('string')).toBe('a\r\n1\r\n2')
  })

  test('starts again when new data is loaded', async() => {
    const { wrapper, store } = setup()
    await checkbox(wrapper, 'Tab first').trigger('click')
    await flush()
    store.state.xp.fileManager = {}
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.selected).toEqual([])
    expect(wrapper.vm.outputs).toEqual({})
  })
})
