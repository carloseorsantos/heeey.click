import { useEffect, useRef, useState, useCallback } from 'react';
import type { ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, Collaborator } from '@excalidraw/excalidraw/types';
import { reconcileElements } from '@excalidraw/excalidraw';
import { supabase } from '../lib/supabase';
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
import { getLocalBoard, saveLocalBoard, isBoardLocallyCreated, markBoardAsCreated } from '../lib/storage';
import { useAuth } from './useAuth';
import { debounce, throttle } from '../lib/utils';

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

  // References to keep latest values in callbacks without re-subscribing
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  apiRef.current = excalidrawAPI;

  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  const isRemoteUpdateRef = useRef<boolean>(false);
  const channelRef = useRef<any>(null);
  const collaboratorsMapRef = useRef<Map<SocketId, Collaborator>>(new Map());
  const onlineCollaboratorsRef = useRef<Map<string, CollaboratorUser>>(new Map());
  const lastChangeSignatureRef = useRef<string>('');

  // Determine permissions accurately:
  // - If board has owner_id, current user must match owner_id.
  // - If board has no owner_id (guest board), current browser must be the creator.
  // Visitors who open the link in another browser do NOT own the board!
  const isOwner = board?.owner_id
    ? board.owner_id === user?.id
    : isBoardLocallyCreated(boardId);
  const canEdit = board?.access_level === 'edit' || isOwner;
  const isViewMode = !canEdit;

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

      // Check local cache
      const cached = getLocalBoard(boardId);
      if (cached && isMounted) {
        setBoard(cached);
        setLoading(false);
        return;
      }

      // If brand new board not found anywhere, initialize new board
      const newBoard: Board = {
        id: boardId,
        title: 'Quadro sem título',
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

      if (isMounted) {
        markBoardAsCreated(boardId);
        setBoard(newBoard);
        saveLocalBoard(newBoard);
        setLoading(false);
      }

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
    if (boardRef.current.owner_id === null && isBoardLocallyCreated(boardId)) {
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
        .is('owner_id', null)
        .then();
    }
  }, [user?.id, boardId]);

  // 3. Debounced Database Save
  const debouncedSaveToDb = useRef(
    debounce(async (boardData: Board) => {
      setSyncStatus('saving');
      try {
        saveLocalBoard(boardData);

        const { error } = await supabase.from('boards').upsert({
          id: boardData.id,
          title: boardData.title,
          owner_id: boardData.owner_id,
          elements: boardData.elements,
          app_state: boardData.app_state,
          files: boardData.files,
          access_level: boardData.access_level,
          updated_at: new Date().toISOString(),
        });

        if (error) {
          console.warn('Erro ao salvar no Supabase:', error.message);
          setSyncStatus('saved');
        } else {
          setSyncStatus('saved');
        }
      } catch (e) {
        console.warn('Falha no salvamento remoto:', e);
        setSyncStatus('saved');
      }
    }, 1200)
  ).current;

  // 4. Debounced Broadcast of Canvas Changes
  const debouncedBroadcastCanvas = useRef(
    debounce((elements: readonly ExcalidrawElement[], appState: AppState) => {
      if (!channelRef.current) return;

      const payload: RealtimeCanvasUpdate = {
        type: 'canvas-update',
        boardId,
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
        },
        senderId: effectiveUserId,
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
  const throttledBroadcastCursor = useRef(
    throttle((payload: RealtimeCursorUpdate) => {
      if (!channelRef.current) return;

      channelRef.current.send({
        type: 'broadcast',
        event: 'cursor-update',
        payload,
      });
    }, 40)
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
                name: p.name || 'Convidado',
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
              updated_at: new Date().toISOString(),
            };
            saveLocalBoard(updated);
            return updated;
          });
        } finally {
          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 50);
        }
      })
      // Broadcast: Cursor updates with reliable nicknames and colors
      .on('broadcast', { event: 'cursor-update' }, ({ payload }: { payload: RealtimeCursorUpdate }) => {
        if (!payload || payload.senderId === effectiveUserId) return;

        const api = apiRef.current;
        if (!api) return;

        // Extract collaborator info from payload or presence map
        const knownCollab = onlineCollaboratorsRef.current.get(payload.senderId);
        const name = payload.username || knownCollab?.name || 'Colaborador';
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
      // Broadcast: Room Sync Request (a newly joined peer requests latest scene)
      .on('broadcast', { event: 'sync-request' }, ({ payload }: { payload: RealtimeSyncRequest }) => {
        if (!payload || payload.senderId === effectiveUserId) return;
        const api = apiRef.current;
        if (!api) return;

        const elements = api.getSceneElementsIncludingDeleted();
        if (elements && elements.length > 0 && channelRef.current) {
          const syncResponse: RealtimeSyncResponse = {
            type: 'sync-response',
            boardId,
            elements,
            appState: {
              viewBackgroundColor: api.getAppState().viewBackgroundColor,
            },
            files: api.getFiles(),
            senderId: effectiveUserId,
          };
          channelRef.current.send({
            type: 'broadcast',
            event: 'sync-response',
            payload: syncResponse,
          });
        }
      })
      // Broadcast: Room Sync Response (received latest scene from existing peer)
      .on('broadcast', { event: 'sync-response' }, ({ payload }: { payload: RealtimeSyncResponse }) => {
        if (!payload || payload.senderId === effectiveUserId) return;
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
            api.updateScene({
              elements: reconciled,
              appState: payload.appState?.viewBackgroundColor
                ? { viewBackgroundColor: payload.appState.viewBackgroundColor }
                : undefined,
            });
            if (payload.files) {
              api.addFiles(Object.values(payload.files));
            }
          } finally {
            setTimeout(() => {
              isRemoteUpdateRef.current = false;
            }, 50);
          }
        }
      })
      // Broadcast: Meta updates (title, access_level)
      .on('broadcast', { event: 'meta-update' }, ({ payload }: { payload: RealtimeMetaUpdate }) => {
        if (!payload || payload.senderId === effectiveUserId) return;

        setBoard((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            ...(payload.title !== undefined ? { title: payload.title } : {}),
            ...(payload.accessLevel !== undefined ? { access_level: payload.accessLevel } : {}),
            updated_at: new Date().toISOString(),
          };
          saveLocalBoard(updated);
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: effectiveUserId,
            name: effectiveUserName,
            color: guestProfile.color,
            joinedAt: Date.now(),
          });

          // Request latest scene from existing peers in the room
          channel.send({
            type: 'broadcast',
            event: 'sync-request',
            payload: {
              type: 'sync-request',
              boardId,
              senderId: effectiveUserId,
            },
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, effectiveUserId, effectiveUserName, guestProfile.color]);

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
      const elementsVersionSum = elements.reduce(
        (acc, el) => (acc + el.version + el.versionNonce) % 10000000,
        0
      );
      const signature = `${elements.length}:${elementsVersionSum}:${appState.viewBackgroundColor || ''}:${Object.keys(files || {}).length}`;

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

      // Debounced real-time broadcast to room
      debouncedBroadcastCanvas(elements, appState);

      // Debounced persistence to database & local storage
      debouncedSaveToDb(updatedBoard);
    },
    [canEdit, debouncedBroadcastCanvas, debouncedSaveToDb]
  );

  // 8. Pointer & Cursor movement handler (Throttled)
  const handlePointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number; tool: 'pointer' | 'laser' };
      button: 'down' | 'up';
      pointersMap: any;
    }) => {
      if (!channelRef.current) return;

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

  // 9. Update board title
  const updateTitle = useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim() || 'Quadro sem título';
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
          .eq('id', boardId);
      } catch (err) {
        console.warn('Erro ao atualizar título no banco:', err);
      }
    },
    [boardId, effectiveUserId]
  );

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
          .eq('id', boardId);
      } catch (err) {
        console.warn('Erro ao atualizar permissão no banco:', err);
      }
    },
    [boardId, effectiveUserId]
  );

  return {
    board,
    loading,
    syncStatus,
    onlineCollaborators,
    canEdit,
    isViewMode,
    isOwner,
    excalidrawAPI,
    setExcalidrawAPI,
    handleCanvasChange,
    handlePointerUpdate,
    updateTitle,
    updateAccessLevel,
  };
}
