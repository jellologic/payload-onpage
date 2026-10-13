'use client'

/**
 * Panels loaded on first use (see ../OnDemand.tsx), so the editor's first
 * download stays small. Prefetched when the browser is idle.
 */
import { useOnPage } from '../../context.tsx'
import { BlockPicker } from './BlockPicker.tsx'
import { PublishPanel } from './PublishPanel.tsx'
import { SettingsPanel } from './SettingsPanel.tsx'

export function OnDemandPanel() {
  const { panel } = useOnPage()
  switch (panel?.kind) {
    case 'publish':
      return <PublishPanel />
    case 'blocks':
      return <BlockPicker />
    case 'settings':
    case 'page':
      return <SettingsPanel />
    default:
      return null
  }
}

export default OnDemandPanel
