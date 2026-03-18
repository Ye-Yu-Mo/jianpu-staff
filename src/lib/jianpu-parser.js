// 音名到半音偏移（C=0）
const NOTE_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

// 已知力度标记
const DYNAMICS = new Set(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sfz'])
// 已知速度文字标记
const TEMPO_WORDS = new Set([
  'Larghissimo', 'Grave', 'Largo', 'Lento', 'Larghetto', 'Adagio',
  'Andante', 'Andantino', 'Moderato', 'Allegretto', 'Allegro',
  'Vivace', 'Presto', 'Prestissimo', 'Rit', 'rit', 'Accel', 'accel',
])

function degreeToMidi(degree, key, octaveOffset) {
  const tonicMidi = 12 * 5 + NOTE_TO_SEMITONE[key]
  const midi = tonicMidi + MAJOR_SCALE_SEMITONES[degree - 1] + octaveOffset * 12
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1)
}

/**
 * 将 [...]  指令内容解析为结构化对象
 * 返回 { kind, ... } 或 null（表示已被头部消费）
 */
function parseDirective(content) {
  // 拍号：4/4, 3/4 等
  if (/^\d+\/\d+$/.test(content)) {
    const [beats, beatType] = content.split('/').map(Number)
    return { _header: true, kind: 'time-sig', value: { beats, beatType } }
  }
  // 调号：1=C, 1=G 等
  if (/^\d+=\w+$/.test(content)) {
    const key = content.split('=')[1].trim().toUpperCase()
    return { _header: true, kind: 'key', value: key }
  }
  // 速度 BPM：q=120
  if (/^q=\d+$/.test(content)) {
    return { type: 'directive', kind: 'tempo-bpm', bpm: parseInt(content.split('=')[1]) }
  }
  // 渐强
  if (content === '<') {
    return { type: 'directive', kind: 'dynamic', value: 'crescendo' }
  }
  // 渐弱
  if (content === '>') {
    return { type: 'directive', kind: 'dynamic', value: 'diminuendo' }
  }
  // 力度标记
  if (DYNAMICS.has(content)) {
    return { type: 'directive', kind: 'dynamic', value: content }
  }
  // 速度文字
  if (TEMPO_WORDS.has(content)) {
    return { type: 'directive', kind: 'tempo-text', text: content }
  }
  // 未知指令忽略
  return null
}

/**
 * 将输入文本分解为 token 列表
 * token 类型：bar | directive | tuplet | note
 */
function tokenize(text) {
  const tokens = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
    } else if (ch === '|') {
      tokens.push({ type: 'bar' })
      i++
    } else if (ch === '[') {
      const end = text.indexOf(']', i)
      if (end === -1) throw new Error('未闭合的方括号 [')
      tokens.push({ type: 'directive', content: text.slice(i + 1, end) })
      i = end + 1
    } else if (ch === '{') {
      const end = text.indexOf('}', i)
      if (end === -1) throw new Error('未闭合的花括号 {')
      tokens.push({ type: 'tuplet', content: text.slice(i + 1, end).trim() })
      i = end + 1
    } else {
      // 读取到下一个空白或特殊字符
      let j = i
      while (j < text.length && !' \t\n\r|[{'.includes(text[j])) j++
      if (j > i) tokens.push({ type: 'note', content: text.slice(i, j) })
      i = j
    }
  }
  return tokens
}

/**
 * 解析单个音符 token，返回 Note 对象
 * 完整结构：[g] digit [八度] [时值] [装饰音] [技巧] [~]
 */
