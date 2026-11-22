import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import UserSearch from '@/Components/UserSearch'; // <-- Импортируем наш компонент

export default function Dashboard() {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Dashboard
                </h2>
            }
        >
            <Head title="Dashboard" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg p-6">
                        <p className="text-gray-900 mb-6">You're logged in!</p>
                        
                        {/* Вставляем компонент поиска чата */}
                        <UserSearch />
                        
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}