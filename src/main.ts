import './style.css';
import { getReadings, filterByChamber, filterByDays, getDateBounds, getUniqueDevices, calcStats, type SensorReading } from './dataService.ts';

// Shared Header Component
const HeaderHTML = `
<header class="w-full sticky top-0 z-50 bg-sky-50/80 backdrop-blur-xl bg-gradient-to-b from-sky-100 to-transparent flex justify-between items-center px-6 py-4">
  <div class="flex items-center gap-3">
    <!-- Back arrow for internal pages, or thermostat icon for home -->
    <button onclick="window.location.pathname === '/' || window.location.pathname.includes('index.html') ? null : window.history.back()" class="p-2 rounded-full hover:opacity-80 transition-opacity scale-95 active:scale-90 transition-transform text-sky-700">
      <span class="material-symbols-outlined" id="header-icon">thermostat</span>
    </button>
    <span class="text-xl font-bold text-sky-900 font-['Space_Grotesk'] tracking-tight text-2xl">Get Temp</span>
  </div>
  <button id="header-profile-btn" onclick="window.location.href='ajustes.html'" class="w-11 h-11 rounded-full bg-sky-200 flex items-center justify-center text-sky-900 font-bold text-sm border-2 border-white shadow-sm cursor-pointer hover:bg-sky-300 hover:scale-105 transition-all duration-200" title="Acessar perfil">
    <span id="header-avatar-initials">TS</span>
  </button>
</header>
`;

// Shared Bottom NavBar Component
const NavBarHTML = `
<nav class="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-white/60 backdrop-blur-2xl rounded-t-[2.5rem] border-t border-white/20 shadow-[0_-12px_40px_rgba(25,28,30,0.04)]">
  <button onclick="window.location.href='index.html'" class="flex flex-col items-center justify-center bg-sky-100 text-sky-900 rounded-full px-5 py-2 ease-in-out duration-300 transform active:scale-95 shadow-sm nav-btn" data-page="index.html">
    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">dashboard</span>
    <span class="font-['Manrope'] text-[10px] font-semibold uppercase tracking-wider mt-0.5 tracking-widest">Status</span>
  </button>
  <button onclick="window.location.href='analise.html'" class="flex flex-col items-center justify-center text-slate-500 px-5 py-2 hover:bg-sky-50 ease-in-out duration-300 transform active:scale-95 nav-btn" data-page="analise.html">
    <span class="material-symbols-outlined">show_chart</span>
    <span class="font-['Manrope'] text-[10px] font-semibold uppercase tracking-wider mt-0.5 tracking-widest">Análise</span>
  </button>
  <button onclick="window.location.href='relatorios.html'" class="flex flex-col items-center justify-center text-slate-500 px-5 py-2 hover:bg-sky-50 ease-in-out duration-300 transform active:scale-95 nav-btn" data-page="relatorios.html">
    <span class="material-symbols-outlined">description</span>
    <span class="font-['Manrope'] text-[10px] font-semibold uppercase tracking-wider mt-0.5 tracking-widest">Relatórios</span>
  </button>
  <button onclick="window.location.href='ajustes.html'" class="flex flex-col items-center justify-center text-slate-500 px-5 py-2 hover:bg-sky-50 ease-in-out duration-300 transform active:scale-95 nav-btn" data-page="ajustes.html">
    <span class="material-symbols-outlined">settings</span>
    <span class="font-['Manrope'] text-[10px] font-semibold uppercase tracking-wider mt-0.5 tracking-widest">Ajustes</span>
  </button>
</nav>
`;

