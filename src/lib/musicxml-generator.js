// DIVISIONS=12 支持三连音（triplet eighth = 4 divisions）
const DIVISIONS = 12

const DURATION_TO_DIVISIONS = {
  whole: 48, half: 24, quarter: 12, eighth: 6, sixteenth: 3,
  'dotted-quarter': 18, 'dotted-eighth': 9,
}

// 时值 → 拍数单位（quarter=48，避免浮点）
const DURATION_TO_UNITS = {
  whole: 192, half: 96, quarter: 48, eighth: 24, sixteenth: 12,
  'dotted-quarter': 72, 'dotted-eighth': 36,
}

const KEY_FIFTHS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, F: -1 }

function parsePitch(pitch) {
  if (pitch[1] === '#') return { step: pitch[0], alter: 1, octave: parseInt(pitch[2]) }
  return { step: pitch[0], alter: 0, octave: parseInt(pitch[1]) }
}

/** 构建 <notations> 块（延音线、连音组、装饰音、技巧） */
function notationsXml(note, pendingTieStop) {
  const parts = []

  // 延音线
  if (note.tie === 'start') parts.push('<tied type="start"/>')
  if (pendingTieStop) parts.push('<tied type="stop"/>')

  // 连音组
  if (note.tuplet?.type === 'start') {
    parts.push(`<tuplet type="start" bracket="yes"/>`)
  } else if (note.tuplet?.type === 'stop') {
    parts.push('<tuplet type="stop"/>')
  }

  // 装饰音
  if (note.ornament) {
    const tag = note.ornament === 'trill' ? 'trill-mark'
      : note.ornament === 'mordent' ? 'mordent'
      : 'turn'
    parts.push(`<ornaments><${tag}/></ornaments>`)
  }

  // 技巧标记
  if (note.articulations?.length) {
    const tags = note.articulations.map(a => {
      if (a === 'staccato') return '<staccato/>'
      if (a === 'staccatissimo') return '<staccatissimo/>'
      if (a === 'accent') return '<accent/>'
      if (a === 'strong-accent') return '<strong-accent/>'
      if (a === 'tenuto') return '<tenuto/>'
      return ''
    }).join('')
    parts.push(`<articulations>${tags}</articulations>`)
  }

  if (!parts.length) return ''
  return `<notations>${parts.join('')}</notations>`
}

/** 单个音符 → XML 片段，currentTuplet 用于 middle/stop 节点 */
function noteXml(note, pendingTieStop = false, currentTuplet = null) {
  const isDotted = note.duration === 'dotted-quarter' || note.duration === 'dotted-eighth'
  const baseType = isDotted ? note.duration.replace('dotted-', '') : note.duration
  const dot = isDotted ? '<dot/>' : ''

  // 三连音：divisions 按比例缩放
  let divs = DURATION_TO_DIVISIONS[note.duration]
  let timeMod = ''
  if (note.tuplet?.type === 'start') {
    const { actual, normal } = note.tuplet
    divs = Math.round(DURATION_TO_DIVISIONS[note.duration] * normal / actual)
    timeMod = `<time-modification><actual-notes>${actual}</actual-notes><normal-notes>${normal}</normal-notes></time-modification>`
  } else if (note.tuplet?.type === 'stop' || (note.tuplet === null && currentTuplet)) {
    const { actual, normal } = currentTuplet ?? { actual: 3, normal: 2 }
    divs = Math.round(DURATION_TO_DIVISIONS[note.duration] * normal / actual)
    timeMod = `<time-modification><actual-notes>${actual}</actual-notes><normal-notes>${normal}</normal-notes></time-modification>`
  }

  // 延音线 <tie> 元素（在 <note> 内，非 <notations>）
  const tieStart = note.tie === 'start' ? '<tie type="start"/>' : ''
  const tieStop = pendingTieStop ? '<tie type="stop"/>' : ''

  const notations = notationsXml(note, pendingTieStop)

  if (note.isGrace) {
    const { step, alter, octave } = parsePitch(note.pitch)
    const alterXml = alter ? `<alter>${alter}</alter>` : ''
    return `      <note><grace/><pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch>` +
      `<type>${baseType}</type>${dot}${notations}</note>`
  }

  if (note.isRest) {
    return `      <note>${tieStop}<rest/><duration>${divs}</duration><type>${baseType}</type>${dot}${timeMod}${notations}</note>`
  }

  const { step, alter, octave } = parsePitch(note.pitch)
  const alterXml = alter ? `<alter>${alter}</alter>` : ''
  return `      <note>${tieStop}<pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch>` +
    `<duration>${divs}</duration><type>${baseType}</type>${dot}${tieStart}${timeMod}${notations}</note>`
}

