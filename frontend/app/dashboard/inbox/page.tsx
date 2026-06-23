"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Image as ImageIcon, FileText, Check, CheckCheck, Clock, Download, User, Trash2, Video, ArrowLeft, Paperclip, X, RefreshCw, Reply, UserMinus } from 'lucide-react';
import api from '@/app/lib/api';

export default function InboxPage() {
    const [chats, setChats] = useState<any[]>([]);
    const [selectedChat, setSelectedChat] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [localReadReceipts, setLocalReadReceipts] = useState<Record<string, boolean>>({});

    const [businessId] = useState(process.env.NEXT_PUBLIC_BUSINESS_ID || '69edf7401e9164e3fd73e073');

    useEffect(() => {
        if (businessId) {
            fetchChats();
            // Global polling for the sidebar to catch new inbound messages
            const globalInterval = setInterval(() => {
                fetchChats();
            }, 5000);
            return () => clearInterval(globalInterval);
        }
    }, [businessId]);

    useEffect(() => {
        if (selectedChat) {
            fetchMessages(selectedChat._id);
            
            // Mark chat as read locally when opened
            const latestMsgId = chats.find(c => c._id === selectedChat._id)?.latestMessage?._id;
            if (latestMsgId) {
                setLocalReadReceipts(prev => ({ ...prev, [latestMsgId]: true }));
            }

            // Polling for real-time blue tick & new message updates
            const interval = setInterval(() => {
                fetchMessages(selectedChat._id);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [selectedChat, chats]);

    const getSpecificFileType = (msg: any) => {
        if (msg.message_type !== 'document') return msg.message_type;
        const lowerContent = msg.content?.toLowerCase() || '';
        if (lowerContent.endsWith('.pdf')) return 'pdf';
        if (lowerContent.endsWith('.csv')) return 'csv';
        if (lowerContent.endsWith('.xlsx') || lowerContent.endsWith('.xls')) return 'excel';
        return 'document';
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [selectedChat?._id, messages.length]);

    const fetchChats = async () => {
        try {
            const res = await api.get(`/chats?business_id=${businessId}`);
            setChats(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching chats:", error);
            setLoading(false);
        }
    };

    // ... (rest of the handlers) ...
    const fetchMessages = async (customerId: string) => {
        try {
            const res = await api.get(`/chats/${customerId}`);
            setMessages(res.data);
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const MAX_SIZE = 16 * 1024 * 1024; // 16MB limit for Meta API generally
            if (file.size > MAX_SIZE) {
                alert("File size exceeds 16MB limit.");
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && !selectedFile) || !selectedChat) return;

        // Create Optimistic Message
        const tempId = `temp-${Date.now()}`;
        const messageToSend = newMessage.trim();
        const fileToSend = selectedFile;
        const replyMessageId = replyingToMessage?.whatsapp_message_id;

        const optimisticMessage = {
            _id: tempId,
            content: messageToSend || (fileToSend ? `[Sending ${fileToSend.name}...]` : ''),
            direction: 'outbound',
            status: 'optimistic_sending',
            createdAt: new Date().toISOString(),
            message_type: fileToSend ? (fileToSend.type.startsWith('image') ? 'image' : fileToSend.type.startsWith('video') ? 'video' : 'document') : 'text',
            context_message_id: replyMessageId,
            media_id: fileToSend ? 'temp-media' : undefined
        };

        // Instantly update UI and clear inputs
        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage("");
        setSelectedFile(null);
        setReplyingToMessage(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        try {
            let res;
            if (fileToSend) {
                const formData = new FormData();
                formData.append('business_id', businessId);
                formData.append('customer_id', selectedChat._id);
                formData.append('file', fileToSend);
                if (messageToSend) {
                    formData.append('caption', messageToSend);
                }
                if (replyMessageId) {
                    formData.append('reply_to_message_id', replyMessageId);
                }

                res = await api.post('/chats/media-reply', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await api.post('/chats/reply', {
                    business_id: businessId,
                    customer_id: selectedChat._id,
                    text: messageToSend,
                    reply_to_message_id: replyMessageId
                });
            }
            
            // Replace optimistic message with actual DB message
            setMessages(prev => prev.map(m => m._id === tempId ? res.data.data : m));
            
            // Update the last message in the chat list
            setChats(prevChats => prevChats.map(c => {
                if (c._id === selectedChat._id) {
                    return { ...c, latestMessage: res.data.data };
                }
                return c;
            }));

        } catch (error: any) {
            console.error(error);
            // Update optimistic message to show failure
            setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'optimistic_failed' } : m));
        }
    };

    const formatTime = (dateString: string) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessageStatus = (msg: any) => {
        if (msg.direction === 'inbound') return null;
        if (msg.status === 'read') return <CheckCheck className="w-3 h-3 text-blue-500 inline-block ml-1" />;
        if (msg.status === 'delivered') return <CheckCheck className="w-3 h-3 text-gray-400 inline-block ml-1" />;
        if (msg.status === 'sent') return <Check className="w-3 h-3 text-gray-400 inline-block ml-1" />;
        if (msg.status === 'failed' || msg.status === 'optimistic_failed') return <span className="text-red-500 text-[10px] ml-1 font-bold">Failed</span>;
        if (msg.status === 'optimistic_sending') return <Clock className="w-3 h-3 text-gray-400 inline-block ml-1 animate-pulse" />;
        return <Clock className="w-3 h-3 text-gray-400 inline-block ml-1" />; // queued
    };

    const isUnread = (chat: any) => {
        const latest = chat.latestMessage;
        if (!latest) return false;
        if (latest.direction === 'outbound') return false;
        // If it's inbound, it's unread unless we explicitly marked this exact message ID as read
        return !localReadReceipts[latest._id];
    };

    const filteredChats = chats.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
        const matchesUnread = showUnreadOnly ? isUnread(c) : true;
        return matchesSearch && matchesUnread;
    });

    const isWindowOpen = () => {
        if (!selectedChat?.last_message_received_at) return false;
        const hours = (Date.now() - new Date(selectedChat.last_message_received_at).getTime()) / (1000 * 60 * 60);
        return hours < 24;
    };

    const handleEditName = async () => {
        if (!selectedChat) return;
        const newName = window.prompt("Enter patient name:", selectedChat.name === 'Unknown Patient' ? '' : selectedChat.name);
        if (newName && newName.trim()) {
            try {
                const res = await api.put(`/chats/${selectedChat._id}/name`, { name: newName.trim() });
                setSelectedChat({ ...selectedChat, name: res.data.name });
                setChats(prevChats => prevChats.map(c => 
                    c._id === selectedChat._id ? { ...c, name: res.data.name } : c
                ));
            } catch (error) {
                alert("Failed to update name");
            }
        }
    };

    const handleDeleteChat = async () => {
        if (!selectedChat) return;
        if (!confirm(`Are you sure you want to delete the entire chat history with ${selectedChat.name}? This cannot be undone.`)) return;

        try {
            await api.delete(`/chats/${selectedChat._id}`);
            setMessages([]);
            setSelectedChat(null);
            fetchChats(); // Refresh the sidebar
        } catch (error: any) {
            alert(error.response?.data?.message || error.response?.data?.error || "Failed to delete chat history");
        }
    };

    const handleDeleteContact = async () => {
        if (!selectedChat) return;
        if (!confirm(`Are you sure you want to delete this contact and all their messages from the WhatsApp inbox? This cannot be undone.`)) return;

        try {
            await api.delete(`/chats/${selectedChat._id}/contact`);
            setMessages([]);
            setSelectedChat(null);
            fetchChats(); // Refresh the sidebar
        } catch (error: any) {
            alert(error.response?.data?.message || error.response?.data?.error || "Failed to delete contact");
        }
    };

    const handleDownloadChat = () => {
        if (!selectedChat || messages.length === 0) return;
        
        const displayName = selectedChat.name === 'Unknown Patient' ? selectedChat.phone : selectedChat.name;
        let txtContent = `WhatsApp Chat History with ${displayName} (${selectedChat.phone})\n`;
        txtContent += `Exported on: ${new Date().toLocaleString()}\n\n`;
        
        messages.forEach(msg => {
            const time = new Date(msg.createdAt).toLocaleString();
            const sender = msg.direction === 'inbound' ? displayName : 'Clinic';
            const content = msg.message_type === 'image' ? '[Image/Media attached]' : msg.content;
            txtContent += `[${time}] ${sender}: ${content}\n`;
        });

        const blob = new Blob([txtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_history_${displayName.replace(/\s+/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-x-0 bottom-0 top-[56px] md:relative md:top-auto md:inset-auto flex md:h-[calc(100vh-80px)] bg-gray-100 overflow-hidden z-40">
            {/* Sidebar List */}
            <div className={`bg-white border-r border-gray-200 flex-col w-full md:w-1/3 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-800">Chats</h2>
                            <button 
                                onClick={() => { fetchChats(); if (selectedChat) fetchMessages(selectedChat._id); }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100"
                                title="Refresh Inbox"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
                            </button>
                        </div>
                        <div className="flex gap-2 bg-gray-200 p-1 rounded-lg">
                            <button 
                                onClick={() => setShowUnreadOnly(false)} 
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${!showUnreadOnly ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                All
                            </button>
                            <button 
                                onClick={() => setShowUnreadOnly(true)} 
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${showUnreadOnly ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Unread
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search patients..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center p-8"><span className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent"></span></div>
                    ) : filteredChats.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 text-sm">
                            {showUnreadOnly ? 'No unread messages.' : 'No chats found.'}
                        </div>
                    ) : (
                        filteredChats.map((chat) => {
                            const unread = isUnread(chat);
                            const displayName = chat.name === 'Unknown Patient' ? chat.phone : chat.name;
                            const initial = chat.name === 'Unknown Patient' ? '#' : chat.name.charAt(0).toUpperCase();

                            return (
                                <div 
                                    key={chat._id} 
                                    onClick={() => setSelectedChat(chat)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 flex gap-3 animate-in fade-in slide-in-from-bottom-2 ${selectedChat?._id === chat._id ? 'bg-blue-50 md:border-l-4 md:border-l-blue-500' : ''}`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 text-lg">
                                        {initial}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className={`text-sm truncate ${unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                                                {displayName}
                                            </h3>
                                            {chat.latestMessage && (
                                                <span className={`text-xs whitespace-nowrap ml-2 ${unread ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                                                    {formatTime(chat.latestMessage.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className={`text-xs truncate ${unread ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                                                {chat.latestMessage ? (
                                                    chat.latestMessage.message_type === 'image' ? '📷 Image' : 
                                                    chat.latestMessage.message_type === 'template' ? '📄 Template Sent' :
                                                    chat.latestMessage.content
                                                ) : 'No messages yet'}
                                            </div>
                                            {unread && (
                                                <div className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center shrink-0 ml-2 shadow-sm">
                                                    <span className="text-white text-[10px] font-bold">1</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Chat Thread */}
            <div className={`flex-1 flex flex-col min-w-0 bg-[#efeae2] animate-in fade-in slide-in-from-right-8 md:slide-in-from-none duration-300 ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                {selectedChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-4 md:px-6 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10 shrink-0">
                            <div className="flex items-center gap-2 md:gap-3">
                                {/* Mobile Back Button */}
                                <button 
                                    onClick={() => setSelectedChat(null)}
                                    className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                                    {selectedChat.name === 'Unknown Patient' ? '#' : selectedChat.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-semibold text-gray-800 truncate">
                                            {selectedChat.name === 'Unknown Patient' ? selectedChat.phone : selectedChat.name}
                                        </h2>
                                        <button onClick={handleEditName} className="text-blue-500 hover:text-blue-700 text-xs font-medium shrink-0">Edit</button>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">{selectedChat.phone}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 md:gap-4 shrink-0">
                                {isWindowOpen() ? (
                                    <span className="px-1.5 md:px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium flex items-center gap-1" title="Active Window">
                                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span> 
                                        <span className="hidden sm:inline">Active Window</span>
                                    </span>
                                ) : (
                                    <span className="px-1.5 md:px-2 py-1 bg-gray-200 text-gray-600 text-[10px] md:text-xs rounded-full font-medium flex items-center gap-1" title="Window Closed">
                                        <Clock className="w-3 h-3 shrink-0" /> 
                                        <span className="hidden sm:inline">Window Closed</span>
                                    </span>
                                )}
                                
                                <div className="h-5 border-l border-gray-300 ml-1"></div>

                                <button 
                                    onClick={handleDownloadChat}
                                    title="Export Chat History"
                                    className="text-gray-500 hover:text-blue-600 transition p-1"
                                >
                                    <Download className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                                
                                <button 
                                    onClick={handleDeleteChat}
                                    title="Clear Chat History"
                                    className="text-gray-500 hover:text-red-600 transition p-1"
                                >
                                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                                </button>

                                <button 
                                    onClick={handleDeleteContact}
                                    title="Delete Contact completely from Inbox"
                                    className="text-gray-500 hover:text-red-600 transition p-1 ml-1"
                                >
                                    <UserMinus className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4">
                            {messages.map((msg, idx) => {
                                const isOutbound = msg.direction === 'outbound';
                                const messageDate = new Date(msg.createdAt).toLocaleDateString();
                                const prevMessageDate = idx > 0 ? new Date(messages[idx - 1].createdAt).toLocaleDateString() : null;
                                const showDateSeparator = messageDate !== prevMessageDate;
                                
                                const displayDate = (() => {
                                    const today = new Date().toLocaleDateString();
                                    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
                                    if (messageDate === today) return 'Today';
                                    if (messageDate === yesterday) return 'Yesterday';
                                    return new Date(msg.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                                })();

                                return (
                                    <React.Fragment key={msg._id || idx}>
                                        {showDateSeparator && (
                                            <div className="flex justify-center my-4">
                                                <span className="bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-500 text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-lg shadow-sm">
                                                    {displayDate}
                                                </span>
                                            </div>
                                        )}
                                        <div className={`flex items-center gap-2 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                            {!isOutbound && (
                                                <button 
                                                    onClick={() => setReplyingToMessage(msg)}
                                                    title="Reply to message"
                                                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-200 rounded-full transition-all focus:opacity-100"
                                                >
                                                    <Reply className="w-4 h-4" />
                                                </button>
                                            )}
                                            <div className={`max-w-[85%] md:max-w-[70%] rounded-xl px-3 md:px-4 py-2 shadow-sm relative ${isOutbound ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}`}>
                                            
                                            {/* Context/Replied-to Box */}
                                            {msg.context_message_id && (
                                                <div className="bg-black/5 border-l-4 border-blue-400 p-2 rounded mb-2 flex flex-col min-w-0">
                                                    <span className="text-[11px] font-bold text-blue-600 mb-0.5">
                                                        {(() => {
                                                            const ctx = messages.find(m => m.whatsapp_message_id === msg.context_message_id);
                                                            if (ctx) return ctx.direction === 'inbound' ? (selectedChat.name || 'Patient') : 'You';
                                                            return isOutbound ? 'Patient' : 'You'; // fallback
                                                        })()}
                                                    </span>
                                                    <span className="text-xs text-gray-600 truncate">
                                                        {(() => {
                                                            const ctx = messages.find(m => m.whatsapp_message_id === msg.context_message_id);
                                                            if (ctx) return ctx.content || `[${ctx.message_type} attached]`;
                                                            return 'Message context...';
                                                        })()}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Media Rendering */}
                                            {msg.media_id && (
                                                <div className="mb-2">
                                                    {msg.message_type === 'image' && (
                                                        <a href={`/api/chats/media/${msg.media_id}`} target="_blank" rel="noreferrer">
                                                            <img 
                                                                src={`/api/chats/media/${msg.media_id}`} 
                                                                alt="Sent Image" 
                                                                className="w-full max-h-60 object-cover rounded-lg mb-1 border border-black/5"
                                                            />
                                                        </a>
                                                    )}
                                                    {msg.message_type === 'video' && (
                                                        <video 
                                                            src={`/api/chats/media/${msg.media_id}`} 
                                                            controls 
                                                            className="w-full max-h-60 rounded-lg mb-1 border border-black/5"
                                                        />
                                                    )}
                                                    {msg.message_type === 'audio' && (
                                                        <div className="w-full mb-1 text-center">
                                                            <audio 
                                                                src={`/api/chats/media/${msg.media_id}`} 
                                                                controls 
                                                                className="w-full mb-1"
                                                            />
                                                            <p className="text-[10px] text-gray-500 italic mt-1 leading-tight">iPhone users: download to listen through your device</p>
                                                        </div>
                                                    )}
                                                    {msg.message_type === 'document' && (
                                                        <div className="flex items-center gap-3 bg-black/5 p-3 rounded-lg mb-1">
                                                            <FileText className="w-8 h-8 text-blue-500" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold truncate text-gray-700">Document File</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Universal Download Button for ALL media */}
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold bg-white/50 px-2 py-1 rounded">
                                                            {getSpecificFileType(msg)} File
                                                        </span>
                                                        <a 
                                                            href={`/api/chats/media/${msg.media_id}`} 
                                                            target="_blank" 
                                                            download
                                                            className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 bg-blue-50 p-2 rounded"
                                                        >
                                                            <Download className="w-3 h-3" /> Download
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Only show text if it's not the generic fallback OR the exact filename */}
                                            {msg.content && 
                                             msg.content !== `Received a ${msg.message_type}` && 
                                             msg.content !== `Received a ${getSpecificFileType(msg)}` &&
                                             (!msg.media_id || !msg.content.toLowerCase().match(/\.(pdf|csv|xlsx|xls|jpg|png|mp4)$/)) && (
                                                <p className="text-sm whitespace-pre-wrap break-words overflow-hidden">{msg.content}</p>
                                            )}
                                            
                                            <div className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${isOutbound ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {formatTime(msg.createdAt)}
                                                {renderMessageStatus(msg)}
                                            </div>
                                        </div>
                                        {isOutbound && (
                                            <button 
                                                onClick={() => setReplyingToMessage(msg)}
                                                title="Reply to message"
                                                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-200 rounded-full transition-all focus:opacity-100"
                                            >
                                                <Reply className="w-4 h-4" />
                                            </button>
                                        )}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Replying To Preview Box */}
                        {replyingToMessage && (
                            <div className="absolute bottom-[64px] md:bottom-[72px] left-2 right-2 md:left-4 md:right-4 bg-gray-100 border-l-4 border-blue-500 rounded-lg p-2 md:p-3 flex items-center justify-between shadow-md z-10 animate-in slide-in-from-bottom-2">
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-xs font-bold text-blue-600 mb-0.5">
                                        Replying to {replyingToMessage.direction === 'inbound' ? (selectedChat.name || 'Patient') : 'Yourself'}
                                    </p>
                                    <p className="text-sm text-gray-600 truncate">
                                        {replyingToMessage.content || `[${replyingToMessage.message_type} attached]`}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setReplyingToMessage(null)}
                                    className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-2 md:p-4 bg-[#f0f2f5] flex flex-col gap-2 relative">
                            {selectedChat?.opt_out ? (
                                <div className="text-center bg-red-50 text-red-800 text-xs py-2 px-4 rounded-lg border border-red-200 font-medium">
                                    This patient has explicitly opted out of WhatsApp messages by texting "STOP". Meta blocks all further outbound templates and messages.
                                </div>
                            ) : !isWindowOpen() && (
                                <div className="text-center bg-yellow-50 text-yellow-800 text-xs py-2 px-4 rounded-lg border border-yellow-200">
                                    The 24-hour service window has closed. You cannot send free-form text. Please use the Broadcast tool to send a pre-approved template first.
                                </div>
                            )}

                            {selectedFile && (
                                <div className="absolute bottom-full left-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 flex items-center gap-3 w-max max-w-[80vw]">
                                    <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{selectedFile.name}</p>
                                        <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => { setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ""; }}
                                        className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange}
                                    accept="image/*,video/*,.pdf,.csv,.xlsx,.xls"
                                    disabled={selectedChat?.opt_out || !isWindowOpen()}
                                />
                                <button 
                                    type="button"
                                    disabled={selectedChat?.opt_out || !isWindowOpen()}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-3 text-gray-500 hover:bg-gray-200 rounded-full transition disabled:opacity-50 flex items-center justify-center"
                                >
                                    <Paperclip className="w-6 h-6" />
                                </button>
                                <input
                                    type="text"
                                    placeholder={selectedChat?.opt_out ? "Patient opted out." : isWindowOpen() ? (selectedFile ? "Add a caption..." : "Type a message...") : "Window closed. Cannot send manual messages."}
                                    className="flex-1 bg-white text-gray-900 border-none rounded-full px-4 md:px-5 py-2.5 md:py-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed text-sm md:text-base transition-all duration-300"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    disabled={selectedChat?.opt_out || !isWindowOpen()}
                                />
                                <button 
                                    type="submit"
                                    disabled={selectedChat?.opt_out || (!newMessage.trim() && !selectedFile) || !isWindowOpen()}
                                    className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                                >
                                    <Send className="w-5 h-5 ml-1" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                            <MessageCircleIcon className="w-10 h-10 text-blue-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">WhatsApp Inbox</h2>
                        <p className="text-sm">Select a patient from the list to start chatting.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MessageCircleIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}
