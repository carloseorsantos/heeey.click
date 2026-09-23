import { useCallback, useEffect, useState } from 'react';
import {
  Folder,
  fetchFolders,
  createFolder as createFolderRemote,
  updateFolder,
  deleteFolder as deleteFolderRemote,
  getFolderSubtreeIds,
} from '../lib/folders';

/**
 * Folders of the signed-in user. `available` is false for guests and when the
 * database does not have the folders migration yet, so the UI can hide them.
 */
export function useFolders(userId: string | null | undefined) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setFolders([]);
      setAvailable(false);
      return;
    }
    fetchFolders(userId).then((result) => {
      if (cancelled) return;
      setFolders(result || []);
      setAvailable(result !== null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const createFolder = useCallback(
    async (name: string, parentId: string | null) => {
      if (!userId) return null;
      const folder = await createFolderRemote(userId, name, parentId);
      if (folder) setFolders((prev) => [...prev, folder]);
      return folder;
    },
    [userId]
  );

  const renameFolder = useCallback(async (id: string, name: string) => {
    const ok = await updateFolder(id, { name });
    if (ok) setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)));
    return ok;
  }, []);

  /** Returns the ids that were removed (the folder and its subfolders), or null on failure */
  const deleteFolder = useCallback(
    async (id: string) => {
      const removed = getFolderSubtreeIds(folders, id);
      const ok = await deleteFolderRemote(id);
      if (!ok) return null;
      setFolders((prev) => prev.filter((f) => !removed.has(f.id)));
      return removed;
    },
    [folders]
  );

  return { folders, available, createFolder, renameFolder, deleteFolder };
}
