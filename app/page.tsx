"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// ЖЕСТКО ПРОПИСЫВАЕМ КЛЮЧИ (Anon-ключ безопасен для фронтенда)
const supabaseUrl = 'https://mbatvendpeyxjzfsjbiy.supabase.co';
const supabaseKey = 'sb_publishable_xWVduzDP1f0bPfy-UvXr8A_dWmCy5yx';
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Узнаем ID пользователя (из Telegram или для теста)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      if (tg.initDataUnsafe?.user?.id) {
        setUserId(tg.initDataUnsafe.user.id);
      } else {
        setUserId(123456789); // Заглушка для теста в браузере
      }
    } else {
      setUserId(123456789); 
    }
  }, []);

  // 2. Загружаем задачи из Supabase
  useEffect(() => {
    if (!userId) return;

    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .eq('done', false)
          .order('deadline', { ascending: true });

        if (error) {
          setErrorMsg("Ошибка базы: " + error.message);
        } else if (data) {
          setTasks(data);
        }
      } catch (err: any) {
        setErrorMsg("Ошибка сети: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, [userId]);

  // 3. Отмечаем задачу выполненной
  const toggleTask = async (id: number) => {
    const { error } = await supabase.from('tasks').update({ done: true }).eq('id', id);
    if (!error) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Загрузка данных...</div>;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6 pt-4">
        
        <div className="flex justify-between items-center">
          <Link href="/" className="text-slate-400 text-sm font-medium">← Выйти</Link>
          <span className="text-sm font-medium text-slate-500">ID: {userId}</span>
        </div>

        <h1 className="text-2xl font-semibold text-slate-800">Твои задачи из облака</h1>

        {errorMsg && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl text-sm">
            {errorMsg}
          </div>
        )}

        {tasks.length === 0 && !errorMsg && (
          <p className="text-slate-500 text-center py-8">Пока нет задач. Добавь через бота!</p>
        )}

        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} onClick={() => toggleTask(task.id)} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 cursor-pointer">
              <div className="w-5 h-5 rounded-full border-2 border-slate-300"></div>
              <div>
                <p className="font-medium text-slate-800">{task.text}</p>
                <p className="text-xs text-slate-400 mt-1">{task.category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}