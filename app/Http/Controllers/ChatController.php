<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Room;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ChatController extends Controller
{
    // 1. Поиск пользователей (возвращает JSON для фронтенда)
    public function searchUsers(Request $request)
    {
        $search = $request->input('q');

        // Ищем пользователей, исключая самого себя
        $users = User::where('id', '!=', Auth::id())
            ->where(function($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%");
            })
            ->limit(10)
            ->get();

        return response()->json($users);
    }

    // 2. Создание или открытие приватного чата
    public function storeDirectRoom(Request $request)
    {
        $recipientId = $request->input('user_id');
        $currentUserId = Auth::id();

        // Простая логика: создаем новую комнату для диалога
        // (в более продвинутой версии здесь проверяется, существует ли уже чат между ними)
        $room = Room::create([
            'name' => 'Диалог',
        ]);

        // Привязываем обоих пользователей через связующую таблицу room_user
        $room->users()->attach([$currentUserId, $recipientId]);

        // Перенаправляем пользователя в созданный чат
        return redirect()->route('chat.show', $room->id);
    }

    // 3. Отображение страницы чата
    public function show(Room $room)
    {
        // Проверяем, имеет ли текущий пользователь доступ к этой комнате
        if (!$room->users()->where('users.id', Auth::id())->exists()) {
            abort(403);
        }

        // Подгружаем сообщения вместе с авторами
        $room->load('messages.user', 'users');

        return Inertia::render('Chat/Room', [
            'room' => $room,
        ]);
    }
}