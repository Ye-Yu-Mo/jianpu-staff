import { describe, it, expect } from 'vitest'
import { generate } from '../musicxml-generator.js'

const has = (xml, str) => xml.includes(str)

// 辅助构造 note 对象
const note = (pitch, duration = 'quarter', extra = {}) => ({
  pitch, duration, isRest: false, ...extra
})
const rest = (duration = 'quarter') => ({ pitch: 'R', duration, isRest: true })
const directive = (kind, extra) => ({ type: 'directive', kind, ...extra })

// 补满 4/4 小节（跳过 directive 对象）
const UNITS = {
  whole: 192, half: 96, quarter: 48, eighth: 24, sixteenth: 12,
  'dotted-quarter': 72, 'dotted-eighth': 36,
}
const fill44 = (items) => {
  const used = items
    .filter(n => n.type !== 'directive' && !n.isGrace)
    .reduce((s, n) => s + (UNITS[n.duration] ?? 0), 0)
  const remaining = 192 - used
  if (remaining <= 0) return items
  const pads = []
  let left = remaining
  for (const [dur, u] of [['half', 96], ['quarter', 48], ['eighth', 24], ['sixteenth', 12]]) {
    while (left >= u) { pads.push(rest(dur)); left -= u }
  }
  return [...items, ...pads]
}

// ─── 附点八分音符 ────────────────────────────────────────────────────────────

describe('附点八分音符', () => {
  it('dotted-eighth → type=eighth + <dot/>', () => {
    // 3/8 = 3个八分音符 = 72 units；dotted-eighth(36) + eighth(24) = 60，不足
    // 用 6/8 拍：dotted-quarter(72) + dotted-eighth(36) + eighth(24) = 132... 不对
    // 最简单：用 3/4 拍，dotted-eighth(36) + eighth(24) + quarter(48) + quarter(48) = 156... 不对
    // 直接用 4/4：dotted-eighth(36) + eighth(24) + quarter(48) + half(96) = 204... 不对
    // 正确：dotted-eighth = 3/4 拍，用 3/4 拍号：dotted-eighth(36) + eighth(24) + quarter(48) = 108 ≠ 144
    // 用 6/8 拍（6个八分音符 = 144 units）：dotted-eighth(36) + eighth(24) + dotted-eighth(36) + eighth(24) + eighth(24) = 144 ✓
    const xml = generate({
      timeSignature: { beats: 6, beatType: 8 },
      key: 'C',
      measures: [[
        note('C4', 'dotted-eighth'), note('C4', 'eighth'),
        note('C4', 'dotted-eighth'), note('C4', 'eighth'), note('C4', 'eighth'),
      ]]
    })
    expect(has(xml, '<type>eighth</type>')).toBe(true)
    expect(has(xml, '<dot/>')).toBe(true)
  })
})

// ─── 延音线 ──────────────────────────────────────────────────────────────────

describe('延音线', () => {
  it('tie:start 输出 <tie type="start"/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[
        note('C4', 'half', { tie: 'start' }),
        note('C4', 'half'),
      ]]
    })
    expect(has(xml, 'type="start"')).toBe(true)
  })

  it('tie:start 的下一个同音高音符自动输出 <tie type="stop"/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[
        note('C4', 'half', { tie: 'start' }),
        note('C4', 'half'),
      ]]
    })
    expect(has(xml, 'type="stop"')).toBe(true)
  })

  it('延音线同时输出 <tied> 在 notations 中', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[
        note('C4', 'half', { tie: 'start' }),
        note('C4', 'half'),
      ]]
    })
    expect(has(xml, '<tied')).toBe(true)
  })
})

// ─── 三连音 ──────────────────────────────────────────────────────────────────

describe('三连音', () => {
  // 三连音 3个eighth = 1拍，加上3个quarter = 3拍，共4拍
  const tripletMeasure = [
    note('C4', 'eighth', { tuplet: { type: 'start', actual: 3, normal: 2 } }),
    note('D4', 'eighth', { tuplet: null }),
    note('E4', 'eighth', { tuplet: { type: 'stop' } }),
    note('F4', 'quarter'),
    note('G4', 'quarter'),
    note('C4', 'quarter'),
  ]

  it('三连音输出 <time-modification>', () => {
    const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [tripletMeasure] })
    expect(has(xml, '<time-modification>')).toBe(true)
  })

  it('三连音 actual-notes=3 normal-notes=2', () => {
    const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [tripletMeasure] })
    expect(has(xml, '<actual-notes>3</actual-notes>')).toBe(true)
    expect(has(xml, '<normal-notes>2</normal-notes>')).toBe(true)
  })

  it('三连音第一个音符输出 <tuplet type="start"/>', () => {
    const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [tripletMeasure] })
    expect(has(xml, 'type="start"')).toBe(true)
  })

  it('三连音最后一个音符输出 <tuplet type="stop"/>', () => {
    const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [tripletMeasure] })
    expect(has(xml, 'type="stop"')).toBe(true)
  })
})

// ─── 前倚音 ──────────────────────────────────────────────────────────────────

describe('前倚音', () => {
  it('isGrace:true 输出 <grace/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('B4', 'eighth', { isGrace: true }), note('C5')])]
    })
    expect(has(xml, '<grace/>')).toBe(true)
  })

  it('前倚音不计入小节时值校验', () => {
    // 4/4 拍，前倚音 + 4个四分音符，不应报错
    expect(() => generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[
        note('B4', 'eighth', { isGrace: true }),
        note('C4'), note('D4'), note('E4'), note('F4'),
      ]]
    })).not.toThrow()
  })
})

