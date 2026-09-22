export type AccessLevel = 'edit' | 'view';

export interface Board {
  id: string;
  title: string;
  owner_id: string | null;
  elements: any[];
  app_state: Record<string, any>;
  files: Record<string, any>;
  access_level: AccessLevel;
  created_at: string;
  updated_at: string;
}

export interface CollaboratorUser {
  id: string;
  name: string;
  color: {
    background: string;
    stroke: string;
  };
  cursor?: {
    x: number;
    y: number;
    tool: 'pointer' | 'laser';
  } | null;
  selectedElementIds?: Record<string, boolean>;
  isCurrentUser?: boolean;
  updatedAt: number;
}

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';

export interface UserProfile {
  id: string;
  email: string | null;
  name: string;
  avatarUrl?: string;
  isAnonymous: boolean;
}

export interface RealtimeCanvasUpdate {
  type: 'canvas-update';
  boardId: string;
  elements: readonly any[];
  appState?: {
    viewBackgroundColor?: string;
  };
  files?: Record<string, any>;
  senderId: string;
  timestamp: number;
}

export interface RealtimeCursorUpdate {
  type: 'cursor-update';
  boardId: string;
  senderId: string;
  username?: string;
  color?: {
    background: string;
    stroke: string;
  };
  cursor: {
    x: number;
    y: number;
    tool: 'pointer' | 'laser';
  } | null;
  button?: 'up' | 'down';
  selectedElementIds?: Record<string, boolean>;
}

export interface RealtimeMetaUpdate {
  type: 'meta-update';
  boardId: string;
  title?: string;
  accessLevel?: AccessLevel;
  senderId: string;
}

export interface RealtimeSyncRequest {
  type: 'sync-request';
  boardId: string;
  senderId: string;
}

export interface RealtimeSyncResponse {
  type: 'sync-response';
  boardId: string;
  elements: readonly any[];
  appState?: {
    viewBackgroundColor?: string;
  };
  files?: Record<string, any>;
  senderId: string;
}

