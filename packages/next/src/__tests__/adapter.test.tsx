// @vitest-environment happy-dom
import { act, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ refresh: vi.fn(), pathname: '/about', search: 'x=1' }))
vi.mock('next/navigation.js', () => ({
  useRouter: () => ({ refresh: nav.refresh }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}))
const session = vi.hoisted(() => ({ mode: null as 'edit' | 'view' | null, shared: false }))
vi.mock('../session.ts', () => ({
  getOnPageMode: async () => session.mode,
  isSharedPreview: async () => session.shared,
}))

const { useNextRefresh } = await import('../refresh.ts')
const { OnPage } = await import('../index.tsx')
const { NextPreview } = await import('../editor.tsx')

beforeEach(() => {
  nav.refresh.mockReset()
  session.mode = null
  session.shared = false
})

describe('useNextRefresh', () => {
  it('debounces saves into one router.refresh and resolves when it settles', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useNextRefresh())
    expect(result.current.live).toBe(false)
    const a = result.current.afterSave({ refs: [] })
    const b = result.current.afterSave({ refs: [] })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
    await expect(Promise.all([a, b])).resolves.toBeDefined()
    vi.useRealTimers()
  })
})

describe('<OnPage>', () => {
  it('renders nothing for visitors', async () => {
    expect(await OnPage({})).toBeNull()
  })
  it('mounts the given client mount with mode and shared flag', async () => {
    session.mode = 'view'
    session.shared = true
    const Mount = vi.fn(() => null)
    const el = (await OnPage({ mount: Mount, apiRoute: '/api' })) as {
      props: Record<string, unknown>
    }
    expect(el.props).toMatchObject({ mode: 'view', shared: true, apiRoute: '/api' })
  })
})

describe('NextPreview', () => {
  it('posts to the plugin endpoints with the current path', () => {
    render(<NextPreview mode="view" apiRoute="/cms-api" prefix="/op" />)
    const exit = screen.getByTestId('onpage-exit-preview').closest('form')!
    expect(exit.getAttribute('action')).toBe(
      `/cms-api/op/exit?path=${encodeURIComponent('/about?x=1')}`,
    )
    expect(screen.getByTestId('onpage-edit').closest('form')!.getAttribute('action')).toContain(
      '/cms-api/op/mode?mode=edit',
    )
  })
  it('link viewers get no Edit button', () => {
    render(<NextPreview mode="view" shared />)
    expect(screen.queryByTestId('onpage-edit')).toBeNull()
  })
})