/** 力度/速度指令 → <direction> XML */
function directiveXml(dir) {
  if (dir.kind === 'dynamic') {
    if (dir.value === 'crescendo') {
      return `      <direction placement="below"><direction-type><wedge type="crescendo"/></direction-type></direction>`
    }
    if (dir.value === 'diminuendo') {
      return `      <direction placement="below"><direction-type><wedge type="diminuendo"/></direction-type></direction>`
    }
    return `      <direction placement="below"><direction-type><dynamics><${dir.value}/></dynamics></direction-type></direction>`
  }
  if (dir.kind === 'tempo-bpm') {
    return `      <direction placement="above"><direction-type><metronome parentheses="no">` +
      `<beat-unit>quarter</beat-unit><per-minute>${dir.bpm}</per-minute>` +
      `</metronome></direction-type></direction>`
  }
  if (dir.kind === 'tempo-text') {
    return `      <direction placement="above"><direction-type><words>${dir.text}</words></direction-type></direction>`
  }
  return ''
}

/** 校验单个小节时值（跳过 directive 和 grace note） */
function validateMeasure(items, expectedUnits, measureIndex) {
  // 先收集三连音 start 的 actual/normal，供 middle/stop 节点使用
  let currentTuplet = null
  const actual = items
    .filter(n => n.type !== 'directive' && !n.isGrace)
    .reduce((sum, n) => {
      if (n.tuplet?.type === 'start') {
        currentTuplet = n.tuplet
        return sum + DURATION_TO_UNITS[n.duration] * n.tuplet.normal / n.tuplet.actual
      }
      if (n.tuplet?.type === 'stop') {
        const ratio = currentTuplet ? currentTuplet.normal / currentTuplet.actual : 2 / 3
        currentTuplet = null
        return sum + DURATION_TO_UNITS[n.duration] * ratio
      }
      if (n.tuplet === null && currentTuplet) {
        // middle note：沿用当前三连音比例
        return sum + DURATION_TO_UNITS[n.duration] * currentTuplet.normal / currentTuplet.actual
      }
      return sum + DURATION_TO_UNITS[n.duration]
    }, 0)

  if (Math.abs(actual - expectedUnits) < 0.01) return
  const expectedBeats = expectedUnits / 48
  const actualBeats = actual / 48
  const label = actual < expectedUnits ? '不足' : '超出'
  throw new Error(`第${measureIndex + 1}小节时值${label}：期望${expectedBeats}拍，实际${actualBeats}拍`)
}

/**
 * 将解析器输出转为 MusicXML 字符串
 * @param {{ timeSignature, key, measures }} score
 * @returns {string}
 */
export function generate({ timeSignature, key, measures }) {
  const { beats, beatType } = timeSignature
  const fifths = KEY_FIFTHS[key] ?? 0
  const expectedUnits = beats * (192 / beatType)

  measures.forEach((items, i) => validateMeasure(items, expectedUnits, i))

  // 跟踪待解决的延音线：pitch → true
  const pendingTies = new Map()

  const measureXml = measures.map((items, i) => {
    const attrs = i === 0
      ? `\n      <attributes>` +
        `<divisions>${DIVISIONS}</divisions>` +
        `<key><fifths>${fifths}</fifths></key>` +
        `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
        `<clef><sign>G</sign><line>2</line></clef>` +
        `</attributes>`
      : ''

    let activeTuplet = null
    const itemsXml = items.map(item => {
      if (item.type === 'directive') return directiveXml(item)

      const isTieStop = !item.isGrace && pendingTies.has(item.pitch)
      if (isTieStop) pendingTies.delete(item.pitch)
      if (item.tie === 'start') pendingTies.set(item.pitch, true)

      const xml = noteXml(item, isTieStop, activeTuplet)

      // 更新 activeTuplet 状态
      if (item.tuplet?.type === 'start') activeTuplet = item.tuplet
      else if (item.tuplet?.type === 'stop') activeTuplet = null

      return xml
    }).join('\n')

    return `    <measure number="${i + 1}">${attrs}\n${itemsXml}\n    </measure>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">` +
    `<score-partwise version="3.1">` +
    `<part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>` +
    `<part id="P1">\n${measureXml}\n  </part>` +
    `</score-partwise>`
}
