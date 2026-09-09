import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('multi-account selection surfaces', () => {
  it('keeps the exact provider slot in every chat model picker', () => {
    const chip = source('src/renderer/components/chat/ChatModelChip.tsx')
    const settings = source('src/renderer/components/chat/ApiKeySettings.tsx')
    const review = source('src/renderer/components/chat/ReviewLoopPickerDialog.tsx')
    const candidate = source('src/renderer/components/chat/subagent-profiles/CandidateFields.tsx')

    expect(chip).toContain('providerId: p.id, providerName: p.name')
    expect(chip).toMatch(/key=\{`\$\{r\.providerId\}::\$\{r\.modelId\}`\}/)
    expect(settings.match(/<option key=\{p\.id\} value=\{p\.id\}>/g)).toHaveLength(2)
    expect(review).toContain('<SelectItem key={provider.id} value={provider.id}>')
    expect(review).toContain('{provider.name}')
    expect(candidate).toContain('id: provider.id')
    expect(candidate).toContain('.chatSubagentProfilesModelCatalog(candidate.providerId)')
  })

  it('keeps configurator and quick usage identities account-scoped', () => {
    const configurator = source('src/renderer/components/chat/MaestroConfigurator.tsx')
    const usage = source('src/renderer/components/chat/quick-subscription-usage.ts')

    expect(configurator).toContain('state.catalog.providers.map((provider) => provider.id)')
    expect(configurator).toContain('providerFilter={providerFilter}')
    expect(usage).toContain('providerId: provider.id')
    expect(usage).toContain('accountId: provider.accountId ?? null')
  })
})