// ─── 装饰音 ──────────────────────────────────────────────────────────────────

describe('装饰音', () => {
  it('ornament:trill 输出 <trill-mark/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { ornament: 'trill' })])]
    })
    expect(has(xml, '<trill-mark/>')).toBe(true)
  })

  it('ornament:mordent 输出 <mordent/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { ornament: 'mordent' })])]
    })
    expect(has(xml, '<mordent/>')).toBe(true)
  })

  it('ornament:turn 输出 <turn/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { ornament: 'turn' })])]
    })
    expect(has(xml, '<turn/>')).toBe(true)
  })

  it('装饰音包裹在 <ornaments> 和 <notations> 中', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { ornament: 'trill' })])]
    })
    expect(has(xml, '<ornaments>')).toBe(true)
    expect(has(xml, '<notations>')).toBe(true)
  })
})

// ─── 技巧标记 ────────────────────────────────────────────────────────────────

describe('技巧标记', () => {
  it('staccato 输出 <staccato/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { articulations: ['staccato'] })])]
    })
    expect(has(xml, '<staccato/>')).toBe(true)
  })

  it('accent 输出 <accent/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { articulations: ['accent'] })])]
    })
    expect(has(xml, '<accent/>')).toBe(true)
  })

  it('strong-accent 输出 <strong-accent/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { articulations: ['strong-accent'] })])]
    })
    expect(has(xml, '<strong-accent/>')).toBe(true)
  })

  it('tenuto 输出 <tenuto/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { articulations: ['tenuto'] })])]
    })
    expect(has(xml, '<tenuto/>')).toBe(true)
  })

  it('staccatissimo 输出 <staccatissimo/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { articulations: ['staccatissimo'] })])]
    })
    expect(has(xml, '<staccatissimo/>')).toBe(true)
  })

  it('多个技巧标记同时输出', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { articulations: ['accent', 'staccato'] })])]
    })
    expect(has(xml, '<accent/>')).toBe(true)
    expect(has(xml, '<staccato/>')).toBe(true)
  })

  it('技巧标记包裹在 <articulations> 和 <notations> 中', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [fill44([note('C4', 'quarter', { articulations: ['staccato'] })])]
    })
    expect(has(xml, '<articulations>')).toBe(true)
    expect(has(xml, '<notations>')).toBe(true)
  })
})

// ─── 力度指令 ────────────────────────────────────────────────────────────────

describe('力度指令', () => {
  it('[dynamic:f] 输出 <dynamics><f/></dynamics>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[directive('dynamic', { value: 'f' }), ...fill44([note('C4')])]]
    })
    expect(has(xml, '<f/>')).toBe(true)
    expect(has(xml, '<dynamics>')).toBe(true)
  })

  it('[dynamic:pp] 输出 <pp/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[directive('dynamic', { value: 'pp' }), ...fill44([note('C4')])]]
    })
    expect(has(xml, '<pp/>')).toBe(true)
  })

  it('力度指令包裹在 <direction> 中', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[directive('dynamic', { value: 'mf' }), ...fill44([note('C4')])]]
    })
    expect(has(xml, '<direction')).toBe(true)
  })

  it('crescendo 输出 <wedge type="crescendo"/>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[directive('dynamic', { value: 'crescendo' }), ...fill44([note('C4')])]]
    })
    expect(has(xml, 'crescendo')).toBe(true)
  })
})

// ─── 速度指令 ────────────────────────────────────────────────────────────────

describe('速度指令', () => {
  it('[tempo-bpm:120] 输出 <metronome>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[directive('tempo-bpm', { bpm: 120 }), ...fill44([note('C4')])]]
    })
    expect(has(xml, '<metronome')).toBe(true)
    expect(has(xml, '120')).toBe(true)
  })

  it('[tempo-text:Allegro] 输出 <words>Allegro</words>', () => {
    const xml = generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[directive('tempo-text', { text: 'Allegro' }), ...fill44([note('C4')])]]
    })
    expect(has(xml, '<words>Allegro</words>')).toBe(true)
  })
})

// ─── 回归：原有测试不受影响 ──────────────────────────────────────────────────

describe('回归：原有功能', () => {
  it('C4 quarter 输出正确', () => {
    const xml = generate({ timeSignature: { beats: 4, beatType: 4 }, key: 'C', measures: [fill44([note('C4')])] })
    expect(has(xml, '<step>C</step>')).toBe(true)
    expect(has(xml, '<type>quarter</type>')).toBe(true)
  })

  it('dotted-quarter 仍然正确', () => {
    const xml = generate({
      timeSignature: { beats: 3, beatType: 4 },
      key: 'C',
      measures: [[note('C4', 'dotted-quarter'), note('C4', 'eighth'), note('C4', 'quarter')]]
    })
    expect(has(xml, '<dot/>')).toBe(true)
  })

  it('小节时值校验仍然工作', () => {
    expect(() => generate({
      timeSignature: { beats: 4, beatType: 4 },
      key: 'C',
      measures: [[note('C4'), note('C4'), note('C4')]]
    })).toThrow('第1小节')
  })
})
