<?php

use App\Http\Controllers\ChatController;
use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return redirect()->route('chat.index');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Главная страница чатов (список комнат)
    Route::get('/chat', [ChatController::class, 'index'])->name('chat.index');

    // Страница конкретной комнаты
    Route::get('/chat/{room}', [ChatController::class, 'show'])->name('chat.show');

    // Поиск пользователей для создания диалога
    Route::get('/users/search', [ChatController::class, 'searchUsers'])->name('users.search');

    // Создание или открытие приватного диалога с пользователем
    Route::post('/rooms/direct', [ChatController::class, 'storeDirectRoom'])->name('rooms.storeDirect');

    // Отправка сообщения в комнату без перезагрузки страницы (axios + Reverb)
    Route::post('/rooms/{room}/messages', [ChatController::class, 'storeMessage'])->name('messages.store');

    Route::post('/rooms/{room}/read', [ChatController::class, 'markAsRead'])->name('rooms.read');
});

require __DIR__.'/auth.php';