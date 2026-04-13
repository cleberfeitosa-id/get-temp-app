import './style.css';
import { getReadings, filterByChamber, getDateBounds, getUniqueDevices, calcStats, onReadingsUpdate, getDeviceLimitsSync, clearAllReadings, deleteReadingById, saveLastReading, loadLastReading, initDB, type SensorReading } from './dataService.ts';
import { loginUser, registerUser, seedAdminUser, getUserChambers } from './authService.ts';

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
  const searchParams = new URLSearchParams(window.location.search);

  // Helper: handles both /page and /page.html (accounts for Vercel cleanUrls)
  const isPage = (name: string) =>
    currentPath.endsWith(`/${name}.html`) ||
    currentPath.endsWith(`/${name}`) ||
    currentPath === `/${name}`;

  // Navbar should NOT show on: login, visualizacao_relatorio
  const showNavBar = !isPage('login') && !isPage('visualizacao_relatorio');
  
  if (showNavBar) {
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

  // Initialize database and seed admin user on app load
  initDB().then(() => seedAdminUser());
  
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
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('email') as HTMLInputElement).value;
        const pwd = pwdInput.value;
        const remember = (document.getElementById('remember') as HTMLInputElement).checked;

        const user = await loginUser(email, pwd);
        
        if (user) {
          if (remember) localStorage.setItem('authToken', 'db-token-' + user.id);
          else sessionStorage.setItem('authToken', 'db-token-' + user.id);
          localStorage.setItem('authToken', 'db-token-' + user.id);
          
          localStorage.setItem('gettemp_user_id', user.id);
          localStorage.setItem('gettemp_user_email', user.email);
          localStorage.setItem('profile_name', user.name || user.email);
          
          window.location.href = 'index.html';
        } else {
          if (errorMsg) errorMsg.classList.remove('hidden');
        }
      });
    }

    // Modal: Criar Conta
    const registerLink = document.getElementById('register-link');
    const registerModal = document.getElementById('register-modal');
    const registerBackdrop = document.getElementById('register-backdrop');
    const closeRegister = document.getElementById('close-register');
    const registerForm = document.getElementById('register-form') as HTMLFormElement;
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');

    registerLink?.addEventListener('click', (e) => {
      e.preventDefault();
      registerModal?.classList.remove('hidden');
    });

    closeRegister?.addEventListener('click', () => registerModal?.classList.add('hidden'));
    registerBackdrop?.addEventListener('click', () => registerModal?.classList.add('hidden'));

    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('reg-name') as HTMLInputElement).value;
      const email = (document.getElementById('reg-email') as HTMLInputElement).value;
      const password = (document.getElementById('reg-password') as HTMLInputElement).value;
      const confirm = (document.getElementById('reg-confirm') as HTMLInputElement).value;

      registerError?.classList.add('hidden');
      registerSuccess?.classList.add('hidden');

      if (password !== confirm) {
        registerError!.textContent = 'As senhas não coincidem.';
        registerError?.classList.remove('hidden');
        return;
      }

      if (password.length < 6) {
        registerError!.textContent = 'Senha deve ter pelo menos 6 caracteres.';
        registerError?.classList.remove('hidden');
        return;
      }

      const user = await registerUser(email, password, name);
      if (user) {
        registerSuccess!.textContent = 'Conta criada com sucesso! Você pode fazer login.';
        registerSuccess?.classList.remove('hidden');
        registerForm.reset();
        setTimeout(() => {
          registerModal?.classList.add('hidden');
          registerSuccess?.classList.add('hidden');
        }, 2500);
      } else {
        registerError!.textContent = 'E-mail já cadastrado ou erro ao criar conta.';
        registerError?.classList.remove('hidden');
      }
    });

    // Modal: Esqueceu Senha
    const forgotLink = document.getElementById('forgot-password-link');
    const forgotModal = document.getElementById('forgot-modal');
    const forgotBackdrop = document.getElementById('forgot-backdrop');
    const closeForgot = document.getElementById('close-forgot');
    const forgotForm = document.getElementById('forgot-form') as HTMLFormElement;
    const forgotError = document.getElementById('forgot-error');
    const forgotSuccess = document.getElementById('forgot-success');

    forgotLink?.addEventListener('click', (e) => {
      e.preventDefault();
      forgotModal?.classList.remove('hidden');
    });

    closeForgot?.addEventListener('click', () => forgotModal?.classList.add('hidden'));
    forgotBackdrop?.addEventListener('click', () => forgotModal?.classList.add('hidden'));

    forgotForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('forgot-email') as HTMLInputElement).value;

      forgotError?.classList.add('hidden');
      forgotSuccess?.classList.add('hidden');

      // Simular envio (em produção, enviaria email com token)
      forgotSuccess!.textContent = `Link de recuperação enviado para ${email}. Verifique sua caixa de spam.`;
      forgotSuccess?.classList.remove('hidden');
      forgotForm.reset();
    });
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
    // Subscribe to real-time updates for debug panel
    const mqttChatEl = document.getElementById('mqtt-chat');
    const mqttCountEl = document.getElementById('mqtt-count');
    const connectedCountEl = document.getElementById('connected-count');
    const connectedBarEl = document.getElementById('connected-bar');
    let mqttMsgCount = 0;
    
    // Restore connected count from localStorage on page load
    const storedConnectedCount = localStorage.getItem('gettemp_connected_count');
    if (connectedCountEl && storedConnectedCount) {
      connectedCountEl.textContent = storedConnectedCount;
    }
    if (connectedBarEl && storedConnectedCount) {
      connectedBarEl.style.width = Math.min(100, parseInt(storedConnectedCount) * 50) + '%';
    }
    
    onReadingsUpdate((readings) => {
      if (!mqttChatEl || !mqttCountEl || !connectedCountEl || !connectedBarEl) return;
      
      // Get configured cameras from localStorage
      const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
      
      // Update connected count - only count truly Connected (not overheating, etc)
      const uniqueDevices = getUniqueDevices(readings);
      const connectedDevices = uniqueDevices.filter(id => {
        const latest = readings.find(r => r.device_id === id);
        return latest?.connection === 'Connected';
      });
      const count = connectedDevices.length;
      connectedCountEl.textContent = count.toString();
      connectedBarEl.style.width = Math.min(100, count * 50) + '%';
      
      // Persist connected count
      localStorage.setItem('gettemp_connected_count', count.toString());
      
      // Get latest reading sorted by time
      const sortedReadings = [...readings].sort((a, b) => {
        const timeA = new Date(`${a.date}T${a.time}`).getTime();
        const timeB = new Date(`${b.date}T${b.time}`).getTime();
        return timeB - timeA;
      });
      const latest = sortedReadings.find(r => r && r.temp !== undefined && r.temp !== null && !isNaN(r.temp));
      if (!latest) {
        console.log('[Dashboard] No valid readings with temperature found');
        return;
      }
      console.log('[Dashboard] Latest reading:', latest.temp, 'at', latest.time);
      
      // Update main display in real-time
      const camNameEl = document.getElementById('cam_name');
      const camTempEl = document.getElementById('cam_temp');
      const statusBadge = document.getElementById('status_badge');
      const statusText = document.getElementById('status_text');
      const lastUpdate = document.getElementById('last_update');
      
      const deviceConfig = storedCameras[latest.device_id];
      const displayName = deviceConfig?.name || latest.name || latest.device_id;
      
      if (camNameEl) camNameEl.textContent = displayName;
      if (camTempEl) {
        camTempEl.innerHTML = `${latest.temp.toFixed(1)}<span class="text-primary-container text-[5rem] align-top -mt-8">°C</span>`;
      }
      
      // Update status badge
      if (statusBadge && statusText) {
        statusBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2';
        if (latest.connection === 'Connected') {
          statusBadge.classList.add('bg-green-100', 'text-green-700');
          statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span><span id="status_text">Estável</span>';
        } else if (latest.connection === 'Overheating') {
          statusBadge.classList.add('bg-error-container', 'text-error');
          statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-error mr-1.5 animate-pulse"></span><span id="status_text">Superaquecimento</span>';
        } else if (latest.connection === 'SPIFFS_Warning') {
          statusBadge.classList.add('bg-tertiary-container', 'text-tertiary');
          statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-tertiary mr-1.5 animate-pulse"></span><span id="status_text">SPIFFS Crítico</span>';
        } else {
          statusBadge.classList.add('bg-red-100', 'text-red-700');
          statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse"></span><span id="status_text">Offline</span>';
        }
      }
      if (lastUpdate) lastUpdate.textContent = `Última atualização: ${latest.time}`;
      
      // Save last reading for persistence
      saveLastReading(latest);
      
      mqttMsgCount++;
      mqttCountEl.textContent = mqttMsgCount + ' msgs';
      
      // Persist MQTT chat messages (max 50, keep 24 hours)
      const chatMessages = JSON.parse(localStorage.getItem('gettemp_mqtt_chat') || '[]');
      chatMessages.unshift({
        device: displayName,
        temp: latest.temp.toFixed(1),
        rssi: latest.wifi_rssi,
        spiffs: latest.spiffs_usage.toFixed(1),
        heap: latest.free_heap,
        connection: latest.connection,
        time: new Date().toISOString()
      });
      
      // Keep only last 50 messages and within 24 hours
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const filteredMessages = chatMessages.filter((m: any) => new Date(m.time).getTime() > oneDayAgo).slice(0, 50);
      localStorage.setItem('gettemp_mqtt_chat', JSON.stringify(filteredMessages));
      
      // Add to chat (max 5 visible) - show full payload with configured name
      const chatItem = document.createElement('div');
      chatItem.className = 'bg-surface-container px-2 py-1.5 rounded border-l-2 border-primary';
      chatItem.innerHTML = `
        <span class="text-primary font-bold">${displayName}:</span>
        <span class="text-on-surface">${latest.temp.toFixed(1)}°C</span>
        <span class="text-on-surface-variant">| RSSI: ${latest.wifi_rssi}dBm</span>
        <span class="text-on-surface-variant">| SPIFFS: ${latest.spiffs_usage.toFixed(1)}%</span>
        <span class="text-on-surface-variant">| Heap: ${latest.free_heap}</span>
        <span class="text-tertiary font-bold ml-1">[${latest.connection}]</span>
      `;
      mqttChatEl.insertBefore(chatItem, mqttChatEl.firstChild);
      
      // Keep only last 5 visible
      while (mqttChatEl.children.length > 5) {
        mqttChatEl.removeChild(mqttChatEl.lastChild!);
      }
    });
    
    // Restore MQTT chat from localStorage on page load
    const storedChat = JSON.parse(localStorage.getItem('gettemp_mqtt_chat') || '[]');
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const validStoredChat = storedChat.filter((m: any) => new Date(m.time).getTime() > oneDayAgo);
    
    mqttMsgCount = validStoredChat.length;
    if (mqttCountEl) mqttCountEl.textContent = mqttMsgCount + ' msgs';
    
    if (mqttChatEl && validStoredChat.length > 0) {
      mqttChatEl.innerHTML = '';
      validStoredChat.slice(0, 5).forEach((m: any) => {
        const chatItem = document.createElement('div');
        chatItem.className = 'bg-surface-container px-2 py-1.5 rounded border-l-2 border-primary';
        chatItem.innerHTML = `
          <span class="text-primary font-bold">${m.device}:</span>
          <span class="text-on-surface">${m.temp}°C</span>
          <span class="text-on-surface-variant">| RSSI: ${m.rssi}dBm</span>
          <span class="text-on-surface-variant">| SPIFFS: ${m.spiffs}%</span>
          <span class="text-on-surface-variant">| Heap: ${m.heap}</span>
          <span class="text-tertiary font-bold ml-1">[${m.connection}]</span>
        `;
        mqttChatEl.appendChild(chatItem);
      });
    }
    
    // Load last reading from localStorage to display immediately
    const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
    const lastStoredReading = loadLastReading();
    if (lastStoredReading) {
      const camNameEl = document.getElementById('cam_name');
      const camTempEl = document.getElementById('cam_temp');
      const lastUpdate = document.getElementById('last_update');
      const statusBadge = document.getElementById('status_badge');
      
      const deviceConfig = storedCameras[lastStoredReading.device_id];
      const displayName = deviceConfig?.name || lastStoredReading.name || lastStoredReading.device_id;
      
      if (camNameEl) camNameEl.textContent = displayName;
      if (camTempEl && lastStoredReading.temp !== undefined && lastStoredReading.temp !== null) {
        camTempEl.innerHTML = `${lastStoredReading.temp.toFixed(1)}<span class="text-primary-container text-[5rem] align-top -mt-8">°C</span>`;
      }
      if (lastUpdate) lastUpdate.textContent = `Última atualização: ${lastStoredReading.time}`;
      
      // Set status based on connection
      if (statusBadge) {
        statusBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2';
        if (lastStoredReading.connection === 'Connected') {
          statusBadge.classList.add('bg-green-100', 'text-green-700');
          statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span><span id="status_text">Estável</span>';
        } else if (lastStoredReading.connection === 'Overheating') {
          statusBadge.classList.add('bg-error-container', 'text-error');
          statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-error mr-1.5 animate-pulse"></span><span id="status_text">Superaquecimento</span>';
        } else if (lastStoredReading.connection === 'SPIFFS_Warning') {
          statusBadge.classList.add('bg-tertiary-container', 'text-tertiary');
          statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-tertiary mr-1.5 animate-pulse"></span><span id="status_text">SPIFFS Crítico</span>';
        } else {
          statusBadge.classList.add('bg-red-100', 'text-red-700');
          statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse"></span><span id="status_text">Offline</span>';
        }
      }
    } else {
      // No data at all - show placeholder with hyphens
      const camTempEl = document.getElementById('cam_temp');
      const camNameEl = document.getElementById('cam_name');
      const lastUpdate = document.getElementById('last_update');
      
      if (camTempEl) {
        camTempEl.innerHTML = `<span class="text-on-surface-variant">--<span class="text-primary-container text-[5rem] align-top -mt-8">°C</span></span>`;
      }
      if (camNameEl) camNameEl.textContent = 'Aguardando dados';
      if (lastUpdate) lastUpdate.textContent = 'Última atualização: --:--';
    }
    
    getReadings().then(dataArray => {
        if (!dataArray || dataArray.length === 0) return;
        
        const camNameEl = document.getElementById('cam_name');
        const camTempEl = document.getElementById('cam_temp');
        const statusBadge = document.getElementById('status_badge');
        const statusText = document.getElementById('status_text');
        const lastUpdate = document.getElementById('last_update');
        
        // Get unique devices and their latest readings
        const uniqueDevices = getUniqueDevices(dataArray);
        
        // Find the most recent reading across all devices
        const sortedReadings = [...dataArray].sort((a, b) => {
          const timeA = new Date(`${a.date}T${a.time}`).getTime();
          const timeB = new Date(`${b.date}T${b.time}`).getTime();
          return timeB - timeA;
        });
        const latestReading = sortedReadings.find(r => r.temp !== undefined && r.temp !== null && !isNaN(r.temp));
        
        if (!latestReading) return;
        
        // Get configured name for this device
        const deviceConfig = storedCameras[latestReading.device_id];
        const displayName = deviceConfig?.name || latestReading.name || latestReading.device_id;
        
        if (camNameEl) camNameEl.textContent = displayName;
        
        if (camTempEl) {
          camTempEl.innerHTML = `${latestReading.temp.toFixed(1)}<span class="text-primary-container text-[5rem] align-top -mt-8">°C</span>`;
        }
        
        // Update status badge dynamically
        const connStatus = latestReading.connection;
        if (statusBadge && statusText) {
          statusBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2';
          
          if (connStatus === 'Connected') {
            statusBadge.classList.add('bg-green-100', 'text-green-700');
            statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span><span id="status_text">Estável</span>';
          } else if (connStatus === 'Overheating') {
            statusBadge.classList.add('bg-error-container', 'text-error');
            statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-error mr-1.5 animate-pulse"></span><span id="status_text">Superaquecimento</span>';
          } else if (connStatus === 'SPIFFS_Warning') {
            statusBadge.classList.add('bg-tertiary-container', 'text-tertiary');
            statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-tertiary mr-1.5 animate-pulse"></span><span id="status_text">SPIFFS Crítico</span>';
          } else {
            statusBadge.classList.add('bg-red-100', 'text-red-700');
            statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse"></span><span id="status_text">Offline</span>';
          }
        }
        
        if (lastUpdate) {
          lastUpdate.textContent = `Última atualização: ${latestReading.time}`;
        }
        
        // Create trend grid for all devices
        const gridContainer = document.getElementById('dynamic-chambers-grid');
        if (gridContainer) {
            let gridHtml = '';
            
            // Filter dataArray first to remove invalid readings
            const validData = dataArray.filter(r => r.temp !== undefined && r.temp !== null && !isNaN(r.temp));
            
            if (validData.length === 0) {
                gridContainer.innerHTML = '<p class="text-center text-slate-500 col-span-2">Nenhum dado de temperatura disponível</p>';
            } else {
                for (let deviceId of uniqueDevices) {
                    let readings = filterByChamber(validData, deviceId);
                    const latest = readings[readings.length - 1];
                    
                    if (!latest || latest.temp === undefined || latest.temp === null || isNaN(latest.temp)) continue;
                    
                    // Get configured name and limits
                    const devConfig = storedCameras[deviceId];
                    const devName = devConfig?.name || latest.name || deviceId;
                    const limits = getDeviceLimitsSync(deviceId);
                    
                    const isSafe = latest.connection === 'Connected' && latest.temp <= limits.max && latest.temp >= limits.min;
                    const badgeClass = isSafe ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
                    const badgeText = latest.connection === 'Disconnected' ? 'Offline' : (isSafe ? 'Seguro' : 'Aviso');
                    const progressHue = isSafe ? 'bg-primary' : 'bg-secondary-container';
                    
                    gridHtml += `
                    <div class="glass-card p-6 rounded-lg ring-1 ring-white/30 flex flex-col justify-between min-h-[160px] cursor-pointer hover:shadow-md transition-shadow max-w-sm text-center mx-auto" onclick="window.location.href='detalhes_camara.html?id=${latest.device_id}'">
                        <div class="w-full">
                            <div class="flex justify-between items-start mb-3 w-full">
                                <p class="text-xs font-label text-on-surface-variant opacity-80 uppercase tracking-[0.15em] font-bold">${devName}</p>
                                <span class="px-2.5 py-1 rounded-full ${badgeClass} text-[10px] font-bold uppercase tracking-wider">${badgeText}</span>
                            </div>
                            <p class="text-4xl font-headline font-bold text-on-surface">${Math.round(latest.temp)}°C</p>
                            <p class="text-[10px] text-slate-500 mt-1">Limites: ${limits.min}°C a ${limits.max}°C</p>
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
                        <span class="text-sm font-medium text-on-surface">Monitorando Time-Series: ${validData.length} entradas</span>
                    </div>
                    <span class="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                </div>
            `;
            }
        }
      })
      .catch(error => console.error('Error fetching data:', error));
  }

  // Phase 4 & 5: Dynamic Details Page Logic
  if (isPage('detalhes_camara')) {
    const urlParams = new URLSearchParams(window.location.search);
    const deviceId = urlParams.get('id');

    if (deviceId) {
      getReadings().then((dataArray: SensorReading[]) => {
          if (!dataArray || dataArray.length === 0) return;
          let readings: SensorReading[] = filterByChamber(dataArray, deviceId);
          
          // Filter out invalid readings
          readings = readings.filter(r => r.temp !== undefined && r.temp !== null && !isNaN(r.temp));
          
          if (readings.length === 0) return;
          const latest: SensorReading = readings[readings.length - 1];
          const tempHeader = document.querySelector('h1.text-\\[5\\.5rem\\]');
          if (tempHeader) tempHeader.textContent = latest.temp.toFixed(1);
          
          // Get device-specific limits
          const limits = getDeviceLimitsSync(deviceId);
          const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
          const devConfig = storedCameras[deviceId];
          
          // Update chart with device limits
          const temps = readings.map((r: SensorReading) => r.temp);
          const limitBuffer = Math.abs(limits.max - limits.min) * 0.2;
          const minT = Math.min(limits.min - limitBuffer, Math.min(...temps) - 1);
          const maxT = Math.max(limits.max + limitBuffer, Math.max(...temps) + 1);
          const range = maxT - minT || 1;
          const svgWidth = 400;
          const svgHeight = 100;
          
          // Padding interno do gráfico
          const padding = { left: 0, right: 0, top: 10, bottom: 10 };
          const chartInnerWidth = svgWidth - padding.left - padding.right;
          const chartInnerHeight = svgHeight - padding.top - padding.bottom;
          
          const points = readings.map((r: SensorReading, idx: number) => {
             const x = padding.left + (idx / (readings.length - 1 || 1)) * chartInnerWidth;
             const y = padding.top + chartInnerHeight - ((r.temp - minT) / range) * chartInnerHeight;
             return {x, y, temp: r.temp};
           });
          
          let pathD = '';
          if (points.length > 0 && !isNaN(points[0].y)) {
              pathD = `M ${points[0].x} ${points[0].y} `;
              for(let i = 1; i < points.length; i++) {
                  if (!isNaN(points[i].y)) {
                      pathD += `L ${points[i].x} ${points[i].y} `;
                  }
              }
          }
          // Area fill within chart bounds
          const fillD = pathD + `L ${svgWidth - padding.right} ${svgHeight - padding.bottom} L ${padding.left} ${svgHeight - padding.bottom} Z`;
          
          // Update chart paths
          const chartLine = document.getElementById('details-chart-line');
          const chartArea = document.getElementById('details-chart-area');
          if (chartLine) chartLine.setAttribute('d', pathD);
          if (chartArea) chartArea.setAttribute('d', fillD);
          
          // Update Y-axis labels
          const yAxisLabels = document.getElementById('details-y-axis');
          if (yAxisLabels) {
              yAxisLabels.innerHTML = `
                  <span>${maxT.toFixed(0)}°</span>
                  <span>${((maxT + minT) / 2).toFixed(0)}°</span>
                  <span>${minT.toFixed(0)}°</span>
              `;
          }
          
          // Add peak and valley indicators
          const maxReadingTemp = Math.max(...temps);
          const minReadingTemp = Math.min(...temps);
          const peakIdx = points.findIndex(p => p.temp === maxReadingTemp);
          const valleyIdx = points.findIndex(p => p.temp === minReadingTemp);
          
          const detailsPeakIndicator = document.getElementById('details-peak-indicator');
          if (detailsPeakIndicator && peakIdx !== -1) {
            detailsPeakIndicator.setAttribute('transform', `translate(${points[peakIdx].x}, ${points[peakIdx].y})`);
            detailsPeakIndicator.classList.remove('opacity-0');
          }
          
          const detailsValleyIndicator = document.getElementById('details-valley-indicator');
          if (detailsValleyIndicator && valleyIdx !== -1 && valleyIdx !== peakIdx) {
            detailsValleyIndicator.setAttribute('transform', `translate(${points[valleyIdx].x}, ${points[valleyIdx].y})`);
            detailsValleyIndicator.classList.remove('opacity-0');
          }
          
          // Populate alerts based on device limits
          const alertsContainer = document.getElementById('chamber-alerts');
          if (alertsContainer) {
              alertsContainer.innerHTML = '';
              
              // Filter readings that are out of limits, offline, or outliers
              const alerts = readings.filter(r => {
                  const isOutOfRange = r.temp > limits.max || r.temp < limits.min;
                  return isOutOfRange || r.connection === 'Disconnected' || r.isOutlier === true;
              }).reverse();
              
              if (alerts.length === 0) {
                  alertsContainer.innerHTML = `
                      <div class="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                          <div class="flex items-center gap-4">
                              <div class="w-2 h-2 rounded-full bg-green-500"></div>
                              <div>
                                  <p class="font-semibold text-on-surface">Nenhum alerta - Temperatura dentro dos limites</p>
                                  <span class="text-[12px] text-on-surface-variant">Limites: ${limits.min}°C a ${limits.max}°C</span>
                              </div>
                          </div>
                      </div>`;
              } else {
                  alerts.forEach((r: SensorReading) => {
                      const isOffline = r.connection === 'Disconnected';
                      const isAbove = r.temp > limits.max;
                      const isBelow = r.temp < limits.min;
                      
                      let title, color;
                      if (isOffline) {
                          title = 'Equipamento Offline';
                          color = 'bg-amber-500';
                      } else if (isAbove) {
                          title = `Temperatura acima do limite (max: ${limits.max}°C)`;
                          color = 'bg-red-500';
                      } else if (isBelow) {
                          title = `Temperatura abaixo do limite (min: ${limits.min}°C)`;
                          color = 'bg-red-500';
                      } else {
                          title = 'Alerta de Temperatura';
                          color = 'bg-secondary';
                      }
                      
                      const alertHtml = `<div class="flex items-center justify-between p-4 bg-surface-container-low rounded-lg transition-colors hover:bg-surface-container-high">
                              <div class="flex items-center gap-4">
                                  <div class="w-2 h-2 rounded-full ${color}"></div>
                                  <div>
                                      <p class="font-semibold text-on-surface">${title}</p>
                                      <span class="text-[12px] text-on-surface-variant">${r.temp.toFixed(1)}°C - ${r.date}, ${r.time}</span>
                                  </div>
                              </div>
                          </div>`;
                      alertsContainer.insertAdjacentHTML('beforeend', alertHtml);
                  });
              }
          }
          
          // Add interactive tooltip to details chart (like analise page)
          const chartSvg = document.getElementById('details-chart-svg');
          const detailsSvgWidth = 400;
          const detailsSvgHeight = 100;
          const detailsPadding = { left: 0, right: 0, top: 10, bottom: 10 };
          
          if (chartSvg && readings.length > 0) {
            // Clear old circles
            const oldCircles = chartSvg.querySelectorAll('.details-chart-point');
            oldCircles.forEach(c => c.remove());
            
            const chartRange = maxT - minT;
            const detailsMapY = (temp: number) => detailsPadding.top + (detailsSvgHeight - detailsPadding.top - detailsPadding.bottom) - ((temp - minT) / chartRange) * (detailsSvgHeight - detailsPadding.top - detailsPadding.bottom);
            const detailsMapX = (idx: number) => detailsPadding.left + (idx / (readings.length - 1 || 1)) * (detailsSvgWidth - detailsPadding.left - detailsPadding.right);
            
            // Add circles for each reading
            readings.forEach((r: SensorReading, idx: number) => {
              if (r.temp === undefined || r.temp === null || isNaN(r.temp)) return;
              
              const limits = getDeviceLimitsSync(deviceId);
              const isOutOfRange = r.temp > limits.max || r.temp < limits.min;
              const isOutlier = r.isOutlier === true;
              const status = r.connection === 'Disconnected' ? 'Offline' : (isOutlier ? 'Inválido' : (isOutOfRange ? 'Alerta' : 'Normal'));
              const statusColor = r.connection === 'Disconnected' ? '#d97706' : (isOutlier ? '#f97316' : (isOutOfRange ? '#dc2626' : '#16a34a'));
              
              const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
              circle.setAttribute('class', 'details-chart-point cursor-pointer');
              circle.setAttribute('cx', detailsMapX(idx).toString());
              circle.setAttribute('cy', detailsMapY(r.temp).toString());
              circle.setAttribute('r', '4');
              circle.setAttribute('fill', statusColor);
              circle.setAttribute('data-temp', r.temp.toString());
              circle.setAttribute('data-time', r.time || '');
              circle.setAttribute('data-date', r.date || '');
              circle.setAttribute('data-status', status);
              circle.setAttribute('data-limits', `${limits.min}°C - ${limits.max}°C`);
              circle.setAttribute('data-device', devConfig?.name || r.name || deviceId);
              circle.setAttribute('data-is-outlier', isOutlier ? 'true' : 'false');
              if (isOutlier && r.outlierReason) {
                circle.setAttribute('data-outlier-reason', r.outlierReason);
              }
              if (isOutlier && r.jumpDelta) {
                circle.setAttribute('data-jump-delta', r.jumpDelta.toString());
              }
              
              chartSvg.appendChild(circle);
            });
            
            // Add tooltip element
            let tooltip = document.getElementById('details-chart-tooltip');
            if (!tooltip) {
              tooltip = document.createElement('div');
              tooltip.id = 'details-chart-tooltip';
              tooltip.className = 'fixed hidden bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-50 pointer-events-none max-w-xs';
              document.body.appendChild(tooltip);
            }
            
            // Add event listeners
            const circles = chartSvg.querySelectorAll('.details-chart-point');
            circles.forEach((circle) => {
              circle.addEventListener('mouseenter', (e) => {
                const target = e.target as SVGElement;
                const isOutlier = target.dataset.isOutlier === 'true';
                const outlierReason = target.dataset.outlierReason || '';
                const jumpDelta = target.dataset.jumpDelta || '';
                
                let statusColor = '#16a34a';
                if (target.dataset.status === 'Offline') statusColor = '#d97706';
                else if (target.dataset.status === 'Alerta') statusColor = '#dc2626';
                else if (target.dataset.status === 'Inválido') statusColor = '#f97316';
                
                tooltip!.innerHTML = `
                  <div class="font-bold text-sm">${target.dataset.device}</div>
                  <div class="text-lg font-bold mt-1">${target.dataset.temp}°C</div>
                  <div class="text-slate-300 mt-1">${target.dataset.date} ${target.dataset.time}</div>
                  <div class="mt-2 pt-2 border-t border-slate-600">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full" style="background: ${statusColor}"></span>
                      <span>${target.dataset.status}</span>
                    </div>
                    <div class="text-slate-400 mt-1">Limites: ${target.dataset.limits}</div>
                    ${isOutlier ? `<div class="text-orange-400 mt-1 font-bold">⚠️ ${outlierReason}</div>` : ''}
                    ${jumpDelta ? `<div class="text-orange-400 mt-1">Delta: ${jumpDelta}°C</div>` : ''}
                  </div>`;
                tooltip!.classList.remove('hidden');
                target.setAttribute('r', '6');
              });
              
              circle.addEventListener('mousemove', ((e: Event) => {
                const mouseEvent = e as MouseEvent;
                tooltip!.style.left = `${mouseEvent.clientX + 15}px`;
                tooltip!.style.top = `${mouseEvent.clientY - 10}px`;
              }) as EventListener);
              
              circle.addEventListener('mouseleave', (e) => {
                const target = e.target as SVGElement;
                tooltip!.classList.add('hidden');
                target.setAttribute('r', '4');
              });
            });
            
            // Generate dynamic X Axis for details chart
            const detailsXAxis = document.getElementById('details-x-axis');
            if (detailsXAxis && readings.length > 0) {
                const numLabels = Math.min(5, Math.max(2, Math.ceil(readings.length / 8)));
                const step = Math.max(1, Math.floor((readings.length - 1) / (numLabels - 1)));
                let labels = '';
                const now = new Date();
                
                for (let i = 0; i < numLabels; i++) {
                    const idx = Math.min(i * step, readings.length - 1);
                    if (idx >= readings.length) continue;
                    const r = readings[idx];
                    const readingDate = new Date(`${r.date}T${r.time}`);
                    const hoursDiff = (now.getTime() - readingDate.getTime()) / (1000 * 60 * 60);
                    
                    let label;
                    if (hoursDiff <= 24) {
                        label = r.time.substring(0, 5);
                    } else {
                        label = readingDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
                    }
                    labels += `<span>${label}</span>`;
                }
                detailsXAxis.innerHTML = labels;
            }
          }
        });
    }
  }

  // Phase 5 & 6: Dynamic Analysis Page Logic
  if (isPage('analise')) {
      let globalData: SensorReading[] = [];
      let currentChamber = 'ALL';
      const analyticsState = { currentDays: 1 };
        
      // Get configured cameras
      const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');

      const renderAnalytics = () => {
          console.log('[renderAnalytics] globalData length:', globalData.length);
          if (globalData.length === 0) {
              console.log('[renderAnalytics] No data, returning early');
              return;
          }

          try {

          // Always filter to at least last 24 hours
          const now = new Date();
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          console.log('[renderAnalytics] globalData:', globalData.slice(0, 3));
          
          // Filter data to last 24 hours minimum
          let filtered = globalData.filter(r => {
              if (!r.date || !r.time) return false;
              try {
                  const readingTime = new Date(`${r.date}T${r.time}`);
                  return readingTime >= oneDayAgo;
              } catch {
                  return false;
              }
          });
          
          // If no data in 24h, use whatever we have
          if (filtered.length === 0) {
              filtered = globalData.slice(-20).filter(r => r.temp != null && !isNaN(r.temp));
          }
          
          // Filter out invalid readings (no temp or invalid temp)
          filtered = filtered.filter(r => r.temp !== undefined && r.temp !== null && !isNaN(r.temp));
          
          // Sort by time
          filtered.sort((a, b) => {
              try {
                  const timeA = new Date(`${a.date}T${a.time}`).getTime();
                  const timeB = new Date(`${b.date}T${b.time}`).getTime();
                  return timeA - timeB;
              } catch {
                  return 0;
              }
          });

          console.log('[renderAnalytics] filtered length after cleanup:', filtered.length);
          console.log('[renderAnalytics] sample reading:', filtered[0]);
          
          // Get device config for tooltip (use first device in filtered data)
          const firstDeviceId = filtered[0]?.device_id;
          // Use first device config if available (used in tooltip)

          // 1. Calculate Stats
          const { max: maxTemp, min: minTemp, avg: avgTemp } = calcStats(filtered);
          
          const statBlocks = document.querySelectorAll('.text-3xl.font-headline');
          if (statBlocks.length >= 3) {
              statBlocks[0].textContent = `${maxTemp.toFixed(1)}°C`;
              statBlocks[1].textContent = `${minTemp.toFixed(1)}°C`;
              statBlocks[2].textContent = `${avgTemp.toFixed(1)}°C`;
          }
          
          // Update current temp display
          const currentTempEl = document.getElementById('chart-current-temp');
          if (currentTempEl && filtered.length > 0) {
              currentTempEl.textContent = `${filtered[filtered.length - 1].temp.toFixed(1)}°C`;
          }
          
          // Device-specific limits from camera registration
          const deviceLimits = firstDeviceId ? getDeviceLimitsSync(firstDeviceId) : { min: -25, max: -15 };
          
          console.log('[Analise] Device ID:', firstDeviceId);
          console.log('[Analise] Limits:', deviceLimits);
          
          // Dynamic limits based on device-specific limits
          const limitBuffer = Math.abs(deviceLimits.max - deviceLimits.min) * 0.2;
          const upperLimit = deviceLimits.max;
          const lowerLimit = deviceLimits.min;
          const chartMin = Math.min(lowerLimit - limitBuffer, minTemp - 3);
          const chartMax = Math.max(upperLimit + limitBuffer, maxTemp + 3);
          const chartRange = chartMax - chartMin;
          
          const svgWidth = 800;
          const svgHeight = 240;
          const padding = { left: 60, right: 20, top: 20, bottom: 30 };
          const chartWidth = svgWidth - padding.left - padding.right;
          const chartHeight = svgHeight - padding.top - padding.bottom;
          
          // Map temperature to Y coordinate
          const mapY = (temp: number) => padding.top + chartHeight - ((temp - chartMin) / chartRange) * chartHeight;
          const mapX = (idx: number) => padding.left + (idx / (filtered.length - 1 || 1)) * chartWidth;
          
          // Calculate points (filter out invalid temps)
          const validReadings = filtered.filter(r => r.temp !== undefined && r.temp !== null && !isNaN(r.temp));
          const points = validReadings.map((r: SensorReading, idx: number) => ({
              x: mapX(idx),
              y: mapY(r.temp),
              temp: r.temp,
              time: r.time,
              date: r.date
          }));
          
          // Build path for line
          let linePath = '';
          if (points.length > 0) {
              linePath = `M ${points[0].x} ${points[0].y}`;
              for (let i = 1; i < points.length; i++) {
                  if (!isNaN(points[i].y)) {
                      linePath += ` L ${points[i].x} ${points[i].y}`;
                  }
              }
          }
          
          // Build area path
          let areaPath = linePath;
          if (points.length > 0) {
              areaPath += ` L ${points[points.length - 1].x} ${svgHeight - padding.bottom} L ${points[0].x} ${svgHeight - padding.bottom} Z`;
          }
          
          // Update SVG elements
          const chartLine = document.getElementById('chart-line');
          const chartArea = document.getElementById('chart-area');
          const currentPoint = document.getElementById('current-point');
          const safeZone = document.getElementById('safe-zone');
          const limitMaxLine = document.getElementById('limit-max-line');
          const limitMinLine = document.getElementById('limit-min-line');
          
          if (chartLine) chartLine.setAttribute('d', linePath);
          if (chartArea) chartArea.setAttribute('d', areaPath);
          
          // Current point (latest reading)
          if (currentPoint && points.length > 0) {
              const latestPt = points[points.length - 1];
              currentPoint.setAttribute('transform', `translate(${latestPt.x}, ${latestPt.y})`);
              currentPoint.classList.remove('opacity-0');
          }
          
          // Safe zone (between limits)
          if (safeZone) {
              const zoneY = mapY(upperLimit);
              const zoneHeight = mapY(lowerLimit) - zoneY;
              safeZone.setAttribute('x', padding.left.toString());
              safeZone.setAttribute('y', zoneY.toString());
              safeZone.setAttribute('width', chartWidth.toString());
              safeZone.setAttribute('height', Math.max(0, zoneHeight).toString());
          }
          
          // Limit lines
          if (limitMaxLine) {
              limitMaxLine.setAttribute('x1', padding.left.toString());
              limitMaxLine.setAttribute('y1', mapY(upperLimit).toString());
              limitMaxLine.setAttribute('x2', (svgWidth - padding.right).toString());
              limitMaxLine.setAttribute('y2', mapY(upperLimit).toString());
          }
          if (limitMinLine) {
              limitMinLine.setAttribute('x1', padding.left.toString());
              limitMinLine.setAttribute('y1', mapY(lowerLimit).toString());
              limitMinLine.setAttribute('x2', (svgWidth - padding.right).toString());
              limitMinLine.setAttribute('y2', mapY(lowerLimit).toString());
          }
          
          // Update Y-axis labels
          const yMaxEl = document.getElementById('y-max');
          const yMidEl = document.getElementById('y-mid');
          const yMinEl = document.getElementById('y-min');
          if (yMaxEl) yMaxEl.textContent = `${chartMax.toFixed(1)}°C`;
          if (yMidEl) yMidEl.textContent = `${((chartMax + chartMin) / 2).toFixed(1)}°C`;
          if (yMinEl) yMinEl.textContent = `${chartMin.toFixed(1)}°C`;
          
          // Draw grid lines
          const gridLines = document.getElementById('grid-lines');
          if (gridLines) {
              gridLines.innerHTML = '';
              const gridCount = 5;
              for (let i = 0; i <= gridCount; i++) {
                  const y = padding.top + (i / gridCount) * chartHeight;
                  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                  line.setAttribute('x1', padding.left.toString());
                  line.setAttribute('y1', y.toString());
                  line.setAttribute('x2', (svgWidth - padding.right).toString());
                  line.setAttribute('y2', y.toString());
                  line.setAttribute('stroke', '#006399');
                  line.setAttribute('stroke-width', '1');
                  line.setAttribute('opacity', '0.15');
                  gridLines.appendChild(line);
              }
          }
          
          // Create interactive tooltip points - add as SVG circles inside the chart
          const chartSvg = document.getElementById('main-chart');
          
          // Remove old tooltip elements and tooltip div
          const oldCircles = chartSvg?.querySelectorAll('.chart-point-circle');
          oldCircles?.forEach(c => c.remove());
          const oldTooltip = document.getElementById('chart-tooltip');
          if (oldTooltip) oldTooltip.remove();
          
          if (chartSvg && filtered.length > 0) {
            filtered.forEach((r: SensorReading, idx: number) => {
                if (r.temp === undefined || r.temp === null || isNaN(r.temp)) return;
                
                const limits = getDeviceLimitsSync(r.device_id);
                const isOutOfRange = r.temp > limits.max || r.temp < limits.min;
                const isOutlier = r.isOutlier === true;
                const status = r.connection === 'Disconnected' ? 'Offline' : (isOutlier ? 'Inválido' : (isOutOfRange ? 'Alerta' : 'Normal'));
                const statusColor = r.connection === 'Disconnected' ? '#d97706' : (isOutlier ? '#f97316' : (isOutOfRange ? '#dc2626' : '#16a34a'));
                const rDeviceConfig = storedCameras[r.device_id];
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('class', 'chart-point-circle cursor-pointer hover:fill-primary transition-all');
                circle.setAttribute('cx', mapX(idx).toString());
                circle.setAttribute('cy', mapY(r.temp).toString());
                circle.setAttribute('r', '4');
                circle.setAttribute('fill', statusColor);
                circle.setAttribute('opacity', '0.8');
                circle.setAttribute('data-temp', r.temp.toString());
                circle.setAttribute('data-time', r.time || '');
                circle.setAttribute('data-date', r.date || '');
                circle.setAttribute('data-status', status);
                circle.setAttribute('data-status-color', statusColor);
                circle.setAttribute('data-device', rDeviceConfig?.name || r.name || r.device_id);
                circle.setAttribute('data-limits', `${limits.min}°C - ${limits.max}°C`);
                circle.setAttribute('data-rssi', String(r.wifi_rssi || 0));
                circle.setAttribute('data-ip', r.device_ip || '');
                circle.setAttribute('data-is-outlier', isOutlier ? 'true' : 'false');
                if (isOutlier && r.outlierReason) {
                  circle.setAttribute('data-outlier-reason', r.outlierReason);
                }
                if (isOutlier && r.jumpDelta) {
                  circle.setAttribute('data-jump-delta', r.jumpDelta.toString());
                }
                
                chartSvg.appendChild(circle);
            });
            
            // Add tooltip element
            const tooltip = document.createElement('div');
            tooltip.id = 'chart-tooltip';
            tooltip.className = 'fixed hidden bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-50 pointer-events-none max-w-xs';
            tooltip.innerHTML = '';
            document.body.appendChild(tooltip);
            
            // Add event listeners to circles
            const circles = chartSvg.querySelectorAll('.chart-point-circle');
            circles.forEach((circle) => {
                circle.addEventListener('mouseenter', (e) => {
                    const target = e.target as SVGElement;
                    const temp = target.dataset.temp;
                    const time = target.dataset.time;
                    const date = target.dataset.date;
                    const status = target.dataset.status;
                    const statusColor = target.dataset.statusColor;
                    const device = target.dataset.device;
                    const limits = target.dataset.limits;
                    const rssi = target.dataset.rssi;
                    const ip = target.dataset.ip;
                    const isOutlier = target.dataset.isOutlier === 'true';
                    const outlierReason = target.dataset.outlierReason || '';
                    const jumpDelta = target.dataset.jumpDelta || '';
                    
                    tooltip.innerHTML = `
                        <div class="font-bold text-sm">${device}</div>
                        <div class="text-lg font-bold mt-1">${temp}°C</div>
                        <div class="text-slate-300 mt-1">${date} ${time}</div>
                        <div class="mt-2 pt-2 border-t border-slate-600">
                            <div class="flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full" style="background: ${statusColor}"></span>
                                <span>${status}</span>
                            </div>
                            <div class="text-slate-400 mt-1">Limites: ${limits}</div>
                            <div class="text-slate-400">RSSI: ${rssi} dBm</div>
                            <div class="text-slate-400">IP: ${ip}</div>
                            ${isOutlier ? `<div class="text-orange-400 mt-1 font-bold">⚠️ ${outlierReason}</div>` : ''}
                            ${jumpDelta ? `<div class="text-orange-400 mt-1">Delta: ${jumpDelta}°C</div>` : ''}
                        </div>`;
                    
                    tooltip.classList.remove('hidden');
                    target.setAttribute('r', '6');
                });
                
                circle.addEventListener('mousemove', ((e: Event) => {
                    const mouseEvent = e as MouseEvent;
                    tooltip.style.left = `${mouseEvent.clientX + 15}px`;
                    tooltip.style.top = `${mouseEvent.clientY - 10}px`;
                }) as EventListener);
                
                circle.addEventListener('mouseleave', (e) => {
                    const target = e.target as SVGElement;
                    tooltip.classList.add('hidden');
                    target.setAttribute('r', '4');
                });
            });
          }
           
          // Peak indicator (maximum)
          const peakIdx = points.findIndex(p => p.temp === maxTemp);
          const peakIndicator = document.getElementById('peak-indicator');
          if (peakIndicator && peakIdx !== -1) {
              const peakPt = points[peakIdx];
              peakIndicator.setAttribute('transform', `translate(${peakPt.x}, ${peakPt.y})`);
              peakIndicator.classList.remove('opacity-0');
          }
          
          // Valley indicator (minimum)
          const valleyIdx = points.findIndex(p => p.temp === minTemp);
          const valleyIndicator = document.getElementById('valley-indicator');
          if (valleyIndicator && valleyIdx !== -1 && valleyIdx !== peakIdx) {
              const valleyPt = points[valleyIdx];
              valleyIndicator.setAttribute('transform', `translate(${valleyPt.x}, ${valleyPt.y})`);
              valleyIndicator.classList.remove('opacity-0');
          }
           
          // Generate dynamic X Axis with better distribution
          const xAxisEl = document.getElementById('chart-x-axis');
          if (xAxisEl && filtered.length > 0) {
              // Calculate number of labels based on data volume (aim for 5-6 labels)
              const numLabels = Math.min(6, Math.max(3, Math.ceil(filtered.length / 10)));
              const step = Math.max(1, Math.floor((filtered.length - 1) / (numLabels - 1)));
              let labels = '';
              
              for (let i = 0; i < numLabels; i++) {
                  const idx = Math.min(i * step, filtered.length - 1);
                  if (idx >= filtered.length) continue;
                  const r = filtered[idx];
                  const readingDate = new Date(`${r.date}T${r.time}`);
                  const now = new Date();
                  const hoursDiff = (now.getTime() - readingDate.getTime()) / (1000 * 60 * 60);
                  
                  let label;
                  if (hoursDiff <= 24) {
                      // Within 24 hours - show time
                      label = r.time.substring(0, 5);
                  } else {
                      // More than 24 hours - show date
                      label = readingDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
                  }
                  labels += `<span class="px-1">${label}</span>`;
              }
              xAxisEl.innerHTML = labels;
          }

          // Populate Alert Logs with configured names
          const logContainer = document.getElementById('alert-logs-container');
          if (logContainer) {
              logContainer.innerHTML = '';
              [...filtered].reverse().forEach((r: SensorReading) => {
                  const limits = getDeviceLimitsSync(r.device_id);
                  const isOutOfRange = r.temp > limits.max || r.temp < limits.min;
                  const isAlert = isOutOfRange || r.connection === 'Disconnected';
                  if (!isAlert) return;
                  
                  // Get configured name
                  const devConfig = storedCameras[r.device_id];
                  const displayName = devConfig?.name || r.name || r.device_id;
                  
                  const icon = r.connection === 'Disconnected' ? 'warning' : 'notifications_active';
                  const colorGrp = r.connection === 'Disconnected' ? 'bg-tertiary-container/30 text-tertiary' : 'bg-secondary-container/20 text-secondary';
                  
                  let title;
                  if (r.connection === 'Disconnected') {
                      title = 'Offline';
                  } else if (r.temp > limits.max) {
                      title = `Acima do limite (max: ${limits.max}°C)`;
                  } else if (r.temp < limits.min) {
                      title = `Abaixo do limite (min: ${limits.min}°C)`;
                  } else {
                      title = 'Alerta de Temperatura';
                  }
                  
                  const html = `
                  <div class="flex items-start gap-4 p-4 rounded-xl bg-surface-container-low/50 transition-colors">
                      <div class="w-10 h-10 rounded-full ${colorGrp} flex items-center justify-center flex-shrink-0 mt-1">
                          <span class="material-symbols-outlined text-[20px]">${icon}</span>
                      </div>
                      <div class="flex-grow">
                          <div class="flex justify-between items-start mb-1">
                              <span class="font-bold text-on-background">${title}</span>
                              <span class="text-[10px] text-on-surface-variant">${r.date}, ${r.time}</span>
                          </div>
                          <div class="text-sm text-on-surface-variant">${displayName}</div>
                          <div class="mt-1 font-bold ${isOutOfRange ? 'text-tertiary' : 'text-secondary'}">${r.temp.toFixed(1)}°C</div>
                      </div>
                  </div>`;
                  logContainer.insertAdjacentHTML('beforeend', html);
              });
          }
          
          // Generate Dynamic Insights
          const insightsContainer = document.getElementById('analytics-insights');
          if (insightsContainer) {
              const uniqueDevices = getUniqueDevices(filtered);
              const activeCount = uniqueDevices.filter(id => {
                  const latest = filtered.find(r => r.device_id === id);
                  return latest?.connection === 'Connected';
              }).length;
              
              const safeCount = filtered.filter(d => {
                const limits = getDeviceLimitsSync(d.device_id);
                return d.temp >= limits.min && d.temp <= limits.max && d.connection === 'Connected';
              }).length;
              const compliance = filtered.length > 0 ? (safeCount / filtered.length * 100) : 0;
              
              const temps = filtered.map(d => d.temp);
              const stdDev = temps.length > 1 ? Math.sqrt(temps.reduce((sum, t) => sum + Math.pow(t - avgTemp, 2), 0) / temps.length) : 0;
              
              const insights: string[] = [];
              
              // Compliance insight
              if (compliance >= 95) {
                  insights.push('✓ Conformidade excelente - Sistema operando dentro dos parâmetros seguros.');
              } else if (compliance >= 80) {
                  insights.push('⚠ Conformidade moderada - Recomenda-se revisão dos limites.');
              } else {
                  insights.push('✗ Baixa conformidade - Ação imediata requerida.');
              }
              
              // Stability insight
              if (stdDev < 2) {
                  insights.push('✓ Estabilidade térmica excelente - Baixa variabilidade detected.');
              } else if (stdDev < 5) {
                  insights.push('⚠ Variabilidade moderada - Monitorar ciclos de operação.');
              } else {
                  insights.push('✗ Alta variabilidade - Investigar sistema de controle.');
              }
              
              // Device status
              if (activeCount === uniqueDevices.length) {
                  insights.push('✓ Todos os dispositivos operacionais.');
              } else {
                  insights.push(`⚠ ${uniqueDevices.length - activeCount} dispositivo(s) offline.`);
              }
              
              // Temperature alerts based on device limits
              const firstDeviceId = filtered[0]?.device_id;
              const deviceLimits = firstDeviceId ? getDeviceLimitsSync(firstDeviceId) : { min: -25, max: -15 };
              
              if (maxTemp > deviceLimits.max) {
                  insights.push(`⚠ Temperatura máxima acima do limite seguro (${deviceLimits.max}°C).`);
              }
              if (minTemp < deviceLimits.min) {
                  insights.push(`⚠ Temperatura mínima abaixo do limite seguro (${deviceLimits.min}°C).`);
              }
              
              // Real-time update indicator
              const lastReading = filtered[filtered.length - 1];
              if (lastReading) {
                  insights.push(`📡 Última leitura: ${lastReading.temp.toFixed(1)}°C às ${lastReading.time}`);
              }
              
              insightsContainer.innerHTML = insights.map(insight => {
                  let colorClass = 'text-on-surface';
                  if ( insight.startsWith('✓')) colorClass = 'text-emerald-600';
                  else if ( insight.startsWith('⚠')) colorClass = 'text-amber-600';
                  else if ( insight.startsWith('✗')) colorClass = 'text-red-600';
                  else if ( insight.startsWith('📡')) colorClass = 'text-primary';
                  
                  return `<div class="flex items-start gap-2 ${colorClass}">
                      <span class="font-bold">${insight}</span>
                  </div>`;
              }).join('');
          }
          
          console.log('[renderAnalytics] Completed successfully');
          } catch (err) {
              console.error('[renderAnalytics] Error:', err);
          }
      };

      // Subscribe to real-time updates
      onReadingsUpdate((readings) => {
          globalData = readings;
          renderAnalytics();
      });

      getReadings().then(dataArray => {
            if (!dataArray || dataArray.length === 0) return;
            globalData = dataArray;
            
            // Populate Dropdown with configured names
            const selectEl = document.getElementById('chamber-select') as HTMLSelectElement;
            if (selectEl) {
                const uniqueChambers = getUniqueDevices(globalData);
                uniqueChambers.forEach(id => {
                    const cInfo = globalData.find((d: SensorReading) => d.device_id === id);
                    const devConfig = storedCameras[id];
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = devConfig?.name || cInfo?.name || id;
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
                    analyticsState.currentDays = parseInt(target.getAttribute('data-days') || '1');
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
          let selectedPeriod = 1;
          const periodBtns = document.querySelectorAll('.period-btn');
          periodBtns.forEach(btn => {
              btn.addEventListener('click', (e) => {
                  periodBtns.forEach(b => {
                      b.classList.remove('bg-primary', 'text-on-primary', 'active-period');
                      b.classList.add('text-on-surface-variant');
                  });
                  const target = e.currentTarget as HTMLElement;
                  target.classList.remove('text-on-surface-variant');
                  target.classList.add('bg-primary', 'text-on-primary', 'active-period');
                  selectedPeriod = parseInt(target.getAttribute('data-days') || '1');
              });
          });
          
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
                     window.location.href = `visualizacao_relatorio.html?type=${encodeURIComponent(selectedType)}&graphs=${incGraphs}&logs=${incLogs}&cams=${selectedCams.join(',')}&days=${selectedPeriod}`;
                     return;
                 }
               
               let contentText = '';
                let typeType = '';
                let extension = '';
                
                // Apply period filter before export
                const now = new Date();
                const cutoffDate = new Date(now.getTime() - selectedPeriod * 24 * 60 * 60 * 1000);
                let exportData = data.filter((d: any) => {
                    const readingDate = new Date(`${d.date}T${d.time}`);
                    return readingDate >= cutoffDate;
                });
                
                // Apply camera filter
                if (!selectedCams.includes('ALL')) {
                    exportData = exportData.filter((d: any) => selectedCams.includes(d.device_id) || selectedCams.includes(d.name));
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
      
      // Load existing device data from localStorage
      const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
      let existing = storedCameras[editDeviceId];
      
      // If not in localStorage, try to get from current readings
      if (!existing) {
        getReadings().then(readings => {
          const reading = readings?.find((r: SensorReading) => r.device_id === editDeviceId);
          if (reading) {
            existing = {
              name: reading.name || editDeviceId,
              location: '',
              unit_type: 'congelador',
              temp_min: '-25',
              temp_max: '-15',
              ip: reading.device_ip || '',
              device_id: reading.device_id,
              mqtt_topic: 'gettemp'
            };
            
            // Preenche os campos
            (document.getElementById('chamber_name') as HTMLInputElement).value = existing.name;
            (document.getElementById('location') as HTMLInputElement).value = existing.location;
            if (existing.unit_type) (document.getElementById('unit_type') as HTMLSelectElement).value = existing.unit_type;
            tMinSlider.value = existing.temp_min;
            if (tMinDisplay) tMinDisplay.textContent = existing.temp_min + '°C';
            tMaxSlider.value = existing.temp_max;
            if (tMaxDisplay) tMaxDisplay.textContent = existing.temp_max + '°C';
            (document.getElementById('device_ip') as HTMLInputElement).value = existing.ip;
            (document.getElementById('device_id_input') as HTMLInputElement).value = existing.device_id;
            (document.getElementById('mqtt_topic') as HTMLInputElement).value = existing.mqtt_topic;
            
            // Update page title for edit mode
            const stepLabel = document.getElementById('step-label');
            const stepTitle = document.querySelector('#step1 h2');
            if (stepLabel) stepLabel.textContent = 'Modo de Edição';
            if (stepTitle) stepTitle.textContent = 'Editar Câmara';
            if (btnNextLabel) btnNextLabel.textContent = 'ATUALIZAR';
          }
        });
      } else {
        // Existing found in localStorage - fill the form
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
        if (btnNextLabel) btnNextLabel.textContent = 'SALVAR';
      }
    }

    const updateView = () => {
      [step1, step2, step3].forEach(s => s?.classList.add('hidden'));
      btnBack?.classList.toggle('hidden', currentStep === 1);
      
      if (currentStep === 1) {
        step1?.classList.remove('hidden');
        if (btnNextLabel) btnNextLabel.textContent = isEditMode ? 'SALVAR' : 'CONECTAR';
      } else if (currentStep === 2) {
        step2?.classList.remove('hidden');
        if (btnNextLabel) btnNextLabel.textContent = isEditMode ? 'ATUALIZAR' : 'REGISTRAR';
        
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
              <p class="font-bold text-on-surface">${name || 'Não informado'}</p>
              <p class="text-xs text-on-surface-variant">${loc || 'Localização não definida'}</p>
            </div>
            <div class="bg-surface-container-low p-4 rounded-xl">
              <p class="text-xs text-on-surface-variant font-bold uppercase">Limites</p>
              <p class="font-bold text-on-surface">${min}°C a ${max}°C</p>
            </div>
            <div class="bg-surface-container-low p-4 rounded-xl">
              <p class="text-xs text-on-surface-variant font-bold uppercase">Dispositivo</p>
              <p class="font-bold text-on-surface font-mono text-sm">${did || 'A definir'}</p>
              <p class="text-xs text-on-surface-variant">${ip || 'IP não definido'}</p>
            </div>
          `;
        }
      }
    };

    btnNext?.addEventListener('click', () => {
      if (currentStep < 2) {
        // Validate only name in step 1
        if (currentStep === 1) {
          const name = (document.getElementById('chamber_name') as HTMLInputElement).value.trim();
          if (!name) {
            alert('Por favor, informe o nome da câmara.');
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
      
      // Get device-specific limits and filter alerts based on them
      const alerts = data.filter(r => {
        const limits = getDeviceLimitsSync(r.device_id);
        const isOutOfRange = r.temp > limits.max || r.temp < limits.min;
        const isOffline = r.connection === 'Disconnected';
        return isOutOfRange || isOffline;
      }).reverse();
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
          const limits = getDeviceLimitsSync(r.device_id);
          const isAbove = r.temp > limits.max;
          const isBelow = r.temp < limits.min;
          
          let title, icon, colorClass;
          if (isOffline) {
            title = 'Equipamento Offline';
            icon = 'warning';
            colorClass = 'bg-tertiary-container/30 text-tertiary';
          } else if (isAbove) {
            title = `Temperatura máxima acima do limite (${limits.max}°C)`;
            icon = 'expand_less';
            colorClass = 'bg-error-container/30 text-error';
          } else if (isBelow) {
            title = `Temperatura mínima abaixo do limite (${limits.min}°C)`;
            icon = 'expand_more';
            colorClass = 'bg-error-container/30 text-error';
          } else {
            title = 'Alerta de Temperatura';
            icon = 'notifications_active';
            colorClass = 'bg-error-container/30 text-error';
          }

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
    const type = urlParams.get('type') || 'Relatório de Qualidade Térmica';
    const hasGraphs = urlParams.get('graphs') !== 'false';
    const hasLogs = urlParams.get('logs') !== 'false';
    const periodDays = parseInt(urlParams.get('days') || '1');

    getReadings().then(mutData => {
      let data = [...mutData];
      if (!data || data.length === 0) return;
      
      // Filter by period
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
      data = data.filter(r => {
          const readingDate = new Date(`${r.date}T${r.time}`);
          return readingDate >= cutoffDate;
      });
      
      const filterCamsStr = urlParams.get('cams');
      if (filterCamsStr && filterCamsStr !== 'ALL') {
          const validCams = filterCamsStr.split(',');
          data = data.filter(r => validCams.includes(r.device_id) || validCams.includes(r.name)); 
      }
      
      // Filter out invalid readings
      data = data.filter(r => r.temp !== undefined && r.temp !== null && !isNaN(r.temp));
      
      if (data.length === 0) return;
      
      const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
      
      const elChartSec = document.getElementById('report-chart-section');
      const elLogsSec = document.getElementById('report-logs-section');

      if (!hasGraphs && elChartSec) elChartSec.classList.add('hidden');
      if (!hasLogs && elLogsSec) elLogsSec.classList.add('hidden');

      const { max, min, avg } = calcStats(data);
      const bounds = getDateBounds(data);
      
      // Calculate standard deviation
      const temps = data.map(d => d.temp);
      const stdDev = Math.sqrt(temps.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / temps.length);
      
      // Calculate compliance (within device-specific safe range)
      // Get limits from first device in data (or default)
      const firstDeviceId = data[0]?.device_id;
      const deviceLimits = firstDeviceId ? getDeviceLimitsSync(firstDeviceId) : { min: -25, max: -15 };
      const safeCount = data.filter(d => d.temp >= deviceLimits.min && d.temp <= deviceLimits.max && d.connection === 'Connected').length;
      const compliance = data.length > 0 ? (safeCount / data.length * 100).toFixed(1) : '0';
      
      // Get unique devices
      const uniqueDevices = getUniqueDevices(data);
      const activeDevices = uniqueDevices.filter(id => {
        const latest = data.find(d => d.device_id === id);
        return latest?.connection === 'Connected';
      }).length;
      
      // Calculate coverage time
      let coverage = '--';
      if (bounds) {
        const hours = (bounds.max.getTime() - bounds.min.getTime()) / (1000 * 60 * 60);
        coverage = hours > 24 ? `${(hours / 24).toFixed(1)} dias` : `${hours.toFixed(1)} horas`;
      }
      
      // Stability score (inverse of stdDev)
      const stability = Math.max(0, 100 - stdDev * 10).toFixed(1);

      // Set document signature
      const docSignature = document.getElementById('doc-signature');
      if (docSignature) docSignature.textContent = `GT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Update filename and title
      const elTitle = document.getElementById('report-filename');
      const elType = document.getElementById('report-type-title');
      const elDate = document.getElementById('report-date-generated');
      const elDateRange = document.getElementById('report-date-range');
      
      const reportId = `RL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      if (elTitle) elTitle.textContent = reportId;
      if (elType) elType.textContent = type;
      if (elDate && bounds) elDate.textContent = `Gerado em ${new Date().toLocaleDateString('pt-BR', {day: '2-digit', month: 'long', year: 'numeric'})}`;
      if (elDateRange && bounds) elDateRange.textContent = `${bounds.min.toLocaleDateString('pt-BR')} a ${bounds.max.toLocaleDateString('pt-BR')}`;

      // Update KPIs
      const elAvg = document.getElementById('report-avg-temp');
      const elMax = document.getElementById('report-max-temp');
      const elMaxDate = document.getElementById('report-max-date');
      const elMin = document.getElementById('report-min-temp');
      const elMinDate = document.getElementById('report-min-date');
      const elCompliance = document.getElementById('report-compliance');
      
      if (elAvg) elAvg.textContent = `${avg.toFixed(1)}°C`;
      if (elMax) elMax.textContent = `${max.toFixed(1)}°C`;
      if (elMaxDate) {
        const maxReading = data.find(d => d.temp === max);
        elMaxDate.textContent = maxReading ? `${maxReading.date} ${maxReading.time}` : '--';
      }
      if (elMin) elMin.textContent = `${min.toFixed(1)}°C`;
      if (elMinDate) {
        const minReading = data.find(d => d.temp === min);
        elMinDate.textContent = minReading ? `${minReading.date} ${minReading.time}` : '--';
      }
      if (elCompliance) {
        elCompliance.textContent = `${compliance}%`;
        elCompliance.className = `font-headline text-3xl font-bold ${Number(compliance) >= 95 ? 'text-emerald-700' : Number(compliance) >= 80 ? 'text-amber-600' : 'text-red-600'}`;
      }

      // Update statistics
      const statTotal = document.getElementById('stat-total-readings');
      const statDevices = document.getElementById('stat-active-devices');
      const statCoverage = document.getElementById('stat-coverage');
      const statStdDev = document.getElementById('stat-stddev');
      const statStability = document.getElementById('stat-stability');
      const readingsBadge = document.getElementById('total-readings-badge');
      
      if (statTotal) statTotal.textContent = data.length.toString();
      if (statDevices) statDevices.textContent = `${activeDevices} de ${uniqueDevices.length}`;
      if (statCoverage) statCoverage.textContent = coverage;
      if (statStdDev) statStdDev.textContent = `±${stdDev.toFixed(2)}°C`;
      if (statStability) statStability.textContent = `${stability}%`;
      if (readingsBadge) readingsBadge.textContent = `${data.length} Leituras`;

      // Populate company info
      const companyName = localStorage.getItem('profile_company') || 'Get Temp Ltda';
      const companyLocation = localStorage.getItem('profile_company_location') || 'São Paulo, SP - Brasil';
      const companyCnpj = localStorage.getItem('profile_company_cnpj') || '00.000.000/0001-00';
      const elCompanyName = document.getElementById('report-company-name');
      const elCompanyLocation = document.getElementById('report-company-location');
      const elCompanyCnpj = document.getElementById('report-company-cnpj');
      if (elCompanyName) elCompanyName.textContent = companyName;
      if (elCompanyLocation) elCompanyLocation.textContent = companyLocation;
      if (elCompanyCnpj) elCompanyCnpj.textContent = companyCnpj;

      // Draw professional chart
      if (hasGraphs && elChartSec) {
        const chartLine = document.getElementById('chart-line-fill');
        const chartArea = document.getElementById('chart-area-fill');
        const currentPoint = document.getElementById('current-point-report');
        const safeZone = document.getElementById('safe-zone-rect');
        const limitUpper = document.getElementById('limit-upper');
        const limitLower = document.getElementById('limit-lower');
        
        const svgWidth = 900;
        const svgHeight = 300;
        const padding = { left: 60, right: 20, top: 20, bottom: 40 };
        const chartWidth = svgWidth - padding.left - padding.right;
        const chartHeight = svgHeight - padding.top - padding.bottom;
        
        // Dynamic limits - use device-specific limits from camera registration
        const firstDeviceId = data[0]?.device_id;
        const chartLimits = firstDeviceId ? getDeviceLimitsSync(firstDeviceId) : { min: -25, max: -15 };
        const upperLimit = chartLimits.max;
        const lowerLimit = chartLimits.min;
        // Calculate chart range with padding
        const chartMin = Math.min(lowerLimit - 5, min - 3);
        const chartMax = Math.max(upperLimit + 5, max + 3);
        const chartRange = chartMax - chartMin;
        
        const mapY = (temp: number) => padding.top + chartHeight - ((temp - chartMin) / chartRange) * chartHeight;
        const mapX = (idx: number) => padding.left + (idx / (data.length - 1 || 1)) * chartWidth;
        
        const points = data.map((r, idx) => ({
            x: mapX(idx),
            y: mapY(r.temp),
            temp: r.temp,
            time: r.time,
            date: r.date
        }));
        
        // Build paths (skip NaN values)
        let linePath = '';
        if (points.length > 0 && !isNaN(points[0].y)) {
            linePath = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                if (!isNaN(points[i].y)) {
                    linePath += ` L ${points[i].x} ${points[i].y}`;
                }
            }
        }
        let areaPath = linePath;
        if (points.length > 0 && !isNaN(points[points.length - 1].y)) {
            areaPath += ` L ${points[points.length - 1].x} ${svgHeight - padding.bottom} L ${points[0].x} ${svgHeight - padding.bottom} Z`;
        }
        
        if (chartLine) chartLine.setAttribute('d', linePath);
        if (chartArea) chartArea.setAttribute('d', areaPath);
        
        // Current point
        if (currentPoint && points.length > 0) {
            const latest = points[points.length - 1];
            currentPoint.setAttribute('transform', `translate(${latest.x}, ${latest.y})`);
        }
        
        // Safe zone
        if (safeZone) {
            const zoneY = mapY(upperLimit);
            const zoneHeight = mapY(lowerLimit) - zoneY;
            safeZone.setAttribute('x', padding.left.toString());
            safeZone.setAttribute('y', zoneY.toString());
            safeZone.setAttribute('width', chartWidth.toString());
            safeZone.setAttribute('height', Math.max(0, zoneHeight).toString());
        }
        
        // Limit lines
        if (limitUpper) {
            limitUpper.setAttribute('x1', padding.left.toString());
            limitUpper.setAttribute('y1', mapY(upperLimit).toString());
            limitUpper.setAttribute('x2', (svgWidth - padding.right).toString());
            limitUpper.setAttribute('y2', mapY(upperLimit).toString());
        }
        if (limitLower) {
            limitLower.setAttribute('x1', padding.left.toString());
            limitLower.setAttribute('y1', mapY(lowerLimit).toString());
            limitLower.setAttribute('x2', (svgWidth - padding.right).toString());
            limitLower.setAttribute('y2', mapY(lowerLimit).toString());
        }
        
        // Y-axis labels
        const yLabels = document.getElementById('chart-y-labels');
        if (yLabels) {
            yLabels.innerHTML = `
                <span>${chartMax.toFixed(0)}°</span>
                <span>${((chartMax + chartMin) / 2).toFixed(0)}°</span>
                <span>${chartMin.toFixed(0)}°</span>
            `;
        }
        
        // Grid lines
        const grid = document.getElementById('chart-grid');
        if (grid) {
            grid.innerHTML = '';
            for (let i = 0; i <= 5; i++) {
                const y = padding.top + (i / 5) * chartHeight;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', padding.left.toString());
                line.setAttribute('y1', y.toString());
                line.setAttribute('x2', (svgWidth - padding.right).toString());
                line.setAttribute('y2', y.toString());
                grid.appendChild(line);
            }
        }
        
        // Add peak and valley indicators
        const peakIdx = points.findIndex(p => p.temp === max);
        const valleyIdx = points.findIndex(p => p.temp === min);
        
        const reportPeakIndicator = document.getElementById('report-peak-indicator');
        if (reportPeakIndicator && peakIdx !== -1) {
            reportPeakIndicator.setAttribute('transform', `translate(${points[peakIdx].x}, ${points[peakIdx].y})`);
            reportPeakIndicator.classList.remove('opacity-0');
        }
        
        const reportValleyIndicator = document.getElementById('report-valley-indicator');
        if (reportValleyIndicator && valleyIdx !== -1 && valleyIdx !== peakIdx) {
            reportValleyIndicator.setAttribute('transform', `translate(${points[valleyIdx].x}, ${points[valleyIdx].y})`);
            reportValleyIndicator.classList.remove('opacity-0');
        }

        // Generate X-axis labels for report chart
        const reportXAxis = document.getElementById('report-x-axis');
        if (reportXAxis && data.length > 0) {
            const numLabels = Math.min(6, Math.max(3, Math.ceil(data.length / 10)));
            const step = Math.max(1, Math.floor((data.length - 1) / (numLabels - 1)));
            let labels = '';

            for (let i = 0; i < numLabels; i++) {
                const idx = Math.min(i * step, data.length - 1);
                if (idx >= data.length) continue;
                const r = data[idx];
                const readingDate = new Date(`${r.date}T${r.time}`);
                const now = new Date();
                const hoursDiff = (now.getTime() - readingDate.getTime()) / (1000 * 60 * 60);

                let label;
                if (hoursDiff <= 24) {
                    label = r.time.substring(0, 5);
                } else {
                    label = readingDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
                }
                labels += `<span class="px-1">${label}</span>`;
            }
            reportXAxis.innerHTML = labels;
        }
      }

      // Generate Insights
      const insightsContainer = document.getElementById('insights-container');
      if (insightsContainer) {
        const insights: string[] = [];
        
        // Compliance insight
        if (Number(compliance) >= 95) {
            insights.push('✓ Excelente conformidade térmica. Sistema operating within safe parameters.');
        } else if (Number(compliance) >= 80) {
            insights.push('⚠ Conformidade moderada. Recomenda-se revisão dos limites de temperatura.');
        } else {
            insights.push('✗ Baixa conformidade. Ação imediata requerida para corrective measures.');
        }
        
        // Temperature variance insight
        if (stdDev < 2) {
            insights.push('✓ Estabilidade excelente. Baixa variabilidade indica sistema de refrigeração otimizado.');
        } else if (stdDev < 5) {
            insights.push('⚠ Variabilidade moderada. Monitorar ciclos de compressor e door openings.');
        } else {
            insights.push('✗ Alta variabilidade térmica. Investigar possível falha no sistema de controle.');
        }
        
        // Device insight
        if (activeDevices === uniqueDevices.length) {
            insights.push('✓ Todos os dispositivos operacionais. Rede de monitoramento fully functional.');
        } else {
            insights.push(`⚠ ${uniqueDevices.length - activeDevices} dispositivo(s) offline. Verificar conectividade.`);
        }
        
        // Max/Min insight based on device-specific limits
        const reportDeviceId = data[0]?.device_id;
        const reportLimits = reportDeviceId ? getDeviceLimitsSync(reportDeviceId) : { min: -25, max: -15 };
        
        if (max > reportLimits.max) {
            insights.push(`⚠ Temperatura máxima acima do limite seguro (${reportLimits.max}°C). Risco de comprometimento de produtos.`);
        }
        if (min < reportLimits.min) {
            insights.push(`⚠ Temperatura mínima abaixo do limite seguro (${reportLimits.min}°C). Risco de congelamento excessivo.`);
        }
        
        // Recommendation
        insights.push('📋 Recomendação: Realizar manutenção preventiva trimestral e calibrar sensores.');
        
        insightsContainer.innerHTML = insights.map(insight => `
            <div class="flex items-start gap-2 text-sm ${insight.includes('✓') ? 'text-emerald-700' : insight.includes('⚠') ? 'text-amber-700' : insight.includes('✗') ? 'text-red-700' : 'text-slate-700'}">
                <span class="font-bold">${insight}</span>
            </div>
        `).join('');
      }

      // Populate table
      const tbl = document.getElementById('report-records-table');
      const recordsPerPage = 20;
      let currentPage = 1;
      
      const updateTable = () => {
          if (!tbl) return;
          const totalRecords = data.length;
          const totalPages = Math.ceil(totalRecords / recordsPerPage);
          const startIdx = (currentPage - 1) * recordsPerPage;
          const endIdx = Math.min(startIdx + recordsPerPage, totalRecords);
          const pageData = [...data].reverse().slice(startIdx, endIdx);
          
          tbl.innerHTML = pageData.map(d => {
              const devConfig = storedCameras[d.device_id];
              const displayName = devConfig?.name || d.name || d.device_id;
              const limits = getDeviceLimitsSync(d.device_id);
              const isOutOfRange = d.temp > limits.max || d.temp < limits.min;
              const isWarning = d.connection !== 'Connected' || isOutOfRange;
              const statusClass = isWarning ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700';
              const statusText = d.connection !== 'Connected' ? 'Offline' : isWarning ? 'Alerta' : 'Normal';
              
              return `<tr class="hover:bg-slate-50 transition-colors">
                  <td class="py-3 px-4 text-slate-600">${d.date} ${d.time}</td>
                  <td class="py-3 px-4 font-medium text-slate-900">${displayName}</td>
                  <td class="py-3 px-4 text-right font-bold ${isWarning ? 'text-red-600' : 'text-slate-900'}">${d.temp.toFixed(1)}°C</td>
                  <td class="py-3 px-4 text-right text-slate-500">${d.wifi_rssi} dBm</td>
                  <td class="py-3 px-4 text-center"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusClass}">${statusText}</span></td>
              </tr>`;
          }).join('');
          
          // Update pagination info
          const showingStart = document.getElementById('showing-start');
          const showingEnd = document.getElementById('showing-end');
          const totalRecordsEl = document.getElementById('total-records');
          if (showingStart) showingStart.textContent = (startIdx + 1).toString();
          if (showingEnd) showingEnd.textContent = endIdx.toString();
          if (totalRecordsEl) totalRecordsEl.textContent = totalRecords.toString();
          
          // Update buttons
          const prevBtn = document.getElementById('pagination-prev') as HTMLButtonElement;
          const nextBtn = document.getElementById('pagination-next') as HTMLButtonElement;
          if (prevBtn) prevBtn.disabled = currentPage === 1;
          if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
      };
      
      if (tbl && data.length > recordsPerPage) {
          document.getElementById('pagination-prev')?.addEventListener('click', () => {
              currentPage = Math.max(1, currentPage - 1);
              updateTable();
          });
          document.getElementById('pagination-next')?.addEventListener('click', () => {
              const totalPages = Math.ceil(data.length / recordsPerPage);
              currentPage = Math.min(totalPages, currentPage + 1);
              updateTable();
          });
      }
      
      updateTable();

      // Print button - render all data before printing
      document.getElementById('btn-pdf')?.addEventListener('click', () => {
          // Store current page
          const prevBtn = document.getElementById('pagination-prev');
          const nextBtn = document.getElementById('pagination-next');
          const paginationDiv = document.getElementById('report-pagination');
          
          // Show all records for printing
          if (tbl) {
              tbl.innerHTML = [...data].reverse().map(d => {
                  const devConfig = storedCameras[d.device_id];
                  const displayName = devConfig?.name || d.name || d.device_id;
                  const limits = getDeviceLimitsSync(d.device_id);
                  const isOutOfRange = d.temp > limits.max || d.temp < limits.min;
                  const isWarning = d.connection !== 'Connected' || isOutOfRange;
                  const statusClass = isWarning ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700';
                  const statusText = d.connection !== 'Connected' ? 'Offline' : isWarning ? 'Alerta' : 'Normal';
                  
                  return `<tr class="hover:bg-slate-50 transition-colors">
                      <td class="py-3 px-4 text-slate-600">${d.date} ${d.time}</td>
                      <td class="py-3 px-4 font-medium text-slate-900">${displayName}</td>
                      <td class="py-3 px-4 text-right font-bold ${isWarning ? 'text-red-600' : 'text-slate-900'}">${d.temp.toFixed(1)}°C</td>
                      <td class="py-3 px-4 text-right text-slate-500">${d.wifi_rssi} dBm</td>
                      <td class="py-3 px-4 text-center"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusClass}">${statusText}</span></td>
                  </tr>`;
              }).join('');
          }
          
          // Hide pagination for print
          if (paginationDiv) paginationDiv.classList.add('hidden');
          if (prevBtn) prevBtn.classList.add('hidden');
          if (nextBtn) nextBtn.classList.add('hidden');
          
          // Print
          window.print();
          
          // Restore pagination after print
          setTimeout(() => {
              if (paginationDiv) paginationDiv.classList.remove('hidden');
              if (prevBtn) prevBtn.classList.remove('hidden');
              if (nextBtn) nextBtn.classList.remove('hidden');
              updateTable();
          }, 100);
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

    // Show/hide configuration panels based on toggle states
    const toggleDailySummary = document.getElementById('toggle-daily-summary') as HTMLInputElement;
    const dailySummaryConfig = document.getElementById('daily-summary-config');
    if (toggleDailySummary && dailySummaryConfig) {
      toggleDailySummary.addEventListener('change', () => {
        if (toggleDailySummary.checked) {
          dailySummaryConfig.classList.remove('hidden');
        } else {
          dailySummaryConfig.classList.add('hidden');
        }
      });
      // Initial state
      if (toggleDailySummary.checked) {
        dailySummaryConfig.classList.remove('hidden');
      }
    }

    const toggleMaintenance = document.getElementById('toggle-maintenance') as HTMLInputElement;
    const maintenanceSection = document.querySelector('.bg-surface-container-lowest:has(#maintenance-date)');
    if (toggleMaintenance && maintenanceSection) {
      toggleMaintenance.addEventListener('change', () => {
        if (toggleMaintenance.checked) {
          maintenanceSection.classList.remove('hidden');
        } else {
          maintenanceSection.classList.add('hidden');
        }
      });
      // Initial state
      const maintenanceEnabled = localStorage.getItem('notification_toggle_2') === 'true';
      if (maintenanceEnabled) {
        maintenanceSection.classList.remove('hidden');
      } else {
        maintenanceSection.classList.add('hidden');
      }
    }

    // Save daily summary configuration
    const btnSaveDailySummary = document.getElementById('btn-save-daily-summary');
    if (btnSaveDailySummary) {
      btnSaveDailySummary.addEventListener('click', () => {
        const time = (document.getElementById('daily-summary-time') as HTMLInputElement).value;
        const day = (document.getElementById('daily-summary-day') as HTMLSelectElement).value;
        
        localStorage.setItem('daily_summary_time', time);
        localStorage.setItem('daily_summary_day', day);
        
        const toast = document.createElement('div');
        toast.textContent = 'Configuração do resumo diário salva!';
        toast.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:#27ae60; color:#fff; padding:12px 20px; border-radius:999px; font-size:13px; font-weight:600; z-index:9999;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
      });
    }

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

    // --- Data Management: Reset & Delete ---
    const btnResetReadings = document.getElementById('btn-reset-readings');
    const btnDeleteReading = document.getElementById('btn-delete-reading');
    const confirmResetModal = document.getElementById('confirm-reset-modal');
    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    const resetConfirmInput = document.getElementById('reset-confirm-input') as HTMLInputElement;
    const deleteConfirmInput = document.getElementById('delete-confirm-input') as HTMLInputElement;
    const btnConfirmReset = document.getElementById('btn-confirm-reset');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    const operationLogs = document.getElementById('operation-logs');

    // --- Maintenance Reminder System ---
    const maintenanceDateInput = document.getElementById('maintenance-date') as HTMLInputElement;
    const maintenancePeriodSelect = document.getElementById('maintenance-period') as HTMLSelectElement;
    const btnSaveMaintenance = document.getElementById('btn-save-maintenance');
    const maintenanceRemindersContainer = document.getElementById('maintenance-reminders');

    // Load saved maintenance reminders
    const loadMaintenanceReminders = () => {
      const reminders = JSON.parse(localStorage.getItem('maintenance_reminders') || '[]');
      const isEnabled = localStorage.getItem('notification_toggle_2') === 'true';
      
      if (!maintenanceRemindersContainer) return;
      
      if (!isEnabled || reminders.length === 0) {
        if (!isEnabled) {
          maintenanceRemindersContainer.innerHTML = '<p class="text-sm text-on-surface-variant italic">Lembretes desativados. Ative acima para configurar.</p>';
        } else if (reminders.length === 0) {
          maintenanceRemindersContainer.innerHTML = '<p class="text-sm text-on-surface-variant italic">Nenhum lembrete configurado.</p>';
        }
        return;
      }
      
      const now = Date.now();
      maintenanceRemindersContainer.innerHTML = reminders.map((r: any) => {
        const dueDate = new Date(r.date).getTime();
        const isOverdue = dueDate < now;
        const isDueSoon = dueDate - now < 7 * 24 * 60 * 60 * 1000; // 7 days
        
        let statusClass = 'bg-green-100 text-green-700';
        let statusText = 'Agendado';
        if (isOverdue) {
          statusClass = 'bg-red-100 text-red-700';
          statusText = 'Atrasado';
        } else if (isDueSoon) {
          statusClass = 'bg-amber-100 text-amber-700';
          statusText = 'Em breve';
        }
        
        return `
          <div class="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
            <div>
              <p class="font-semibold text-on-surface">${r.title || 'Manutenção'}</p>
              <p class="text-xs text-on-surface-variant">${new Date(r.date).toLocaleDateString('pt-BR')}</p>
            </div>
            <span class="px-2 py-1 rounded-full text-xs font-bold ${statusClass}">${statusText}</span>
          </div>
        `;
      }).join('');
    };

    // Check for due maintenance and trigger alerts
    const checkMaintenanceAlerts = () => {
      const reminders = JSON.parse(localStorage.getItem('maintenance_reminders') || '[]');
      const now = Date.now();
      const triggered = localStorage.getItem('maintenance_alerts_triggered') || '[]';
      const triggeredArray = JSON.parse(triggered);
      
      reminders.forEach((r: any) => {
        const dueDate = new Date(r.date).getTime();
        const daysUntil = (dueDate - now) / (24 * 60 * 60 * 1000);
        
        // Alert if overdue or due within 7 days and not yet triggered
        if ((daysUntil <= 0 || daysUntil <= 7) && !triggeredArray.includes(r.date)) {
          triggeredArray.push(r.date);
          localStorage.setItem('maintenance_alerts_triggered', JSON.stringify(triggeredArray));
          
          // Add alert to logs
          addOperationLog('MANUTENÇÃO', `Lembrete: ${r.title || 'Manutenção agendada para ' + new Date(r.date).toLocaleDateString('pt-BR')}`);
          
          // Show in-app notification
          const toast = document.createElement('div');
          toast.textContent = `🔧 Lembrete de Manutenção: ${r.title || 'Manutenção agendada'} - ${daysUntil <= 0 ? 'ATRASADO' : 'em ' + Math.round(daysUntil) + ' dias'}`;
          toast.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:#f97316; color:#fff; padding:12px 20px; border-radius:999px; font-size:13px; font-weight:600; z-index:9999;';
          document.body.appendChild(toast);
          setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 5000);
        }
      });
    };

    // Save maintenance reminder
    if (btnSaveMaintenance && maintenanceDateInput && maintenancePeriodSelect) {
      btnSaveMaintenance.addEventListener('click', () => {
        const date = maintenanceDateInput.value;
        const period = maintenancePeriodSelect.value;
        
        if (!date) {
          alert('Por favor, selecione uma data.');
          return;
        }
        
        const reminders = JSON.parse(localStorage.getItem('maintenance_reminders') || '[]');
        const newReminder = {
          date: date,
          period: period,
          title: `Manutenção ${period === 'once' ? 'única' : 'recorrente (' + period + ' dias)'}`,
          createdAt: new Date().toISOString()
        };
        
        reminders.push(newReminder);
        localStorage.setItem('maintenance_reminders', JSON.stringify(reminders));
        
        // Clear triggered alerts for new reminders
        localStorage.setItem('maintenance_alerts_triggered', '[]');
        
        loadMaintenanceReminders();
        
        const toast = document.createElement('div');
        toast.textContent = 'Lembrete salvo com sucesso!';
        toast.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:#27ae60; color:#fff; padding:12px 20px; border-radius:999px; font-size:13px; font-weight:600; z-index:9999;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
      });
    }

    // Initial load
    loadMaintenanceReminders();
    checkMaintenanceAlerts();

    // Check maintenance alerts periodically (every hour)
    setInterval(checkMaintenanceAlerts, 60 * 60 * 1000);

    // Function to add log entry
    const addOperationLog = (action: string, details: string) => {
      const logs = JSON.parse(localStorage.getItem('operation_logs') || '[]');
      const entry = {
        timestamp: new Date().toISOString(),
        action,
        details,
      };
      logs.unshift(entry);
      if (logs.length > 50) logs.pop();
      localStorage.setItem('operation_logs', JSON.stringify(logs));
      renderOperationLogs();
    };

    // Render operation logs
    const renderOperationLogs = () => {
      if (!operationLogs) return;
      const logs = JSON.parse(localStorage.getItem('operation_logs') || '[]');
      if (logs.length === 0) {
        operationLogs.innerHTML = '<p class="italic">Nenhuma operação registrada.</p>';
        return;
      }
      operationLogs.innerHTML = logs.map((log: any) => `
        <div class="flex justify-between text-xs">
          <span class="text-error font-semibold">${log.action}</span>
          <span class="text-outline">${new Date(log.timestamp).toLocaleString('pt-BR')}</span>
        </div>
        <p class="text-[10px] text-on-surface-variant ml-2">${log.details}</p>
      `).join('');
    };

    // Load logs on page load
    renderOperationLogs();

    // Reset confirmation handlers
    if (btnResetReadings) {
      btnResetReadings.addEventListener('click', () => {
        confirmResetModal?.classList.remove('hidden');
        resetConfirmInput.value = '';
        btnConfirmReset?.setAttribute('disabled', 'true');
      });
    }

    if (resetConfirmInput && btnConfirmReset) {
      resetConfirmInput.addEventListener('input', () => {
        if (resetConfirmInput.value.toLowerCase() === 'quero resetar') {
          btnConfirmReset.removeAttribute('disabled');
        } else {
          btnConfirmReset.setAttribute('disabled', 'true');
        }
      });

      btnConfirmReset.addEventListener('click', async () => {
        // Clear readings from dataService
        await clearAllReadings();
        
        addOperationLog('RESET', 'Todas as leituras históricas foram removidas');
        
        confirmResetModal?.classList.add('hidden');
        
        const toast = document.createElement('div');
        toast.textContent = 'Leituras resetadas com sucesso!';
        toast.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:#27ae60; color:#fff; padding:12px 20px; border-radius:999px; font-size:13px; font-weight:600; z-index:9999;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
      });
    }

    // Delete confirmation handlers
    if (btnDeleteReading) {
      btnDeleteReading.addEventListener('click', () => {
        confirmDeleteModal?.classList.remove('hidden');
        deleteConfirmInput.value = '';
        btnConfirmDelete?.setAttribute('disabled', 'true');
      });
    }

    if (deleteConfirmInput && btnConfirmDelete) {
      deleteConfirmInput.addEventListener('input', () => {
        if (deleteConfirmInput.value.toLowerCase() === 'quero excluir') {
          btnConfirmDelete.removeAttribute('disabled');
        } else {
          btnConfirmDelete.setAttribute('disabled', 'true');
        }
      });

      btnConfirmDelete.addEventListener('click', async () => {
        const readingId = (document.getElementById('delete-reading-id') as HTMLInputElement).value.trim();
        if (!readingId) {
          alert('Por favor, informe o ID da leitura.');
          return;
        }

        // Delete the reading using dataService
        const deleted = await deleteReadingById(readingId);
        if (deleted) {
          addOperationLog('EXCLUSÃO', `Leitura removida: ${readingId}`);
          
          confirmDeleteModal?.classList.add('hidden');
          
          const toast = document.createElement('div');
          toast.textContent = 'Leitura excluída com sucesso!';
          toast.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:#27ae60; color:#fff; padding:12px 20px; border-radius:999px; font-size:13px; font-weight:600; z-index:9999;';
          document.body.appendChild(toast);
          setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
        } else {
          alert('Leitura não encontrada. Verifique o ID.');
        }
      });
    }

    // Download Exclusion History
    const btnDownloadExclusions = document.getElementById('btn-download-exclusions');
    if (btnDownloadExclusions) {
      btnDownloadExclusions.addEventListener('click', () => {
        const logs = JSON.parse(localStorage.getItem('operation_logs') || '[]');
        const exclusionLogs = logs.filter((log: any) => log.action === 'EXCLUSÃO' || log.action === 'RESET');
        
        if (exclusionLogs.length === 0) {
          alert('Nenhum histórico de exclusões disponível.');
          return;
        }
        
        const content = exclusionLogs.map((log: any) => 
          `Data: ${new Date(log.timestamp).toLocaleString('pt-BR')}\nAção: ${log.action}\nDetalhes: ${log.details}\n`
        ).join('--- ---\n');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historico_exclusoes_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        const toast = document.createElement('div');
        toast.textContent = 'Histórico baixado com sucesso!';
        toast.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:#27ae60; color:#fff; padding:12px 20px; border-radius:999px; font-size:13px; font-weight:600; z-index:9999;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
      });
    }

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
