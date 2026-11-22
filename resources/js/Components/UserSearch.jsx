import React, { useState } from 'react';
import axios from 'axios';
import { router } from '@inertiajs/react';

export default function UserSearch() {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState([]);

    // Функция поиска при вводе текста
    const handleSearch = async (e) => {
        const value = e.target.value;
        setQuery(value);

        if (value.length > 1) {
            try {
                const response = await axios.get(`/users/search?q=${value}`);
                setUsers(response.data);
            } catch (error) {
                console.error("Ошибка поиска", error);
            }
        } else {
            setUsers([]);
        }
    };

    // Функция создания чата при клике на пользователя
    const startChat = (userId) => {
        router.post('/rooms/direct', { user_id: userId });
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">Начать новый чат</h3>
            <input
                type="text"
                value={query}
                onChange={handleSearch}
                placeholder="Введите имя или email..."
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring"
            />

            {/* Список найденных пользователей */}
            <ul className="mt-2 divide-y">
                {users.map((user) => (
                    <li key={user.id} className="py-2 flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <button
                            onClick={() => startChat(user.id)}
                            className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                        >
                            Написать
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}