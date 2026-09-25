import { useCallback } from 'react';
import { DEFAULT_PROJECT_NAME } from '../lib/teams';
import { useI18n } from '../i18n';

/** Display name of a project: the default project reads in the user's language until renamed */
export function useProjectName() {
  const { t } = useI18n();
  return useCallback(
    (project: { name: string; is_default: boolean }) =>
      project.is_default && project.name === DEFAULT_PROJECT_NAME ? t('projects.defaultName') : project.name,
    [t]
  );
}
