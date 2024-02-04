import { helloChibivue } from '../packages'
import { describe, expect, it, vi } from 'vitest'

describe('010_project_setup', () => {
  it('should called console.log', () => {
    const consoleLog = window.console.log
    const mockFn = vi.fn(() => {})
    window.console.log = mockFn
    helloChibivue()
    expect(mockFn).toBeCalled()
    window.console.log = consoleLog
  })
})
