import React, { useEffect, useRef, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';

export default function ChatIndex({ rooms = [], activeRoom = null, messages: initialMessages = [] }) {
    const { auth } = usePage().props;
    const currentUser = auth.user;

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [messages, setMessages] = useState(initialMessages);
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [roomList, setRoomList] = useState(rooms);

    const messagesEndRef = useRef(null);

    // Для личного диалога возвращаем имя собеседника, а не "Sofia & Maria"
    const getChatTitle = (room) => {
        if (!room) return '';
        const otherUsers = (room.users || []).filter((u) => u.id !== currentUser.id);
        return otherUsers.length === 1 ? otherUsers[0].name : room.name;
    };

    useEffect(() => {
        setRoomList(rooms);
    }, [rooms]);

    useEffect(() => {
        setMessages(initialMessages);
    }, [activeRoom?.id, initialMessages]);

    // Сразу прокручиваем к последним сообщениям
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    // Подписка на WebSocket (Reverb) для открытого чата
    useEffect(() => {
        if (!activeRoom?.id || !window.Echo) return;

        const channelName = `chat.room.${activeRoom.id}`;
        const channel = window.Echo.private(channelName);

        channel.listen('.message.sent', (event) => {
            const incoming = event.message;
            if (!incoming) return;

            setMessages((prev) =>
                prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
            );
        });

        return () => window.Echo.leave(channelName);
    }, [activeRoom?.id]);

    // Поиск пользователей
    useEffect(() => {
        const trimmed = searchQuery.trim();
        if (trimmed.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const { data } = await axios.get('/users/search', {
                    params: { q: trimmed },
                });
                setSearchResults(data);
            } catch (error) {
                console.error('Ошибка поиска:', error);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Обновляем превью, счётчик непрочитанных и поднимаем чат наверх списка
    const applyIncomingMessageToSidebar = (incomingMsg) => {
        const isCurrentRoom = activeRoom?.id === incomingMsg.room_id;
        const isFromMe = incomingMsg.user_id === currentUser.id;

        setRoomList((prev) => {
            const existing = prev.find((r) => r.id === incomingMsg.room_id);
            const otherRooms = prev.filter((r) => r.id !== incomingMsg.room_id);

            const baseRoom = existing ?? {
                ...(incomingMsg.room || { id: incomingMsg.room_id, name: 'Чат', users: [] }),
                unread_count: 0,
            };

            const updatedRoom = {
                ...baseRoom,
                messages: [incomingMsg],
                unread_count: isCurrentRoom || isFromMe
                    ? 0
                    : (baseRoom.unread_count || 0) + 1,
            };

            return [updatedRoom, ...otherRooms];
        });

        // Если сообщение пришло в уже открытый чат — обновляем last_read_at на сервере
        if (isCurrentRoom && !isFromMe) {
            axios.post(`/rooms/${activeRoom.id}/read`).catch(() => {});
        }
    };

    // Подписка на личный канал для живого обновления списка чатов
    useEffect(() => {
        if (!currentUser?.id || !window.Echo) return;

        const channelName = `user.${currentUser.id}`;
        const channel = window.Echo.private(channelName);

        channel.listen('.message.sent', (event) => {
            const incoming = event.message;
            if (!incoming) return;

            applyIncomingMessageToSidebar(incoming);
        });

        return () => window.Echo.leave(channelName);
    }, [currentUser?.id, activeRoom?.id]);

    const handleStartDirectChat = async (targetUserId) => {
        try {
            const { data } = await axios.post('/rooms/direct', { user_id: targetUserId });
            setSearchQuery('');
            setSearchResults([]);
            router.visit(data.redirect_url);
        } catch (error) {
            console.error('Ошибка создания чата:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!activeRoom?.id || !body.trim() || sending) return;

        setSending(true);
        try {
            const { data } = await axios.post(`/rooms/${activeRoom.id}/messages`, {
                body: body.trim(),
            });

            if (data.message) {
                setMessages((prev) =>
                    prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
                );
                applyIncomingMessageToSidebar(data.message);
            }
            setBody('');
        } catch (error) {
            console.error('Ошибка отправки:', error);
        } finally {
            setSending(false);
        }
    };

    const activeTitle = getChatTitle(activeRoom);

    return (
        <AuthenticatedLayout>
            <Head title={activeRoom ? activeTitle : 'Чаты'} />

            {/* Общее пространство с отступами от краёв экрана */}
            <div className="h-[calc(100vh-65px)] flex bg-gray-100 p-3 gap-4 overflow-hidden">

                {/* Левая панель: отдельный блок для поиска и списка чатов */}
                <aside className="w-80 bg-white border border-gray-200 rounded-lg flex flex-col shrink-0 overflow-hidden">
                    <div className="p-3 border-b border-gray-200">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск"
                            className="w-full rounded-md border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />

                        {searchResults.length > 0 && (
                            <ul className="mt-2 border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
                                {searchResults.map((user) => (
                                    <li
                                        key={user.id}
                                        className="p-2 flex items-center justify-between gap-2"
                                    >
                                        <span className="text-sm truncate">{user.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleStartDirectChat(user.id)}
                                            className="px-2 py-1 bg-indigo-600 text-white text-xs rounded"
                                        >
                                            Написать
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {roomList.length === 0 ? (
                            <p className="p-4 text-sm text-gray-400">Чатов пока нет</p>
                        ) : (
                            roomList.map((room) => {
                                const isActive = activeRoom?.id === room.id;
                                const lastMsg = room.messages?.[0];

                                return (
                                    <Link
                                        key={room.id}
                                        href={route('chat.show', room.id)}
                                        className={`flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 ${
                                            isActive ? 'bg-indigo-50 font-medium' : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm text-gray-900 truncate">
                                                {getChatTitle(room)}
                                            </div>
                                            {lastMsg && (
                                                <div className="text-xs text-gray-500 truncate mt-0.5">
                                                    {lastMsg.body}
                                                </div>
                                            )}
                                        </div>

                                        {room.unread_count > 0 && (
                                            <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-indigo-600 text-white rounded-full">
                                                {room.unread_count}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })
                        )}
                    </div>
                </aside>

                {/* Правая область: чат по центру с ограниченной шириной */}
                <section className="flex-1 flex justify-center min-w-0 overflow-hidden">
                    {!activeRoom ? (
                        <div className="flex items-center justify-center text-sm text-gray-400">
                            Выберите чат слева
                        </div>
                    ) : (
                        <div className="w-full max-w-3xl flex flex-col h-full gap-2">
                            {/* Шапка собеседника */}
                            <div className="px-4 py-3 bg-white border border-gray-200 rounded-lg font-medium text-sm text-gray-900 shrink-0">
                                {activeTitle}
                            </div>

                            {/* Лента сообщений */}
                            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                                {messages.map((msg) => {
                                    const isMine = msg.user_id === currentUser.id;
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                                                    isMine
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-white border border-gray-200 text-gray-900'
                                                }`}
                                            >
                                                {msg.body}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Поле ввода */}
                            <form
                                onSubmit={handleSendMessage}
                                className="p-2 bg-white border border-gray-200 rounded-lg flex gap-2 shrink-0"
                            >
                                <input
                                    type="text"
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder="Написать сообщение..."
                                    className="flex-1 rounded-md border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                <button
                                    type="submit"
                                    disabled={sending || !body.trim()}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md disabled:opacity-50"
                                >
                                    Отправить
                                </button>
                            </form>
                        </div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}