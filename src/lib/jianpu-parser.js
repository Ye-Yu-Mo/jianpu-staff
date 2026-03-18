// 音名到半音偏移（C=0）
const NOTE_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
// 大调音阶各级距根音的半音数
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

/**
 * 将简谱音级 + 调号 + 八度偏移 转为绝对音名（如 'C4', 'G#5'）
 * 根音默认置于第4组（C4=MIDI60）
 */
function degreeToMidi(degree, key, octaveOffset) {
  const tonicMidi = 12 * 5 + NOTE_TO_SEMITONE[key] // 根音 MIDI 值（第4组）
  const midi = tonicMidi + MAJOR_SCALE_SEMITONES[degree - 1] + octaveOffset * 12
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1)
}

/**
 * 解析单个音符 token，返回 Note 对象
 * token 格式：digit [octave_mod*] [duration_mod]
 *   octave_mod: ' (升八度) | , (降八度)
 *   duration_mod: - (半音符) | -- (全音符) | / (八分) | // (十六分) | * (附点四分)
 */
function parseToken(token, key) {
  let i = 0
  const digit = parseInt(token[i++])
  if (isNaN(digit) || digit < 0 || digit > 7) throw new Error(`未知符号 '${token}'`)

  let octaveOffset = 0
  if (token[i] === "'") { while (token[i] === "'") { octaveOffset++; i++ } }
  else if (token[i] === ',') { while (token[i] === ',') { octaveOffset--; i++ } }

  let duration = 'quarter'
  if (token[i] === '-') {
    let n = 0; while (token[i] === '-') { n++; i++ }
    duration = n === 1 ? 'half' : 'whole'
  } else if (token[i] === '/') {
    let n = 0; while (token[i] === '/') { n++; i++ }
    duration = n === 1 ? 'eighth' : 'sixteenth'
  } else if (token[i] === '*') { duration = 'dotted-quarter'; i++ }

  if (i < token.length) throw new Error(`未知符号 '${token}'`)

  if (digit === 0) return { pitch: 'R', duration, isRest: true }
  return { pitch: degreeToMidi(digit, key, octaveOffset), duration, isRest: false }
}

/**
 * 解析简谱文本，返回结构化数据
 * @param {string} input
 * @returns {{ timeSignature: {beats, beatType}, key: string, measures: Note[][] }}
 */
export function parse(input) {
  if (!input.trim()) {
    return { timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [[]] }
  }

  let timeSignature = { beats: 4, beatType: 4 }
  let key = 'C'
  let remaining = input.trim()

  // 提取头部指令 [4/4] [1=C]
  remaining = remaining.replace(/\[([^\]]+)\]/g, (_, directive) => {
    if (directive.includes('/')) {
      const [beats, beatType] = directive.split('/').map(Number)
      timeSignature = { beats, beatType }
    } else if (directive.includes('=')) {
      key = directive.split('=')[1].trim().toUpperCase()
    }
    return ''
  }).trim()

  // 按小节线分割，过滤空小节（处理末尾 |）
  const measureStrings = remaining.split('|').map(s => s.trim()).filter(s => s.length > 0)

  if (measureStrings.length === 0) {
    return { timeSignature, key, measures: [[]] }
  }

  const measures = measureStrings.map(ms =>
    ms.split(/\s+/).filter(t => t.length > 0).map(t => parseToken(t, key))
  )

  return { timeSignature, key, measures }
}
