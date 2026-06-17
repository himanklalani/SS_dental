"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Image as ImageIcon, FileText, Check, CheckCheck, Clock, Download, User } from 'lucide-react';
import api from '@/app/lib/api';

export default function InboxPage() {
    const [chats, setChats] = useState<any[]>([]);
    const [selectedChat, setSelectedChat] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Use the environment variable for businessId to match other pages
    const [businessId] = useState(process.env.NEXT_PUBLIC_BUSINESS_ID || '69edf7401e9164e3fd73e073');

    useEffect(() => {
        if (businessId) {
            fetchChats();
        }
    }, [businessId]);

    useEffect(() => {
        if (selectedChat) {
            fetchMessages(selectedChat._id);
        }
    }, [selectedChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

    const fetchMessages = async (customerId: string) => {
        try {
            const res = await api.get(`/chats/${customerId}`);
            setMessages(res.data);
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        setSending(true);
        try {
            const res = await api.post('/chats/reply', {
                business_id: businessId,
                customer_id: selectedChat._id,
                text: newMessage.trim()
            });
            
            setMessages(prev => [...prev, res.data.data]);
            setNewMessage("");
            
            // Update the last message in the chat list
            setChats(prevChats => prevChats.map(c => {
                if (c._id === selectedChat._id) {
                    return { ...c, latestMessage: res.data.data };
                }
                return c;
            }));

        } catch (error: any) {
            alert(error.response?.data?.message || "Failed to send message. 24-hour window may be closed.");
        } finally {
            setSending(false);
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
        if (msg.status === 'failed') return <span className="text-red-500 text-xs ml-1">Failed</span>;
        return <Clock className="w-3 h-3 text-gray-400 inline-block ml-1" />; // queued
    };

    const filteredChats = chats.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.phone.includes(searchQuery)
    );

    const isWindowOpen = () => {
        if (!selectedChat?.last_interaction) return false;
        const hours = (Date.now() - new Date(selectedChat.last_interaction).getTime()) / (1000 * 60 * 60);
        return hours < 24;
    };

    return (
        <div className="flex h-[calc(100vh-80px)] bg-gray-100 rounded-xl overflow-hidden shadow-sm border border-gray-200">
            {/* Sidebar List */}
            <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 mb-3">Chats</h2>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search patients..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center p-8"><span className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent"></span></div>
                    ) : filteredChats.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 text-sm">No chats found.</div>
                    ) : (
                        filteredChats.map((chat) => (
                            <div 
                                key={chat._id} 
                                onClick={() => setSelectedChat(chat)}
                                className={`p-4 border-b border-gray-100 cursor-pointer transition hover:bg-gray-50 flex gap-3 ${selectedChat?._id === chat._id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                                    {chat.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-semibold text-sm text-gray-800 truncate">{chat.name}</h3>
                                        {chat.latestMessage && (
                                            <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                                {formatTime(chat.latestMessage.createdAt)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {chat.latestMessage ? (
                                            chat.latestMessage.message_type === 'image' ? '📷 Image' : 
                                            chat.latestMessage.message_type === 'template' ? '📄 Template Sent' :
                                            chat.latestMessage.content
                                        ) : 'No messages yet'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Thread */}
            <div className="flex-1 flex flex-col bg-[#efeae2]">
                {selectedChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-6 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                    {selectedChat.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="font-semibold text-gray-800">{selectedChat.name}</h2>
                                    <p className="text-xs text-gray-500">{selectedChat.phone}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isWindowOpen() ? (
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Active Window
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full font-medium flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Window Closed
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg, idx) => {
                                const isOutbound = msg.direction === 'outbound';
                                return (
                                    <div key={msg._id || idx} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] rounded-xl px-4 py-2 shadow-sm relative ${isOutbound ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}`}>
                                            
                                            {/* Media Rendering */}
                                            {msg.message_type === 'image' && msg.media_id && (
                                                <div className="mb-2">
                                                    <div className="w-full h-40 bg-gray-200 rounded-lg flex items-center justify-center mb-2 overflow-hidden relative group">
                                                        <ImageIcon className="w-8 h-8 text-gray-400" />
                                                        <a 
                                                            href={`${process.env.NEXT_PUBLIC_API_URL}/api/chats/media/${msg.media_id}`} 
                                                            target="_blank" 
                                                            download
                                                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Download className="w-6 h-6 text-white" />
                                                        </a>
                                                    </div>
                                                    <a 
                                                        href={`${process.env.NEXT_PUBLIC_API_URL}/api/chats/media/${msg.media_id}`} 
                                                        target="_blank" 
                                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1"
                                                    >
                                                        <Download className="w-3 h-3" /> Download Full Image
                                                    </a>
                                                </div>
                                            )}

                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            
                                            <div className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${isOutbound ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {formatTime(msg.createdAt)}
                                                {renderMessageStatus(msg)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-[#f0f2f5]">
                            {!isWindowOpen() && (
                                <div className="mb-3 text-center bg-yellow-50 text-yellow-800 text-xs py-2 px-4 rounded-lg border border-yellow-200">
                                    The 24-hour service window has closed. You cannot send free-form text. Please use the Broadcast tool to send a pre-approved template first.
                                </div>
                            )}
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder={isWindowOpen() ? "Type a message..." : "Window closed. Cannot send manual messages."}
                                    className="flex-1 bg-white border-none rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    disabled={!isWindowOpen() || sending}
                                />
                                <button 
                                    type="submit"
                                    disabled={!newMessage.trim() || !isWindowOpen() || sending}
                                    className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    {sending ? (
                                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    ) : (
                                        <Send className="w-5 h-5 ml-1" />
                                    )}
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
