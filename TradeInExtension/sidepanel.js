// LeadSniper Extension - with authentication
const API_BASE = 'https://leadsniperpublic.vercel.app'; // Production API

document.addEventListener('DOMContentLoaded', () => {
  // Screens
  const loginScreen = document.getElementById('loginScreen');
  const appScreen = document.getElementById('appScreen');
  
  // Login elements
  const loginForm = document.getElementById('loginForm');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  
  // User info elements
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userOrg = document.getElementById('userOrg');
  const logoutBtn = document.getElementById('logoutBtn');
  
  // Main app elements
  const scrapeBtn = document.getElementById('scrapeBtn');
  const sendBtn = document.getElementById('sendBtn');
  const statusBar = document.getElementById('statusBar');
  const nameField = document.getElementById('nameField');
  const modelField = document.getElementById('modelField');
  const phoneField = document.getElementById('phoneField');
  const urlField = document.getElementById('urlField');
  
  // Settings elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const closeSettings = document.getElementById('closeSettings');
  const saveSettings = document.getElementById('saveSettings');
  const messageTemplate = document.getElementById('messageTemplate');

  // Stats elements
  const queueCountEl = document.getElementById('queueCount');
  const sentCountEl = document.getElementById('sentCount');
  const timerCountEl = document.getElementById('timerCount');
  const timerStat = document.getElementById('timerStat');
  const clearQueueBtn = document.getElementById('clearQueueBtn');

  // State
  let currentUser = null;
  let authToken = null;
  let messageQueue = [];
  let sentCount = 0;
  let isProcessing = false;
  let countdownInterval = null;
  let nextSendTime = null;
  let lastSentTime = 0; // Track when we last sent a message

  // Default message template with spintax
  const DEFAULT_TEMPLATE = `{Hi|Hello|Hey|Hi there} [Customer Name]! {It's|This is} Zayden O'Gorman, {the|your} acquisition manager {at|from} Stony Plain Chrysler. {We're looking to|My team and I want to} {refresh|update} our {inventory|pre-owned stock} and {[Models] are|the [Models] is} {at the top of our list|in high demand right now}. We {are offering|can offer} {wholesale value|top market value} + a $1000 {Bonus|Trade-In Credit} if you {would be|are} {willing to consider|open to} trading {it|your vehicle} in {to our dealership|to us}. I {can also|could also} {get|secure} you a {pretty good|fantastic} deal on {any|a} new or {certified pre-owned|CPO} vehicle {on our lot|in stock}. {Would you be interested in hearing|Are you open to seeing|Would you want to hear} what we {can offer you|have to offer}?`;

  // =====================
  // AUTHENTICATION
  // =====================
  
  async function checkAuth() {
    const stored = await chrome.storage.local.get(['authToken', 'currentUser', 'sentCount', 'messageTemplate']);
    
    if (stored.authToken && stored.currentUser) {
      // Verify token is still valid
      try {
        const response = await fetch(`${API_BASE}/api/extension/auth`, {
          headers: {
            'Authorization': `Bearer ${stored.authToken}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          authToken = stored.authToken;
          currentUser = data.user;
          sentCount = stored.sentCount || 0;
          showAppScreen();
          return;
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
      
      // Token invalid, clear storage
      await chrome.storage.local.remove(['authToken', 'currentUser']);
    }
    
    showLoginScreen();
  }
  
  async function login(username, password) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span>Signing in...</span>';
    loginError.textContent = '';
    
    // Convert username to email format (same as web app)
    const email = `${username.toLowerCase()}@leadsniper.local`;
    
    try {
      const response = await fetch(`${API_BASE}/api/extension/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      authToken = data.token;
      currentUser = data.user;
      
      // Store credentials
      await chrome.storage.local.set({
        authToken: data.token,
        currentUser: data.user,
      });
      
      showAppScreen();
      
    } catch (error) {
      loginError.textContent = error.message;
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<span>Sign In</span>';
    }
  }
  
  async function logout() {
    await chrome.storage.local.remove(['authToken', 'currentUser']);
    authToken = null;
    currentUser = null;
    showLoginScreen();
  }
  
  function showLoginScreen() {
    loginScreen.style.display = 'flex';
    appScreen.style.display = 'none';
    loginUsername.value = '';
    loginPassword.value = '';
    loginError.textContent = '';
  }
  
  function showAppScreen() {
    loginScreen.style.display = 'none';
    appScreen.style.display = 'flex';
    
    // Update user info
    if (currentUser) {
      const initials = (currentUser.name || currentUser.email || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      userAvatar.textContent = initials;
      userName.textContent = currentUser.name || currentUser.email;
      userOrg.textContent = currentUser.organization_name || 'No Organization';
    }
    
    loadSettings();
    updateCounters();
    scrapeData();
  }
  
  // =====================
  // SPINTAX & TEMPLATING
  // =====================
  
  function processSpintax(text) {
    const spintaxRegex = /\{([^{}]+)\}/g;
    return text.replace(spintaxRegex, (match, options) => {
      if (options.includes('|')) {
        const choices = options.split('|');
        return choices[Math.floor(Math.random() * choices.length)];
      }
      return match;
    });
  }

  // =====================
  // QUEUE SYSTEM
  // =====================
  
  function getRandomDelay() {
    return (60 + Math.floor(Math.random() * 11)) * 1000; // 60-70 seconds
  }

  function formatPhoneNumber(phone) {
    return phone.replace(/[^\d+]/g, '');
  }

  function updateCounters() {
    queueCountEl.textContent = messageQueue.length;
    sentCountEl.textContent = sentCount;
    
    if (messageQueue.length > 0) {
      queueCountEl.classList.add('stat-warning');
    } else {
      queueCountEl.classList.remove('stat-warning');
    }
  }

  function updateTimer() {
    if (nextSendTime && messageQueue.length > 0) {
      const remaining = Math.max(0, nextSendTime - Date.now());
      const seconds = Math.ceil(remaining / 1000);
      timerCountEl.textContent = `${seconds}s`;
      timerStat.classList.add('active');
      
      if (remaining <= 0) {
        timerCountEl.textContent = 'Sending...';
      }
    } else {
      timerCountEl.textContent = '--';
      timerStat.classList.remove('active');
    }
  }

  function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateTimer, 1000);
    updateTimer();
  }

  function clearQueue() {
    if (messageQueue.length === 0) {
      updateStatus('Queue is already empty', '');
      return;
    }
    
    const count = messageQueue.length;
    messageQueue = [];
    updateCounters();
    
    // Reset timer
    nextSendTime = null;
    updateTimer();
    
    updateStatus(`Cleared ${count} item${count > 1 ? 's' : ''} from queue`, 'success');
  }

  // =====================
  // SETTINGS
  // =====================
  
  async function loadSettings() {
    const result = await chrome.storage.local.get(['messageTemplate', 'sentCount', 'lastSentTime']);
    messageTemplate.value = result.messageTemplate || DEFAULT_TEMPLATE;
    sentCount = result.sentCount || 0;
    lastSentTime = result.lastSentTime || 0;
    updateCounters();
  }

  async function saveSettingsToStorage() {
    await chrome.storage.local.set({
      messageTemplate: messageTemplate.value || DEFAULT_TEMPLATE
    });
    
    saveSettings.textContent = 'Saved!';
    saveSettings.classList.add('saved');
    setTimeout(() => {
      saveSettings.textContent = 'Save Settings';
      saveSettings.classList.remove('saved');
    }, 1500);
  }

  async function saveSentCount() {
    await chrome.storage.local.set({ sentCount, lastSentTime });
  }

  function toggleSettings() {
    settingsPanel.classList.toggle('open');
  }

  // =====================
  // STATUS & UI
  // =====================
  
  function updateStatus(message, type = '') {
    const statusText = statusBar.querySelector('.status-text');
    statusText.textContent = message;
    statusBar.className = 'status-bar ' + type;
  }

  // =====================
  // SCRAPING
  // =====================
  
  async function scrapeData() {
    scrapeBtn.classList.add('loading');
    updateStatus('Scraping page...', '');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url || !tab.url.includes('kijiji.ca')) {
        updateStatus('Not a Kijiji page', 'error');
        scrapeBtn.classList.remove('loading');
        return;
      }

      // Capture the listing URL
      urlField.value = tab.url;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeKijijiData
      });

      const data = results[0]?.result;

      if (data) {
        if (data.name) nameField.value = data.name;
        if (data.model) modelField.value = data.model;
        if (data.phone) phoneField.value = data.phone;

        const foundCount = [data.name, data.model, data.phone].filter(Boolean).length;
        
        if (foundCount > 0) {
          updateStatus(`Found ${foundCount}/3 fields`, 'success');
        } else {
          updateStatus('No data found on page', 'error');
        }
      } else {
        updateStatus('Failed to scrape data', 'error');
      }
    } catch (error) {
      console.error('Scraping error:', error);
      updateStatus('Error: ' + error.message, 'error');
    }

    scrapeBtn.classList.remove('loading');
  }

  function scrapeKijijiData() {
    const data = {
      name: null,
      model: null,
      phone: null
    };

    // Scrape seller name
    const nameLink = document.querySelector('h3 a[href^="/o-profile/"]');
    if (nameLink) {
      data.name = nameLink.textContent.trim();
    } else {
      const altNameLink = document.querySelector('a[class*="cPzJWd"]');
      if (altNameLink) {
        data.name = altNameLink.textContent.trim();
      }
    }

    // Scrape vehicle model
    const allParagraphs = document.querySelectorAll('p');
    for (const p of allParagraphs) {
      if (p.textContent.trim() === 'Model') {
        const modelValue = p.nextElementSibling;
        if (modelValue && modelValue.tagName === 'P') {
          data.model = modelValue.textContent.trim();
          break;
        }
      }
    }
    
    if (!data.model) {
      const titleElement = document.querySelector('h1[class*="title"]') || 
                          document.querySelector('[data-testid="listing-title"]') ||
                          document.querySelector('h1');
      if (titleElement) {
        data.model = titleElement.textContent.trim();
      }
    }

    // Scrape phone number
    const phoneLink = document.querySelector('a[href^="tel:"]');
    if (phoneLink) {
      data.phone = phoneLink.textContent.trim();
    }

    return data;
  }

  // =====================
  // SEND MESSAGE
  // =====================
  
  async function addToQueue() {
    if (!authToken) {
      updateStatus('Please sign in first', 'error');
      return;
    }
    
    const rawPhone = phoneField.value.trim();
    if (!rawPhone) {
      updateStatus('No phone number to send to', 'error');
      return;
    }
    const toNumber = formatPhoneNumber(rawPhone);

    const stored = await chrome.storage.local.get(['messageTemplate']);
    const template = stored.messageTemplate || DEFAULT_TEMPLATE;
    
    // Replace placeholders then process spintax
    let message = template
      .replace(/\[Customer Name\]/gi, nameField.value || 'there')
      .replace(/\[Models?\]/gi, modelField.value || 'your vehicle');
    message = processSpintax(message);

    const msgData = {
      to: toNumber,
      content: message,
      seller_name: nameField.value || null,
      vehicle_model: modelField.value || null,
      listing_url: urlField.value || null,
    };

    // Check if we should send instantly (no message sent in last 60 seconds)
    const timeSinceLastSend = Date.now() - lastSentTime;
    const shouldSendInstantly = timeSinceLastSend >= 60000; // 60 seconds

    if (shouldSendInstantly && !isProcessing) {
      // Send instantly
      await sendMessageInstantly(msgData);
    } else {
      // Add to queue
      messageQueue.push(msgData);
      updateCounters();
      updateStatus(`Added to queue (${messageQueue.length} pending)`, 'success');

      // Visual feedback
      sendBtn.innerHTML = `
        <span>Added!</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
      setTimeout(() => {
        sendBtn.innerHTML = `
          <span>Add to Queue</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        `;
      }, 1000);

      if (!isProcessing) {
        processQueue();
      }
    }
  }

  // Send a message instantly (no queue delay)
  async function sendMessageInstantly(msg) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = `
      <span>Sending...</span>
      <svg class="spinning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    `;
    updateStatus(`Sending to ${msg.seller_name || msg.to}...`, '');

    try {
      const response = await fetch(`${API_BASE}/api/extension/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: msg.to,
          content: msg.content,
          organizationId: currentUser.organization_id,
          metadata: {
            seller_name: msg.seller_name,
            vehicle_model: msg.vehicle_model,
            kijiji_listing_url: msg.listing_url,
            is_initial_outreach: true,
          },
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        sentCount++;
        lastSentTime = Date.now(); // Update last sent time
        saveSentCount();
        updateCounters();
        updateStatus(`Sent to ${msg.seller_name || msg.to}!`, 'success');
        
        // Success feedback
        sendBtn.innerHTML = `
          <span>Sent!</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
      } else {
        throw new Error(data.error || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('SMS error:', error);
      updateStatus(`Failed: ${error.message}`, 'error');
      
      if (error.message.includes('token') || error.message.includes('Unauthorized')) {
        logout();
        return;
      }
    } finally {
      setTimeout(() => {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `
          <span>Add to Queue</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        `;
      }, 1000);
    }
  }

  async function processQueue() {
    if (isProcessing || messageQueue.length === 0) return;
    
    isProcessing = true;
    startCountdown();

    while (messageQueue.length > 0) {
      const msg = messageQueue[0];
      
      const delay = getRandomDelay();
      nextSendTime = Date.now() + delay;
      updateTimer();

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        updateStatus(`Sending to ${msg.seller_name || msg.to}...`, '');
        
        const response = await fetch(`${API_BASE}/api/extension/send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: msg.to,
            content: msg.content,
            seller_name: msg.seller_name,
            vehicle_model: msg.vehicle_model,
            listing_url: msg.listing_url,
          }),
        });

        const data = await response.json();

          if (response.ok && data.success) {
            sentCount++;
            lastSentTime = Date.now(); // Update last sent time
            saveSentCount();
            updateStatus(`Sent to ${msg.seller_name || msg.to}!`, 'success');
          } else {
            throw new Error(data.error || 'Failed to send SMS');
          }
        } catch (error) {
          console.error('SMS error:', error);
          updateStatus(`Failed: ${error.message}`, 'error');
          
          // If auth error, redirect to login
          if (error.message.includes('token') || error.message.includes('Unauthorized')) {
            logout();
            return;
          }
        }

        messageQueue.shift();
        updateCounters();
      }

    isProcessing = false;
    nextSendTime = null;
    updateTimer();
    
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    
    updateStatus('Queue complete!', 'success');
  }

  // =====================
  // EVENT LISTENERS
  // =====================
  
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    login(loginUsername.value, loginPassword.value);
  });
  
  logoutBtn.addEventListener('click', logout);
  scrapeBtn.addEventListener('click', scrapeData);
  sendBtn.addEventListener('click', addToQueue);
  clearQueueBtn.addEventListener('click', clearQueue);
  settingsBtn.addEventListener('click', toggleSettings);
  closeSettings.addEventListener('click', toggleSettings);
  saveSettings.addEventListener('click', saveSettingsToStorage);

  // Tab change listeners
  chrome.tabs.onActivated.addListener(() => {
    if (currentUser) scrapeData();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('kijiji.ca') && currentUser) {
      scrapeData();
    }
  });

  // Initialize
  checkAuth();
});
