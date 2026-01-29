import { describe, it, expect } from 'vitest'

describe('示例测试', () => {
  it('基本断言', () => {
    expect(1 + 1).toBe(2)
  })

  it('字符串匹配', () => {
    expect('Vitest').toContain('test')
  })

  it('对象相等', () => {
    const data = { name: 'Suno API', version: '1.1.0' }
    expect(data).toEqual({ name: 'Suno API', version: '1.1.0' })
  })
})
