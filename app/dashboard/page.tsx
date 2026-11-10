"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

type Task = {
  id: number;
  title: string;
  category: string;
  time: string;
  completed?: boolean;
  scheduledTime?: string; 
};

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [energy, setEnergy] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); 
  
  // Настройки расписания
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [sleepStart, setSleepStart] = useState("23:00");
  const [sleepEnd, setSleepEnd] = useState("07:00");
  const [protectedTime, setProtectedTime] = useState("19:00 - 21:00");

  // Поля новой задачи
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Учеба");
  const [newDuration, setNewDuration] = useState(60); 

  // Загрузка из памяти
  useEffect(() => {
    try {
      const savedTasks = window.localStorage.getItem('ritm-tasks');
      if (savedTasks) setTasks(JSON.parse(savedTasks));
      
      const savedSchedule = window.localStorage.getItem('ritm-schedule');
      if (savedSchedule) {
        const s = JSON.parse(savedSchedule);
        setWorkStart(s.workStart || "09:00");
        setWorkEnd(s.workEnd || "18:00");
        setSleepStart(s.sleepStart || "23:00");
        setSleepEnd(s.sleepEnd || "07:00");
        setProtectedTime(s.protectedTime || "19:00 - 21:00");
      }
    } catch (e) {}
  }, []);

  // Сохранение в память
  useEffect(() => {
    try {
      window.localStorage.setItem('ritm-tasks', JSON.stringify(tasks));
      window.localStorage.setItem('ritm-schedule', JSON.stringify({ workStart, workEnd, sleepStart, sleepEnd, protectedTime }));
    } catch (e) {}
  }, [tasks, workStart, workEnd, sleepStart, sleepEnd, protectedTime]);

  // ИИ для автоопределения категории
  const autoCategorize = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('лекци') || lowerText.includes('учеб') || lowerText.includes('курсов') || lowerText.includes('читать') || lowerText.includes('экзамен')) setNewCategory('Учеба');
    else if (lowerText.includes('работ') || lowerText.includes('отчет') || lowerText.includes('созвон') || lowerText.includes('письм') || lowerText.includes('смен')) setNewCategory('Работа');
    else if (lowerText.includes('купить') || lowerText.includes('убрать') || lowerText.includes('врач') || lowerText.includes('дом')) setNewCategory('Быт');
    else if (lowerText.includes('отдохнуть') || lowerText.includes('играть') || lowerText.includes('гулять') || lowerText.includes('кино')) setNewCategory('Отдых');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(e.target.value);
    autoCategorize(e.target.value);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newTask: Task = {
      id: Date.now(),
      title: newTitle,
      category: newCategory,
      time: `${newDuration} мин`,
      completed: false,
    };
    setTasks([...tasks, newTask]);
    setIsModalOpen(false);
    setNewTitle("");
  };

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
  };

  // Умный планировщик
  const generatePlan = () => {
    const activeTasks = tasks.filter(t => !t.completed && !t.scheduledTime);
    if (activeTasks.length === 0) {
      alert("Все задачи уже распределены или выполнены!");
      return;
    }

    let currentHour = 8;
    let currentMinute = 0;
    
    const plannedTasks = tasks.map(task => {
      if (task.completed || task.scheduledTime) return task;

      let slotTime = "";
      
      while (currentHour < 23) {
        const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        const isWork = currentHour >= parseInt(workStart.split(':')[0]) && currentHour < parseInt(workEnd.split(':')[0]);
        const isProtected = timeStr >= protectedTime.split(' - ')[0] && timeStr < protectedTime.split(' - ')[1];

        if (!isWork && !isProtected) {
          slotTime = timeStr;
          currentMinute += 30; 
          if (currentMinute >= 60) { currentHour += 1; currentMinute = 0; }
          break;
        }
        currentHour += 1;
      }

      return { ...task, scheduledTime: slotTime || "На завтра" };
    });

    setTasks(plannedTasks);
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans flex flex-col items-center relative">
      <div className="w-full max-w-2xl space-y-6 pt-4 md:pt-6 pb-20">
        
        <div className="flex justify-between items-center">
          <Link href="/" className="text-slate-400 hover:text-blue-500 transition-colors text-sm font-medium">
            ← Выйти
          </Link>
          <button onClick={() => setIsSettingsOpen(true)} className="text-sm text-slate-500 hover:text-blue-500 font-medium">
            ⚙️ Настроить
          </button>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-800">Привет! 👋</h1>
          <p className="text-sm md:text-base text-slate-500">Вот твой план на сегодня.</p>
        </div>

        {/* Блок энергии */}
        <div className="bg-white rounded-3xl shadow-sm p-4 md:p-6 border border-slate-100">
          <h2 className="text-base md:text-lg font-medium text-slate-800 mb-3 md:mb-4">Как твои силы сегодня?</h2>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <button onClick={() => setEnergy(1)} className={`py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${energy === 1 ? 'bg-red-50 border-2 border-red-200 text-red-700' : 'bg-slate-50 border-2 border-transparent text-slate-600'}`}>
              <span className="text-xl">🔋</span><span className="text-xs">Мало</span>
            </button>
            <button onClick={() => setEnergy(2)} className={`py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${energy === 2 ? 'bg-yellow-50 border-2 border-yellow-200 text-yellow-700' : 'bg-slate-50 border-2 border-transparent text-slate-600'}`}>
              <span className="text-xl">🔋🔋</span><span className="text-xs">Норма</span>
            </button>
            <button onClick={() => setEnergy(3)} className={`py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${energy === 3 ? 'bg-green-50 border-2 border-green-200 text-green-700' : 'bg-slate-50 border-2 border-transparent text-slate-600'}`}>
              <span className="text-xl">🔋🔋🔋</span><span className="text-xs">Полон сил</span>
            </button>
          </div>
        </div>

        {/* Список задач */}
        <div className="space-y-3">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h2 className="text-base md:text-lg font-medium text-slate-800">Задачи на сегодня</h2>
              <p className="text-xs text-slate-500 mt-1">Выполнено: {completedCount} из {totalCount}</p>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="text-sm text-blue-600 font-medium hover:text-blue-700 pb-1">
              + Добавить
            </button>
          </div>

          <div className="w-full h-2 bg-slate-200 rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
          </div>

          <button onClick={generatePlan} className="w-full py-3 mb-4 bg-indigo-50 text-indigo-700 font-medium rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 flex items-center justify-center gap-2">
            ✨ Спланировать день
          </button>

          {tasks.map((task) => (
            <div key={task.id} onClick={() => toggleTask(task.id)} className={`rounded-2xl shadow-sm p-3 md:p-4 border flex items-center justify-between group cursor-pointer transition-all ${task.completed ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${task.completed ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                  {task.completed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                  <p className={`text-sm md:text-base font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</p>
                  <div className="flex gap-2 items-center mt-1">
                    <span className={`text-[10px] md:text-xs ${task.completed ? 'text-slate-300' : 'text-slate-400'}`}>{task.category} • {task.time}</span>
                    {task.scheduledTime && !task.completed && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        ⏰ {task.scheduledTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Настройки расписания */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Мое расписание</h3>
            <p className="text-sm text-slate-500 mb-4">Планировщик не будет ставить задачи на это время.</p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Начало работы</label>
                  <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Конец работы</label>
                  <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Отбой (сон)</label>
                  <input type="time" value={sleepStart} onChange={e => setSleepStart(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Подъем</label>
                  <input type="time" value={sleepEnd} onChange={e => setSleepEnd(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Защищенное время (Отдых)</label>
                <input type="text" value={protectedTime} onChange={e => setProtectedTime(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl" />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button onClick={() => setIsSettingsOpen(false)} className="w-full py-3 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка добавления задачи */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
              Новая задача <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-md">ИИ-подсказки</span>
            </h3>
            
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Что нужно сделать?</label>
                <input type="text" value={newTitle} onChange={handleTitleChange} placeholder="Например: купить хлеб" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500" autoFocus />
                <div className="mt-2 bg-blue-50 text-blue-700 text-xs p-2 rounded-lg flex items-start gap-2">
                  <span className="text-lg leading-none">💡</span>
                  <p>На телефоне используйте <b>микрофон на клавиатуре</b>.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Категория</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <option value="Учеба">Учеба</option>
                    <option value="Работа">Работа</option>
                    <option value="Быт">Быт</option>
                    <option value="Отдых">Отдых</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Примерное время</label>
                  <select value={newDuration} onChange={(e) => setNewDuration(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <option value={15}>15 минут</option>
                    <option value={30}>30 минут</option>
                    <option value={60}>1 час</option>
                    <option value={120}>2 часа</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Отмена</button>
                <button type="submit" className="flex-1 py-3 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}