/**
 * @jest-environment jsdom
 */
import Vue from 'vue'
import { mount, createLocalVue } from '@vue/test-utils'
import Vuex, { Store } from 'vuex'
import Vuetify from 'vuetify'
import JSZip from 'jszip'
import RedactableTable from '../RedactableTable.vue'

// Vuetify registers its components globally
Vue.use(Vuetify)
const localVue = createLocalVue()
localVue.use(Vuex)

const alice = 'messages/inbox/alice_1/message_1.json'
const bo1 = 'messages/inbox/bo_2/message_1.json'
const bo2 = 'messages/inbox/bo_2/message_2.json'

function setup(props = {}) {
  const fileDict = Object.fromEntries(
    [alice, bo1, bo2].map(path => [path, { blob: new Blob([`raw ${path}`]) }])
  )
  const store = new Store({
    modules: { xp: { namespaced: true, state: () => ({ fileManager: { fileDict } }) } }
  })
  return mount(RedactableTable, {
    localVue,
    store,
    vuetify: new Vuetify(),
    propsData: {
      headers: [
        { text: 'Conversation', value: 'title' },
        { text: 'Messages', value: 'messages', format: n => `${n} msgs` }
      ],
      items: [
        { title: 'Alice', messages: 3, files: [alice] },
        { title: 'Bo', messages: 5, files: [bo1, bo2] }
      ],
      ...props
    }
  })
}

// jsdom's Blob has no text() or arrayBuffer()
function read(blob, as) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    as === 'text' ? reader.readAsText(blob) : reader.readAsArrayBuffer(blob)
  })
}

const cells = wrapper => wrapper.findAll('.cell')
const pathBar = wrapper => wrapper.find('.path').text()
const button = (wrapper, text) => wrapper.findAll('button').filter(b => b.text().includes(text)).at(0)

describe('RedactableTable', () => {
  let downloads
  beforeEach(() => {
    downloads = []
    global.URL.createObjectURL = (blob) => {
      downloads.push({ blob })
      return 'blob:test'
    }
    global.URL.revokeObjectURL = () => {}
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function() {
      downloads[downloads.length - 1].filename = this.download
    })
  })
  afterEach(() => jest.restoreAllMocks())

  test('shows formatted cells, and the files of the row under the mouse', async() => {
    const wrapper = setup()
    expect(cells(wrapper).wrappers.map(c => c.text())).toEqual(['Alice', '3 msgs', 'Bo', '5 msgs'])
    await cells(wrapper).at(2).trigger('mouseenter')
    expect(pathBar(wrapper)).toBe(`File: ${bo1}, ${bo2}`)
    expect(cells(wrapper).at(2).attributes('title')).toBe(`${bo1}, ${bo2}`)
  })

  test('blacks out cells, columns and rows, and hides the paths of rows with anything blacked out', async() => {
    const wrapper = setup()
    await button(wrapper, 'Black out').trigger('click')

    await cells(wrapper).at(0).trigger('click')
    expect(cells(wrapper).wrappers.map(c => c.classes('redacted'))).toEqual([true, false, false, false])

    await wrapper.findAll('th span').filter(s => s.text().includes('Messages')).at(0).trigger('click')
    expect(cells(wrapper).wrappers.map(c => c.classes('redacted'))).toEqual([true, true, false, true])

    await wrapper.find('[aria-label="Black out this row"]').trigger('click')
    expect(wrapper.findAll('tr.redacted-row')).toHaveLength(1)

    // leaving the mode keeps what is blacked out
    await button(wrapper, 'Black out').trigger('click')
    await cells(wrapper).at(0).trigger('mouseenter')
    expect(pathBar(wrapper)).toBe('Point at a row to see where its file is in your export.')
    expect(cells(wrapper).at(0).attributes('title')).toBeFalsy()

    await button(wrapper, 'Show all').trigger('click')
    expect(wrapper.findAll('.redacted')).toHaveLength(0)
    await cells(wrapper).at(0).trigger('mouseenter')
    expect(pathBar(wrapper)).toBe(`File: ${alice}`)
  })

  test('downloads the original file, or a zip of a conversation\'s files', async() => {
    const wrapper = setup()
    const downloadButtons = wrapper.findAll('[aria-label="Download the original file"]')

    await downloadButtons.at(0).trigger('click')
    expect(downloads[0].filename).toBe('alice_1_message_1.json')
    expect(await read(downloads[0].blob, 'text')).toBe(`raw ${alice}`)

    await downloadButtons.at(1).trigger('click')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(downloads[1].filename).toBe('bo_2.zip')
    const zip = await JSZip.loadAsync(await read(downloads[1].blob))
    expect(Object.keys(zip.files).filter(name => !name.endsWith('/'))).toEqual([bo1, bo2])
    expect(await zip.file(bo2).async('string')).toBe(`raw ${bo2}`)
  })

  test('groups columns under a shared title, and a group click blacks out the group', async() => {
    const wrapper = setup({
      headers: [
        { text: 'Conversation', value: 'title' },
        { text: 'You', value: 'mine', group: 'Messages' },
        { text: 'Others', value: 'theirs', group: 'Messages' }
      ],
      items: [
        { title: 'Alice', mine: 1, theirs: 5, files: [alice] },
        { title: 'Bo', mine: 4, theirs: 2, files: [bo1, bo2] }
      ]
    })
    const groupCells = wrapper.findAll('thead.group-header th')
    expect(groupCells.wrappers.map(th => [th.text(), th.attributes('colspan')])).toEqual([
      ['', '1'], ['Messages', '2'], ['', '1']
    ])
    expect(wrapper.findAll('th.group-start').length).toBeGreaterThan(0)

    // titles sort when not blacking out
    const titleOf = wrapper => wrapper.findAll('tbody tr').wrappers.map(tr => tr.find('.cell').text())
    await wrapper.findAll('th span').filter(s => s.text() === 'Others').at(0).trigger('click')
    expect(titleOf(wrapper)).toEqual(['Bo', 'Alice'])

    await button(wrapper, 'Black out').trigger('click')
    // black-out mode adds the row-square column: find the group by its title
    const group = () => wrapper.findAll('thead.group-header th span').filter(s => s.text() === 'Messages').at(0)
    await group().trigger('click')
    expect(cells(wrapper).wrappers.map(c => c.classes('redacted'))).toEqual([false, true, true, false, true, true])
    await group().trigger('click')
    expect(wrapper.findAll('.redacted')).toHaveLength(0)
  })

  test('on phones, where there is no group row, a column title also names its group', async() => {
    const wrapper = setup({
      headers: [
        { text: 'Conversation', value: 'title' },
        { text: 'You', value: 'mine', group: 'Messages' }
      ]
    })
    const titles = () => wrapper.vm.tableHeaders.map(header => header.text)
    expect(titles()).toEqual(['Conversation', 'You', ''])
    wrapper.vm.$vuetify.breakpoint.width = 400
    await wrapper.vm.$nextTick()
    expect(titles()).toEqual(['Conversation', 'Messages · You', ''])
  })
})