function parseToken(token, key) {
  let i = 0

  // 前倚音前缀
  const isGrace = token[i] === 'g' && i + 1 < token.length && /[0-7]/.test(token[i + 1])
  if (isGrace) i++

  // 音高数字
  const digit = parseInt(token[i++])
  if (isNaN(digit) || digit < 0 || digit > 7) throw new Error(`未知符号 '${token}'`)

  // 八度修饰
  let octaveOffset = 0
  if (token[i] === "'") { while (token[i] === "'") { octaveOffset++; i++ } }
  else if (token[i] === ',') { while (token[i] === ',') { octaveOffset--; i++ } }

  // 时值
  let duration = 'quarter'
  if (token[i] === '-') {
    let n = 0; while (token[i] === '-') { n++; i++ }
    duration = n === 1 ? 'half' : 'whole'
  } else if (token[i] === '/') {
    let n = 0; while (token[i] === '/') { n++; i++ }
    duration = n === 1 ? 'eighth' : 'sixteenth'
  } else if (token[i] === '*') {
    i++
    duration = token[i] === '/' ? (i++, 'dotted-eighth') : 'dotted-quarter'
  }

  // 装饰音后缀
  let ornament = null
  if (token.slice(i, i + 4) === 'turn') { ornament = 'turn'; i += 4 }
  else if (token.slice(i, i + 3) === 'mor') { ornament = 'mordent'; i += 3 }
  else if (token.slice(i, i + 2) === 'tr') { ornament = 'trill'; i += 2 }

  // 技巧标记（任意顺序，循环消费）
  const articulations = []
  let changed = true
  while (changed) {
    changed = false
    if (token.slice(i, i + 2) === '^^') { articulations.push('strong-accent'); i += 2; changed = true }
    else if (token.slice(i, i + 2) === '^.') { articulations.push('accent', 'staccato'); i += 2; changed = true }
    else if (token[i] === '^') { articulations.push('accent'); i++; changed = true }
    else if (token.slice(i, i + 2) === '..') { articulations.push('staccatissimo'); i += 2; changed = true }
    else if (token[i] === '.') { articulations.push('staccato'); i++; changed = true }
    else if (token[i] === '_') { articulations.push('tenuto'); i++; changed = true }
  }

  // 延音线
  let tie = null
  if (token[i] === '~') { tie = 'start'; i++ }

  if (i < token.length) throw new Error(`未知符号 '${token}'`)

  const pitch = digit === 0 ? 'R' : degreeToMidi(digit, key, octaveOffset)
  return {
    pitch,
    duration,
    isRest: digit === 0,
    ...(isGrace && { isGrace: true }),
    ...(tie && { tie }),
    ...(ornament && { ornament }),
    ...(articulations.length > 0 && { articulations }),
  }
}

/**
 * 解析花括号内的连音组
 * 格式：[n: ] note note note ...
 */
function parseTupletGroup(content, key) {
  let actual = 3
  let noteStr = content

  // 检查是否有显式连音数 "5: ..."
  const colonIdx = content.indexOf(':')
  if (colonIdx !== -1 && /^\d+$/.test(content.slice(0, colonIdx).trim())) {
    actual = parseInt(content.slice(0, colonIdx).trim())
    noteStr = content.slice(colonIdx + 1).trim()
  }

  // normal = 最近的 2 的幂次（小于 actual）
  let normal = 1
  while (normal * 2 < actual) normal *= 2

  const noteTokens = noteStr.split(/\s+/).filter(t => t.length > 0)
  if (noteTokens.length !== actual) {
    throw new Error(`连音组需要 ${actual} 个音符，实际 ${noteTokens.length} 个`)
  }

  return noteTokens.map((t, idx) => {
    const note = parseToken(t, key)
    if (idx === 0) note.tuplet = { type: 'start', actual, normal }
    else if (idx === actual - 1) note.tuplet = { type: 'stop' }
    else note.tuplet = null
    return note
  })
}

/**
 * 解析简谱文本，返回结构化数据
 * @param {string} input
 * @returns {{ timeSignature, key, measures }}
 */
export function parse(input) {
  if (!input.trim()) {
    return { timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [[]] }
  }

  let timeSignature = { beats: 4, beatType: 4 }
  let key = 'C'

  const tokens = tokenize(input.trim())

  const measures = []
  let currentMeasure = []

  for (const token of tokens) {
    if (token.type === 'bar') {
      if (currentMeasure.length > 0) {
        measures.push(currentMeasure)
        currentMeasure = []
      }
    } else if (token.type === 'directive') {
      const dir = parseDirective(token.content)
      if (!dir) continue
      if (dir._header) {
        if (dir.kind === 'time-sig') timeSignature = dir.value
        else if (dir.kind === 'key') key = dir.value
      } else {
        currentMeasure.push(dir)
      }
    } else if (token.type === 'tuplet') {
      const notes = parseTupletGroup(token.content, key)
      currentMeasure.push(...notes)
    } else if (token.type === 'note') {
      currentMeasure.push(parseToken(token.content, key))
    }
  }

  if (currentMeasure.length > 0) measures.push(currentMeasure)
  if (measures.length === 0) return { timeSignature, key, measures: [[]] }

  return { timeSignature, key, measures }
}
