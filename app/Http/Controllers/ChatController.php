<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Message;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ChatController extends Controller
{
    public function index()
    {
        return Inertia::render('Chat/Index', [
            'rooms' => $this->getUserRooms(Auth::user()),
            'activeRoom' => null,
            'messages' => [],
        ]);
    }
    public function show(Room $room)
    {
        if (!$room->users()->where('users.id', Auth::id())->exists()) {
            abort(403);
        }

        // Отмечаем чат прочитанным при открытии
        $room->users()->updateExistingPivot(Auth::id(), [
            'last_read_at' => now(),
        ]);

        $messages = $room->messages()
            ->with('user')
            ->orderBy('created_at', 'asc')
            ->get();

        return Inertia::render('Chat/Index', [
            'rooms' => $this->getUserRooms(Auth::user()),
            'activeRoom' => $room->load('users'),
            'messages' => $messages,
        ]);
    }

    public function searchUsers(Request $request)
    {
        $search = trim((string) $request->input('q', ''));

        if (mb_strlen($search) < 2) {
            return response()->json([]);
        }

        $users = User::where('id', '!=', Auth::id())
            ->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            })
            ->select('id', 'name', 'email')
            ->limit(10)
            ->get();

        return response()->json($users);
    }

    public function storeDirectRoom(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id', 'different:current_user'],
        ]);

        $currentUserId = Auth::id();
        $recipientId = (int) $validated['user_id'];

        if ($recipientId === $currentUserId) {
            return response()->json(['message' => 'Нельзя создать диалог с самим собой'], 422);
        }

        // Ищем существующий диалог ровно между двумя участниками
        $existingRoom = Room::whereHas('users', fn($q) => $q->where('users.id', $currentUserId))
            ->whereHas('users', fn($q) => $q->where('users.id', $recipientId))
            ->has('users', '=', 2)
            ->first();

        if ($existingRoom) {
            if ($request->header('X-Inertia')) {
                return redirect()->route('chat.show', $existingRoom->id);
            }

            return response()->json([
                'room' => $existingRoom->load('users'),
                'redirect_url' => route('chat.show', $existingRoom->id),
            ]);
        }

        $recipient = User::findOrFail($recipientId);

        $room = Room::create([
            'name' => Auth::user()->name . ' & ' . $recipient->name,
        ]);

        $room->users()->attach([$currentUserId, $recipientId]);

        if ($request->header('X-Inertia')) {
            return redirect()->route('chat.show', $room->id);
        }

        return response()->json([
            'room' => $room->load('users'),
            'redirect_url' => route('chat.show', $room->id),
        ], 201);
    }

    public function storeMessage(Request $request, Room $room)
    {
        if (!$room->users()->where('users.id', Auth::id())->exists()) {
            abort(403);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message = Message::create([
            'room_id' => $room->id,
            'user_id' => Auth::id(),
            'body' => $validated['body'],
        ]);

        $room->touch(); // Обновляем updated_at у комнаты для сортировки
        $message->load('user');

        // Отправляем событие другим участникам комнаты через Reverb
        broadcast(new MessageSent($message))->toOthers();

        return response()->json([
            'message' => $message,
        ], 201);
    }

    private function getUserRooms($user)
    {
        return $user->rooms()
            ->with(['users', 'messages' => fn($q) => $q->latest()->limit(1)])
            ->latest('updated_at')
            ->get()
            ->map(function ($room) use ($user) {
                $lastReadAt = $room->pivot->last_read_at;

                $room->unread_count = $room->messages()
                    ->where('user_id', '!=', $user->id)
                    ->when($lastReadAt, fn($q) => $q->where('created_at', '>', $lastReadAt))
                    ->count();

                return $room;
            });
    }

    public function markAsRead(Room $room)
    {
        if (!$room->users()->where('users.id', Auth::id())->exists()) {
            abort(403);
        }

        $room->users()->updateExistingPivot(Auth::id(), [
            'last_read_at' => now(),
        ]);

        return response()->json(['status' => 'ok']);
    }
}