document.addEventListener("DOMContentLoaded", () => {
  // Inject Header and Footer into body
  document.body.insertAdjacentHTML("afterbegin", HeaderHTML);

  const currentPath = window.location.pathname;

  // Helper: handles both /page and /page.html (accounts for Vercel cleanUrls)
  const isPage = (name: string) =>
    currentPath.endsWith(`/${name}.html`) ||
    currentPath.endsWith(`/${name}`) ||
    currentPath === `/${name}`;

  if (!isPage('login') && !isPage('visualizacao_relatorio')) {
      document.body.insertAdjacentHTML("beforeend", NavBarHTML);
  }

  // Simple Auth Protection
  const token = localStorage.getItem('authToken');
  const onLoginPage = isPage('login');
  
  if (!token && !onLoginPage) {
    window.location.href = 'login.html';
    return;
  }
  if (token && onLoginPage) {
    window.location.href = 'index.html';
    return;
  }

  // Update header avatar initials from saved profile
  const savedName = localStorage.getItem('profile_name');
  if (savedName) {
    const initials = savedName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    setTimeout(() => {
      const avatarEl = document.getElementById('header-avatar-initials');
      if (avatarEl) avatarEl.textContent = initials;
    }, 0);
  }

  // --- Auth Logic (Login) ---
  if (onLoginPage) {
    const loginForm = document.getElementById('login-form') as HTMLFormElement;
    const errorMsg = document.getElementById('login-error');
    const togglePwd = document.getElementById('toggle-password');
    const pwdInput = document.getElementById('password') as HTMLInputElement;

    if (togglePwd && pwdInput) {
      togglePwd.addEventListener('click', () => {
        const type = pwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
        pwdInput.setAttribute('type', type);
        togglePwd.querySelector('span')!.textContent = type === 'password' ? 'visibility' : 'visibility_off';
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = (document.getElementById('email') as HTMLInputElement).value;
        const pwd = pwdInput.value;
        const remember = (document.getElementById('remember') as HTMLInputElement).checked;

        if (email === 'admin@gettemp.io' && pwd === 'gettemp123') {
           if (remember) localStorage.setItem('authToken', 'demo-token-123');
           else sessionStorage.setItem('authToken', 'demo-token-123'); // Fallback if not persisting, but simplify for demo:
           localStorage.setItem('authToken', 'demo-token-123'); // Just use local storage for demo
           window.location.href = 'index.html';
        } else {
           if (errorMsg) errorMsg.classList.remove('hidden');
        }
      });
    }
  }

  // Change Header icon to back arrow if not on index
  if (!isPage('index') && currentPath !== '/') {
    const icon = document.getElementById('header-icon');
    if (icon) icon.textContent = 'arrow_back';
  }

  // Highlight active Nav Button
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    if (btn instanceof HTMLElement && btn.dataset.page && currentPath.includes(btn.dataset.page)) {
      btn.classList.add('bg-sky-100', 'text-sky-900', 'shadow-sm');
      btn.classList.remove('text-slate-500', 'hover:bg-sky-50');
      const icon = btn.querySelector('span');
      if(icon) icon.style.fontVariationSettings = "'FILL' 1";
    } else {
      btn.classList.remove('bg-sky-100', 'text-sky-900', 'shadow-sm');
      btn.classList.add('text-slate-500', 'hover:bg-sky-50');
      const icon = btn.querySelector('span');
      if(icon) icon.style.fontVariationSettings = "'FILL' 0";
    }
  });

  // Re-run dynamic script logic if on Dashboard (index.html)
  if (isPage('index') || currentPath === '/') {
    getReadings().then(dataArray => {
        if (!dataArray || dataArray.length === 0) return;
        
        // Grab the most recent reading for Câmara 01 for the main dashboard
        const cam1Readings = filterByChamber(dataArray, 'CAM01');
        const mainData = cam1Readings[cam1Readings.length - 1] || dataArray[0];
        
        const camNameEl = document.getElementById('cam_name');
        const camTempEl = document.getElementById('cam_temp');
        const sysStatusEl = document.getElementById('system_status');
        const sysSpiffsEl = document.getElementById('system_spiffs');
        const sysRssiEl = document.getElementById('system_rssi');

        if(camNameEl) camNameEl.textContent = mainData.name || 'Câmara';
        if(camTempEl) camTempEl.textContent = mainData.temp !== undefined ? Math.round(mainData.temp).toString() : '--';
        if(sysStatusEl) sysStatusEl.textContent = mainData.connection === 'Connected' ? 'Sistema Normal' : 'Desconectado';
        if(sysSpiffsEl) sysSpiffsEl.textContent = mainData.spiffs_usage + '%';
        if(sysRssiEl) sysRssiEl.textContent = mainData.wifi_rssi + ' dBm';
        
        // Create trend grid for the 2 chambers
        const gridContainer = document.getElementById('dynamic-chambers-grid');
        if (gridContainer) {
            let gridHtml = '';
            
            // Unique devices snippet
            const uniqueDevices = getUniqueDevices(dataArray);
            
            for (let deviceId of uniqueDevices) {
                const readings = filterByChamber(dataArray, deviceId);
                const latest = readings[readings.length - 1] as SensorReading;
                
                const isSafe = latest.connection === 'Connected' && latest.temp < -15;
                const badgeClass = isSafe ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
                const badgeText = latest.connection === 'Disconnected' ? 'Offline' : (isSafe ? 'Seguro' : 'Aviso');
                const progressHue = isSafe ? 'bg-primary' : 'bg-secondary-container';
                
                gridHtml += `
                <div class="glass-card p-6 rounded-lg ring-1 ring-white/30 flex flex-col justify-between min-h-[160px] cursor-pointer hover:shadow-md transition-shadow" onclick="window.location.href='detalhes_camara.html?id=${latest.device_id}'">
                    <div>
                        <div class="flex justify-between items-start mb-3">
                            <p class="text-xs font-label text-on-surface-variant opacity-80 uppercase tracking-[0.15em] font-bold">${latest.name}</p>
                            <span class="px-2.5 py-1 rounded-full ${badgeClass} text-[10px] font-bold uppercase tracking-wider">${badgeText}</span>
                        </div>
                        <p class="text-4xl font-headline font-bold text-on-surface">${Math.round(latest.temp)}°C</p>
                        <p class="text-[10px] text-slate-500 mt-1">${readings.length} leituras em log</p>
                    </div>
                    <div class="h-1.5 bg-surface-container-highest rounded-full overflow-hidden mt-4">
                        <div class="h-full ${progressHue} w-[85%]"></div>
                    </div>
                </div>`;
            }
            
            gridContainer.innerHTML = gridHtml + `
                <div class="col-span-2 bg-white/60 backdrop-blur-md p-5 rounded-xl flex items-center justify-between px-8 ring-1 ring-black/5 mt-2 cursor-pointer" onclick="window.location.href='historico_alertas.html'">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-amber-600">notification_important</span>
                        <span class="text-sm font-medium text-on-surface">Monitorando Time-Series: ${dataArray.length} entradas</span>
                    </div>
                    <span class="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                </div>
            `;
        }
      })
      .catch(error => console.error('Error fetching mock data:', error));
  }

  // Phase 4 & 5: Dynamic Details Page Logic
  if (isPage('detalhes_camara')) {
    const urlParams = new URLSearchParams(window.location.search);
    const deviceId = urlParams.get('id');

    if (deviceId) {
      getReadings().then((dataArray: SensorReading[]) => {
          if (!dataArray || dataArray.length === 0) return;
          const readings: SensorReading[] = filterByChamber(dataArray, deviceId);
          if (readings.length === 0) return;
          const latest: SensorReading = readings[readings.length - 1];
          const tempHeader = document.querySelector('h1.text-\\[5\\.5rem\\]');
          if (tempHeader) tempHeader.textContent = latest.temp.toFixed(1);
          
          const temps = readings.map((r: SensorReading) => r.temp);
          const minT = Math.min(...temps) - 2;
          const maxT = Math.max(...temps) + 2;
          const range = maxT - minT || 1;
          const svgWidth = 400;
          const svgHeight = 100;
          
          const points = readings.map((r: SensorReading, idx: number) => {
             const x = (idx / (readings.length - 1)) * svgWidth;
             const y = svgHeight - ((r.temp - minT) / range) * svgHeight;
             return {x, y};
          });
          
          let pathD = `M ${points[0].x} ${points[0].y} `;
          for(let i = 1; i < points.length; i++) pathD += `L ${points[i].x} ${points[i].y} `;
          let fillD = pathD + `L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;
          
          const paths = document.querySelectorAll('svg path');
          if (paths && paths.length >= 2) {
             paths[0].setAttribute('d', pathD);
             paths[1].setAttribute('d', fillD);
          }
          
          const logsContainer = document.querySelector('.space-y-3');
          if (logsContainer) {
              logsContainer.innerHTML = '';
              [...readings].reverse().forEach((r: SensorReading) => {
                  const safeStr = (r.temp < -15 && r.connection === 'Connected');
                  const color = safeStr ? 'bg-primary' : 'bg-secondary';
                  const title = r.connection === 'Disconnected' ? 'Equipamento Offline' : (safeStr ? 'Leitura Estável' : 'Alerta de Temperatura');
                  const logHtml = `<div class="flex items-center justify-between p-4 bg-surface-container-low rounded-lg transition-colors hover:bg-surface-container-high">
                        <div class="flex items-center gap-4">
                            <div class="w-2 h-2 rounded-full ${color}"></div>
                            <div>
                                <p class="font-semibold text-on-surface">${title} (${r.temp}°C)</p>
                                <span class="text-[12px] text-on-surface-variant">${r.date}, ${r.time}</span>
                            </div>
                        </div>
                    </div>`;
                  logsContainer.insertAdjacentHTML('beforeend', logHtml);
              });
          }
        });
    }
  }

  // Phase 5 & 6: Dynamic Analysis Page Logic
  if (isPage('analise')) {
      let globalData: SensorReading[] = [];
      let currentChamber = 'ALL';
      let currentDays = 1;

      const renderAnalytics = () => {
          if (globalData.length === 0) return;

          let filtered = filterByDays(globalData, currentDays);
          filtered = filterByChamber(filtered, currentChamber);
          if (filtered.length === 0) filtered = [globalData[0]]; // fallback if empty

          // 1. Calculate Stats
          const { max: maxTemp, min: minTemp, avg: avgTemp } = calcStats(filtered);
          
          const statBlocks = document.querySelectorAll('.text-3xl.font-headline');
          if (statBlocks.length >= 3) {
              statBlocks[0].textContent = `${maxTemp.toFixed(1)}°C`;
              statBlocks[1].textContent = `${minTemp.toFixed(1)}°C`;
              statBlocks[2].textContent = `${avgTemp.toFixed(1)}°C`;
          }
          
          // Re-draft the SVG line
          const range = maxTemp - minTemp || 1;
          const svgWidth = 400;
          const svgHeight = 100;
          const points = filtered.map((r: SensorReading, idx: number) => {
             const x = (idx / (filtered.length - 1 || 1)) * svgWidth;
             const y = svgHeight - ((r.temp - minTemp) / range) * svgHeight;
             return {x, y, temp: r.temp};
          });
          let pathD = `M ${points[0].x} ${points[0].y} `;
          for(let i = 1; i < points.length; i++) pathD += `L ${points[i].x} ${points[i].y} `;
          let fillD = pathD + `L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;
          
          const paths = document.querySelectorAll('svg path');
          if (paths && paths.length >= 2) {
             paths[0].setAttribute('d', fillD);
             paths[1].setAttribute('d', pathD);
          }

          // Anchor dynamic Peak Tooltip Coordinate
          const peakIdx = points.findIndex(p => p.temp === maxTemp);
          const peakPt = points[peakIdx !== -1 ? peakIdx : 0];
          
          const pCircle = document.getElementById('chart-peak-circle');
          const pText = document.getElementById('chart-peak-text');
          
          if (pCircle) {
             pCircle.setAttribute('cx', peakPt.x.toFixed(1));
             pCircle.setAttribute('cy', peakPt.y.toFixed(1));
          }
          if (pText) {
             // Avoid clipping on SVG edges
             let textX = peakPt.x;
             if (textX < 20) textX = 20;
             if (textX > svgWidth - 20) textX = svgWidth - 20;

             pText.setAttribute('x', textX.toFixed(1));
             pText.setAttribute('y', (peakPt.y - 10).toFixed(1));
             pText.textContent = `PICO ${maxTemp.toFixed(1)}°C`;
          }

          // Generate dynamic X Axis
          const xAxisEl = document.getElementById('chart-x-axis');
          if (xAxisEl) {
             if (currentDays === 1) {
                 xAxisEl.innerHTML = `<span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>`;
             } else {
                 let labels = '';
                 for(let i=0; i<5; i++){
                    const dt = new Date();
                    dt.setDate(dt.getDate() - currentDays + 1 + Math.floor((currentDays-1) * (i / 4)));
                    labels += `<span>${dt.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}</span>`;
                 }
                 xAxisEl.innerHTML = labels;
             }
          }

          // Populate Alert Logs
          const logContainer = document.querySelector('.space-y-4');
          if (logContainer) {
              logContainer.innerHTML = '';
              [...filtered].reverse().forEach((r: SensorReading) => {
                  const isAlert = r.temp >= -15 || r.connection === 'Disconnected';
                  if (!isAlert) return;
                  
                  const icon = r.connection === 'Disconnected' ? 'warning' : 'notifications_active';
                  const colorGrp = r.connection === 'Disconnected' ? 'bg-tertiary-container/30 text-tertiary' : 'bg-secondary-container/20 text-secondary';
                  const title = r.connection === 'Disconnected' ? 'Offline' : 'Alerta de Temperatura';
                  const html = `
                  <div class="flex items-center gap-6 p-4 rounded-xl bg-surface-container-low/50 transition-colors">
                      <div class="w-12 h-12 rounded-full ${colorGrp} flex items-center justify-center flex-shrink-0">
                          <span class="material-symbols-outlined text-[24px]">${icon}</span>
                      </div>
                      <div class="flex-grow grid grid-cols-2 lg:grid-cols-4 items-center gap-4">
                          <div>
                              <span class="block text-[10px] font-bold text-on-surface-variant uppercase mb-0.5">Timestamp</span>
                              <span class="font-bold text-on-background line-break">${r.date}, ${r.time}</span>
                          </div>
                          <div>
                              <span class="block text-[10px] font-bold text-on-surface-variant uppercase mb-0.5">Evento</span>
                              <span class="font-bold border-b border-black/10">${title}</span>
                          </div>
                          <div>
                              <span class="block text-[10px] font-bold text-on-surface-variant uppercase mb-0.5">Câmara</span>
                              <span class="font-bold">${r.name} (${r.temp}°C)</span>
                          </div>
                      </div>
                  </div>`;
                  logContainer.insertAdjacentHTML('beforeend', html);
              });
          }
      };

      getReadings().then(dataArray => {
            if (!dataArray || dataArray.length === 0) return;
            globalData = dataArray;
            
            // Populate Dropdown
            const selectEl = document.getElementById('chamber-select') as HTMLSelectElement;
            if (selectEl) {
                const uniqueChambers = getUniqueDevices(globalData);
                uniqueChambers.forEach(id => {
                    const cInfo = globalData.find((d: SensorReading) => d.device_id === id);
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = cInfo?.name ?? id;
                    selectEl.appendChild(opt);
                });

                selectEl.addEventListener('change', (e) => {
                    currentChamber = (e.target as HTMLSelectElement).value;
                    renderAnalytics();
                });
            }

            // Populate Time Filters
            const timeBtns = document.querySelectorAll('.time-filter');
            timeBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    timeBtns.forEach(b => {
                        b.classList.remove('bg-primary', 'text-on-primary', 'active-time');
                        b.classList.add('text-on-surface-variant');
                    });
                    const target = e.currentTarget as HTMLElement;
                    target.classList.remove('text-on-surface-variant');
                    target.classList.add('bg-primary', 'text-on-primary', 'active-time');
                    currentDays = parseInt(target.getAttribute('data-days') || '1');
                    renderAnalytics();
                });
            });


            // Initial Render
            renderAnalytics();
      });
  }

  // Phase 7: Comprehensive Dynamic Reports Export
  if (isPage('relatorios')) {
     let selectedFormat = 'PDF';
     let selectedType = 'Resumo Semanal';
     
     // Bind active format toggles (PDF / CSV / JSON)
     const formatBtns = document.querySelectorAll('.flex.gap-3 button');
     formatBtns.forEach(btn => {
         btn.addEventListener('click', (e) => {
             formatBtns.forEach(b => {
                 b.classList.remove('border-2', 'border-primary', 'text-primary', 'bg-primary/5', 'hover:bg-primary/10');
                 b.classList.add('border', 'border-outline-variant', 'text-outline', 'hover:bg-surface-container-high');
             });
             const target = e.currentTarget as HTMLElement;
             target.classList.add('border-2', 'border-primary', 'text-primary', 'bg-primary/5', 'hover:bg-primary/10');
             target.classList.remove('border', 'border-outline-variant', 'text-outline', 'hover:bg-surface-container-high');
             selectedFormat = target.textContent?.trim() || 'CSV';
         });
     });

     // Bind active Type toggles
     const typeBtns = document.querySelectorAll('.type-btn');
     typeBtns.forEach(btn => {
         btn.addEventListener('click', (e) => {
             typeBtns.forEach(b => {
                 b.classList.remove('border-primary', 'bg-primary/5', 'shadow-sm');
                 b.classList.add('border-transparent', 'bg-surface-container-low', 'hover:bg-surface-container-high');
                 b.querySelector('.material-symbols-outlined')?.classList.remove('text-primary');
                 b.querySelector('.material-symbols-outlined')?.classList.add('text-outline');
             });
             const target = e.currentTarget as HTMLElement;
             target.classList.add('border-primary', 'bg-primary/5', 'shadow-sm');
             target.classList.remove('border-transparent', 'bg-surface-container-low', 'hover:bg-surface-container-high');
             target.querySelector('.material-symbols-outlined')?.classList.add('text-primary');
             target.querySelector('.material-symbols-outlined')?.classList.remove('text-outline');
             selectedType = target.getAttribute('data-type') || 'Resumo Semanal';
         });
     });

     getReadings().then(data => {
         if(!data || data.length === 0) return;

         // Sync Date bounds
         const bounds = getDateBounds(data);
         if (!bounds) return;
         const { min: minDate, max: maxDate } = bounds;
         
         const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short', year: 'numeric'});
         const sDateInput = document.getElementById('date-start') as HTMLInputElement;
         const eDateInput = document.getElementById('date-end') as HTMLInputElement;
         if (sDateInput) sDateInput.value = fmtDate(minDate);
         if (eDateInput) eDateInput.value = fmtDate(maxDate);

         // Sync Recent Reports Sidebar dynamically
         const renderRecentReports = () => {
            const recentsContainer = document.getElementById('recent-reports-container');
            if(!recentsContainer) return;
            recentsContainer.innerHTML = '';
            let recents = JSON.parse(localStorage.getItem('gettemp_recent_reports') || '[]');
            if (recents.length === 0) {
               recentsContainer.innerHTML = '<p class="text-xs text-outline/50 italic">Nenhum relatório foi emitido no seu histórico local.</p>';
               return;
            }
            
            recents.forEach((rp: any) => {
                const dtObj = new Date(rp.date);
                const dt = dtObj.toLocaleDateString('pt-BR');
                const time = dtObj.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                const icon = rp.format === 'PDF' ? 'picture_as_pdf' : (rp.format === 'CSV' ? 'table_chart' : 'data_object');
                const color = rp.format === 'PDF' ? 'text-secondary' : 'text-primary';
                const bg = rp.format === 'PDF' ? 'bg-secondary-container/30' : 'bg-primary-container/30';
                const title = `${rp.type.split(' ')[0]}_${dt.replace(/\//g,'')}.${rp.format.toLowerCase()}`;
                
                const cLabel = rp.cams.includes('ALL') ? 'Todas Câmaras' : `${rp.cams.length} Câm.`;
                
                const btnId = `btn-rc-${rp.id}`;
                recentsContainer.insertAdjacentHTML('beforeend', `
                   <div id="${btnId}" class="bg-white/40 border border-white/50 p-4 rounded-lg flex items-center gap-4 group hover:bg-white transition-colors cursor-pointer shadow-sm">
                       <div class="w-12 h-12 rounded-md ${bg} flex items-center justify-center ${color}">
                           <span class="material-symbols-outlined">${icon}</span>
                       </div>
                       <div class="flex-1 overflow-hidden">
                           <h4 class="font-headline text-[13px] font-bold truncate text-on-surface">${title}</h4>
                           <span class="text-[10px] text-on-surface-variant font-medium">${dt} ${time} • ${cLabel}</span>
                       </div>
                       <button class="opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                           <span class="material-symbols-outlined">refresh</span>
                       </button>
                   </div>`);
                
                const btn = document.getElementById(btnId);
                if (btn) {
                   btn.addEventListener('click', () => {
                      if (rp.format === 'PDF') {
                          window.location.href = `visualizacao_relatorio.html?type=${encodeURIComponent(rp.type)}&cams=${rp.cams.join(',')}&graphs=${rp.graphs}&logs=${rp.logs}`;
                      } else {
                          alert(`Re-emitir o arquivo bruto ${rp.format} requer conexão ao Banco de Dados (Offline Mock)`);
                      }
                   });
                }
            });
         };
         
         const saveRecentReport = (type: string, format: string, cams: string[], graphs: boolean, logs: boolean) => {
             let recents = JSON.parse(localStorage.getItem('gettemp_recent_reports') || '[]');
             recents.unshift({ id: Date.now(), type, format, cams, graphs, logs, date: new Date().toISOString() });
             if(recents.length > 5) recents = recents.slice(0, 5); // Keep last 5
             localStorage.setItem('gettemp_recent_reports', JSON.stringify(recents));
             renderRecentReports();
         };

         renderRecentReports();
         
         // Dynamically populate Camera Picker Checkboxes
         const camFilterContainer = document.getElementById('camera-filter-container');
         if (camFilterContainer) {
            camFilterContainer.innerHTML = '';
            const devices = getUniqueDevices(data);
            
            camFilterContainer.insertAdjacentHTML('beforeend', `
               <label class="flex items-center gap-3 py-2 cursor-pointer group">
                  <input type="checkbox" value="ALL" checked class="cam-chk w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary transition-colors cursor-pointer checked:bg-primary" />
                  <span class="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">Todas as Câmaras (Geral)</span>
               </label>
            `);
            
            devices.forEach(dev => {
               const dRef = data.find((r: any) => r.device_id === dev);
               const realName = dRef ? dRef.name : dev;
               
               camFilterContainer.insertAdjacentHTML('beforeend', `
                  <label class="flex items-center gap-3 py-2 cursor-pointer group opacity-60 hover:opacity-100 transition-opacity">
                     <input type="checkbox" value="${dev}" class="cam-chk w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary transition-colors cursor-pointer checked:bg-primary" />
                     <span class="text-sm font-semibold text-on-surface-variant group-hover:text-primary">${realName}</span>
                  </label>
               `);
            });
            
            const checks = document.querySelectorAll('.cam-chk') as NodeListOf<HTMLInputElement>;
            const allCheck = checks[0];
            
            checks.forEach(chk => {
               chk.addEventListener('change', (e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.value === 'ALL') {
                     if (target.checked) checks.forEach(c => { if(c.value !== 'ALL') { c.checked = false; c.parentElement?.classList.add('opacity-60'); }});
                  } else {
                     if (target.checked) {
                        allCheck.checked = false;
                        allCheck.parentElement?.classList.add('opacity-60');
                        target.parentElement?.classList.remove('opacity-60');
                     } else {
                        target.parentElement?.classList.add('opacity-60');
                     }
                  }
               });
            });
         }

         // Generate Button Logics
         const generateBtn = document.getElementById('btn-generate-report');
         if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                const incGraphs = (document.getElementById('chk-graphs') as HTMLInputElement)?.checked || false;
                const incLogs = (document.getElementById('chk-logs') as HTMLInputElement)?.checked || false;
                
                // Collect selected cameras
                const camChecks = Array.from(document.querySelectorAll('.cam-chk')) as HTMLInputElement[];
                let selectedCams = camChecks.filter(c => c.checked).map(c => c.value);
                if (selectedCams.length === 0) selectedCams = ['ALL']; // fallback
                
                // Save to history
                saveRecentReport(selectedType, selectedFormat, selectedCams, incGraphs, incLogs);

                if (selectedFormat === 'PDF') {
                    window.location.href = `visualizacao_relatorio.html?type=${encodeURIComponent(selectedType)}&graphs=${incGraphs}&logs=${incLogs}&cams=${selectedCams.join(',')}`;
                    return;
                }
               
               let contentText = '';
               let typeType = '';
               let extension = '';
               
               // Applica Filtro de câmera antes de exportar
               let exportData = data;
               if (!selectedCams.includes('ALL')) {
                   exportData = data.filter((d: any) => selectedCams.includes(d.device_id) || selectedCams.includes(d.name));
               }

               if (selectedFormat === 'CSV') {
                   const header = "device_id,name,temp,wifi_rssi,date,time,connection\n";
                   const rows = exportData.map((d: any) => `${d.device_id},${d.name},${d.temp},${d.wifi_rssi},${d.date},${d.time},${d.connection}`).join("\n");
                   contentText = header + rows;
                   typeType = 'text/csv';
                   extension = 'csv';
               } else if (selectedFormat === 'JSON') {
                   // Inject configs meta for fun
                   const payload = { type: selectedType, options: { graphs: incGraphs, logs: incLogs, cams: selectedCams }, dataset: exportData };
                   contentText = JSON.stringify(payload, null, 2);
                   typeType = 'application/json';
                   extension = 'json';
               }
               
               const blob = new Blob([contentText], { type: `${typeType};charset=utf-8;` });
               const url = URL.createObjectURL(blob);
               const link = document.createElement("a");
               link.setAttribute("href", url);
               link.setAttribute("download", `relatorio_${selectedType.replace(/ /g,'_').toLowerCase()}_${new Date().getTime()}.${extension}`);
               link.style.visibility = 'hidden';
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
            });
         }
     });
  }

  // --- Nova Câmara (Multi-step Form) ---
  if (isPage('nova_camara')) {
    let currentStep = 1;
    const btnNext = document.getElementById('btn-next');
    const btnNextLabel = document.getElementById('btn-next-label');
    const btnBack = document.getElementById('btn-back');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const summary = document.getElementById('confirm-summary');
    const success = document.getElementById('step3-success');

    // Slider display updates
    const tMinSlider = document.getElementById('temp-min-slider') as HTMLInputElement;
    const tMinDisplay = document.getElementById('temp-min-display');
    const tMaxSlider = document.getElementById('temp-max-slider') as HTMLInputElement;
    const tMaxDisplay = document.getElementById('temp-max-display');

    if (tMinSlider && tMinDisplay) tMinSlider.addEventListener('input', e => { tMinDisplay.textContent = (e.target as HTMLInputElement).value + '°C'; });
    if (tMaxSlider && tMaxDisplay) tMaxSlider.addEventListener('input', e => { tMaxDisplay.textContent = (e.target as HTMLInputElement).value + '°C'; });

    // Check if we're in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const editDeviceId = urlParams.get('edit');
    let isEditMode = false;

    if (editDeviceId) {
      isEditMode = true;
      // Load existing device data from localStorage or from the readings
      const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
      const existing = storedCameras[editDeviceId];

      if (existing) {
        (document.getElementById('chamber_name') as HTMLInputElement).value = existing.name || '';
        (document.getElementById('location') as HTMLInputElement).value = existing.location || '';
        if (existing.unit_type) (document.getElementById('unit_type') as HTMLSelectElement).value = existing.unit_type;
        if (existing.temp_min) {
          tMinSlider.value = existing.temp_min;
          if (tMinDisplay) tMinDisplay.textContent = existing.temp_min + '°C';
        }
        if (existing.temp_max) {
          tMaxSlider.value = existing.temp_max;
          if (tMaxDisplay) tMaxDisplay.textContent = existing.temp_max + '°C';
        }
        (document.getElementById('device_ip') as HTMLInputElement).value = existing.ip || '';
        (document.getElementById('device_id_input') as HTMLInputElement).value = existing.device_id || editDeviceId;
        (document.getElementById('mqtt_topic') as HTMLInputElement).value = existing.mqtt_topic || '';
      }

      // Update page title for edit mode
      const stepLabel = document.getElementById('step-label');
      const stepTitle = document.querySelector('#step1 h2');
      if (stepLabel) stepLabel.textContent = 'Modo de Edição';
      if (stepTitle) stepTitle.textContent = 'Editar Câmara';

      // Change submit button text
      if (btnNextLabel) btnNextLabel.textContent = 'PRÓXIMO';
    }

    const updateView = () => {
      [step1, step2, step3].forEach(s => s?.classList.add('hidden'));
      btnBack?.classList.toggle('hidden', currentStep === 1);
      
      if (currentStep === 1) {
        step1?.classList.remove('hidden');
        if (btnNextLabel) btnNextLabel.textContent = isEditMode ? 'PRÓXIMO' : 'PRÓXIMO';
      } else if (currentStep === 2) {
        step2?.classList.remove('hidden');
        if (btnNextLabel) btnNextLabel.textContent = 'REVISAR';
      } else if (currentStep === 3) {
        step3?.classList.remove('hidden');
        if (btnNextLabel) btnNextLabel.textContent = isEditMode ? 'ATUALIZAR CÂMARA' : 'CONFIRMAR REGISTRO';
        
        // Populate summary
        if (summary) {
          const name = (document.getElementById('chamber_name') as HTMLInputElement).value;
          const loc = (document.getElementById('location') as HTMLInputElement).value;
          const min = tMinSlider.value;
          const max = tMaxSlider.value;
          const ip = (document.getElementById('device_ip') as HTMLInputElement).value;
          const did = (document.getElementById('device_id_input') as HTMLInputElement).value;

          summary.innerHTML = `
            <div class="bg-surface-container-low p-4 rounded-xl">
              <p class="text-xs text-on-surface-variant font-bold uppercase">Câmara</p>
              <p class="font-bold text-on-surface">${name || 'Não informado'} (${loc || 'N/A'})</p>
            </div>
            <div class="bg-surface-container-low p-4 rounded-xl">
              <p class="text-xs text-on-surface-variant font-bold uppercase">Limites</p>
              <p class="font-bold text-on-surface">Min: ${min}°C | Máx: ${max}°C</p>
            </div>
            <div class="bg-surface-container-low p-4 rounded-xl">
              <p class="text-xs text-on-surface-variant font-bold uppercase">Rede</p>
              <p class="font-bold text-on-surface font-mono text-sm">IP: ${ip || 'N/A'} | ID: ${did || 'N/A'}</p>
            </div>
          `;
        }
      }
    };

    btnNext?.addEventListener('click', () => {
      if (currentStep < 3) {
        // Validate required fields before proceeding
        if (currentStep === 1) {
          const name = (document.getElementById('chamber_name') as HTMLInputElement).value.trim();
          const location = (document.getElementById('location') as HTMLInputElement).value.trim();
          if (!name) {
            alert('Por favor, informe o nome da câmara.');
            return;
          }
          if (!location) {
            alert('Por favor, informe a localização da câmara.');
            return;
          }
        }
        if (currentStep === 2) {
          const ip = (document.getElementById('device_ip') as HTMLInputElement).value.trim();
          const did = (document.getElementById('device_id_input') as HTMLInputElement).value.trim();
          if (!ip) {
            alert('Por favor, informe o endereço IP do dispositivo.');
            return;
          }
          if (!did) {
            alert('Por favor, informe o ID do dispositivo.');
            return;
          }
        }
        currentStep++;
        updateView();
      } else {
        // Submit - save camera data to localStorage
        const name = (document.getElementById('chamber_name') as HTMLInputElement).value;
        const loc = (document.getElementById('location') as HTMLInputElement).value;
        const unitType = (document.getElementById('unit_type') as HTMLSelectElement).value;
        const ip = (document.getElementById('device_ip') as HTMLInputElement).value;
        const did = (document.getElementById('device_id_input') as HTMLInputElement).value || editDeviceId || 'CAM_NEW';
        const mqttTopic = (document.getElementById('mqtt_topic') as HTMLInputElement).value;

        const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
        storedCameras[did] = {
          name, location: loc, unit_type: unitType,
          temp_min: tMinSlider.value, temp_max: tMaxSlider.value,
          ip, device_id: did, mqtt_topic: mqttTopic
        };
        localStorage.setItem('gettemp_cameras', JSON.stringify(storedCameras));

        summary?.classList.add('hidden');
        btnNext.parentElement?.classList.add('hidden');
        success?.classList.remove('hidden');
        success?.classList.add('flex');

        if (success) {
          const successTitle = success.querySelector('h3');
          const successBtn = success.querySelector('button');
          if (successTitle) successTitle.textContent = isEditMode ? 'Câmara Atualizada!' : 'Câmara Registrada!';
          if (successBtn) successBtn.textContent = isEditMode ? 'Voltar para Ajustes' : 'Ir para o Dashboard';
          if (successBtn) successBtn.onclick = () => { window.location.href = isEditMode ? 'ajustes.html' : 'index.html'; };
        }
      }
    });

    btnBack?.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateView();
      }
    });

    updateView();
  }

  // --- Historico de Alertas ---
  if (isPage('historico_alertas')) {
    getReadings().then(data => {
      if (!data) return;
      // Get only disconnected or temp > -15
      const alerts = data.filter(r => r.temp >= -15 || r.connection === 'Disconnected').reverse();
      const list = document.getElementById('alerts-list');
      const search = document.getElementById('search-input') as HTMLInputElement;
      const filters = document.querySelectorAll('button[data-filter]');

      let currentFilter = 'todos';
      let currentSearch = '';

      const renderAlerts = () => {
        if (!list) return;
        list.innerHTML = '';
        
        let filtered = alerts.filter(a => {
          const type = a.connection === 'Disconnected' ? 'offline' : 'temp';
          if (currentFilter !== 'todos' && currentFilter !== type) return false;
          if (currentSearch && !a.name.toLowerCase().includes(currentSearch.toLowerCase())) return false;
          return true;
        });

        if (filtered.length === 0) {
          list.innerHTML = '<p class="text-center text-on-surface-variant py-8">Nenhum alerta encontrado.</p>';
          return;
        }

        filtered.forEach(r => {
          const isOffline = r.connection === 'Disconnected';
          const icon = isOffline ? 'warning' : 'notifications_active';
          const title = isOffline ? 'Equipamento Offline' : 'Temperatura Crítica';
          const colorClass = isOffline ? 'bg-tertiary-container/30 text-tertiary' : 'bg-error-container/30 text-error';

          list.innerHTML += `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-surface-container-low rounded-2xl gap-4 hover:shadow-md transition-shadow ring-1 ring-black/5">
              <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-full ${colorClass} flex items-center justify-center shrink-0">
                      <span class="material-symbols-outlined">${icon}</span>
                  </div>
                  <div>
                      <h4 class="font-headline font-bold text-on-surface text-lg">${title}</h4>
                      <p class="text-sm font-medium text-on-surface-variant">${r.name}</p>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="material-symbols-outlined text-[14px] text-outline">schedule</span>
                        <span class="text-xs text-outline font-bold">${r.date}, ${r.time}</span>
                      </div>
                  </div>
              </div>
              <div class="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                  <div class="text-right">
                      <span class="block text-[10px] font-bold text-outline uppercase tracking-widest">Leitura</span>
                      <span class="font-headline font-bold text-xl text-on-surface">${r.temp}°C</span>
                  </div>
                  <button class="px-5 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-sm rounded-full transition-colors ml-auto">Detalhes</button>
              </div>
            </div>`;
        });
      };

      if (search) {
        search.addEventListener('input', e => {
          currentSearch = (e.target as HTMLInputElement).value;
          renderAlerts();
        });
      }

      filters.forEach(btn => {
        btn.addEventListener('click', e => {
          filters.forEach(b => {
             b.classList.remove('bg-primary-container', 'text-on-primary-container');
             b.classList.add('bg-surface-container', 'text-on-surface');
          });
          const target = e.currentTarget as HTMLElement;
          target.classList.remove('bg-surface-container', 'text-on-surface');
          target.classList.add('bg-primary-container', 'text-on-primary-container');
          currentFilter = target.getAttribute('data-filter') || 'todos';
          renderAlerts();
        });
      });

      renderAlerts();
    });
  }

  // --- Visualizacao Relatorio ---
  if (isPage('visualizacao_relatorio')) {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'Relatório Completo';
    const hasGraphs = urlParams.get('graphs') !== 'false';
    const hasLogs = urlParams.get('logs') !== 'false';

    getReadings().then(mutData => {
      let data = [...mutData];
      if (!data || data.length === 0) return;
      
      const filterCamsStr = urlParams.get('cams');
      if (filterCamsStr && filterCamsStr !== 'ALL') {
          const validCams = filterCamsStr.split(',');
          data = data.filter(r => validCams.includes(r.device_id) || validCams.includes(r.name)); 
      }
      if (data.length === 0) return;
      
      const elChartSec = document.getElementById('report-chart-section');
      const elLogsSec = document.getElementById('report-logs-section');
      const elStatsGrid = document.getElementById('report-stats-grid');
      const elTableTitle = document.getElementById('report-table-title');

      if (!hasGraphs && elChartSec) elChartSec.classList.add('hidden');
      if (!hasLogs && elLogsSec) elLogsSec.classList.add('hidden');

      const { max, min, avg } = calcStats(data);
      const bounds = getDateBounds(data);

      const elTitle = document.getElementById('report-filename');
      const elType = document.getElementById('report-type-title');
      const elDate = document.getElementById('report-date-generated');
      const elAvg = document.getElementById('report-avg-temp');
      const elMax = document.getElementById('report-max-temp');
      const elMin = document.getElementById('report-min-temp');
      const tbl = document.getElementById('report-records-table');

      if (elTitle) elTitle.textContent = `relatorio_insight_${new Date().getTime()}.pdf`;
      if (elType) elType.textContent = type;
      if (elDate && bounds) elDate.textContent = `Gerado p/ ${bounds.min.toLocaleDateString()} a ${bounds.max.toLocaleDateString()}`;
      if (elAvg) elAvg.textContent = `${avg.toFixed(1)}°C`;
      if (elMax) elMax.textContent = `${max.toFixed(1)}°C`;
      if (elMin) elMin.textContent = `${min.toFixed(1)}°C`;

      // Populate company info from localStorage
      const companyName = localStorage.getItem('profile_company') || 'Get Temp Ltda';
      const companyLocation = localStorage.getItem('profile_company_location') || 'São Paulo, SP - Brasil';
      const companyCnpj = localStorage.getItem('profile_company_cnpj') || '00.000.000/0001-00';
      const elCompanyName = document.getElementById('report-company-name');
      const elCompanyLocation = document.getElementById('report-company-location');
      const elCompanyCnpj = document.getElementById('report-company-cnpj');
      if (elCompanyName) elCompanyName.textContent = companyName;
      if (elCompanyLocation) elCompanyLocation.textContent = companyLocation;
      if (elCompanyCnpj) elCompanyCnpj.textContent = companyCnpj;

      if (hasGraphs && elChartSec) {
         const chartContainer = elChartSec.querySelector('#dynamic-chart-container');
         if (chartContainer) {
            chartContainer.innerHTML = ''; // Limpa as barras hardcoded caso existam
            const totalBars = Math.min(data.length, 120); // render max 120 nodes so dom doesn't explode
            const step = Math.ceil(data.length / totalBars);
            for (let i = 0; i < totalBars; i++) {
               const sample = data[i * step];
               if(!sample) break;
               
               const pct = Math.max(10, Math.min(100, ((sample.temp + 40) / 40) * 90 + 10));
               const isCritical = sample.temp > -15 || sample.temp < -25;
               const bgClass = isCritical ? 'bg-error' : 'bg-primary';
               
               chartContainer.insertAdjacentHTML('beforeend', `<div class="flex-1 ${bgClass} rounded-t-sm transition-all duration-300" style="height: ${pct}%;"></div>`);
            }
         }
      }

      if (tbl) {
        if (type.includes('Auditoria') || type.includes('Risco')) {
           const safeCount = data.filter(d => d.temp >= -25 && d.temp <= -15).length;
           const safePercent = (safeCount / data.length * 100).toFixed(1);
           
           if (elStatsGrid) {
              elStatsGrid.innerHTML = `
                 <div class="p-6 bg-surface-container rounded-md col-span-2 shadow-sm border border-outline-variant/10">
                    <p class="text-[10px] font-bold text-outline uppercase tracking-widest mb-1">Taxa de Conformidade</p>
                    <p class="font-headline text-4xl font-bold ${Number(safePercent) > 90 ? 'text-primary' : 'text-error'} mb-1">${safePercent}%</p>
                    <p class="text-sm font-semibold text-on-surface-variant">${safeCount} de ${data.length} leituras auditadas ficaram em margem segura (-25°C a -15°C).</p>
                 </div>
              `;
           }
           if (elTableTitle) elTableTitle.textContent = "Desvios Críticos e Exceções Lógicas (Raw Data)";
           
           tbl.innerHTML = [...data].reverse().map(d => {
             const isWarning = d.connection !== 'Connected' || d.temp > -15 || d.temp < -25;
             if (!isWarning) return ''; // na auditoria se o user quer todas, vamos injetar tds ou n?
             // "necessário que todos os registros da base" ah, auditoria mostra tudo mas sinaliza
             return `<div class="flex items-center justify-between py-2 border-b border-surface-container/30 text-sm">
                <span class="font-medium ${isWarning ? 'text-error font-bold' : 'text-on-surface-variant'}">${d.date} ${d.time} <span class="font-normal opacity-60">| ${d.name}</span></span>
                <span class="${isWarning ? 'font-bold text-error' : 'font-semibold'}">${d.temp}°C - ${d.connection}</span>
             </div>`;
           }).join('');
        } else {
           // Relatório Completo Raw Data
           if (elTableTitle) elTableTitle.textContent = "Log Integral de Leitura Contínua";
           
           tbl.innerHTML = [...data].reverse().map(d => {
             const isWarning = d.connection !== 'Connected' || d.temp > -15 || d.temp < -25;
             return `<div class="flex items-center justify-between py-1.5 border-b border-surface-container/20 text-xs">
                <span class="font-medium ${isWarning ? 'text-error' : 'text-on-surface-variant'}">${d.date} ${d.time} <span class="font-normal opacity-50">| ${d.name} | ID:${d.device_id}</span></span>
                <span class="${isWarning ? 'font-bold bg-error/10 text-error px-1 rounded' : 'font-semibold text-primary'}">${d.temp.toFixed(1)}°C</span>
             </div>`;
           }).join('');
        }
      }

      document.getElementById('btn-pdf')?.addEventListener('click', () => {
         window.print();
      });
    });
  }

  // --- Ajustes ---
  if (isPage('ajustes')) {
    // Edit Profile
    const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Editar Perfil'));
    const modal = document.getElementById('edit-profile-modal');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const btnCancel = document.getElementById('modal-cancel');
    const btnClose = document.getElementById('close-modal');
    const btnSave = document.getElementById('modal-save');
    const profileName = document.querySelector('h2.font-headline');
    const profileRole = document.querySelector('p.mt-4.text-on-surface-variant');

    const closeModal = () => modal?.classList.add('hidden');
    const openModal = () => {
      const savedName = localStorage.getItem('profile_name');
      const savedEmail = localStorage.getItem('profile_email');
      const savedRole = localStorage.getItem('profile_role');
      const savedCompany = localStorage.getItem('profile_company');
      const savedCompanyLocation = localStorage.getItem('profile_company_location');
      const savedCompanyCnpj = localStorage.getItem('profile_company_cnpj');
      if (savedName) (document.getElementById('edit-name') as HTMLInputElement).value = savedName;
      if (savedEmail) (document.getElementById('edit-email') as HTMLInputElement).value = savedEmail;
      if (savedRole) (document.getElementById('edit-role') as HTMLInputElement).value = savedRole;
      if (savedCompany) (document.getElementById('edit-company') as HTMLInputElement).value = savedCompany;
      if (savedCompanyLocation) (document.getElementById('edit-company-location') as HTMLInputElement).value = savedCompanyLocation;
      if (savedCompanyCnpj) (document.getElementById('edit-company-cnpj') as HTMLInputElement).value = savedCompanyCnpj;
      modal?.classList.remove('hidden');
    };

    if (editBtn) {
       editBtn.addEventListener('click', openModal);
    }
    [modalBackdrop, btnCancel, btnClose].forEach(el => el?.addEventListener('click', closeModal));
    
    btnSave?.addEventListener('click', () => {
      const name = (document.getElementById('edit-name') as HTMLInputElement).value;
      const email = (document.getElementById('edit-email') as HTMLInputElement).value;
      const role = (document.getElementById('edit-role') as HTMLInputElement).value;
      const company = (document.getElementById('edit-company') as HTMLInputElement).value;
      const companyLocation = (document.getElementById('edit-company-location') as HTMLInputElement).value;
      const companyCnpj = (document.getElementById('edit-company-cnpj') as HTMLInputElement).value;
      
      localStorage.setItem('profile_name', name);
      localStorage.setItem('profile_email', email);
      localStorage.setItem('profile_role', role);
      localStorage.setItem('profile_company', company);
      localStorage.setItem('profile_company_location', companyLocation);
      localStorage.setItem('profile_company_cnpj', companyCnpj);

      if (profileName) {
        const parts = name.trim().split(' ');
        const first = parts[0] || name;
        const last = parts.slice(1).join(' ') || '';
        profileName.innerHTML = last ? `${first} <span class="text-outline-variant">${last}</span>` : first;
      }
      if (profileRole && role) {
        profileRole.textContent = role;
      }
      closeModal();
    });

    // Load saved profile on page load
    const savedName = localStorage.getItem('profile_name');
    const savedRole = localStorage.getItem('profile_role');
    if (savedName && profileName) {
      const parts = savedName.trim().split(' ');
      const first = parts[0] || savedName;
      const last = parts.slice(1).join(' ') || '';
      profileName.innerHTML = last ? `${first} <span class="text-outline-variant">${last}</span>` : first;
    }
    if (savedRole && profileRole) {
      profileRole.textContent = savedRole;
    }

    // Logout
    const sairBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Sair'));
    if (sairBtn) {
      sairBtn.addEventListener('click', () => { 
        localStorage.removeItem('authToken');
        window.location.href = 'login.html'; 
      });
    }

    // Nova Câmara button
    const novaCamaraBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Nova Câmara'));
    if (novaCamaraBtn) {
      novaCamaraBtn.addEventListener('click', () => {
        window.location.href = 'nova_camara.html';
      });
    }

    // Notification Preferences - Load and Save State
    const notificationToggles = document.querySelectorAll('section .md\\:col-span-8 input[type="checkbox"]');
    
    // Restore saved states
    notificationToggles.forEach((toggle, index) => {
      const savedState = localStorage.getItem(`notification_toggle_${index}`);
      if (savedState !== null) {
        (toggle as HTMLInputElement).checked = savedState === 'true';
      }
    });

    // Toggle Feedback & Save
    const toggles = document.querySelectorAll('input[type="checkbox"]');
    toggles.forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        const label = (e.target as HTMLElement).closest('div.flex.items-center.justify-between')?.querySelector('h5')?.textContent ?? 'Configuração';
        
        // Save to localStorage if it's a notification toggle
        notificationToggles.forEach((nt, index) => {
          if (nt === e.target) {
            localStorage.setItem(`notification_toggle_${index}`, isChecked.toString());
          }
        });

        const toast = document.createElement('div');
        toast.textContent = `${label.trim()}: ${isChecked ? 'Ativado ✓' : 'Desativado'}`;
        toast.style.cssText = `
          position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
          background:#191c1e; color:#fff; padding:12px 20px; border-radius:999px;
          font-size:13px; font-family:Manrope,sans-serif; font-weight:600;
          z-index:9999; white-space:nowrap; transition:opacity 0.3s;
        `;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
      });
    });

    // Populate Cameras
    const grid = document.getElementById('cameras-grid');
    if (grid) {
      const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
      
      getReadings().then(data => {
        const unique = data ? getUniqueDevices(data) : [];
        
        // Build a map of device data from readings
        const readingsMap: Record<string, SensorReading> = {};
        if (data) {
          unique.forEach(id => {
            const readings = filterByChamber(data, id);
            readingsMap[id] = readings[readings.length - 1];
          });
        }
        
        // Combine: registered cameras from localStorage + cameras from readings
        const allDeviceIds = new Set<string>();
        
        // Add IDs from localStorage (registered cameras)
        Object.keys(storedCameras).forEach(id => allDeviceIds.add(id));
        
        // Add IDs from readings data
        unique.forEach(id => allDeviceIds.add(id));
        
        if (allDeviceIds.size === 0) {
          grid.innerHTML = '<p class="text-center text-on-surface-variant py-8">Nenhuma câmara registrada.</p>';
          return;
        }
        
        grid.innerHTML = Array.from(allDeviceIds).map(id => {
          const stored = storedCameras[id];
          const reading = readingsMap[id];
          const name = stored?.name || reading?.name || `Câmara ${id}`;
          const location = stored?.location || '';
          const isOffline = reading?.connection === 'Disconnected';
          const temp = reading?.temp;
          const icon = isOffline ? 'warning' : 'check_circle';
          const color = isOffline ? 'text-amber-500' : 'text-primary';
          return `
          <div class="group relative overflow-hidden rounded-lg bg-surface-container-low p-8 flex flex-col justify-between min-h-[200px]" data-device-id="${id}">
              <div class="absolute top-0 right-0 p-4">
              <button class="menu-btn p-3 rounded-full hover:bg-surface-container-high transition-colors focus:outline-none">
                  <span class="material-symbols-outlined text-on-surface-variant">more_vert</span>
              </button>
              </div>
              <div>
              <span class="material-symbols-outlined ${color} mb-3 shadow-lg shadow-black/5" style="font-variation-settings: 'FILL' 1; font-size: 32px;">${icon}</span>
              <h4 class="font-headline font-bold text-2xl text-on-surface mb-1">${name}</h4>
              <p class="text-on-surface-variant text-sm font-semibold mb-4">${location ? location + ' | ' : ''}ID: ${id}</p>
              </div>
              <div class="flex gap-4">
              <div class="bg-surface-container-high px-4 py-2 rounded-md">
                  <span class="block text-[10px] uppercase font-bold text-outline tracking-wider mb-0.5">Temp. Atual</span>
                  <span class="${color} font-bold text-xs">${temp !== undefined ? temp + '°C' : '--'}</span>
              </div>
              <div class="bg-surface-container-high px-4 py-2 rounded-md">
                  <span class="block text-[10px] uppercase font-bold text-outline tracking-wider mb-0.5">Status</span>
                  <span class="${color} font-bold text-xs">${isOffline ? 'Offline' : 'Online'}</span>
              </div>
              </div>
          </div>`;
        }).join('');

        // Context Menu logic
        const contextMenu = document.getElementById('context-menu');
        const editButton = contextMenu?.querySelector('button:first-child');
        const deleteButton = contextMenu?.querySelector('button:last-child');
        let selectedDeviceId = '';

        document.querySelectorAll('.menu-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parentCard = (e.currentTarget as HTMLElement).closest('.group');
            if (!parentCard) return;

            selectedDeviceId = parentCard.getAttribute('data-device-id') || '';

            if (contextMenu) {
              contextMenu.style.top = `${(e as MouseEvent).clientY}px`;
              contextMenu.style.left = `${(e as MouseEvent).clientX - 160}px`;
              contextMenu.classList.remove('hidden');
            }
          });
        });

        if (editButton) {
          editButton.addEventListener('click', () => {
            contextMenu?.classList.add('hidden');
            if (selectedDeviceId) {
              window.location.href = `nova_camara.html?edit=${selectedDeviceId}`;
            }
          });
        }

        if (deleteButton) {
          deleteButton.addEventListener('click', () => {
            contextMenu?.classList.add('hidden');
            if (selectedDeviceId) {
              const stored = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
              delete stored[selectedDeviceId];
              localStorage.setItem('gettemp_cameras', JSON.stringify(stored));
              
              const card = document.querySelector(`[data-device-id="${selectedDeviceId}"]`) as HTMLElement;
              if (card) {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.95)';
                card.style.transition = 'all 0.3s ease';
                setTimeout(() => card.remove(), 300);
              }
            }
          });
        }
        document.addEventListener('click', () => contextMenu?.classList.add('hidden'));
      });
    }
  }
});
