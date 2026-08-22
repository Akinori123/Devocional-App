const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

content = content.replace(
  "import { useState, useEffect } from 'react';",
  "import { useState, useEffect, useRef } from 'react';"
);

const stateHookStr = `  const [resending, setResending] = useState(false);
  const [dailyData, setDailyData] = useState(() => getDailyContent());`;

const dragHookStr = `  const [resending, setResending] = useState(false);
  const [dailyData, setDailyData] = useState(() => getDailyContent());
  
  // Carousel Drag to Scroll
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeft(carouselRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll speed
    carouselRef.current.scrollLeft = scrollLeft - walk;
  };
  
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };`;

content = content.replace(stateHookStr, dragHookStr);

const carouselHeaderStr = `<div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">📖 Devocionais</h2>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mb-2 font-medium">Passe para o lado para ler mensagens anteriores ➡️</p>`;

const carouselHeaderReplacement = `<div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">📖 Devocionais</h2>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <button 
                onClick={() => scrollCarousel('left')}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                title="Rolar para esquerda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => scrollCarousel('right')}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                title="Rolar para direita"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mb-3 font-medium sm:hidden">Passe para o lado para ler mensagens anteriores ➡️</p>`;

content = content.replace(carouselHeaderStr, carouselHeaderReplacement);

const carouselContainerStr = `<div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5 snap-x relative z-0">`;
const carouselContainerReplacement = `<div 
            ref={carouselRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-5 px-5 snap-x cursor-grab active:cursor-grabbing relative z-0 scroll-smooth"
          >`;

content = content.replace(carouselContainerStr, carouselContainerReplacement);

fs.writeFileSync('src/pages/Home.tsx', content);
