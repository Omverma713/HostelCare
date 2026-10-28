import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import {
  connectChatSocket,
  disconnectChatSocket,
  joinTicketRoom,
  leaveTicketRoom,
  sendChatMessage,
  editChatMessage,
  deleteChatMessage,
  sendTypingIndicator,
  markTicketMessagesRead,
  addChatListener,
} from '../services/chatSocketService';
import { encryptMessage, decryptMessage } from '../utils/e2eeCrypto';
import './DevChatPage.css';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '277 KB';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(0)) + ' ' + sizes[i];
}

const CATEGORIES = [
  { id: 'Bug Report', label: 'Bug Report', icon: '🐞', color: '#ef4444' },
  { id: 'Feature Request', label: 'Feature Request', icon: '✨', color: '#8b5cf6' },
  { id: 'Technical Help', label: 'Technical Help', icon: '🛠️', color: '#3b82f6' },
  { id: 'UI/UX Suggestion', label: 'UI/UX Design', icon: '🎨', color: '#ec4899' },
  { id: 'Account & Access', label: 'Account / Passwords', icon: '🔐', color: '#f59e0b' },
  { id: 'Other', label: 'General Dev Query', icon: '💬', color: '#10b981' },
];

export default function DevChatPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const isDeveloper = user?.role === 'superadmin';
  const token = localStorage.getItem('token');

  // Socket & Connection State
  const [socketConnected, setSocketConnected] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);

  // Tickets & Active Chat Room State
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('all'); // 'all' | 'open' | 'resolved'
  const [searchQuery, setSearchQuery] = useState('');

  // Input & Media Attachment State
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // { dataUrl, name, size }
  const [zoomedImage, setZoomedImage] = useState(null); // Fullscreen lightbox
  const [sending, setSending] = useState(false);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('Technical Help');
  const [newPriority, setNewPriority] = useState('medium');
  const [newInitialMsg, setNewInitialMsg] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // WhatsApp Image Download & Blur States (Images 2 & 4)
  const [downloadedImages, setDownloadedImages] = useState({});
  const [downloadingImages, setDownloadingImages] = useState({});

  // Message Context Action Menu & Edit States (Long press on mobile, Right click on PC)
  const [activeActionMenu, setActiveActionMenu] = useState(null); // { msg, x, y, canEdit, canDelete, isMine }
  const [editingMessage, setEditingMessage] = useState(null); // { msg, text }
  const [chatNotifsEnabled, setChatNotifsEnabled] = useState(true);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const longPressTimerRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Image Processing & Compression for Fast E2EE Transfer
  const processImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      triggerToast('error', 'Please choose a valid image file (PNG, JPG, WebP)', 'Invalid Media');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setSelectedImage({
          dataUrl: compressedDataUrl,
          name: file.name || 'screenshot.jpg',
          size: Math.round((compressedDataUrl.length * 3) / 4),
        });
        setTimeout(scrollToBottom, 60);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file);
          return;
        }
      }
    }
  };

  useEffect(() => {
    if (partnerTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [partnerTyping]);

  useEffect(() => {
    if (activeTicket) {
      document.body.classList.add('devchat-room-open');
    } else {
      document.body.classList.remove('devchat-room-open');
    }
    return () => {
      document.body.classList.remove('devchat-room-open');
    };
  }, [activeTicket]);

  // 1. Initialize Socket.IO connection
  useEffect(() => {
    if (!token) return;

    const socket = connectChatSocket(token);
    setSocketConnected(Boolean(socket?.connected));

    const removeConnListener = addChatListener('connection_status', ({ connected }) => {
      setSocketConnected(connected);
    });

    return () => {
      removeConnListener();
    };
  }, [token]);

  // 2. Fetch Tickets List
  const loadTickets = useCallback(async () => {
    try {
      setLoadingTickets(true);
      const res = await api.getChatTickets({
        status: ticketFilter !== 'all' ? ticketFilter : undefined,
        search: searchQuery.trim() || undefined,
      });

      if (res.success) {
        setTickets(res.tickets || []);
        // Auto-select first ticket on desktop if none selected
        if (!activeTicket && res.tickets && res.tickets.length > 0 && window.innerWidth > 768) {
          selectTicket(res.tickets[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
      triggerToast('error', err.message || 'Failed to fetch support tickets', 'Dev Chat');
    } finally {
      setLoadingTickets(false);
    }
  }, [ticketFilter, searchQuery]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // 3. Select Ticket & Load Decrypted Messages
  const selectTicket = async (ticket) => {
    if (activeTicket && activeTicket.ticketId !== ticket.ticketId) {
      leaveTicketRoom(activeTicket.ticketId);
    }

    setActiveTicket(ticket);
    setLoadingMessages(true);
    joinTicketRoom(ticket.ticketId);
    markTicketMessagesRead(ticket.ticketId);

    try {
      const res = await api.getChatTicketMessages(ticket.ticketId);
      if (res.success && Array.isArray(res.messages)) {
        // Decrypt messages client-side with ticket's unique E2EE salt
        const decryptedList = await Promise.all(
          res.messages.map(async (msg) => {
            const plainText = await decryptMessage(
              msg.encryptedContent,
              msg.iv,
              ticket.ticketId,
              res.e2eeSalt || ticket.e2eeSalt
            );
            return {
              ...msg,
              text: plainText,
            };
          })
        );
        setMessages(decryptedList);
        setTimeout(scrollToBottom, 80);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      triggerToast('error', 'Failed to retrieve encrypted messages', 'E2EE Chat');
    } finally {
      setLoadingMessages(false);
    }
  };

  // 4. Real-Time Socket Event Listeners for Active Ticket & Global Ticket Updates
  useEffect(() => {
    const partnerTypingTimer = { current: null };

    // Listen for all new messages globally (instant live delivery without reopening)
    const removeMsgListener = addChatListener('new_message', async (incoming) => {
      // If currently viewing this ticket:
      if (activeTicket && String(incoming.ticketId).toUpperCase() === String(activeTicket.ticketId).toUpperCase()) {
        const plainText = await decryptMessage(
          incoming.encryptedContent,
          incoming.iv,
          activeTicket.ticketId,
          activeTicket.e2eeSalt
        );

        setMessages((prev) => {
          // If message already exists by ID, do not duplicate
          if (prev.some((m) => String(m._id) === String(incoming._id))) return prev;
          // Check if replacing an optimistic message
          const tempIdx = prev.findIndex((m) => String(m._id).startsWith('temp_') && m.text === plainText);
          if (tempIdx !== -1) {
            const copy = [...prev];
            copy[tempIdx] = { ...incoming, text: plainText };
            return copy;
          }
          return [...prev, { ...incoming, text: plainText }];
        });

        // Mark as read if from partner
        if (String(incoming.sender) !== String(user?.id || user?._id)) {
          markTicketMessagesRead(activeTicket.ticketId);
        }

        setTimeout(scrollToBottom, 60);
      }

      // Always update ticket card preview in tickets list
      setTickets((prev) =>
        prev.map((t) => {
          if (String(t.ticketId).toUpperCase() === String(incoming.ticketId).toUpperCase()) {
            const isMe = String(incoming.sender) === String(user?.id || user?._id);
            return {
              ...t,
              lastMessage: {
                preview: 'New message',
                senderRole: incoming.senderRole,
                senderName: incoming.senderName,
                at: incoming.createdAt || new Date(),
              },
              unreadStudent: (!isMe && !isDeveloper) ? (t.unreadStudent || 0) + 1 : t.unreadStudent,
              unreadDeveloper: (!isMe && isDeveloper) ? (t.unreadDeveloper || 0) + 1 : t.unreadDeveloper,
            };
          }
          return t;
        })
      );
    });

    const removeJoinedListener = addChatListener('joined_ticket', (data) => {
      if (activeTicket && String(data.ticketId).toUpperCase() === String(activeTicket.ticketId).toUpperCase()) {
        if (data.partnerOnline !== undefined) {
          setPartnerOnline(Boolean(data.partnerOnline));
        }
      }
    });

    const removeTypingListener = addChatListener('typing_change', (data) => {
      if (
        activeTicket &&
        String(data.ticketId).toUpperCase() === String(activeTicket.ticketId).toUpperCase() &&
        String(data.userId) !== String(user?.id || user?._id)
      ) {
        setPartnerTyping(Boolean(data.isTyping));
        if (partnerTypingTimer.current) clearTimeout(partnerTypingTimer.current);
        if (data.isTyping) {
          partnerTypingTimer.current = setTimeout(() => {
            setPartnerTyping(false);
          }, 3500);
        }
      }
    });

    const removePresenceListener = addChatListener('user_presence', (data) => {
      if (String(data.userId) !== String(user?.id || user?._id)) {
        setPartnerOnline(data.status === 'online');
      }
    });

    const removeReadListener = addChatListener('messages_read', (data) => {
      if (activeTicket && String(data.ticketId).toUpperCase() === String(activeTicket.ticketId).toUpperCase()) {
        setMessages((prev) => prev.map((m) => ({ ...m, read: true, delivered: true })));
      }
    });

    const removeDeliveredListener = addChatListener('message_delivered', (data) => {
      if (activeTicket && String(data.ticketId).toUpperCase() === String(activeTicket.ticketId).toUpperCase()) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId || (!m.delivered && String(m.sender) === String(user?.id || user?._id))
              ? { ...m, delivered: true, deliveredAt: data.deliveredAt || new Date().toISOString() }
              : m
          )
        );
      }
    });

    const removeEditListener = addChatListener('message_edited', async (data) => {
      if (activeTicket && String(data.ticketId).toUpperCase() === String(activeTicket.ticketId).toUpperCase()) {
        let plainText = '';
        try {
          plainText = await decryptMessage(
            data.encryptedContent,
            data.iv,
            activeTicket.ticketId,
            activeTicket.e2eeSalt
          );
        } catch (e) {
          plainText = '[Encrypted content]';
        }
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(data._id)
              ? { ...m, ...data, text: plainText, isEdited: true, editedAt: data.editedAt }
              : m
          )
        );
      }
    });

    const removeDeleteListener = addChatListener('message_deleted', (data) => {
      if (activeTicket && String(data.ticketId).toUpperCase() === String(activeTicket.ticketId).toUpperCase()) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(data._id)
              ? { ...m, isDeleted: true, deletedAt: data.deletedAt }
              : m
          )
        );
      }
    });

    const removeActivityListener = addChatListener('ticket_activity', (data) => {
      setTickets((prev) =>
        prev.map((t) =>
          String(t.ticketId).toUpperCase() === String(data.ticketId).toUpperCase()
            ? {
                ...t,
                lastMessage: data.lastMessage || t.lastMessage,
                unreadStudent: !isDeveloper ? data.unreadCount : t.unreadStudent,
                unreadDeveloper: isDeveloper ? data.unreadCount : t.unreadDeveloper,
              }
            : t
        )
      );
    });

    const removeFlushListener = addChatListener('ticket_flushed', (data) => {
      if (data?.ticketId) {
        setTickets((prev) => prev.filter((t) => t.ticketId !== data.ticketId));
        if (activeTicket && activeTicket.ticketId === data.ticketId) {
          setActiveTicket(null);
          triggerToast('info', 'This ticket was permanently flushed by Super Admin.', 'Room Closed');
        }
      }
    });

    const removeChatNotifListener = addChatListener('chat_notification', (data) => {
      if (!activeTicket || activeTicket.ticketId !== data.ticketId) {
        triggerToast('info', `${data.title}: ${data.body}`, 'New Message');
      }
    });

    return () => {
      removeMsgListener();
      removeJoinedListener();
      removeTypingListener();
      removePresenceListener();
      removeReadListener();
      removeDeliveredListener();
      removeEditListener();
      removeDeleteListener();
      removeActivityListener();
      removeFlushListener();
      removeChatNotifListener();
      if (partnerTypingTimer.current) clearTimeout(partnerTypingTimer.current);
    };
  }, [activeTicket, user, isDeveloper]);

  // Load superadmin chat notification preferences
  useEffect(() => {
    if (isDeveloper) {
      api.getChatNotificationConfig()
        .then((res) => {
          if (res?.success && res.config) {
            setChatNotifsEnabled(Boolean(res.config.enabled));
          }
        })
        .catch((err) => console.warn('Could not load chat notification config:', err));
    }
  }, [isDeveloper]);

  const handleToggleNotifs = async () => {
    try {
      const next = !chatNotifsEnabled;
      setChatNotifsEnabled(next);
      await api.updateChatNotificationConfig({ enabled: next });
      triggerToast('info', `Chat push notifications ${next ? 'enabled' : 'disabled'}`, 'Notifications');
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update notification settings', 'Error');
    }
  };

  // Image Download & Spinner Trigger (Images 2 & 4)
  const triggerImageDownload = (msgId) => {
    setDownloadingImages((prev) => ({ ...prev, [msgId]: true }));
    setTimeout(() => {
      setDownloadingImages((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      setDownloadedImages((prev) => ({ ...prev, [msgId]: true }));
    }, 700);
  };

  // Context Menu & Long-Press Handlers for Messages
  const handleContextMenu = (msg, e) => {
    e.preventDefault();
    e.stopPropagation();
    const isMine = String(msg.sender) === String(user?.id || user?._id);
    const canEdit = (isDeveloper || isMine) && !msg.isDeleted && msg.contentType !== 'image';
    const canDelete = isDeveloper && !msg.isDeleted;
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setActiveActionMenu({ msg, x, y, canEdit, canDelete, isMine });
  };

  const handleTouchStart = (msg, e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      const isMine = String(msg.sender) === String(user?.id || user?._id);
      const canEdit = (isDeveloper || isMine) && !msg.isDeleted && msg.contentType !== 'image';
      const canDelete = isDeveloper && !msg.isDeleted;
      const x = Math.min(clientX, window.innerWidth - 200);
      const y = Math.min(clientY, window.innerHeight - 200);
      setActiveActionMenu({ msg, x, y, canEdit, canDelete, isMine });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const handleCopyMessage = (msg) => {
    if (msg.text) {
      navigator.clipboard.writeText(msg.text);
      triggerToast('success', 'Message copied to clipboard', 'Copied');
    }
    setActiveActionMenu(null);
  };

  const handleStartEdit = (msg) => {
    setActiveActionMenu(null);
    setEditingMessage({ msg, text: msg.text || '' });
  };

  const handleConfirmEdit = async () => {
    if (!editingMessage || !editingMessage.text.trim()) return;
    try {
      const { msg, text } = editingMessage;
      const { encryptedContent, iv, authTag } = await encryptMessage(
        text.trim(),
        activeTicket.ticketId,
        activeTicket.e2eeSalt
      );
      await editChatMessage({
        ticketId: activeTicket.ticketId,
        messageId: msg._id,
        encryptedContent,
        iv,
        authTag,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m._id === msg._id
            ? { ...m, text: text.trim(), isEdited: true, editedAt: new Date() }
            : m
        )
      );
      triggerToast('success', 'Message updated successfully', 'Edited');
    } catch (err) {
      triggerToast('error', err.message || 'Failed to edit message', 'Error');
    } finally {
      setEditingMessage(null);
    }
  };

  const handleConfirmDelete = async (msg) => {
    setActiveActionMenu(null);
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await deleteChatMessage({
        ticketId: activeTicket.ticketId,
        messageId: msg._id,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m._id === msg._id ? { ...m, isDeleted: true, deletedAt: new Date() } : m
        )
      );
      triggerToast('success', 'Message deleted', 'Deleted');
    } catch (err) {
      triggerToast('error', err.message || 'Failed to delete message', 'Error');
    }
  };

  // 5. Handle Send Message (Optimistic Live UI + E2EE + Dual Delivery + Image Support)
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const hasText = Boolean(inputText.trim());
    const hasImage = Boolean(selectedImage);
    if ((!hasText && !hasImage) || !activeTicket || sending) return;

    let textToSend = inputText.trim();
    const imageToSend = selectedImage ? selectedImage.dataUrl : null;
    const isImageMessage = Boolean(imageToSend);

    let rawPayload = textToSend;
    let previewText = textToSend;
    if (isImageMessage) {
      rawPayload = JSON.stringify({
        image: imageToSend,
        caption: textToSend,
      });
      previewText = textToSend ? `📷 ${textToSend}` : '📷 Shared Screenshot';
    }

    setInputText('');
    setSelectedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = '42px';
    }
    sendTypingIndicator(activeTicket.ticketId, false);
    setSending(true);

    // 1. Optimistic message preview (zero delay for sender with WhatsApp 🕒 Clock)
    const tempId = `temp_${Date.now()}`;
    const imageSize = selectedImage ? selectedImage.size : 0;
    const optimisticMessage = {
      _id: tempId,
      ticketId: activeTicket.ticketId,
      sender: user?.id || user?._id,
      senderRole: user?.role || 'student',
      senderName: user?.name || 'You',
      text: rawPayload,
      contentType: isImageMessage ? 'image' : 'text',
      mediaSize: imageSize,
      status: 'pending',
      read: false,
      delivered: false,
      createdAt: new Date().toISOString(),
    };

    if (isImageMessage) {
      setDownloadedImages((prev) => ({ ...prev, [tempId]: true }));
    }

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(scrollToBottom, 40);

    // Update tickets list preview immediately
    setTickets((prev) =>
      prev.map((t) =>
        String(t.ticketId).toUpperCase() === String(activeTicket.ticketId).toUpperCase()
          ? {
              ...t,
              lastMessage: {
                preview: previewText,
                senderRole: user?.role || 'student',
                senderName: user?.name || 'You',
                at: new Date(),
              },
            }
          : t
      )
    );

    try {
      // 2. Client-side E2EE encryption using Web Crypto AES-256-GCM
      const { encryptedContent, iv, authTag } = await encryptMessage(
        rawPayload,
        activeTicket.ticketId,
        activeTicket.e2eeSalt
      );

      try {
        const ack = await sendChatMessage({
          ticketId: activeTicket.ticketId,
          encryptedContent,
          iv,
          authTag,
          contentType: isImageMessage ? 'image' : 'text',
          mediaSize: imageSize,
        });
        if (ack && ack.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === tempId
                ? {
                    ...m,
                    _id: ack.messageId,
                    status: 'sent',
                    delivered: ack.message?.delivered || false,
                    read: false,
                    mediaSize: imageSize,
                  }
                : m
            )
          );
          if (isImageMessage) {
            setDownloadedImages((prev) => ({ ...prev, [ack.messageId]: true, [tempId]: true }));
          }
        }
      } catch (socketErr) {
        console.warn('Socket delivery failed, using REST fallback:', socketErr.message);
        const res = await api.sendChatTicketMessage(activeTicket.ticketId, {
          encryptedContent,
          iv,
          authTag,
          contentType: isImageMessage ? 'image' : 'text',
          mediaSize: imageSize,
        });
        if (res.success && res.message) {
          const finalId = res.message._id || tempId;
          setMessages((prev) =>
            prev.map((m) =>
              m._id === tempId
                ? {
                    ...res.message,
                    text: rawPayload,
                    status: 'sent',
                    delivered: res.message.delivered || false,
                  }
                : m
            )
          );
          if (isImageMessage) {
            setDownloadedImages((prev) => ({ ...prev, [finalId]: true, [tempId]: true }));
          }
          setTimeout(scrollToBottom, 60);
        }
      }
    } catch (err) {
      console.error('Failed to send encrypted message:', err);
      triggerToast('error', err.message || 'Failed to deliver message', 'Error');
      // Mark optimistic message as failed with ⚠️ so user knows
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, status: 'failed' } : m))
      );
      if (!isImageMessage) setInputText(textToSend); // Restore unsent text
    } finally {
      setSending(false);
    }
  };

  // Typing change handler with auto-growing textarea
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    // Auto-grow textarea height dynamically based on content (min 42px, max 140px)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      const nextH = Math.min(Math.max(scrollH, 42), 140);
      textareaRef.current.style.height = `${nextH}px`;
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }

    if (!activeTicket) return;

    if (val.trim()) {
      sendTypingIndicator(activeTicket.ticketId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(activeTicket.ticketId, false);
      }, 2500);
    } else {
      sendTypingIndicator(activeTicket.ticketId, false);
    }
  };

  // 6. Handle Create Support Ticket
  const handleCreateTicketSubmit = async (e) => {
    e.preventDefault();
    if (!newSubject.trim() || creatingTicket) return;

    setCreatingTicket(true);
    try {
      const initialText = newInitialMsg.trim();

      const res = await api.createChatTicket({
        subject: newSubject.trim(),
        category: newCategory,
        priority: newPriority,
      });

      if (res.success && res.ticket) {
        // If student provided an initial message, encrypt it with the newly created ticketId & e2eeSalt!
        if (initialText) {
          try {
            const encrypted = await encryptMessage(
              initialText,
              res.ticket.ticketId,
              res.ticket.e2eeSalt
            );

            await api.sendChatTicketMessage(res.ticket.ticketId, {
              encryptedContent: encrypted.encryptedContent,
              iv: encrypted.iv,
              contentType: 'text',
            });
          } catch (initMsgErr) {
            console.warn('Initial message encryption or delivery error:', initMsgErr);
          }
        }

        triggerToast('success', `Ticket ${res.ticket.ticketId} created! Developer assigned.`, 'Ticket Opened 🚀');
        setIsNewTicketModalOpen(false);
        setNewSubject('');
        setNewInitialMsg('');
        await loadTickets();
        selectTicket(res.ticket);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to create ticket', 'Error');
    } finally {
      setCreatingTicket(false);
    }
  };

  // 7. Resolve / Close Ticket
  const handleResolveTicket = async () => {
    if (!activeTicket) return;
    try {
      const isCurrentlyResolved = activeTicket.status === 'resolved';
      const nextStatus = isCurrentlyResolved ? 'open' : 'resolved';
      const res = await api.updateChatTicketStatus(activeTicket.ticketId, nextStatus);
      if (res.success) {
        setActiveTicket((prev) => ({ ...prev, status: nextStatus }));
        setTickets((prev) =>
          prev.map((t) => (t.ticketId === activeTicket.ticketId ? { ...t, status: nextStatus } : t))
        );
        triggerToast('success', isCurrentlyResolved ? 'Ticket reopened' : 'Ticket marked as RESOLVED', 'Ticket Updated');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update ticket status', 'Error');
    }
  };

  // 8. Super Admin Flush Ticket (Permanent Memory & Storage Purge)
  const handleFlushTicket = async () => {
    if (!activeTicket) return;
    const ok = window.confirm(
      `Flush Ticket #${activeTicket.ticketId}?\n\nThis will permanently delete the ticket, all encrypted messages, and media attachments from the database to save storage and server memory.`
    );
    if (!ok) return;

    try {
      const res = await api.flushChatTicket(activeTicket.ticketId);
      if (res.success) {
        triggerToast('success', `Ticket #${activeTicket.ticketId} purged. Storage freed!`, 'Flush Complete');
        const flushedId = activeTicket.ticketId;
        setActiveTicket(null);
        setTickets((prev) => prev.filter((t) => t.ticketId !== flushedId));
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to flush ticket', 'Flush Error');
    }
  };

  return (
    <div className="devchat-root">
      <div className="devchat-ambient-glow" />

      <div className="devchat-container">
        {/* Header Bar */}
        <header className={`devchat-header ${activeTicket ? 'mobile-hidden' : ''}`}>
          <div className="devchat-title-group">
            <div className="devchat-icon-badge">💬</div>
            <div>
              <h1 className="devchat-header-title">
                HostelCare Developer Support Chat
                <span className="e2ee-shield-pill">🔒 End-to-end encrypted</span>
              </h1>
              <p className="devchat-header-subtitle">
                <span>Real-time direct chat between Students & Developers</span>
                <span style={{ opacity: 0.5 }}>•</span>
                <span style={{ color: socketConnected ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                  {socketConnected ? '● Socket Live' : '○ Connecting...'}
                </span>
                <span style={{ opacity: 0.5 }}>•</span>
                <span style={{ color: '#a5b4fc', fontSize: '0.72rem' }}>v1.2.2.12 Pre-Release</span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-new-ticket"
              onClick={() => setIsNewTicketModalOpen(true)}
              id="btn-open-new-ticket-modal"
            >
              ➕ New Support Ticket
            </button>
          </div>
        </header>

        {/* Main Split View */}
        <div className={`devchat-split-view ${activeTicket ? 'chat-active' : ''}`}>
          {/* LEFT: Tickets Pane */}
          <aside className="devchat-tickets-pane">
            <div className="devchat-tickets-header">
              <div className="devchat-tickets-header-top">
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Support Tickets ({tickets.length})
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="tickets-filter-tabs">
                {['all', 'open', 'resolved'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`tickets-filter-tab ${ticketFilter === tab ? 'active' : ''}`}
                    onClick={() => setTicketFilter(tab)}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket # or subject..."
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Tickets List */}
            <div className="devchat-tickets-list">
              {loadingTickets ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Loading support tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  No tickets found. Click "New Support Ticket" to start.
                </div>
              ) : (
                tickets.map((tkt) => {
                  const isSelected = activeTicket?.ticketId === tkt.ticketId;
                  const hasUnread = isDeveloper ? tkt.unreadDeveloper > 0 : tkt.unreadStudent > 0;

                  return (
                    <div
                      key={tkt.ticketId}
                      className={`ticket-item-card ${isSelected ? 'active' : ''}`}
                      onClick={() => selectTicket(tkt)}
                      id={`ticket-card-${tkt.ticketId}`}
                    >
                      <div className="ticket-card-top">
                        <span className="ticket-badge-id">{tkt.ticketId}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`ticket-status-chip ${tkt.status}`}>
                            {tkt.status.replace('_', ' ')}
                          </span>
                          {hasUnread && <span className="ticket-unread-dot" title="Unread messages" />}
                        </div>
                      </div>

                      <div className="ticket-subject-text">{tkt.subject}</div>

                      <div className="ticket-card-meta">
                        <span>
                          {isDeveloper ? `👤 ${tkt.studentName} (${tkt.studentRegNo})` : `👨‍💻 ${tkt.developerName}`}
                        </span>
                        <span>{new Date(tkt.updatedAt || tkt.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* RIGHT: Active Chat Room */}
          <main className="devchat-room-pane">
            {activeTicket ? (
              <>
                {/* Room Header */}
                <div className="devchat-room-header">
                  <div className="room-identity-group">
                    <button
                      type="button"
                      className="room-back-btn"
                      onClick={() => setActiveTicket(null)}
                      title="Back to Tickets"
                    >
                      ←
                    </button>
                    <div>
                      <div className="room-participant-details">
                        <h3>
                          <span className="room-subject-text">{activeTicket.subject}</span>
                          <span className="ticket-badge-id" style={{ fontSize: '0.75rem' }}>
                            ({activeTicket.ticketId})
                          </span>
                          <span className={`partner-online-chip ${partnerTyping ? 'online typing' : partnerOnline ? 'online' : 'offline'}`}>
                            <span className="pulse-dot" />
                            {partnerTyping ? 'typing...' : partnerOnline ? 'Online' : 'Offline'}
                          </span>
                        </h3>
                        <p>
                          {isDeveloper
                            ? `Student: ${activeTicket.studentName} • ${activeTicket.studentRegNo} • Room: ${activeTicket.studentRoom || 'N/A'}`
                            : `Allotted Developer: ${activeTicket.developerName} (Super Admin) • Category: ${activeTicket.category}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="room-actions">
                    {isDeveloper && (
                      <button
                        type="button"
                        onClick={handleToggleNotifs}
                        className="btn-resolve-ticket"
                        style={{
                          background: chatNotifsEnabled ? 'rgba(0, 168, 132, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          borderColor: chatNotifsEnabled ? 'rgba(0, 168, 132, 0.35)' : 'rgba(239, 68, 68, 0.35)',
                          color: chatNotifsEnabled ? 'var(--wa-green-action)' : '#ef4444',
                        }}
                        title="Toggle Support Push Notifications for Mobile & Devices"
                      >
                        {chatNotifsEnabled ? '🔔 Push: ON' : '🔕 Push: OFF'}
                      </button>
                    )}

                    <span className={`ticket-status-chip ${activeTicket.status}`}>
                      {activeTicket.status.replace('_', ' ')}
                    </span>

                    {/* ONLY Super Admin can mark a ticket as resolved */}
                    {activeTicket.status !== 'resolved' && isDeveloper && (
                      <button
                        type="button"
                        className="btn-resolve-ticket"
                        onClick={handleResolveTicket}
                        id="btn-resolve-ticket-action"
                      >
                        ✓ Mark Resolved
                      </button>
                    )}

                    {/* ONLY Student can reopen a resolved ticket */}
                    {activeTicket.status === 'resolved' && !isDeveloper && (
                      <button
                        type="button"
                        className="btn-resolve-ticket reopen"
                        onClick={handleResolveTicket}
                        id="btn-reopen-ticket-action"
                      >
                        🔄 Reopen Ticket
                      </button>
                    )}

                    {/* Super Admin can flush a resolved ticket to save memory and storage */}
                    {activeTicket.status === 'resolved' && isDeveloper && (
                      <button
                        type="button"
                        className="btn-resolve-ticket danger"
                        onClick={handleFlushTicket}
                        id="btn-flush-ticket-action"
                        style={{
                          background: 'rgba(239, 68, 68, 0.18)',
                          borderColor: 'rgba(239, 68, 68, 0.4)',
                          color: '#ef4444',
                        }}
                        title="Permanently purge ticket and messages to free server memory and storage"
                      >
                        🗑️ Flush Ticket
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages Timeline */}
                <div className="devchat-messages-timeline">
                  {/* System E2EE Notice */}
                  <div style={{ textAlign: 'center', margin: '0.4rem 0' }}>
                    <span className="e2ee-notice-pill">
                      🔒 Messages in this room are end-to-end encrypted.
                    </span>
                  </div>

                  {loadingMessages ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                      Decrypting conversation history...
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                      No messages yet. Send a message or screenshot to start real-time chat with developer.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = String(msg.sender) === String(user?.id || user?._id);
                      const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      if (msg.isDeleted) {
                        return (
                          <div
                            key={msg._id || msg.createdAt}
                            className={`chat-bubble-row ${isMine ? 'mine' : 'theirs'}`}
                            onContextMenu={(e) => handleContextMenu(msg, e)}
                            onTouchStart={(e) => handleTouchStart(msg, e)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchEnd}
                          >
                            {!isMine && <span className="chat-sender-name">{msg.senderName}</span>}
                            <div className="chat-bubble">
                              <div className="chat-bubble-deleted">
                                <span>🚫</span>
                                <span>This message was deleted</span>
                              </div>
                              <div className="chat-bubble-meta">
                                <span>{timeStr}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Detect media / screenshot payload
                      let mediaData = null;
                      let displayText = msg.text;

                      if (msg.contentType === 'image' || (typeof msg.text === 'string' && msg.text.startsWith('{"image":'))) {
                        try {
                          const parsed = JSON.parse(msg.text);
                          if (parsed && parsed.image) {
                            mediaData = parsed;
                          }
                        } catch (e) {
                          if (msg.text?.startsWith('data:image/')) {
                            mediaData = { image: msg.text, caption: '' };
                          }
                        }
                      } else if (typeof msg.text === 'string' && msg.text.startsWith('data:image/')) {
                        mediaData = { image: msg.text, caption: '' };
                      }

                      const isDownloaded = isMine || downloadedImages[msg._id];
                      const isDownloading = downloadingImages[msg._id];
                      const fileSizeStr = formatBytes(msg.mediaSize || mediaData?.size || 283648);

                      return (
                        <div
                          key={msg._id || msg.createdAt}
                          className={`chat-bubble-row ${isMine ? 'mine' : 'theirs'}`}
                          onContextMenu={(e) => handleContextMenu(msg, e)}
                          onTouchStart={(e) => handleTouchStart(msg, e)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchEnd}
                        >
                          {!isMine && <span className="chat-sender-name">{msg.senderName}</span>}
                          <div className={`chat-bubble ${mediaData ? 'has-media' : ''}`}>
                            {mediaData ? (
                              <div className="chat-media-wrapper">
                                <div style={{ position: 'relative' }}>
                                  <img
                                    src={mediaData.image}
                                    alt="Shared Screenshot"
                                    className={`chat-bubble-image ${!isDownloaded ? 'blurred' : ''}`}
                                    onClick={() => {
                                      if (isDownloaded) {
                                        setZoomedImage(mediaData.image);
                                      } else {
                                        triggerImageDownload(msg._id);
                                      }
                                    }}
                                  />
                                  {!isDownloaded && (
                                    <div className="image-download-overlay">
                                      {isDownloading ? (
                                        <div
                                          className="download-spinner-ring"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDownloadingImages((prev) => ({ ...prev, [msg._id]: false }));
                                          }}
                                          title="Cancel download"
                                        >
                                          <div className="spinner-arc" />
                                          <span className="spinner-cancel">✕</span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className="download-pill-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            triggerImageDownload(msg._id);
                                          }}
                                          title="Download media"
                                        >
                                          <span className="dl-icon">⬇</span>
                                          <span>{fileSizeStr}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {mediaData.caption && (
                                  <p className="chat-media-caption">{mediaData.caption}</p>
                                )}
                              </div>
                            ) : (
                              <div className="chat-bubble-text">{displayText || '[Encrypted Content]'}</div>
                            )}

                            <div className="chat-bubble-meta">
                              {msg.isEdited && <span className="chat-edited-tag">(edited)</span>}
                              <span>{timeStr}</span>
                              {isMine && (
                                <span className={`read-ticks ${msg.status === 'pending' ? 'pending' : msg.status === 'failed' ? 'failed' : msg.read ? 'read' : msg.delivered ? 'delivered' : 'sent'}`}>
                                  {msg.status === 'pending' ? (
                                    <span className="tick-clock-icon" title="Sending...">🕒</span>
                                  ) : msg.status === 'failed' ? (
                                    <span className="tick-failed-icon" title="Failed to send">⚠️</span>
                                  ) : msg.read ? (
                                    <span className="tick-double-blue" title="Read">✓✓</span>
                                  ) : msg.delivered ? (
                                    <span className="tick-double-grey" title="Delivered">✓✓</span>
                                  ) : (
                                    <span className="tick-single-grey" title="Sent">✓</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {/* Partner Live Typing Indicator with Animated Bouncing Dots inside timeline */}
                  {partnerTyping && (
                    <div className="chat-bubble-row theirs typing-bubble-row">
                      <span className="chat-sender-name">
                        {isDeveloper ? activeTicket.studentName : activeTicket.developerName}
                      </span>
                      <div className="chat-bubble typing-bubble">
                        <span className="typing-pulse-dot" />
                        <span className="typing-text">typing</span>
                        <span className="typing-dots">
                          <span className="dot dot-1" />
                          <span className="dot dot-2" />
                          <span className="dot dot-3" />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Bar Container with Media Preview & WhatsApp Capsule */}
                <form className="devchat-input-bar" onSubmit={handleSendMessage}>
                  {selectedImage && (
                    <div className="chat-image-preview-bar">
                      <div className="preview-thumb-container">
                        <img src={selectedImage.dataUrl} alt="Preview" className="preview-thumb" />
                        <button
                          type="button"
                          className="btn-remove-preview"
                          onClick={() => setSelectedImage(null)}
                          title="Remove media"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="preview-meta">
                        <span className="preview-filename">{selectedImage.name}</span>
                        <span className="preview-filesize">
                          {formatBytes(selectedImage.size)} • Ready to send
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Feature 3: Resolved Ticket Chat Lock for Students */}
                  {activeTicket?.status === 'resolved' && !isDeveloper ? (
                    <div className="ticket-resolved-lock-banner">
                      <div className="lock-icon">🔒</div>
                      <div className="lock-text">
                        <strong style={{ display: 'block', fontSize: '0.88rem', color: '#f87171', marginBottom: '2px' }}>
                          This ticket has been marked as RESOLVED by Support
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          New messages are locked. If your issue is still pending or needs further assistance, reopen the ticket.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-reopen-ticket"
                        onClick={handleResolveTicket}
                        id="btn-reopen-ticket-banner"
                      >
                        🔄 Reopen Ticket
                      </button>
                    </div>
                  ) : (
                    <div className="devchat-input-row">
                    {/* Hidden Inputs for File and Camera Capture */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                      id="chat-file-input"
                    />
                    <input
                      type="file"
                      ref={cameraInputRef}
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                      id="chat-camera-input"
                    />

                    {/* WhatsApp-Style Input Capsule (Emoji removed per user request) */}
                    <div className="whatsapp-input-capsule">
                      <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={handleInputChange}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Message"
                        className="devchat-input-field"
                        rows={1}
                        id="chat-message-input"
                      />

                      <button
                        type="button"
                        className="btn-input-attachment"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach image or file"
                        id="btn-attach-chat-media"
                      >
                        📎
                      </button>

                      <button
                        type="button"
                        className="btn-input-camera"
                        onClick={() => cameraInputRef.current?.click()}
                        title="Camera / Photo"
                        id="btn-chat-camera"
                      >
                        📷
                      </button>
                    </div>

                    {/* Separate Floating Circular Action Button (Pure Send Button All The Time) */}
                    <button
                      type="submit"
                      className="btn-send-message"
                      id="btn-send-chat-msg"
                      disabled={(!inputText.trim() && !selectedImage) || sending}
                      title="Send message"
                    >
                      {sending ? '...' : <span className="send-arrow-icon">➤</span>}
                    </button>
                  </div>
                )}
              </form>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-secondary)',
                  gap: '12px',
                  padding: '2rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '3rem' }}>🛡️</div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>
                  Select or Create a Support Ticket
                </h3>
                <p style={{ margin: 0, maxWidth: '400px', fontSize: '0.85rem' }}>
                  Connect with the system developer in real-time. Messages are encrypted client-side with zero plaintext leakage.
                </p>
                <button
                  type="button"
                  className="btn-new-ticket"
                  onClick={() => setIsNewTicketModalOpen(true)}
                  style={{ marginTop: '8px' }}
                >
                  ➕ Open New Ticket
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MODAL: New Support Ticket */}
      {isNewTicketModalOpen && (
        <div className="devchat-modal-backdrop" onClick={() => setIsNewTicketModalOpen(false)}>
          <div className="devchat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="devchat-modal-header">
              <h3 className="devchat-modal-title">
                <span>🎫 Open Developer Support Ticket</span>
              </h3>
              <button
                type="button"
                className="devchat-modal-close"
                onClick={() => setIsNewTicketModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              A unique Ticket ID will be generated and a developer will be allotted automatically.
            </p>

            <form onSubmit={handleCreateTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Ticket Subject / Title *
                </label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Brief summary of the issue or feature"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                  }}
                  id="input-ticket-subject"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Issue Category
                </label>
                <div className="category-chips-grid" style={{ marginTop: '4px' }}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`category-chip-btn ${newCategory === cat.id ? 'selected' : ''}`}
                      onClick={() => setNewCategory(cat.id)}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Initial Message / Context (Optional)
                </label>
                <textarea
                  rows={3}
                  value={newInitialMsg}
                  onChange={(e) => setNewInitialMsg(e.target.value)}
                  placeholder="Explain your problem, steps to reproduce, or suggestions..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                  id="input-ticket-initial-msg"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewTicketModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newSubject.trim() || creatingTicket}
                  className="btn-new-ticket"
                  id="btn-submit-create-ticket"
                >
                  {creatingTicket ? 'Generating Ticket...' : '🚀 Generate Ticket & Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Media Lightbox Viewer */}
      {zoomedImage && (
        <div className="chat-lightbox-modal" onClick={() => setZoomedImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={zoomedImage} alt="Enlarged Screenshot" className="lightbox-img" />
            <div className="lightbox-toolbar">
              <a
                href={zoomedImage}
                download={`hostelcare-attachment-${Date.now()}.jpg`}
                className="btn-lightbox-download"
                target="_blank"
                rel="noreferrer"
              >
                ⬇ Download Full Resolution
              </a>
              <button
                type="button"
                className="btn-lightbox-close"
                onClick={() => setZoomedImage(null)}
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu / Long Press Action Card (Images 1 & 3: edit & deletion) */}
      {activeActionMenu && (
        <div
          className="chat-action-menu-backdrop"
          onClick={() => setActiveActionMenu(null)}
        >
          <div
            className="chat-action-menu-card"
            style={{
              top: `${Math.min(activeActionMenu.y, window.innerHeight - 170)}px`,
              left: `${Math.min(activeActionMenu.x, window.innerWidth - 200)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="chat-action-item"
              onClick={() => handleCopyMessage(activeActionMenu.msg)}
            >
              <span>📋</span>
              <span>Copy Text</span>
            </button>

            {activeActionMenu.canEdit && (
              <button
                type="button"
                className="chat-action-item"
                onClick={() => handleStartEdit(activeActionMenu.msg)}
              >
                <span>✏️</span>
                <span>Edit Message</span>
              </button>
            )}

            {activeActionMenu.canDelete && (
              <button
                type="button"
                className="chat-action-item danger"
                onClick={() => handleConfirmDelete(activeActionMenu.msg)}
              >
                <span>🗑️</span>
                <span>Delete Message</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit Message Modal Dialog */}
      {editingMessage && (
        <div
          className="chat-action-menu-backdrop"
          onClick={() => setEditingMessage(null)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            className="chat-edit-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: 0, color: 'var(--wa-text-primary)' }}>✏️ Edit Message</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--wa-text-secondary)' }}>
              Modify your message. The recipient will see an (edited) label.
            </p>
            <textarea
              className="chat-edit-textarea"
              value={editingMessage.text}
              onChange={(e) =>
                setEditingMessage((prev) => ({ ...prev, text: e.target.value }))
              }
              placeholder="Edit your message..."
              autoFocus
            />
            <div className="chat-edit-actions">
              <button
                type="button"
                onClick={() => setEditingMessage(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--wa-border)',
                  background: 'transparent',
                  color: 'var(--wa-text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEdit}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--wa-green-action)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
