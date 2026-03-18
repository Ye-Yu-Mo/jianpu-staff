import { describe, it, expect } from 'vitest'
import { parse } from '../jianpu-parser.js'

// ─── 附点八分音符 ────────────────────────────────────────────────────────────

describe('附点八分音符', () => {
  it('1*/ 解析为 dotted-eighth', () => {
    const result = parse('1*/')
    expect(result.measures[0][0].duration).toBe('dotted-eighth')
  })

  it('1\'*/ 八度+附点八分可组合', () => {
    const result = parse("1'*/")
    expect(result.measures[0][0].pitch).toBe('C5')
    expect(result.measures[0][0].duration).toBe('dotted-eighth')
  })
})

// ─── 延音线 ──────────────────────────────────────────────────────────────────

describe('延音线', () => {
  it('1~ 标记 tie: start', () => {
    const result = parse('1~ 1')
    expect(result.measures[0][0].tie).toBe('start')
  })

  it('延音线终点音符无 tie 标记', () => {
    const result = parse('1~ 1')
    expect(result.measures[0][1].tie).toBeFalsy()
  })

  it('1-~ 二分音符延音线', () => {
    const result = parse('1-~ | 1-')
    expect(result.measures[0][0].tie).toBe('start')
    expect(result.measures[0][0].duration).toBe('half')
  })

  it('延音线与时值符号组合顺序正确', () => {
    const result = parse("1'~ 1'")
    expect(result.measures[0][0].pitch).toBe('C5')
    expect(result.measures[0][0].tie).toBe('start')
  })
})

// ─── 三连音 / 连音组 ─────────────────────────────────────────────────────────

describe('三连音', () => {
  it('{1/ 2/ 3/} 解析为 3 个音符', () => {
    const result = parse('{1/ 2/ 3/}')
    expect(result.measures[0]).toHaveLength(3)
  })

  it('三连音音高正确', () => {
    const result = parse('{1/ 2/ 3/}')
    expect(result.measures[0].map(n => n.pitch)).toEqual(['C4', 'D4', 'E4'])
  })

  it('三连音第一个音符 tuplet.type = start', () => {
    const result = parse('{1/ 2/ 3/}')
    expect(result.measures[0][0].tuplet).toMatchObject({ type: 'start', actual: 3, normal: 2 })
  })

  it('三连音最后一个音符 tuplet.type = stop', () => {
    const result = parse('{1/ 2/ 3/}')
    expect(result.measures[0][2].tuplet).toMatchObject({ type: 'stop' })
  })

  it('三连音中间音符 tuplet 为 null', () => {
    const result = parse('{1/ 2/ 3/}')
    expect(result.measures[0][1].tuplet).toBeNull()
  })
})

describe('五连音', () => {
  it('{5: 1/ 2/ 3/ 4/ 5/} 解析为 5 个音符', () => {
    const result = parse('{5: 1/ 2/ 3/ 4/ 5/}')
    expect(result.measures[0]).toHaveLength(5)
  })

  it('五连音 actual=5 normal=4', () => {
    const result = parse('{5: 1/ 2/ 3/ 4/ 5/}')
    expect(result.measures[0][0].tuplet).toMatchObject({ type: 'start', actual: 5, normal: 4 })
  })
})

// ─── 前倚音 ──────────────────────────────────────────────────────────────────

describe('前倚音', () => {
  it('g1 解析为 isGrace: true', () => {
    const result = parse('g1 2')
    expect(result.measures[0][0].isGrace).toBe(true)
  })

  it('前倚音音高正确', () => {
    const result = parse('g1 2')
    expect(result.measures[0][0].pitch).toBe('C4')
  })

  it('前倚音后的主音符 isGrace 为 false', () => {
    const result = parse('g1 2')
    expect(result.measures[0][1].isGrace).toBeFalsy()
  })

  it('前倚音支持八度标记 g1\'', () => {
    const result = parse("g1' 2")
    expect(result.measures[0][0].pitch).toBe('C5')
    expect(result.measures[0][0].isGrace).toBe(true)
  })
})

// ─── 装饰音 ──────────────────────────────────────────────────────────────────

describe('装饰音', () => {
  it('1tr 解析为 ornament: trill', () => {
    const result = parse('1tr')
    expect(result.measures[0][0].ornament).toBe('trill')
  })

  it('1mor 解析为 ornament: mordent', () => {
    const result = parse('1mor')
    expect(result.measures[0][0].ornament).toBe('mordent')
  })

  it('1turn 解析为 ornament: turn', () => {
    const result = parse('1turn')
    expect(result.measures[0][0].ornament).toBe('turn')
  })

  it('装饰音不影响音高', () => {
    const result = parse('1tr')
    expect(result.measures[0][0].pitch).toBe('C4')
  })

  it('装饰音不影响时值', () => {
    const result = parse('1tr')
    expect(result.measures[0][0].duration).toBe('quarter')
  })

  it('1-tr 时值+装饰音组合', () => {
    const result = parse('1-tr')
    expect(result.measures[0][0].duration).toBe('half')
    expect(result.measures[0][0].ornament).toBe('trill')
  })
})

// ─── 技巧标记 ────────────────────────────────────────────────────────────────

