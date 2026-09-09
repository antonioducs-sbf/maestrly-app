import { Select } from '../../components/Select.js'
import { t, useLocale } from '../../i18n/index.js'
import { Plus } from 'lucide-react'
import type { Project } from '@maestrly/protocol'

export function ProjectSwitcher({ projects, selectedId, onSelect, onCreate }: {
  projects: Project[]; selectedId: string; onSelect(id: string): void; onCreate(): void
}) {
  useLocale()
  return <div className="project-switcher">
    <label className="sr-only" htmlFor="project-select">{t("Project")}</label>
    <Select id="project-select" value={selectedId} onChange={onSelect} label={t('Project')}
      options={projects.map(project => ({value:project.id,label:project.name}))} />
    <button className="icon-button" onClick={onCreate} aria-label={t("Create project")}><Plus size={17} /></button>
  </div>
}
