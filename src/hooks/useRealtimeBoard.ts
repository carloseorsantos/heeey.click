import { useEffect, useRef, useState, useCallback } from 'react';
import type { ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, Collaborator } from '@excalidraw/excalidraw/types';
import { reconcileElements, CaptureUpdateAction } from '@excalidraw/excalidraw';
import { BOARD_ID_HEADER, supabase } from '../lib/supabase';
import {
  Board,
  CollaboratorUser,
  SyncStatus,
  AccessLevel,
  RealtimeCanvasUpdate,
  RealtimeCursorUpdate,
  RealtimeMetaUpdate,
  RealtimeSyncRequest,
  RealtimeSyncResponse,
} from '../lib/types';
import { getLocalBoard, saveLocalBoard, isBoardLocallyCreated, markBoardAsCreated, getBoardCreatorGuestId } from '../lib/storage';
import {
  sanitizeFilesForBroadcast,
  computeSceneSignature,
  electSyncPeer,
  pruneStaleTombstones,
  takeChangedElements,
  takeChangedFiles,
} from '../lib/realtimeUtils';
import { renderBoardThumbnail, THUMBNAIL_INTERVAL_MS } from '../lib/thumbnail';
import { useAuth } from './useAuth';
import { debounce, throttle } from '../lib/utils';
import { optimizeAndUploadImage } from '../lib/imageOptimizer';
import { setBoardTrashed } from '../lib/boardTrash';
import { fetchBoardVersion, snapshotBoard, buildRestoredElements } from '../lib/boardVersions';
import { t } from '../i18n';

interface UseRealtimeBoardOptions {
  boardId: string;
}