describe('技巧标记', () => {
  it('1. 解析为 articulations 含 staccato', () => {
    const result = parse('1.')
    expect(result.measures[0][0].articulations).toContain('staccato')
  })

  it('1.. 解析为 articulations 含 staccatissimo', () => {
    const result = parse('1..')
    expect(result.measures[0][0].articulations).toContain('staccatissimo')
  })

  it('1^ 解析为 articulations 含 accent', () => {
    const result = parse('1^')
    expect(result.measures[0][0].articulations).toContain('accent')
  })

  it('1^^ 解析为 articulations 含 strong-accent', () => {
    const result = parse('1^^')
    expect(result.measures[0][0].articulations).toContain('strong-accent')
  })

  it('1_ 解析为 articulations 含 tenuto', () => {
    const result = parse('1_')
    expect(result.measures[0][0].articulations).toContain('tenuto')
  })

  it('1^. 解析为 accent + staccato', () => {
    const result = parse('1^.')
    expect(result.measures[0][0].articulations).toContain('accent')
    expect(result.measures[0][0].articulations).toContain('staccato')
  })

  it('技巧标记不影响音高和时值', () => {
    const result = parse('1.')
    expect(result.measures[0][0].pitch).toBe('C4')
    expect(result.measures[0][0].duration).toBe('quarter')
  })
})

// ─── 行内指令 ────────────────────────────────────────────────────────────────

describe('行内力度指令', () => {
  it('[f] 解析为 dynamic 指令', () => {
    const result = parse('[4/4] [f] 1 2 3 4')
    const dir = result.measures[0].find(n => n.type === 'directive')
    expect(dir).toMatchObject({ type: 'directive', kind: 'dynamic', value: 'f' })
  })

  it('[pp] [mf] [ff] 均可解析', () => {
    for (const dyn of ['pp', 'mf', 'ff']) {
      const result = parse(`[${dyn}] 1`)
      const dir = result.measures[0].find(n => n.type === 'directive')
      expect(dir).toMatchObject({ kind: 'dynamic', value: dyn })
    }
  })

  it('[<] 解析为渐强指令', () => {
    const result = parse('[<] 1')
    const dir = result.measures[0].find(n => n.type === 'directive')
    expect(dir).toMatchObject({ kind: 'dynamic', value: 'crescendo' })
  })

  it('[>] 解析为渐弱指令', () => {
    const result = parse('[>] 1')
    const dir = result.measures[0].find(n => n.type === 'directive')
    expect(dir).toMatchObject({ kind: 'dynamic', value: 'diminuendo' })
  })
})

describe('行内速度指令', () => {
  it('[q=120] 解析为 tempo-bpm 指令', () => {
    const result = parse('[q=120] 1 2 3 4')
    const dir = result.measures[0].find(n => n.type === 'directive')
    expect(dir).toMatchObject({ type: 'directive', kind: 'tempo-bpm', bpm: 120 })
  })

  it('[Allegro] 解析为 tempo-text 指令', () => {
    const result = parse('[Allegro] 1 2 3 4')
    const dir = result.measures[0].find(n => n.type === 'directive')
    expect(dir).toMatchObject({ type: 'directive', kind: 'tempo-text', text: 'Allegro' })
  })

  it('[Andante] 解析为 tempo-text 指令', () => {
    const result = parse('[Andante] 1')
    const dir = result.measures[0].find(n => n.type === 'directive')
    expect(dir).toMatchObject({ kind: 'tempo-text', text: 'Andante' })
  })
})

describe('行内指令不影响时值校验', () => {
  it('力度指令不计入小节时值', () => {
    const result = parse('[4/4] [mf] 1 2 3 4')
    const notes = result.measures[0].filter(n => n.type !== 'directive')
    expect(notes).toHaveLength(4)
  })

  it('速度指令不计入小节时值', () => {
    const result = parse('[4/4] [q=96] 1 2 3 4')
    const notes = result.measures[0].filter(n => n.type !== 'directive')
    expect(notes).toHaveLength(4)
  })
})

// ─── 组合 ────────────────────────────────────────────────────────────────────

describe('符号组合', () => {
  it("1'.^ 八度+重音+断奏", () => {
    const result = parse("1'.^")
    const note = result.measures[0][0]
    expect(note.pitch).toBe('C5')
    expect(note.articulations).toContain('accent')
    expect(note.articulations).toContain('staccato')
  })

  it('1-tr~ 时值+装饰音+延音线', () => {
    const result = parse("1-tr~ 1-")
    const note = result.measures[0][0]
    expect(note.duration).toBe('half')
    expect(note.ornament).toBe('trill')
    expect(note.tie).toBe('start')
  })

  it('原有测试用例不受影响：1 2 3 4', () => {
    const result = parse('1 2 3 4')
    expect(result.measures[0].map(n => n.pitch)).toEqual(['C4', 'D4', 'E4', 'F4'])
  })

  it('原有测试用例不受影响：[1=G] 1 2 3', () => {
    const result = parse('[1=G] 1 2 3')
    expect(result.measures[0].map(n => n.pitch)).toEqual(['G4', 'A4', 'B4'])
  })
})
