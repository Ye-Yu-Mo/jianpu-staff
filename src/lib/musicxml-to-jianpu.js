const FIFTHS_TO_KEY = { 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', '-1': 'F' }
const NOTE_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]
const DURATION_SUFFIX = {
  whole: '--', half: '-', quarter: '', eighth: '/', sixteenth: '//',
}

export function fifthsToKey(fifths) {
  return FIFTHS_TO_KEY[String(fifths)] ?? 'C'
}

/**
 * 绝对音高 → 简谱音级 + 八度偏移
 * @param {string} step   - 'C'~'B'
 * @param {number} alter  - 0 | 1 | -1
 * @param {number} octave - MIDI 组号
 * @param {string} key    - 'C' | 'G' | ...
 * @returns {{ degree: number, octaveOffset: number }}
 */
export function pitchToJianpu(step, alter, octave, key) {
  const tonicMidi = 12 * 5 + NOTE_TO_SEMITONE[key] // 根音 MIDI（第4组）
  const noteMidi = 12 * (octave + 1) + NOTE_TO_SEMITONE[step] + alter
  const diff = noteMidi - tonicMidi
  const semitone = ((diff % 12) + 12) % 12
  const degree = MAJOR_SCALE_SEMITONES.indexOf(semitone) + 1
  const octaveOffset = Math.floor(diff / 12) + (diff < 0 && diff % 12 !== 0 ? 1 : 0)
  return { degree, octaveOffset }
}

export function durationToSuffix(type, dotted) {
  if (dotted && type === 'quarter') return '*'
  return DURATION_SUFFIX[type] ?? ''
}

/**
 * MusicXML 字符串 → 简谱文本
 * @param {string} xmlStr
 * @returns {string}
 */
export function convert(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml')

  const fifths = parseInt(doc.querySelector('fifths')?.textContent ?? '0')
  const key = fifthsToKey(fifths)
  const beats = doc.querySelector('beats')?.textContent ?? '4'
  const beatType = doc.querySelector('beat-type')?.textContent ?? '4'

  const measures = Array.from(doc.querySelectorAll('measure'))
  const measureTokens = measures.map(measure => {
    const notes = Array.from(measure.querySelectorAll('note'))
    return notes.map(note => {
      if (note.querySelector('rest')) {
        const type = note.querySelector('type')?.textContent ?? 'quarter'
        const dotted = !!note.querySelector('dot')
        return '0' + durationToSuffix(type, dotted)
      }
      const step = note.querySelector('step').textContent
      const alter = parseInt(note.querySelector('alter')?.textContent ?? '0')
      const octave = parseInt(note.querySelector('octave').textContent)
      const type = note.querySelector('type')?.textContent ?? 'quarter'
      const dotted = !!note.querySelector('dot')
      const { degree, octaveOffset } = pitchToJianpu(step, alter, octave, key)
      const octaveSuffix = octaveOffset > 0
        ? "'".repeat(octaveOffset)
        : octaveOffset < 0 ? ','.repeat(-octaveOffset) : ''
      return degree + octaveSuffix + durationToSuffix(type, dotted)
    }).join(' ')
  })

  return `[${beats}/${beatType}] [1=${key}] ${measureTokens.join(' | ')}`
}
