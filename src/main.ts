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
  <div class="flex items-center">
    <div class="w-10 h-10 rounded-full bg-sky-200 flex items-center justify-center text-sky-900 font-bold text-xs border-2 border-white shadow-sm">TS</div>
  </div>
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
  document.body.insertAdjacentHTML("beforeend", NavBarHTML);

  const currentPath = window.location.pathname;

  // Helper: handles both /page and /page.html (accounts for Vercel cleanUrls)
  const isPage = (name: string) =>
    currentPath.endsWith(`/${name}.html`) ||
    currentPath.endsWith(`/${name}`) ||
    currentPath === `/${name}`;

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
             return {x, y};
          });
          let pathD = `M ${points[0].x} ${points[0].y} `;
          for(let i = 1; i < points.length; i++) pathD += `L ${points[i].x} ${points[i].y} `;
          let fillD = pathD + `L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;
          
          const paths = document.querySelectorAll('svg path');
          if (paths && paths.length >= 2) {
             paths[0].setAttribute('d', fillD);
             paths[1].setAttribute('d', pathD);
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

            // Target Context PDF Export for Alert Log
            const pdfBtns = document.querySelectorAll('button');
            pdfBtns.forEach(btn => {
                if (btn.textContent && btn.textContent.includes('Baixar PDF')) {
                    btn.addEventListener('click', () => {
                        const alertHtml = document.querySelector('.space-y-4')?.outerHTML || '';
                        
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                            printWindow.document.write(`
                                <html>
                                <head>
                                    <title>Relatório Especializado de Alertas - Get Temp</title>
                                    <script src="https://cdn.tailwindcss.com"></script>
                                    <style>
                                        body { padding: 40px; font-family: sans-serif; }
                                        h1 { color: #006399; font-size: 24px; margin-bottom: 5px; }
                                        p { color: #555; font-size: 14px; margin-bottom: 20px;}
                                        .report-meta { border-bottom: 2px solid #006399; margin-bottom: 20px; padding-bottom: 10px; }
                                    </style>
                                </head>
                                <body>
                                    <div class="report-meta">
                                        <h1>Relatório de Desvios Térmicos</h1>
                                        <p>Gerado em: ${new Date().toLocaleString()}</p>
                                        <p>Filtros Ativos: Câmara = ${currentChamber}, Período = ${currentDays} dias úteis</p>
                                    </div>
                                    <div style="margin-top:20px;">
                                        ${alertHtml}
                                    </div>
                                    <script>
                                        // Wait for Tailwind scripts to load roughly before printing natively
                                        setTimeout(() => {
                                            window.print();
                                            window.close();
                                        }, 1000);
                                    </script>
                                </body>
                                </html>
                            `);
                            printWindow.document.close();
                        }
                    });
                }
            });

            // Initial Render
            renderAnalytics();
      });
  }

  // Phase 7: Comprehensive Dynamic Reports Export
  if (isPage('relatorios')) {
     let selectedFormat = 'CSV';
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
         const recentsContainer = document.getElementById('recent-reports-container');
         if (recentsContainer) {
             recentsContainer.innerHTML = '';
             const mSize = data.length * 12; // fake size bytes
             
             const reports = [
                 { title: `Auditoria_${fmtDate(maxDate).replace(/ /g,'')}.pdf`, icon: 'picture_as_pdf', color: 'text-tertiary', bg: 'bg-tertiary-container/30', desc: `Gerado Hoje • ${(mSize * 2.3 / 1024).toFixed(1)} MB`},
                 { title: `Historico_${fmtDate(maxDate).replace(/ /g,'')}.csv`, icon: 'table_chart', color: 'text-primary', bg: 'bg-primary-container/30', desc: `Gerado Ontem • ${mSize} KB`},
                 { title: `Resumo_${fmtDate(minDate).replace(/ /g,'')}.pdf`, icon: 'picture_as_pdf', color: 'text-secondary', bg: 'bg-secondary-container/30', desc: `Gerado em ${fmtDate(minDate)} • ${(mSize * 1.5 / 1024).toFixed(1)} MB`}
             ];

             reports.forEach(rp => {
                 recentsContainer.insertAdjacentHTML('beforeend', `
                    <div class="bg-white/40 border border-white/50 p-4 rounded-lg flex items-center gap-4 group hover:bg-white transition-colors">
                        <div class="w-12 h-12 rounded-md ${rp.bg} flex items-center justify-center ${rp.color}">
                            <span class="material-symbols-outlined">${rp.icon}</span>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <h4 class="font-headline text-sm font-bold truncate">${rp.title}</h4>
                            <span class="text-[10px] text-on-surface-variant font-medium">${rp.desc}</span>
                        </div>
                        <button class="opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                            <span class="material-symbols-outlined">download</span>
                        </button>
                    </div>`);
             });
         }

         // Generate Button Logics
         const generateBtn = document.querySelector('button.bg-primary');
         if (generateBtn) {
            generateBtn.addEventListener('click', () => {
               const incGraphs = (document.getElementById('chk-graphs') as HTMLInputElement)?.checked;
               const incLogs = (document.getElementById('chk-logs') as HTMLInputElement)?.checked;

               if (selectedFormat === 'PDF') {
                   const printWindow = window.open('', '_blank');
                   if (printWindow) {
                       let bodyHtml = '';
                       
                       if (incGraphs) {
                           bodyHtml += `<div class="section"><h3>Representação Gráfica</h3><div class="box">[Espaço Reservado para Rendering Dinâmico do Gráfico baseado no mock: ${data.length} entradas]</div></div>`;
                       }
                       if (incLogs) {
                           const rows = data.map((d:any) => `<li>[${d.date} ${d.time}] ${d.name}: ${d.temp}°C (${d.connection})</li>`).join('');
                           bodyHtml += `<div class="section"><h3>Logs de Câmaras</h3><ul>${rows}</ul></div>`;
                       }

                       printWindow.document.write(`
                           <html>
                           <head>
                               <title>Documento Oficial - ${selectedType}</title>
                               <style>
                                   body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
                                   h1 { color: #006399; font-size: 28px; border-bottom: 2px solid #006399; padding-bottom: 10px; }
                                   h2 { font-size: 16px; color: #666; font-weight: normal; margin-bottom: 40px; }
                                   h3 { color: #004b74; margin-top: 30px; }
                                   .section { margin-bottom: 30px; }
                                   .box { border: 2px dashed #ccc; padding: 30px; text-align: center; color: #888; background: #f9f9f9; }
                                   ul { list-style: none; padding: 0; }
                                   li { padding: 8px 0; border-bottom: 1px solid #eee; font-family: monospace; font-size: 12px; }
                               </style>
                           </head>
                           <body>
                               <h1>${selectedType}</h1>
                               <h2>Baseado em Intervalo: ${fmtDate(minDate)} a ${fmtDate(maxDate)}</h2>
                               <p>Total de entradas computadas: <strong>${data.length} registros</strong>.</p>
                               ${bodyHtml}
                               <p style="margin-top:50px; text-align:center; font-size:10px; color:#aaa;">Gerado pelo Sistema ColdChain Control via Impressão Nativa (Blob)</p>
                               <script>
                                   setTimeout(() => { window.print(); window.close(); }, 800);
                               </script>
                           </body>
                           </html>
                       `);
                       printWindow.document.close();
                   }
                   return;
               }
               
               let contentText = '';
               let typeType = '';
               let extension = '';
               
               if (selectedFormat === 'CSV') {
                   const header = "device_id,name,temp,wifi_rssi,date,time,connection\\n";
                   const rows = data.map((d: any) => `${d.device_id},${d.name},${d.temp},${d.wifi_rssi},${d.date},${d.time},${d.connection}`).join("\\n");
                   contentText = header + rows;
                   typeType = 'text/csv';
                   extension = 'csv';
               } else if (selectedFormat === 'JSON') {
                   // Inject configs meta for fun
                   const payload = { type: selectedType, options: { graphs: incGraphs, logs: incLogs }, dataset: data };
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

  // Ajustes page interactive wiring
  if (isPage('ajustes')) {
    // Toggle switches: show toast-like feedback on change
    const toggles = document.querySelectorAll('input[type="checkbox"]');
    toggles.forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        const label = (e.target as HTMLElement).closest('div.flex.items-center.justify-between')?.querySelector('h5')?.textContent ?? 'Configuração';
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

    // "Nova Câmara" button → navigate to nova_camara
    const novaCamaraBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Nova Câmara'));
    if (novaCamaraBtn) {
      novaCamaraBtn.addEventListener('click', () => { window.location.href = 'nova_camara'; });
    }

    // "Editar Perfil" button → alert placeholder
    const editarBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Editar Perfil'));
    if (editarBtn) {
      editarBtn.addEventListener('click', () => {
        alert('Funcionalidade de edição de perfil disponível em breve.');
      });
    }

    // "Sair" button → redirect to login
    const sairBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Sair'));
    if (sairBtn) {
      sairBtn.addEventListener('click', () => { window.location.href = 'login'; });
    }
  }
});
