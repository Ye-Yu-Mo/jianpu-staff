// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { fifthsToKey, pitchToJianpu, durationToSuffix, convert } from '../musicxml-to-jianpu.js'

// 构造最小合法 MusicXML 的辅助函数
function makeXml(fifths, beats, beatType, measuresXml) {
  return `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>${fifths}</fifths></key>
        <time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>
      </attributes>
      ${measuresXml}
    </measure>
  </part>
</score-partwise>`
}

const qn = (step, octave) =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><type>quarter</type></note>`
const rest = () =>
  `<note><rest/><duration>4</duration><type>quarter</type></note>`

describe('musicxml-to-jianpu', () => {

  // --- fifthsToKey ---
  describe('fifthsToKey', () => {
    it('0 → C', () => expect(fifthsToKey(0)).toBe('C'))
    it('1 → G', () => expect(fifthsToKey(1)).toBe('G'))
    it('2 → D', () => expect(fifthsToKey(2)).toBe('D'))
    it('-1 → F', () => expect(fifthsToKey(-1)).toBe('F'))
  })

  // --- pitchToJianpu ---
  describe('pitchToJianpu', () => {
    it('C4 in C → degree 1, octave 0', () =>
      expect(pitchToJianpu('C', 0, 4, 'C')).toEqual({ degree: 1, octaveOffset: 0 }))
    it('G4 in C → degree 5, octave 0', () =>
      expect(pitchToJianpu('G', 0, 4, 'C')).toEqual({ degree: 5, octaveOffset: 0 }))
    it('C5 in G → degree 4, octave 0', () =>
      expect(pitchToJianpu('C', 0, 5, 'G')).toEqual({ degree: 4, octaveOffset: 0 }))
    it('G5 in G → degree 1, octave +1', () =>
      expect(pitchToJianpu('G', 0, 5, 'G')).toEqual({ degree: 1, octaveOffset: 1 }))
    it('G3 in G → degree 1, octave -1', () =>
      expect(pitchToJianpu('G', 0, 3, 'G')).toEqual({ degree: 1, octaveOffset: -1 }))
    it('B4 in G → degree 3, octave 0', () =>
      expect(pitchToJianpu('B', 0, 4, 'G')).toEqual({ degree: 3, octaveOffset: 0 }))
    it('F4 in F → degree 1, octave 0', () =>
      expect(pitchToJianpu('F', 0, 4, 'F')).toEqual({ degree: 1, octaveOffset: 0 }))
  })

  // --- durationToSuffix ---
  describe('durationToSuffix', () => {
    it('whole → --',       () => expect(durationToSuffix('whole',     false)).toBe('--'))
    it('half → -',         () => expect(durationToSuffix('half',      false)).toBe('-'))
    it('quarter → ""',     () => expect(durationToSuffix('quarter',   false)).toBe(''))
    it('eighth → /',       () => expect(durationToSuffix('eighth',    false)).toBe('/'))
    it('sixteenth → //',   () => expect(durationToSuffix('sixteenth', false)).toBe('//'))
    it('quarter+dot → *',  () => expect(durationToSuffix('quarter',   true)).toBe('*'))
  })

  // --- convert (完整 MusicXML → 简谱文本) ---
  describe('convert', () => {
    it('输出包含拍号 [4/4]', () => {
      const xml = makeXml(0, 4, 4, qn('C', 4) + qn('C', 4) + qn('C', 4) + qn('C', 4))
      expect(convert(xml)).toContain('[4/4]')
    })

    it('C 大调输出 [1=C]', () => {
      const xml = makeXml(0, 4, 4, qn('C', 4) + qn('C', 4) + qn('C', 4) + qn('C', 4))
      expect(convert(xml)).toContain('[1=C]')
    })

    it('G 大调输出 [1=G]', () => {
      const xml = makeXml(1, 4, 4, qn('G', 4) + qn('A', 4) + qn('B', 4) + qn('G', 4))
      expect(convert(xml)).toContain('[1=G]')
    })

    it('C 大调 C D E F → 1 2 3 4', () => {
      const xml = makeXml(0, 4, 4, qn('C', 4) + qn('D', 4) + qn('E', 4) + qn('F', 4))
      expect(convert(xml)).toContain('1 2 3 4')
    })

    it('G 大调 G A B G → 1 2 3 1', () => {
      const xml = makeXml(1, 4, 4, qn('G', 4) + qn('A', 4) + qn('B', 4) + qn('G', 4))
      expect(convert(xml)).toContain('1 2 3 1')
    })

    it('高八度 C5 in C → 1\'', () => {
      const xml = makeXml(0, 4, 4, qn('C', 5) + qn('C', 4) + qn('C', 4) + qn('C', 4))
      expect(convert(xml)).toContain("1'")
    })

    it('低八度 C3 in C → 1,', () => {
      const xml = makeXml(0, 4, 4, qn('C', 3) + qn('C', 4) + qn('C', 4) + qn('C', 4))
      expect(convert(xml)).toContain('1,')
    })

    it('休止符输出 0', () => {
      const xml = makeXml(0, 4, 4, rest() + qn('C', 4) + qn('C', 4) + qn('C', 4))
      expect(convert(xml)).toContain('0')
    })

    it('多小节用 | 分隔', () => {
      const twoMeasures = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      ${qn('C', 4) + qn('C', 4) + qn('C', 4) + qn('C', 4)}
    </measure>
    <measure number="2">
      ${qn('G', 4) + qn('G', 4) + qn('G', 4) + qn('G', 4)}
    </measure>
  </part>
</score-partwise>`
      const result = convert(twoMeasures)
      expect(result.split('|').length).toBeGreaterThanOrEqual(2)
    })

    it('二分音符输出 1-', () => {
      const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>8</duration><type>half</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>8</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`
      expect(convert(xml)).toContain('1-')
    })
  })

})