export function useRealtimeBoard({ boardId }: UseRealtimeBoardOptions) {
  const { effectiveUserId, effectiveUserName, guestProfile, user } = useAuth();

  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');
  const [onlineCollaborators, setOnlineCollaborators] = useState<CollaboratorUser[]>([]);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  // References to keep latest values in callbacks without stale closures
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  apiRef.current = excalidrawAPI;

  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  const isRemoteUpdateRef = useRef<boolean>(false);
  const channelRef = useRef<any>(null);
  const channelStatusRef = useRef<string>('CLOSED');
  const joinedAtRef = useRef<number>(Date.now());
  const collaboratorsMapRef = useRef<Map<SocketId, Collaborator>>(new Map());
  const onlineCollaboratorsRef = useRef<Map<string, CollaboratorUser>>(new Map());
  const lastChangeSignatureRef = useRef<string>('');
  const lastSentCursorRef = useRef<{ x: number; y: number; button?: string } | null>(null);
  const processedFilesRef = useRef<Set<string>>(new Set());
  // Delta broadcasts: what this client already sent (or received) on the current channel
  const sentVersionsRef = useRef<Map<string, number>>(new Map());
  const sentFilesRef = useRef<Map<string, string>>(new Map());
  const lastSentBackgroundRef = useRef<string | undefined>(undefined);
  // Dashboard thumbnails: rendered at most every THUMBNAIL_INTERVAL_MS, flushed on leave
  const lastThumbnailAtRef = useRef<number>(0);
  const thumbnailDirtyRef = useRef<boolean>(false);
  const thumbnailsSupportedRef = useRef<boolean>(true);

  // Determine permissions accurately:
  // - If board has owner_id, current user must match owner_id.
  // - If board has no owner_id (guest board), current browser must be the creator session.
  // Visitors who open the link in another browser or after session reset do NOT own the board!
  const creatorGuestId = getBoardCreatorGuestId(boardId);
  const isOwner = board?.owner_id
    ? board.owner_id === user?.id
    : (isBoardLocallyCreated(boardId) && (!creatorGuestId || creatorGuestId === guestProfile.id));
  // Trashed boards are read-only for everyone until the owner restores them
  const isTrashed = !!board?.deleted_at;
  const canEdit = !isTrashed && (board?.access_level === 'edit' || isOwner);
  const isViewMode = !canEdit;

  const isOwnerRef = useRef<boolean>(isOwner);
  isOwnerRef.current = isOwner;

  const canEditRef = useRef<boolean>(canEdit);
  canEditRef.current = canEdit;

  const effectiveUserIdRef = useRef<string>(effectiveUserId);
  effectiveUserIdRef.current = effectiveUserId;

  const effectiveUserNameRef = useRef<string>(effectiveUserName);
  effectiveUserNameRef.current = effectiveUserName;

  const guestProfileRef = useRef(guestProfile);
  guestProfileRef.current = guestProfile;

  // 1. Initial Load: Fetch from Supabase, fallback to local storage
  useEffect(() => {
    let isMounted = true;

    async function loadBoard() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('boards')
          .select('*')
          .eq('id', boardId)
          .setHeader(BOARD_ID_HEADER, boardId)
          .single();

        if (data && !error) {
          if (isMounted) {
            setBoard(data as Board);
            saveLocalBoard(data as Board);
            setLoading(false);
          }
          return;
        }
      } catch (err) {
        console.warn('Falha ao buscar quadro no Supabase, tentando armazenamento local:', err);
      }

      // Unmounted meanwhile (navigation, StrictMode remount): never fall through to creating
      // a blank board, which would overwrite a cached board that was not synced yet
      if (!isMounted) return;

      // Check local cache
      const cached = getLocalBoard(boardId);
      if (cached) {
        setBoard(cached);
        setLoading(false);
        return;
      }

      // If brand new board not found anywhere, initialize new board
      const newBoard: Board = {
        id: boardId,
        title: t('board.untitled'),
        owner_id: user?.id || null,
        elements: [],
        app_state: {
          viewBackgroundColor: '#ffffff',
          currentItemStrokeColor: '#1e1e1e',
          currentItemBackgroundColor: 'transparent',
        },
        files: {},
        access_level: 'edit',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      markBoardAsCreated(boardId);
      setBoard(newBoard);
      saveLocalBoard(newBoard);
      setLoading(false);

      // Try creating in Supabase
      (async () => {
        try {
          const { error } = await supabase.from('boards').insert(newBoard);
          if (error) {
            console.warn('Não foi possível persistir novo quadro inicialmente no Supabase:', error.message);
          }
        } catch (e) {
          // Ignore network errors on init
        }
      })();
    }

    loadBoard();

    return () => {
      isMounted = false;
    };
  }, [boardId]);

  // 2. Associate unowned board to user if authenticated without unmounting
  useEffect(() => {
    if (!user?.id || !boardRef.current) return;
    const creator = getBoardCreatorGuestId(boardId);
    const isCurrentGuestCreator = !creator || creator === guestProfile.id;
    if (boardRef.current.owner_id === null && isBoardLocallyCreated(boardId) && isCurrentGuestCreator) {
      const updated: Board = {
        ...boardRef.current,
        owner_id: user.id,
        updated_at: new Date().toISOString(),
      };
      boardRef.current = updated;
      setBoard(updated);
      saveLocalBoard(updated);
      supabase
        .from('boards')
        .update({ owner_id: user.id })
        .eq('id', boardId)
        .setHeader(BOARD_ID_HEADER, boardId)
        .is('owner_id', null)
        .then();
    }
  }, [user?.id, boardId, guestProfile.id]);

  // 3. Debounced Database Save
  // Uses UPDATE for mutable canvas fields instead of UPSERT to avoid PostgREST INSERT RLS rejection for non-owner collaborators
  const debouncedSaveToDb = useRef(
    debounce(async (boardData: Board) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        saveLocalBoard(boardData);
        setSyncStatus('offline');
        return;
      }

      setSyncStatus('saving');
      try {
        const elements = pruneStaleTombstones(boardData.elements);

        let thumbnail: string | null = null;
        if (thumbnailsSupportedRef.current) {
          if (Date.now() - lastThumbnailAtRef.current >= THUMBNAIL_INTERVAL_MS) {
            lastThumbnailAtRef.current = Date.now();
            thumbnailDirtyRef.current = false;
            thumbnail = await renderBoardThumbnail(elements, boardData.files);
            if (thumbnail === null) thumbnailDirtyRef.current = true;
          } else {
            thumbnailDirtyRef.current = true;
          }
        }

        saveLocalBoard({ ...boardData, elements, ...(thumbnail !== null ? { thumbnail } : {}) });

        const sceneUpdate = {
          elements,
          app_state: boardData.app_state,
          files: boardData.files,
          updated_at: new Date().toISOString(),
        };
        let { error, data } = await supabase
          .from('boards')
          .update(thumbnail !== null ? { ...sceneUpdate, thumbnail } : sceneUpdate)
          .eq('id', boardData.id)
          .setHeader(BOARD_ID_HEADER, boardData.id)
          .select('id');

        // Database without the thumbnail migration yet: keep saving the scene without previews
        if (error && thumbnail !== null && error.message.includes('thumbnail')) {
          thumbnailsSupportedRef.current = false;
          ({ error, data } = await supabase
            .from('boards')
            .update(sceneUpdate)
            .eq('id', boardData.id)
            .setHeader(BOARD_ID_HEADER, boardData.id)
            .select('id'));
        }

        if (error) {
          console.warn('Erro ao salvar no Supabase:', error.message);
          setSyncStatus('error');
          // The owner moved the board to the trash while it was open here: switch to read-only
          if (error.message.includes('lixeira')) {
            setBoard((prev) => (prev && !prev.deleted_at ? { ...prev, deleted_at: new Date().toISOString() } : prev));
          }
        } else if (!data || data.length === 0) {
          // If board is not in remote database yet and current user is owner, insert it
          if (isOwnerRef.current) {
            const { error: insertErr } = await supabase.from('boards').insert(boardData);
            if (insertErr) {
              console.warn('Erro ao inserir novo quadro no Supabase:', insertErr.message);
              setSyncStatus('error');
            } else {
              setSyncStatus('saved');
            }
          } else {
            setSyncStatus('saved');
          }
        } else {
          setSyncStatus('saved');
        }
      } catch (e) {
        console.warn('Falha no salvamento remoto:', e);
        setSyncStatus('error');
      }
    }, 1200)
  ).current;

  // 3.1 On leave: save pending changes now and make sure the dashboard thumbnail is current
  useEffect(() => {
    return () => {
      if (!canEditRef.current || !thumbnailsSupportedRef.current) return;
      lastThumbnailAtRef.current = 0; // a pending save renders a fresh thumbnail
      debouncedSaveToDb.flush();

      const current = boardRef.current;
      if (!thumbnailDirtyRef.current || !current) return;
      thumbnailDirtyRef.current = false;
      const elements = pruneStaleTombstones(current.elements);
      renderBoardThumbnail(elements, current.files).then((thumbnail) => {
        if (thumbnail === null) return;
        saveLocalBoard({ ...current, elements, thumbnail });
        supabase.from('boards').update({ thumbnail }).eq('id', current.id).setHeader(BOARD_ID_HEADER, current.id).then();
      });
    };
  }, [boardId, debouncedSaveToDb]);

  // 4. Debounced Broadcast of Canvas Changes (sanitizes files to keep heavy base64 dataURLs local)
  const debouncedBroadcastCanvas = useRef(
    debounce((elements: readonly ExcalidrawElement[], appState: AppState, files?: Record<string, any>) => {
      if (!channelRef.current) return;

      // Only send what peers do not have yet; they merge it with reconcileElements
      const changedElements = takeChangedElements(elements, sentVersionsRef.current);
      const changedFiles = takeChangedFiles(sanitizeFilesForBroadcast(files), sentFilesRef.current);
      const backgroundChanged = appState.viewBackgroundColor !== lastSentBackgroundRef.current;
      if (changedElements.length === 0 && !changedFiles && !backgroundChanged) return;
      lastSentBackgroundRef.current = appState.viewBackgroundColor;

      const payload: RealtimeCanvasUpdate = {
        type: 'canvas-update',
        boardId,
        elements: changedElements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
        },
        files: changedFiles,
        senderId: effectiveUserIdRef.current,
        timestamp: Date.now(),
      };

      channelRef.current.send({
        type: 'broadcast',
        event: 'canvas-update',
        payload,
      });
    }, 80)
  ).current;

  // 5. Throttled Cursor Broadcast (prevents flooding WebSocket and dropping messages)
  // Adjusted from 40ms to 90ms to save >55% bandwidth while preserving smooth visual motion
  const throttledBroadcastCursor = useRef(
    throttle((payload: RealtimeCursorUpdate) => {
      if (!channelRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      channelRef.current.send({
        type: 'broadcast',
        event: 'cursor-update',
        payload,
      });
    }, 90)
  ).current;

  // 6. Supabase Realtime Channel (Broadcast + Presence + Room Sync)
  useEffect(() => {
    if (!boardId) return;

    const channelName = `heeey:room:${boardId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: effectiveUserId,
        },
        broadcast: {
          self: false,
        },
      },
    });

    channelRef.current = channel;

    // New channel: the next local change is broadcast in full once, then as deltas
    sentVersionsRef.current = new Map();
    sentFilesRef.current = new Map();
    lastSentBackgroundRef.current = undefined;

    // Elements and files received from peers do not need to be echoed back
    const markReceived = (elements: readonly any[], files?: Record<string, any>) => {
      for (const el of elements) {
        const sent = sentVersionsRef.current.get(el.id);
        if (sent === undefined || el.version > sent) sentVersionsRef.current.set(el.id, el.version);
      }
      if (files) takeChangedFiles(files, sentFilesRef.current);
    };

    // Presence: track online users with deduplication
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const usersMap = new Map<string, CollaboratorUser>();

        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (!usersMap.has(p.id)) {
              usersMap.set(p.id, {
                id: p.id,
                name: p.name || t('header.guest'),
                color: p.color || { background: '#f3e8ff', stroke: '#a855f7' },
                cursor: p.cursor || null,
                isCurrentUser: p.id === effectiveUserId,
                updatedAt: p.updatedAt || Date.now(),
              });
            }
          });
        });

        onlineCollaboratorsRef.current = usersMap;
        const usersList = Array.from(usersMap.values());
        setOnlineCollaborators(usersList);

        // Clean up cursor pointers for users that have left
        let mapChanged = false;
        collaboratorsMapRef.current.forEach((_, socketId) => {
          if (!usersMap.has(socketId as string)) {
            collaboratorsMapRef.current.delete(socketId);
            mapChanged = true;
          }
        });

        if (mapChanged && apiRef.current) {
          apiRef.current.updateScene({
            collaborators: new Map(collaboratorsMapRef.current),
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: any) => {
          const socketIdKey = p.id as SocketId;
          if (collaboratorsMapRef.current.has(socketIdKey)) {
            collaboratorsMapRef.current.delete(socketIdKey);
            if (apiRef.current) {
              apiRef.current.updateScene({
                collaborators: new Map(collaboratorsMapRef.current),
              });
            }
          }
        });
      })
      // Broadcast: Canvas updates
      .on('broadcast', { event: 'canvas-update' }, ({ payload }: { payload: RealtimeCanvasUpdate }) => {
        if (!payload || payload.senderId === effectiveUserId) return;

        const api = apiRef.current;
        if (!api) return;

        const currentElements = api.getSceneElementsIncludingDeleted();
        const currentAppState = api.getAppState();

        isRemoteUpdateRef.current = true;
        try {
          const reconciled = reconcileElements(
            currentElements,
            payload.elements as any,
            currentAppState
          );
          markReceived(payload.elements, payload.files);

          // Sync binary files into Excalidraw if present in the broadcast and has valid dataURL
          if (payload.files && Object.keys(payload.files).length > 0) {
            const filesWithData = Object.values(payload.files).filter(
              (f: any) => f && typeof f.dataURL === 'string' && f.dataURL.length > 0
            );
            if (filesWithData.length > 0) {
              api.addFiles(filesWithData as any);
            }
          }

          // Update signature to match reconciled state so synchronous or queued onChange will not re-broadcast,
          // but subsequent user drawing strokes will have a distinct signature and NOT be dropped!
          lastChangeSignatureRef.current = computeSceneSignature(
            reconciled,
            payload.appState?.viewBackgroundColor || currentAppState.viewBackgroundColor,
            Object.keys(api.getFiles() || {}).length
          );

          api.updateScene({
            elements: reconciled,
            appState: payload.appState?.viewBackgroundColor
              ? { viewBackgroundColor: payload.appState.viewBackgroundColor }
              : undefined,
          });

          // Also update board state in background
          setBoard((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              elements: reconciled as any,
              app_state: {
                ...prev.app_state,
                ...(payload.appState || {}),
              },
              files: {
                ...prev.files,
                ...(payload.files || {}),
              },
              updated_at: new Date().toISOString(),
            };
            saveLocalBoard(updated);
            return updated;
          });
        } finally {
          // Reset flag synchronously to avoid dropping user drawing strokes in the next frame
          isRemoteUpdateRef.current = false;
        }
      })
      // Broadcast: Cursor updates with reliable nicknames and colors
      .on('broadcast', { event: 'cursor-update' }, ({ payload }: { payload: RealtimeCursorUpdate }) => {
        if (!payload || payload.senderId === effectiveUserId) return;

        const api = apiRef.current;
        if (!api) return;

        // Extract collaborator info from payload or presence map
        const knownCollab = onlineCollaboratorsRef.current.get(payload.senderId);
        const name = payload.username || knownCollab?.name || t('common.collaborator');
        const color = payload.color || knownCollab?.color || { background: '#e0e7ff', stroke: '#6366f1' };

        const newCollaborator: Collaborator = {
          id: payload.senderId,
          username: name,
          color,
          pointer: payload.cursor
            ? {
                x: payload.cursor.x,
                y: payload.cursor.y,
                tool: payload.cursor.tool || 'pointer',
              }
            : undefined,
          button: payload.button || 'up',
          selectedElementIds: payload.selectedElementIds as any,
        };

        const socketIdKey = payload.senderId as SocketId;
        collaboratorsMapRef.current.set(socketIdKey, newCollaborator);

        api.updateScene({
          collaborators: new Map(collaboratorsMapRef.current),
        });
      })
      // Broadcast: Room Sync Request (elect a single peer to respond, avoiding thundering herd)
      .on('broadcast', { event: 'sync-request' }, ({ payload }: { payload: RealtimeSyncRequest }) => {
        if (!payload || payload.senderId === effectiveUserIdRef.current) return;
        const api = apiRef.current;
        if (!api) return;

        const presence = channelRef.current?.presenceState?.();
        const currentOwnerId = boardRef.current?.owner_id;
        const electedId = electSyncPeer(
          presence,
          currentOwnerId,
          effectiveUserIdRef.current,
          payload.senderId
        );

        // Only the elected peer responds
        if (electedId === effectiveUserIdRef.current) {
          const elements = api.getSceneElementsIncludingDeleted();
          if (elements && elements.length > 0 && channelRef.current) {
            const syncResponse: RealtimeSyncResponse = {
              type: 'sync-response',
              boardId,
              elements,
              appState: {
                viewBackgroundColor: api.getAppState().viewBackgroundColor,
              },
              files: sanitizeFilesForBroadcast(api.getFiles()),
              senderId: effectiveUserIdRef.current,
            };
            channelRef.current.send({
              type: 'broadcast',
              event: 'sync-response',
              payload: syncResponse,
            });
          }
        }
      })
      // Broadcast: Room Sync Response (received latest scene from existing peer)
      .on('broadcast', { event: 'sync-response' }, ({ payload }: { payload: RealtimeSyncResponse }) => {
        if (!payload || payload.senderId === effectiveUserIdRef.current) return;
        const api = apiRef.current;
        if (!api) return;

        const currentElements = api.getSceneElementsIncludingDeleted();
        // If current canvas is empty or peer has more/newer elements, reconcile
        if (currentElements.length === 0 || payload.elements.length > currentElements.length) {
          isRemoteUpdateRef.current = true;
          try {
            const reconciled = reconcileElements(
              currentElements,
              payload.elements as any,
              api.getAppState()
            );
            markReceived(payload.elements, payload.files);

            if (payload.files) {
              const filesWithData = Object.values(payload.files).filter(
                (f: any) => f && typeof f.dataURL === 'string' && f.dataURL.length > 0
              );
              if (filesWithData.length > 0) {
                api.addFiles(filesWithData as any);
              }
            }

            lastChangeSignatureRef.current = computeSceneSignature(
              reconciled,
              payload.appState?.viewBackgroundColor || api.getAppState().viewBackgroundColor,
              Object.keys(api.getFiles() || {}).length
            );

            api.updateScene({
              elements: reconciled,
              appState: payload.appState?.viewBackgroundColor
                ? { viewBackgroundColor: payload.appState.viewBackgroundColor }
                : undefined,
            });
          } finally {
            isRemoteUpdateRef.current = false;
          }
        }
      })
      // Broadcast: Meta updates (title, access_level, trash state)
      .on('broadcast', { event: 'meta-update' }, ({ payload }: { payload: RealtimeMetaUpdate }) => {
        if (!payload || payload.senderId === effectiveUserIdRef.current) return;

        setBoard((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            ...(payload.title !== undefined ? { title: payload.title } : {}),
            ...(payload.accessLevel !== undefined ? { access_level: payload.accessLevel } : {}),
            ...(payload.deletedAt !== undefined ? { deleted_at: payload.deletedAt } : {}),
            updated_at: new Date().toISOString(),
          };
          saveLocalBoard(updated);
          return updated;
        });
      })
      .subscribe(async (status) => {
        channelStatusRef.current = status;
        if (status === 'SUBSCRIBED') {
          joinedAtRef.current = Date.now();
          await channel.track({
            id: effectiveUserIdRef.current,
            name: effectiveUserNameRef.current,
            color: guestProfileRef.current.color,
            joinedAt: joinedAtRef.current,
          });

          // Request latest scene from existing peers in the room
          channel.send({
            type: 'broadcast',
            event: 'sync-request',
            payload: {
              type: 'sync-request',
              boardId,
              senderId: effectiveUserIdRef.current,
            },
          });
        }
      });

    return () => {
      channelStatusRef.current = 'CLOSED';
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, effectiveUserId]);

  // Update room presence without reconnecting WebSocket when nickname or color changes
  useEffect(() => {
    if (channelRef.current && channelStatusRef.current === 'SUBSCRIBED') {
      channelRef.current.track({
        id: effectiveUserId,
        name: effectiveUserName,
        color: guestProfile.color,
        joinedAt: joinedAtRef.current,
      });
    }
  }, [effectiveUserId, effectiveUserName, guestProfile.color]);

  // 6.1 Handle tab visibility change to pause cursor broadcasts and clear cursor on peers' screens
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        throttledBroadcastCursor.cancel();
        if (channelRef.current && lastSentCursorRef.current !== null) {
          lastSentCursorRef.current = null;
          channelRef.current.send({
            type: 'broadcast',
            event: 'cursor-update',
            payload: {
              type: 'cursor-update',
              boardId,
              senderId: effectiveUserId,
              username: effectiveUserName,
              color: guestProfile.color,
              cursor: null,
            },
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [boardId, effectiveUserId, effectiveUserName, guestProfile.color, throttledBroadcastCursor]);

  // 7. Excalidraw Change Handler with change detection filter (no spamming on pan/zoom)
  const handleCanvasChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      // Avoid looping if the change originated from a remote broadcast
      if (isRemoteUpdateRef.current) return;
      if (!canEdit) return;

      const currentBoard = boardRef.current;
      if (!currentBoard) return;

      // Filter out pure viewport changes (scroll, zoom, selection)
      // by computing a signature of the actual canvas elements and files
      const signature = computeSceneSignature(
        elements,
        appState.viewBackgroundColor,
        Object.keys(files || {}).length
      );

      if (signature === lastChangeSignatureRef.current) {
        return;
      }
      lastChangeSignatureRef.current = signature;

      const updatedBoard: Board = {
        ...currentBoard,
        elements: elements as any[],
        app_state: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
          theme: appState.theme,
        },
        files: files || {},
        updated_at: new Date().toISOString(),
      };

      boardRef.current = updatedBoard;
      setBoard(updatedBoard);

      // Debounced real-time broadcast to room (including binary files metadata)
      debouncedBroadcastCanvas(elements, appState, files);

      // Debounced persistence to database & local storage
      debouncedSaveToDb(updatedBoard);

      // Automatic background optimization for any newly added raw image files
      if (files) {
        Object.entries(files).forEach(([fileId, fileData]) => {
          if (
            fileData?.dataURL &&
            typeof fileData.dataURL === 'string' &&
            fileData.dataURL.startsWith('data:image/') &&
            !fileData.dataURL.startsWith('data:image/svg+xml') &&
            !(fileData as any)._optimized &&
            !processedFilesRef.current.has(fileId)
          ) {
            processedFilesRef.current.add(fileId);
            optimizeAndUploadImage(boardId, fileId, fileData.dataURL)
              .then((result) => {
                if (result && result.dataURL !== fileData.dataURL) {
                  const updatedFileRecord = {
                    id: fileId as any,
                    dataURL: result.dataURL as any,
                    mimeType: result.mimeType as any,
                    created: fileData.created || Date.now(),
                    _optimized: true,
                  };

                  apiRef.current?.addFiles([updatedFileRecord]);

                  setBoard((prev) => {
                    if (!prev) return prev;
                    const updatedFiles = {
                      ...prev.files,
                      [fileId]: {
                        ...prev.files?.[fileId],
                        ...updatedFileRecord,
                      },
                    };
                    const updatedBoardWithFile: Board = {
                      ...prev,
                      files: updatedFiles,
                      updated_at: new Date().toISOString(),
                    };
                    boardRef.current = updatedBoardWithFile;
                    saveLocalBoard(updatedBoardWithFile);
                    debouncedSaveToDb(updatedBoardWithFile);
                    // Broadcast updated storage URL to peers
                    debouncedBroadcastCanvas(elements, appState, updatedFiles);
                    return updatedBoardWithFile;
                  });
                }
              })
              .catch((err) => {
                console.warn('Erro ao otimizar imagem de fundo:', err);
              });
          }
        });
      }
    },
    [boardId, canEdit, debouncedBroadcastCanvas, debouncedSaveToDb]
  );

  // 8. Pointer & Cursor movement handler (Throttled + 3px Euclidean Filter + Tab Visibility)
  const handlePointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number; tool: 'pointer' | 'laser' };
      button: 'down' | 'up';
      pointersMap: any;
    }) => {
      if (!channelRef.current) return;

      // 1. Pause broadcast when tab is hidden to save realtime quota
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      if (!payload.pointer) {
        if (lastSentCursorRef.current !== null) {
          lastSentCursorRef.current = null;
          throttledBroadcastCursor.cancel();
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'cursor-update',
              payload: {
                type: 'cursor-update',
                boardId,
                senderId: effectiveUserId,
                username: effectiveUserName,
                color: guestProfile.color,
                cursor: null,
                button: payload.button,
              },
            });
          }
        }
        return;
      }

      // 2. Filter out micro-movements (< 3px euclidean distance threshold) unless button changed
      if (lastSentCursorRef.current) {
        const dx = payload.pointer.x - lastSentCursorRef.current.x;
        const dy = payload.pointer.y - lastSentCursorRef.current.y;
        const dist = Math.hypot(dx, dy);
        const buttonChanged = lastSentCursorRef.current.button !== payload.button;

        if (dist < 3 && !buttonChanged) {
          return;
        }
      }

      lastSentCursorRef.current = {
        x: payload.pointer.x,
        y: payload.pointer.y,
        button: payload.button,
      };

      throttledBroadcastCursor({
        type: 'cursor-update',
        boardId,
        senderId: effectiveUserId,
        username: effectiveUserName,
        color: guestProfile.color,
        cursor: payload.pointer,
        button: payload.button,
      });
    },
    [boardId, effectiveUserId, effectiveUserName, guestProfile.color, throttledBroadcastCursor]
  );

  // 9. Update board title (Enforce read-only mode for viewers)
  const updateTitle = useCallback(
    async (newTitle: string) => {
      if (!canEdit) return; // Viewers in read-only mode cannot rename board
      const trimmed = newTitle.trim() || t('board.untitled');
      if (!boardRef.current) return;

      const updated: Board = {
        ...boardRef.current,
        title: trimmed,
        updated_at: new Date().toISOString(),
      };

      boardRef.current = updated;
      setBoard(updated);
      saveLocalBoard(updated);

      // Broadcast meta change
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'meta-update',
          payload: {
            type: 'meta-update',
            boardId,
            title: trimmed,
            senderId: effectiveUserId,
          },
        });
      }

      // Save to Supabase
      try {
        await supabase
          .from('boards')
          .update({ title: trimmed, updated_at: new Date().toISOString() })
          .eq('id', boardId)
          .setHeader(BOARD_ID_HEADER, boardId);
      } catch (err) {
        console.warn('Erro ao atualizar título no banco:', err);
      }
    },
    [boardId, canEdit, effectiveUserId]
  );

  // Online / Offline network listeners
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('saved');
      if (boardRef.current) {
        debouncedSaveToDb(boardRef.current);
      }
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [debouncedSaveToDb]);

  // 10. Update access level (Only owner should call this)
  const updateAccessLevel = useCallback(
    async (level: AccessLevel) => {
      if (!boardRef.current) return;

      const updated: Board = {
        ...boardRef.current,
        access_level: level,
        updated_at: new Date().toISOString(),
      };

      boardRef.current = updated;
      setBoard(updated);
      saveLocalBoard(updated);

      // Broadcast to room
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'meta-update',
          payload: {
            type: 'meta-update',
            boardId,
            accessLevel: level,
            senderId: effectiveUserId,
          },
        });
      }

      // Save to Supabase
      try {
        await supabase
          .from('boards')
          .update({ access_level: level, updated_at: new Date().toISOString() })
          .eq('id', boardId)
          .setHeader(BOARD_ID_HEADER, boardId);
      } catch (err) {
        console.warn('Erro ao atualizar permissão no banco:', err);
      }
    },
    [boardId, effectiveUserId]
  );

  // 11. Restore from trash (only the owner is allowed by the server)
  const restoreBoard = useCallback(async () => {
    if (!boardRef.current || !isOwnerRef.current) return false;
    // 'not-found' means the board never reached Supabase, so restoring it locally is enough
    const result = await setBoardTrashed(boardId, false);
    if (result === 'error' || !boardRef.current) return false;

    const updated: Board = { ...boardRef.current, deleted_at: null };
    boardRef.current = updated;
    setBoard(updated);
    saveLocalBoard(updated);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'meta-update',
        payload: {
          type: 'meta-update',
          boardId,
          deletedAt: null,
          senderId: effectiveUserIdRef.current,
        },
      });
    }
    return true;
  }, [boardId]);

  // 12. Restore a version from the history. The current state is saved first so the
  // restore can itself be undone; the result goes through the normal save/broadcast path.
  const restoreVersion = useCallback(
    async (versionId: string) => {
      const api = apiRef.current;
      if (!api || !canEdit) return false;

      const version = await fetchBoardVersion(boardId, versionId);
      if (!version) return false;
      await debouncedSaveToDb.flush();
      if (!(await snapshotBoard(boardId))) return false;

      const restored = buildRestoredElements(api.getSceneElementsIncludingDeleted(), version.elements || []);
      const files = Object.values(version.files || {}).filter(
        (f: any) => f && typeof f.dataURL === 'string' && f.dataURL.length > 0
      );
      if (files.length > 0) api.addFiles(files as any);

      api.updateScene({
        elements: restored,
        appState: version.app_state?.viewBackgroundColor
          ? { viewBackgroundColor: version.app_state.viewBackgroundColor }
          : undefined,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      handleCanvasChange(api.getSceneElementsIncludingDeleted(), api.getAppState(), api.getFiles());
      return true;
    },
    [boardId, canEdit, debouncedSaveToDb, handleCanvasChange]
  );

  return {
    board,
    loading,
    syncStatus,
    onlineCollaborators,
    canEdit,
    isViewMode,
    isTrashed,
    isOwner,
    excalidrawAPI,
    setExcalidrawAPI,
    handleCanvasChange,
    handlePointerUpdate,
    updateTitle,
    updateAccessLevel,
    restoreBoard,
    restoreVersion,
  };
}
