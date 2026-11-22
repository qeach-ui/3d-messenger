<?php

use App\Models\Room;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('chat.room.{roomId}', function ($user, $roomId) {
    $room = Room::find($roomId);
    if (!$room) {
        return false;
    }

    return $room->users()->where('users.id', $user->id)->exists();
});

Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});