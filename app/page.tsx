import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center text-center space-y-8">
        
        <div className="space-y-2">
          <h1 className="text-4xl font-light text-slate-800 tracking-tight">Ритм</h1>
          <p className="text-slate-500 text-sm">Твой личный помощник в учебе и работе</p>
        </div>

        <div className="w-28 h-28 bg-blue-50 rounded-full flex items-center justify-center">
          <span className="text-5xl">🌿</span>
        </div>

        <p className="text-slate-600 text-base leading-relaxed">
          Привет! Я помогу тебе совмещать учебу, работу и отдых. 
          Давай посмотрим, где у тебя есть реально свободное время.
        </p>

        <div className="w-full pt-4">
          <Link href="/dashboard" className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 px-4 rounded-2xl transition-all duration-200 shadow-md shadow-blue-200">
            Начать планирование
          </Link>
        </div>
      </div>
    </main>
  );
}