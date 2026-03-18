const DIVISIONS = 4

// 时值 → MusicXML divisions 数（以 DIVISIONS=4 为基准）
const DURATION_TO_DIVISIONS = {
  whole: 16, half: 8, quarter: 4, eighth: 2, sixteenth: 1, 'dotted-quarter': 6,
}

// 时值 → 拍数（以四分音符=1为基准），用整数×16避免浮点误差
const DURATION_TO_UNITS = {
  whole: 64, half: 32, quarter: 16, eighth: 8, sixteenth: 4, 'dotted-quarter': 24,
}

// 调号 → MusicXML fifths（正=升号，负=降号）
const KEY_FIFTHS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, F: -1 }

/** 解析 'C4' / 'F#5' → { step, alter, octave } */
function parsePitch(pitch) {
  if (pitch[1] === '#') return { step: pitch[0], alter: 1, octave: parseInt(pitch[2]) }
  return { step: pitch[0], alter: 0, octave: parseInt(pitch[1]) }
}

/** 单个音符 → XML 片段 */
function noteXml(note) {
  const divs = DURATION_TO_DIVISIONS[note.duration]
  const isDotted = note.duration === 'dotted-quarter'
  const type = isDotted ? 'quarter' : note.duration
  const dot = isDotted ? '<dot/>' : ''

  if (note.isRest) {
    return `      <note><rest/><duration>${divs}</duration><type>${type}</type>${dot}</note>`
  }

  const { step, alter, octave } = parsePitch(note.pitch)
  const alterXml = alter ? `<alter>${alter}</alter>` : ''
  return `      <note><pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch>` +
    `<duration>${divs}</duration><type>${type}</type>${dot}</note>`
}

/** 校验单个小节的时值总和是否符合拍号 */
function validateMeasure(notes, expectedUnits, measureIndex) {
  const actual = notes.reduce((sum, n) => sum + DURATION_TO_UNITS[n.duration], 0)
  if (actual === expectedUnits) return
  const expectedBeats = expectedUnits / 16
  const actualBeats = actual / 16
  const label = actual < expectedUnits ? '不足' : '超出'
  throw new Error(`第${measureIndex + 1}小节时值${label}：期望${expectedBeats}拍，实际${actualBeats}拍`)
}

/**
 * 将解析器输出转为 MusicXML 字符串
 * @param {{ timeSignature: {beats, beatType}, key: string, measures: Note[][] }} score
 * @returns {string}
 */
export function generate({ timeSignature, key, measures }) {
  const { beats, beatType } = timeSignature
  const fifths = KEY_FIFTHS[key] ?? 0
  const expectedUnits = beats * (64 / beatType) // 以 quarter=16 为基准

  // 校验所有小节
  measures.forEach((notes, i) => validateMeasure(notes, expectedUnits, i))

  const measureXml = measures.map((notes, i) => {
    const attrs = i === 0
      ? `\n      <attributes>` +
        `<divisions>${DIVISIONS}</divisions>` +
        `<key><fifths>${fifths}</fifths></key>` +
        `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
        `<clef><sign>G</sign><line>2</line></clef>` +
        `</attributes>`
      : ''
    const notesXml = notes.map(noteXml).join('\n')
    return `    <measure number="${i + 1}">${attrs}\n${notesXml}\n    </measure>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">` +
    `<score-partwise version="3.1">` +
    `<part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>` +
    `<part id="P1">\n${measureXml}\n  </part>` +
    `</score-partwise>`
}
