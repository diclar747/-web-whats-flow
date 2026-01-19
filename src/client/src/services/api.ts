import { sessionFetch } from '../utils/sessionFetch';

const API_BASE_URL = '';

// Function to get the base API URL based on environment
const getBaseURL = () => {
  // In development with proxy, use relative paths
  // In production, determine based on window location
  if (process.env.NODE_ENV === 'production') {
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}`;
  }
  return ''; // Empty string for relative URLs during development with proxy
};

export const API = {
  // Authentication
  login: `${API_BASE_URL}/api/auth/login`,
  verify: `${API_BASE_URL}/api/auth/verify`,
  adminLogin: `${API_BASE_URL}/api/admin/login`,

  // WhatsApp Session
  qrStatus: `${API_BASE_URL}/api/qr-status`,
  createSession: `${API_BASE_URL}/api/create-session`,
  sessionStatus: (sessionId: string) => `${API_BASE_URL}/api/session/${sessionId}/status`,

  // Messages
  sendMessage: `${API_BASE_URL}/api/send/message`,
  sendImage: `${API_BASE_URL}/api/send/image`,
  sendMedia: `${API_BASE_URL}/api/send/media`,
  messages: (sessionId: string) => `${API_BASE_URL}/api/messages/${sessionId}`,
  messageHistory: `${API_BASE_URL}/api/history/messages`,
  fullHistory: (sessionId: string) => `${API_BASE_URL}/api/history/full/${sessionId}`,
  markRead: `${API_BASE_URL}/api/messages/mark-read`,
  reactMessage: `${API_BASE_URL}/api/message/react`,
  deleteMessage: `${API_BASE_URL}/api/message/delete`,
  forwardMessage: `${API_BASE_URL}/api/message/forward`,
  getReactions: (messageId: string, sessionId: string) =>
    `${API_BASE_URL}/api/messages/${messageId}/reactions/details?sessionId=${sessionId}`,

  // Chats
  chats: (sessionId: string) => `${API_BASE_URL}/api/chats/${sessionId}`,
  chatStatus: (sessionId: string) => `${API_BASE_URL}/api/chats-status/${sessionId}`,
  forceSync: (sessionId: string) => `${API_BASE_URL}/api/force-sync/${sessionId}`,
  forceSyncGroups: `${API_BASE_URL}/api/force-sync-groups`,

  // Contacts & Groups
  contacts: (sessionId: string) => `${API_BASE_URL}/api/contacts/${sessionId}`,
  groups: (sessionId: string) => `${API_BASE_URL}/api/groups/${sessionId}`,
  syncContacts: `${API_BASE_URL}/api/sync/contacts`,
  syncGroups: `${API_BASE_URL}/api/sync/groups`,
  syncGroupMembers: `${API_BASE_URL}/api/sync/group-members`,
  groupParticipants: (sessionId: string, groupId: string) =>
    `${API_BASE_URL}/api/group/participants/${sessionId}/${groupId}`,
  groupContacts: (sessionId: string, groupId: string) =>
    `${API_BASE_URL}/api/group/contacts/${sessionId}/${groupId}`,
  campaignGroupContacts: (sessionId: string) =>
    `${API_BASE_URL}/api/campaigns/group-contacts/${sessionId}`,

  // Avatars
  avatar: (sessionId: string, jid: string) =>
    `${API_BASE_URL}/api/avatar/${sessionId}/${jid}`,

  // Campaigns
  campaigns: (sessionId: string) => `${API_BASE_URL}/api/campaigns/${sessionId}`,
  createCampaign: `${API_BASE_URL}/api/campaigns/create`,
  startCampaign: (campaignId: string) => `${API_BASE_URL}/api/campaigns/${campaignId}/start`,
  pauseCampaign: (campaignId: string) => `${API_BASE_URL}/api/campaigns/${campaignId}/pause`,
  saveCampaigns: `${API_BASE_URL}/api/campaigns/save`,

  // Kanban
  kanbanBoards: (sessionId: string) => `${API_BASE_URL}/api/kanban/boards/${sessionId}`,
  kanbanContacts: (sessionId: string) => `${API_BASE_URL}/api/kanban/contacts/${sessionId}`,
  addKanbanContact: `${API_BASE_URL}/api/kanban/contacts`,
  moveKanbanContact: `${API_BASE_URL}/api/kanban/contacts/move`,
  moveContactToBoard: `${API_BASE_URL}/api/kanban/move-contact`,
  moveContactsBulk: `${API_BASE_URL}/api/kanban/move-contacts-bulk`,
  deleteKanbanContact: (boardId: string, contactJid: string) =>
    `${API_BASE_URL}/api/kanban/contacts/${boardId}/${contactJid}`,
  deleteKanbanBoard: (boardId: string) => `${API_BASE_URL}/api/kanban/boards/${boardId}`,

  // Media
  uploadMedia: `${API_BASE_URL}/api/upload/media`,

  // Dashboard
  dashboardStats: (sessionId: string) => `${API_BASE_URL}/api/dashboard/stats/${sessionId}`,

  // Agents
  agentsAvailable: `${API_BASE_URL}/api/agents/available`,
  agentChats: (agentId: string) => `${API_BASE_URL}/api/agent/${agentId}/chats`,
  acceptChat: `${API_BASE_URL}/api/agent/chat/accept`,
  rejectChat: `${API_BASE_URL}/api/agent/chat/reject`,
  closeChat: `${API_BASE_URL}/api/agent/chat/close`,
  returnChat: `${API_BASE_URL}/api/agent/chat/return`,
  transferChat: `${API_BASE_URL}/api/agent/chat/transfer`,
  chatTransfer: `${API_BASE_URL}/api/chats/transfer`,

  // Users
  users: `${API_BASE_URL}/api/users`,
  usersStats: `${API_BASE_URL}/api/users/stats`,
  chatAssignments: (sessionId: string) => `${API_BASE_URL}/api/chat-assignments/${sessionId}`,

  // Analytics
  analyticsMessages: (sessionId: string) =>
    `${API_BASE_URL}/api/analytics/messages/${sessionId}`,
  analyticsCampaigns: (sessionId: string) =>
    `${API_BASE_URL}/api/analytics/campaigns/${sessionId}`,

  // Appointments / Calendar
  appointments: (sessionId: string) => `${API_BASE_URL}/api/appointments/${sessionId}`,
  createAppointment: `${API_BASE_URL}/api/appointments`,
  updateAppointment: (id: string | number) => `${API_BASE_URL}/api/appointments/${id}`,
  deleteAppointment: (id: string | number) => `${API_BASE_URL}/api/appointments/${id}`,

  // Health check
  health: `${API_BASE_URL}/api/health`
};

// Export the WhatsApp API functions
export const whatsappAPI = {
  // Function to get QR status
  getQRStatus: async (sessionId: string) => {
    try {
      const response = await sessionFetch(`${API.qrStatus}?sessionId=${sessionId}`);
      return await response.json();
    } catch (error) {
      console.error('Error getting QR status:', error);
      throw error;
    }
  },

  // Function to create a WhatsApp session
  createSession: async (sessionId: string) => {
    try {
      const response = await sessionFetch(API.createSession, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  },

  // Function to get session status
  getSessionStatus: async (sessionId: string) => {
    try {
      const response = await sessionFetch(API.sessionStatus(sessionId));
      return await response.json();
    } catch (error) {
      console.error('Error getting session status:', error);
      throw error;
    }
  },

  // Function to send a message
  sendMessage: async (sessionId: string, number: string, message: string) => {
    try {
      const response = await sessionFetch(API.sendMessage, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, number, message }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Function to send an image
  sendImage: async (sessionId: string, number: string, url: string, caption?: string) => {
    try {
      const response = await sessionFetch(API.sendImage, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, number, url, caption: caption || '' }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error sending image:', error);
      throw error;
    }
  },

  // Function to get messages
  getMessages: async (sessionId: string, number?: string) => {
    try {
      let url = API.messages(sessionId);
      if (number) {
        url += `?number=${encodeURIComponent(number)}`;
      }
      const response = await sessionFetch(url);
      return await response.json();
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  },

  // Function to get chats
  getChats: async (sessionId: string) => {
    try {
      const response = await sessionFetch(API.chats(sessionId));
      return await response.json();
    } catch (error) {
      console.error('Error getting chats:', error);
      throw error;
    }
  },

  // Function to get contacts
  getContacts: async (sessionId: string) => {
    try {
      const response = await sessionFetch(API.contacts(sessionId));
      return await response.json();
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw error;
    }
  },

  // Function to get groups
  getGroups: async (sessionId: string) => {
    try {
      const response = await sessionFetch(API.groups(sessionId));
      return await response.json();
    } catch (error) {
      console.error('Error getting groups:', error);
      throw error;
    }
  }
};

// Export a function to initialize the socket connection
export const initializeSocket = (sessionId?: string) => {
  // Determine the socket URL based on the environment
  let socketUrl = '';
  if (process.env.NODE_ENV === 'production') {
    // For production, use the same protocol and host as the current page
    const protocol = window.location.protocol;
    const host = window.location.host;
    socketUrl = `${protocol}//${host}`;
  } else {
    // For development with proxy, connect directly to the backend
    socketUrl = 'http://localhost:3000';
  }

  // Import socket.io dynamically
  const { io } = require('socket.io-client');
  const options: any = {
    transports: ['websocket', 'polling'], // Specify transport methods
  };

  if (sessionId) {
    options.query = { sessionId };
  }

  return io(socketUrl, options);
};

