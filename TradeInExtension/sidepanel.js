document.addEventListener('DOMContentLoaded', () => {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const sendBtn = document.getElementById('sendBtn');
  const statusBar = document.getElementById('statusBar');
  const nameField = document.getElementById('nameField');
  const modelField = document.getElementById('modelField');
  const phoneField = document.getElementById('phoneField');
  
  // Settings elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const closeSettings = document.getElementById('closeSettings');
  const saveSettings = document.getElementById('saveSettings');
  const apiKeyField = document.getElementById('apiKeyField');
  const fromNumberField = document.getElementById('fromNumberField');
  const messageTemplate = document.getElementById('messageTemplate');

  // Stats elements
  const queueCountEl = document.getElementById('queueCount');
  const sentCountEl = document.getElementById('sentCount');
  const timerCountEl = document.getElementById('timerCount');
  const timerStat = document.getElementById('timerStat');

  // Queue system
  let messageQueue = [];
  let sentCount = 0;
  let isProcessing = false;
  let countdownInterval = null;
  let nextSendTime = null;

  // Default message template with spintax
  const DEFAULT_TEMPLATE = `{Hi|Hello|Hey|Hi there} [Customer Name]! {It's|This is} Zayden O'Gorman, {the|your} acquisition manager {at|from} Stony Plain Chrysler. {We're looking to|My team and I want to} {refresh|update} our {inventory|pre-owned stock} and {[Models] are|the [Models] is} {at the top of our list|in high demand right now}. We {are offering|can offer} {wholesale value|top market value} + a $1000 {Bonus|Trade-In Credit} if you {would be|are} {willing to consider|open to} trading {it|your vehicle} in {to our dealership|to us}. I {can also|could also} {get|secure} you a {pretty good|fantastic} deal on {any|a} new or {certified pre-owned|CPO} vehicle {on our lot|in stock}. {Would you be interested in hearing|Are you open to seeing|Would you want to hear} what we {can offer you|have to offer}?`;

  // Process spintax - randomly select from {option1|option2|option3}
  function processSpintax(text) {
    const spintaxRegex = /\{([^{}]+)\}/g;
    return text.replace(spintaxRegex, (match, options) => {
      // Check if it contains a pipe (spintax) vs just a placeholder
      if (options.includes('|')) {
        const choices = options.split('|');
        return choices[Math.floor(Math.random() * choices.length)];
      }
      // Not spintax, return as-is
      return match;
    });
  }

  // Get random delay between 60-70 seconds (in ms)
  function getRandomDelay() {
    return (60 + Math.floor(Math.random() * 11)) * 1000; // 60-70 seconds
  }

  // Format phone number to +xxxxxxxxxxx (remove dashes, spaces, etc.)
  function formatPhoneNumber(phone) {
    // Keep only + and digits
    return phone.replace(/[^\d+]/g, '');
  }

  // Update UI counters
  function updateCounters() {
    queueCountEl.textContent = messageQueue.length;
    sentCountEl.textContent = sentCount;
    
    // Highlight queue if there are items
    if (messageQueue.length > 0) {
      queueCountEl.classList.add('stat-warning');
    } else {
      queueCountEl.classList.remove('stat-warning');
    }
  }

  // Update countdown timer
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

  // Start countdown interval
  function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateTimer, 1000);
    updateTimer();
  }

  // Load settings and stats from storage
  async function loadSettings() {
    const result = await chrome.storage.local.get(['apiKey', 'fromNumber', 'messageTemplate', 'sentCount']);
    if (result.apiKey) apiKeyField.value = result.apiKey;
    if (result.fromNumber) fromNumberField.value = result.fromNumber;
    messageTemplate.value = result.messageTemplate || DEFAULT_TEMPLATE;
    sentCount = result.sentCount || 0;
    updateCounters();
  }

  // Save settings to storage
  async function saveSettingsToStorage() {
    await chrome.storage.local.set({
      apiKey: apiKeyField.value,
      fromNumber: fromNumberField.value,
      messageTemplate: messageTemplate.value || DEFAULT_TEMPLATE
    });
    
    // Visual feedback
    saveSettings.textContent = 'Saved!';
    saveSettings.classList.add('saved');
    setTimeout(() => {
      saveSettings.textContent = 'Save Settings';
      saveSettings.classList.remove('saved');
    }, 1500);
  }

  // Save sent count
  async function saveSentCount() {
    await chrome.storage.local.set({ sentCount });
  }

  // Toggle settings panel
  function toggleSettings() {
    settingsPanel.classList.toggle('open');
  }

  // Update status bar
  function updateStatus(message, type = '') {
    const statusText = statusBar.querySelector('.status-text');
    statusText.textContent = message;
    statusBar.className = 'status-bar ' + type;
  }

  // Scrape data from the current page
  async function scrapeData() {
    scrapeBtn.classList.add('loading');
    updateStatus('Scraping page...', '');

    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on a Kijiji page
      if (!tab.url || !tab.url.includes('kijiji.ca')) {
        updateStatus('Not a Kijiji page', 'error');
        scrapeBtn.classList.remove('loading');
        return;
      }

      // Execute the content script and get results
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeKijijiData
      });

      const data = results[0]?.result;

      if (data) {
        // Populate fields with scraped data
        if (data.name) {
          nameField.value = data.name;
        }
        if (data.model) {
          modelField.value = data.model;
        }
        if (data.phone) {
          phoneField.value = data.phone;
        }

        // Count how many fields were found
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

  // Function that runs in the page context to scrape data
  function scrapeKijijiData() {
    const data = {
      name: null,
      model: null,
      phone: null
    };

    // Scrape seller name from profile link
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

  // Add message to queue
  async function addToQueue() {
    const settings = await chrome.storage.local.get(['apiKey', 'fromNumber', 'messageTemplate']);
    
    // Validate settings
    if (!settings.apiKey) {
      updateStatus('API key not set - open settings', 'error');
      settingsPanel.classList.add('open');
      return;
    }
    
    if (!settings.fromNumber) {
      updateStatus('From number not set - open settings', 'error');
      settingsPanel.classList.add('open');
      return;
    }
    
    // Validate and format phone number
    const rawPhone = phoneField.value.trim();
    if (!rawPhone) {
      updateStatus('No phone number to send to', 'error');
      return;
    }
    const toNumber = formatPhoneNumber(rawPhone);

    // Build message from template
    const template = settings.messageTemplate || DEFAULT_TEMPLATE;
    
    // First replace placeholders [Customer Name] and [Models]
    let message = template
      .replace(/\[Customer Name\]/gi, nameField.value || 'there')
      .replace(/\[Models?\]/gi, modelField.value || 'your vehicle');
    
    // Then process spintax to randomly select options
    message = processSpintax(message);

    // Add to queue (format from number too)
    messageQueue.push({
      to: toNumber,
      from: formatPhoneNumber(settings.fromNumber),
      content: message,
      apiKey: settings.apiKey,
      name: nameField.value,
      model: modelField.value
    });

    updateCounters();
    updateStatus(`Added to queue (${messageQueue.length} pending)`, 'success');

    // Visual feedback on button
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

    // Start processing queue if not already
    if (!isProcessing) {
      processQueue();
    }
  }

  // Process the message queue
  async function processQueue() {
    if (isProcessing || messageQueue.length === 0) return;
    
    isProcessing = true;
    startCountdown();

    while (messageQueue.length > 0) {
      const msg = messageQueue[0];
      
      // Set next send time for countdown
      const delay = getRandomDelay();
      nextSendTime = Date.now() + delay;
      updateTimer();

      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // Send the message
      try {
        updateStatus(`Sending to ${msg.name || msg.to}...`, '');
        
        const response = await fetch('https://api.httpsms.com/v1/messages/send', {
          method: 'POST',
          headers: {
            'x-api-key': msg.apiKey,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: msg.content,
            from: msg.from,
            to: msg.to
          })
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
          sentCount++;
          saveSentCount();
          updateStatus(`Sent to ${msg.name || msg.to}!`, 'success');
        } else {
          throw new Error(data.message || 'Failed to send SMS');
        }
      } catch (error) {
        console.error('SMS error:', error);
        updateStatus(`Failed: ${error.message}`, 'error');
      }

      // Remove from queue
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

  // Event listeners
  scrapeBtn.addEventListener('click', scrapeData);
  sendBtn.addEventListener('click', addToQueue);
  settingsBtn.addEventListener('click', toggleSettings);
  closeSettings.addEventListener('click', toggleSettings);
  saveSettings.addEventListener('click', saveSettingsToStorage);

  // Load settings on startup
  loadSettings();

  // Auto-scrape when panel opens
  scrapeData();

  // Listen for tab changes to auto-scrape when switching tabs
  chrome.tabs.onActivated.addListener(() => {
    scrapeData();
  });

  // Listen for page updates to auto-scrape when navigating
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('kijiji.ca')) {
      scrapeData();
    }
  });
});
