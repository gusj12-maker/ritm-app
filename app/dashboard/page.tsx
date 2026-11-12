"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Подключаем Supabase (ключи берутся из .env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type Task = {
  id: number;
  text: string;
  category: string;
  deadline: number | null;
  done: boolean;
};

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // 1. Узнаем ID пользователя (из Telegram или для теста)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      if (tg.initDataUnsafe?.user?.id) {
        setUserId(tg.initDataUnsafe.user.id);
      } else {
        // Для теста на ноутбуке (подставь свой ID, если хочешь проверить в браузере)
        setUserId(123456789); 
      }
    } else {
      setUserId(123456789); // Заглушка, если открыто просто в браузере
    }
  }, []);

  // 2. Загружаем задачи из Supabase
  useEffect(() => {
    if (!userId) return;

    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('done', false)
        .order('deadline', { ascending: true });

      if (data) setTasks(data);
      setIsLoading(false);
    };

    fetchTasks();
  }, [userId]);

  // 3. Добавляем задачу в Supabase
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !userId) return;

    const newTask = {
      id: Date.now(),
      user_id: userId,
      text: newTitle,
      category: 'Другое', // Пока ставим так, потом сделаем ИИ
      done: false,
      deadline: null,
      remind_time: null
    };

    const { error } = await supabase.from('tasks').insert([newTask]);
    
    if (!error) {
      setTasks([...tasks, newTask]);
      setIsModalOpen(false);
      setNewTitle("");
    }
  };

  // 4. Отмечаем задачу выполненной
  const toggleTask = async (id: number) => {
    const { error } = await supabase.from('tasks').update({ done: true }).eq('id', id);
    if (!error) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Загрузка данных из облака...</div>;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans flex flex-col items-center relative">
      <div className="w-full max-w-2xl space-y-6 pt-4 md:pt-6 pb-20">
        
        <div className="flex justify-between items-center">
          <Link href="/" className="text-slate-400 hover:text-blue-500 transition-colors text-sm font-medium">
            ← Выйти
          </Link>
          <span className="text-sm font-medium text-slate-500">Твой профиль</span>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-800">Привет! 👋</h1>
          <p className="text-sm md:text-base text-slate-500">Вот твои задачи из облака.</p>
        </div>

        {/* Список задач */}
        <div className="space-y-3">
          <div className="flex justify-between items-end mb-2">
            <h2 className="text-base md:text-lg font-medium text-slate-800">Задачи на сегодня</h2>
            <button onClick={() => setIsModalOpen(true)} className="text-sm text-blue-600 font-medium hover:text-blue-700 pb-1">
              + Добавить
            </button>
          </div>

          {tasks.length === 0 && (
             <p className="text-slate-500 text-center py-8">Пока нет задач. Добавь через бота или кнопку выше!</p>
          )}

          {tasks.map((task) => (
            <div key={task.id} onClick={() => toggleTask(task.id)} className="rounded-2xl shadow-sm p-3 md:p-4 border border-slate-100 bg-white flex items-center gap-3 cursor-pointer hover:border-blue-200 transition-all">
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center"></div>
              <div>
                <p className="text-sm md:text-base font-medium text-slate-800">{task.text}</p>
                <p className="text-[10px] md:text-xs text-slate-400 mt-1">{task.category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Модальное окно добавления */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Новая задача</h3>
            <form onSubmit={handleAddTask} className="space-y-4">
              <input 
                type="text" 
                value={newTitle} 
                onChange={(e) => setNewTitle(e.target.value)} 
                placeholder="Что нужно сделать?" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                autoFocus 
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl font-medium text-slate-600 bg-slate-100">Отмена</button>
                <button type="submit" className="flex-1 py-3 rounded-xl font-medium text-white bg-blue-600">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}