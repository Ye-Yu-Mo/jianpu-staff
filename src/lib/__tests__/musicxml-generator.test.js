import { describe, it, expect } from 'vitest'
import { generate } from '../musicxml-generator.js'

// 辅助：检查 XML 字符串包含某个子串
const has = (xml, str) => xml.includes(str)

const note = (pitch, duration = 'quarter') => ({ pitch, duration, isRest: false })
const rest = (duration = 'quarter') => ({ pitch: 'R', duration, isRest: true })
// 补满 4/4 小节的辅助函数
const fill44 = (notes) => {
  const UNITS = { whole: 64, half: 32, quarter: 16, eighth: 8, sixteenth: 4, 'dotted-quarter': 24 }
  const used = notes.reduce((s, n) => s + UNITS[n.duration], 0)
  const remaining = 64 - used
  if (remaining <= 0) return notes
  const pads = []
  let left = remaining
  for (const [dur, u] of [['half', 32], ['quarter', 16], ['eighth', 8], ['sixteenth', 4]]) {
    while (left >= u) { pads.push(rest(dur)); left -= u }
  }
  return [...notes, ...pads]
}

describe('musicxml-generator', () => {

  // --- 基础结构 ---
  describe('基础结构', () => {
    it('返回字符串', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [fill44([note('C4')])] })
      expect(typeof xml).toBe('string')
    })

    it('包含 score-partwise 根节点', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [fill44([note('C4')])] })
      expect(has(xml, '<score-partwise')).toBe(true)
    })
  })

  // --- 音高 ---
  describe('音高输出', () => {
    it('C4 输出正确的 step 和 octave', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [fill44([note('C4')])] })
      expect(has(xml, '<step>C</step>')).toBe(true)
      expect(has(xml, '<octave>4</octave>')).toBe(true)
    })

    it('G#5 输出 alter=1', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [fill44([note('G#5')])] })
      expect(has(xml, '<step>G</step>')).toBe(true)
      expect(has(xml, '<alter>1</alter>')).toBe(true)
      expect(has(xml, '<octave>5</octave>')).toBe(true)
    })

    it('休止符输出 <rest/>', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [fill44([rest()])] })
      expect(has(xml, '<rest/>')).toBe(true)
    })
  })

  // --- 时值 ---
  describe('时值输出', () => {
    it('quarter → type=quarter', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [fill44([note('C4', 'quarter')])] })
      expect(has(xml, '<type>quarter</type>')).toBe(true)
    })

    it('half → type=half', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [[note('C4', 'half'), note('C4', 'half')]] })
      expect(has(xml, '<type>half</type>')).toBe(true)
    })

    it('whole → type=whole', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [[note('C4', 'whole')]] })
      expect(has(xml, '<type>whole</type>')).toBe(true)
    })

    it('eighth → type=eighth', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [[note('C4', 'eighth'), note('C4', 'eighth'), note('C4', 'half'), note('C4', 'quarter')]] })
      expect(has(xml, '<type>eighth</type>')).toBe(true)
    })

    it('sixteenth → type=sixteenth', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [[note('C4', 'sixteenth'), note('C4', 'sixteenth'), note('C4', 'sixteenth'), note('C4', 'sixteenth'), note('C4', 'half'), note('C4', 'quarter')]] })
      expect(has(xml, '<type>sixteenth</type>')).toBe(true)
    })

    it('dotted-quarter → type=quarter + <dot/>', () => {
      const xml = generate({ timeSignature: { beats: 3, beatType: 4 }, key: 'C', measures: [[note('C4', 'dotted-quarter'), note('C4', 'eighth'), note('C4', 'quarter')]] })
      expect(has(xml, '<type>quarter</type>')).toBe(true)
      expect(has(xml, '<dot/>')).toBe(true)
    })
  })

  // --- 调号 ---
  describe('调号', () => {
    it('C 大调 → fifths=0', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [fill44([note('C4')])] })
      expect(has(xml, '<fifths>0</fifths>')).toBe(true)
    })

    it('G 大调 → fifths=1', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'G', measures: [fill44([note('G4')])] })
      expect(has(xml, '<fifths>1</fifths>')).toBe(true)
    })

    it('F 大调 → fifths=-1', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'F', measures: [fill44([note('F4')])] })
      expect(has(xml, '<fifths>-1</fifths>')).toBe(true)
    })
  })

  // --- 拍号 ---
  describe('拍号', () => {
    it('4/4 → beats=4 beat-type=4', () => {
      const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [fill44([note('C4')])] })
      expect(has(xml, '<beats>4</beats>')).toBe(true)
      expect(has(xml, '<beat-type>4</beat-type>')).toBe(true)
    })

    it('3/4 → beats=3', () => {
      const xml = generate({ timeSignature: { beats: 3, beatType: 4 }, key: 'C', measures: [[note('C4'), note('C4'), note('C4')]] })
      expect(has(xml, '<beats>3</beats>')).toBe(true)
    })
  })

  // --- 多小节 ---
  describe('多小节', () => {
    it('两个小节生成 measure number=1 和 number=2', () => {
      const xml = generate({
        timeSignature: { beats: 4, beatType: 4 }, key: 'C',
        measures: [
          [note('C4'), note('D4'), note('E4'), note('F4')],
          [note('G4'), note('A4'), note('B4'), note('C5')],
        ]
      })
      expect(has(xml, 'number="1"')).toBe(true)
      expect(has(xml, 'number="2"')).toBe(true)
    })
  })

  // --- 小节时值校验 ---
  describe('小节时值校验', () => {
    it('4/4 拍只有3拍时抛出错误含小节号', () => {
      expect(() => generate({
        timeSignature: { beats: 4, beatType: 4 }, key: 'C',
        measures: [[note('C4'), note('C4'), note('C4')]]
      })).toThrow('第1小节')
    })

    it('错误信息包含期望拍数和实际拍数', () => {
      expect(() => generate({
        timeSignature: { beats: 4, beatType: 4 }, key: 'C',
        measures: [[note('C4'), note('C4'), note('C4')]]
      })).toThrow('4拍')
    })

    it('时值超出也抛出错误', () => {
      expect(() => generate({
        timeSignature: { beats: 4, beatType: 4 }, key: 'C',
        measures: [[note('C4', 'whole'), note('C4')]]
      })).toThrow('第1小节')
    })

    it('第2小节错误时提示第2小节', () => {
      expect(() => generate({
        timeSignature: { beats: 4, beatType: 4 }, key: 'C',
        measures: [
          [note('C4'), note('C4'), note('C4'), note('C4')],
          [note('C4'), note('C4')],
        ]
      })).toThrow('第2小节')
    })
  })

})