// Export socket event types (original object for reference)
export const socketEventNames = {
  QR_CODE: 'qr-code',
  CONNECTION_UPDATE: 'connection-update',
  MESSAGE: 'message',
  MESSAGES_READ: 'messages-read',
  MESSAGE_STATUS_UPDATE: 'message-status-update',
  CHAT_STATUS: 'chat-status',
  INITIAL_CHATS: 'initial-chats',
  CONNECTION: 'connection',
  WHATSAPP_DISCONNECTED: 'whatsapp-disconnected',
};

// Export socket utility functions
export const socketEvents = {
  // Functions with flexible parameters to support different calling patterns
  joinSession: (socket?: any, sessionId?: string) => {
    if (socket && sessionId) {
      socket.emit('join-session', sessionId);
    } else if (sessionId) {
      // If only sessionId is provided, it might be the case that socket is obtained from closure
      console.warn('socketEvents.joinSession: socket parameter missing, expected (socket, sessionId)');
    }
  },

  leaveSession: (socket: any, sessionId?: string) => {
    if (socket && sessionId) {
      socket.emit('leave-session', sessionId);
    } else {
      console.warn('socketEvents.leaveSession: expected (socket, sessionId)');
    }
  },

  onNewMessage: (socket: any, sessionIdOrCallback: any, callback?: (message: any) => void) => {
    if (socket && callback) {
      socket.on(socketEventNames.MESSAGE, callback);
    } else if (socket && sessionIdOrCallback && typeof sessionIdOrCallback === 'function') {
      socket.on(socketEventNames.MESSAGE, sessionIdOrCallback);
    } else {
      console.warn('socketEvents.onNewMessage: expected (socket, callback) or (socket, sessionId, callback)');
    }
  },

  onConnectionUpdate: (socket: any, sessionIdOrCallback: any, callback?: (data: any) => void) => {
    if (socket && callback) {
      socket.on(socketEventNames.CONNECTION_UPDATE, callback);
    } else if (socket && sessionIdOrCallback && typeof sessionIdOrCallback === 'function') {
      socket.on(socketEventNames.CONNECTION_UPDATE, sessionIdOrCallback);
    } else {
      console.warn('socketEvents.onConnectionUpdate: expected (socket, callback) or (socket, sessionId, callback)');
    }
  },

  onQRCode: (socket: any, sessionIdOrCallback: any, callback?: (data: any) => void) => {
    if (socket && callback) {
      socket.on(socketEventNames.QR_CODE, callback);
    } else if (socket && sessionIdOrCallback && typeof sessionIdOrCallback === 'function') {
      socket.on(socketEventNames.QR_CODE, sessionIdOrCallback);
    } else {
      console.warn('socketEvents.onQRCode: expected (socket, callback) or (socket, sessionId, callback)');
    }
  },

  onMessageStatusUpdate: (socket: any, sessionIdOrCallback: any, callback?: (data: any) => void) => {
    if (socket && callback) {
      socket.on(socketEventNames.MESSAGE_STATUS_UPDATE, callback);
    } else if (socket && sessionIdOrCallback && typeof sessionIdOrCallback === 'function') {
      socket.on(socketEventNames.MESSAGE_STATUS_UPDATE, sessionIdOrCallback);
    } else {
      console.warn('socketEvents.onMessageStatusUpdate: expected (socket, callback) or (socket, sessionId, callback)');
    }
  },

  onInitialChats: (socket: any, sessionIdOrCallback: any, callback?: (data: any) => void) => {
    if (socket && callback) {
      socket.on(socketEventNames.INITIAL_CHATS, callback);
    } else if (socket && sessionIdOrCallback && typeof sessionIdOrCallback === 'function') {
      socket.on(socketEventNames.INITIAL_CHATS, sessionIdOrCallback);
    } else {
      console.warn('socketEvents.onInitialChats: expected (socket, callback) or (socket, sessionId, callback)');
    }
  },

  onChatStatus: (socket: any, sessionIdOrCallback: any, callback?: (data: any) => void) => {
    if (socket && callback) {
      socket.on(socketEventNames.CHAT_STATUS, callback);
    } else if (socket && sessionIdOrCallback && typeof sessionIdOrCallback === 'function') {
      socket.on(socketEventNames.CHAT_STATUS, sessionIdOrCallback);
    } else {
      console.warn('socketEvents.onChatStatus: expected (socket, callback) or (socket, sessionId, callback)');
    }
  },

  onWhatsAppDisconnected: (socket: any, sessionIdOrCallback: any, callback?: (data: any) => void) => {
    if (socket && callback) {
      socket.on(socketEventNames.WHATSAPP_DISCONNECTED, callback);
    } else if (socket && sessionIdOrCallback && typeof sessionIdOrCallback === 'function') {
      socket.on(socketEventNames.WHATSAPP_DISCONNECTED, sessionIdOrCallback);
    } else {
      console.warn('socketEvents.onWhatsAppDisconnected: expected (socket, callback) or (socket, sessionId, callback)');
    }
  },

  // Additional method needed based on error
  onChatsUpdate: (socket: any, sessionIdOrCallback: any, callback?: () => void) => {
    if (socket && callback) {
      // For initial chats, the event name is dynamic: initial-chats-{sessionId}
      const eventName = `${socketEventNames.INITIAL_CHATS}-${sessionIdOrCallback}`;
      socket.on(eventName, callback);
    } else if (socket && sessionIdOrCallback && typeof sessionIdOrCallback === 'function') {
      // If called with just (socket, callback), we can't form the specific event name
      // In this case, we'll need to know the sessionId from elsewhere
      console.warn('socketEvents.onChatsUpdate: sessionId required to form correct event name');
    } else {
      console.warn('socketEvents.onChatsUpdate: expected (socket, sessionId, callback) or (socket, callback) with known sessionId');
    }
  },

  removeAllListeners: (socket?: any) => {
    if (socket) {
      socket.removeAllListeners();
    } else {
      // If no socket is provided, assume it's called to return a cleanup function
      // or handled in a different way in the calling code
      console.warn('socketEvents.removeAllListeners: socket parameter missing');
    }
  }
};

// Function to get the API base URL for utility functions
const getAPIBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}`;
  }
  return 'http://localhost:3000'; // For development
};

// For backward compatibility, also export the names
export const socketEventsManager = socketEvents;

// Export the utility functions to get URLs
export const getApiBaseUrl = getAPIBaseUrl;