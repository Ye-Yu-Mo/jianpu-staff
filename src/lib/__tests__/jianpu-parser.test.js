import { describe, it, expect } from 'vitest'
import { parse } from '../jianpu-parser.js'

describe('jianpu-parser', () => {

  // --- 基础音高 ---
  describe('基础音高', () => {
    it('解析 C 大调单小节四个四分音符', () => {
      const result = parse('1 2 3 4')
      expect(result.measures[0]).toEqual([
        { pitch: 'C4', duration: 'quarter', isRest: false },
        { pitch: 'D4', duration: 'quarter', isRest: false },
        { pitch: 'E4', duration: 'quarter', isRest: false },
        { pitch: 'F4', duration: 'quarter', isRest: false },
      ])
    })

    it('解析完整音阶 1~7', () => {
      const result = parse('1 2 3 4 5 6 7')
      const pitches = result.measures[0].map(n => n.pitch)
      expect(pitches).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'])
    })

    it('解析休止符 0', () => {
      const result = parse('0')
      expect(result.measures[0][0]).toEqual({ pitch: 'R', duration: 'quarter', isRest: true })
    })
  })

  // --- 八度 ---
  describe('八度标记', () => {
    it("单引号 ' 升高一个八度", () => {
      const result = parse("1'")
      expect(result.measures[0][0].pitch).toBe('C5')
    })

    it("双引号 '' 升高两个八度", () => {
      const result = parse("1''")
      expect(result.measures[0][0].pitch).toBe('C6')
    })

    it('逗号 , 降低一个八度', () => {
      const result = parse('1,')
      expect(result.measures[0][0].pitch).toBe('C3')
    })

    it('双逗号 ,, 降低两个八度', () => {
      const result = parse('1,,')
      expect(result.measures[0][0].pitch).toBe('C2')
    })
  })

  // --- 时值 ---
  describe('时值标记', () => {
    it('默认为四分音符', () => {
      const result = parse('1')
      expect(result.measures[0][0].duration).toBe('quarter')
    })

    it('- 表示二分音符', () => {
      const result = parse('1-')
      expect(result.measures[0][0].duration).toBe('half')
    })

    it('-- 表示全音符', () => {
      const result = parse('1--')
      expect(result.measures[0][0].duration).toBe('whole')
    })

    it('/ 表示八分音符', () => {
      const result = parse('1/')
      expect(result.measures[0][0].duration).toBe('eighth')
    })

    it('// 表示十六分音符', () => {
      const result = parse('1//')
      expect(result.measures[0][0].duration).toBe('sixteenth')
    })

    it('* 表示附点四分音符', () => {
      const result = parse('1*')
      expect(result.measures[0][0].duration).toBe('dotted-quarter')
    })
  })

  // --- 小节线 ---
  describe('小节线', () => {
    it('| 分割为多个小节', () => {
      const result = parse('1 2 | 3 4')
      expect(result.measures).toHaveLength(2)
      expect(result.measures[0]).toHaveLength(2)
      expect(result.measures[1]).toHaveLength(2)
    })

    it('末尾有 | 不产生空小节', () => {
      const result = parse('1 2 3 4 |')
      expect(result.measures).toHaveLength(1)
    })
  })

  // --- 拍号 ---
  describe('拍号', () => {
    it('默认拍号为 4/4', () => {
      const result = parse('1 2 3 4')
      expect(result.timeSignature).toEqual({ beats: 4, beatType: 4 })
    })

    it('[3/4] 解析为 3/4 拍', () => {
      const result = parse('[3/4] 1 2 3')
      expect(result.timeSignature).toEqual({ beats: 3, beatType: 4 })
    })
  })

  // --- 调号 ---
  describe('调号', () => {
    it('默认调号为 C', () => {
      const result = parse('1 2 3')
      expect(result.key).toBe('C')
    })

    it('[1=G] 时 1→G4 2→A4 3→B4', () => {
      const result = parse('[1=G] 1 2 3')
      const pitches = result.measures[0].map(n => n.pitch)
      expect(pitches).toEqual(['G4', 'A4', 'B4'])
    })

    it('[1=F] 时 1→F4 2→G4 3→A4', () => {
      const result = parse('[1=F] 1 2 3')
      const pitches = result.measures[0].map(n => n.pitch)
      expect(pitches).toEqual(['F4', 'G4', 'A4'])
    })
  })

  // --- 错误处理 ---
  describe('错误处理', () => {
    it('空字符串返回空 measures', () => {
      const result = parse('')
      expect(result.measures).toEqual([[]])
    })

    it('未知符号抛出含位置信息的错误', () => {
      expect(() => parse('1 x 3')).toThrow(/未知符号/)
    })
  })

})
