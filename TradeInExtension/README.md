# Kijiji Lead Scraper - Chrome Extension

A modern Chrome extension for scraping seller details from Kijiji listings. Opens as a persistent sidebar panel.

## Features

- **Sidebar Panel**: Stays open while you browse - no more popup closing!
- **Auto-Scraping**: Automatically scrapes data when switching tabs or navigating
- **All Fields Editable**: Name, Model, and Phone can all be edited
- **SMS Integration**: Send leads via SMS using [httpSMS](https://httpsms.com) API
- **Message Templates**: Customize your SMS with `{name}` and `{model}` placeholders
- **Modern UI**: Dark theme with smooth animations and professional design

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `TradeInExtension` folder
5. The extension icon will appear in your toolbar

## Usage

1. Navigate to a Kijiji listing page (e.g., `https://www.kijiji.ca/v-cars-trucks/...`)
2. Click the extension icon in your toolbar to open the sidebar
3. The extension will automatically scrape:
   - **Seller Name** - From the profile link
   - **Vehicle Model** - From the listing details
   - **Phone Number** - From the tel: link (if available)
4. Edit any field as needed
5. Click **Send Lead** (reserved for future functionality)

The sidebar stays open as you navigate between listings and will auto-refresh when you visit new Kijiji pages.

## SMS Setup (httpSMS)

To enable the "Send Lead" functionality, you need to set up [httpSMS](https://httpsms.com):

1. **Create an account** at [httpsms.com](https://httpsms.com)
2. **Get your API key** from [httpsms.com/settings](https://httpsms.com/settings)
3. **Install the Android app** on your phone from [GitHub releases](https://github.com/NdoleStudio/httpsms/releases/latest/download/HttpSms.apk)
4. **Configure the extension**:
   - Click the ⚙️ settings icon in the extension
   - Enter your **API Key**
   - Enter your **From Number** (your Android phone number with country code, e.g., `+15551234567`)
   - Customize your **Message Template**
   - Click **Save Settings**

### Message Template Syntax

**Placeholders** (replaced with scraped data):
- `[Customer Name]` - Seller's name
- `[Models]` - Vehicle model

**Spintax** (randomly selects one option):
- `{option1|option2|option3}` - Randomly picks one

### Example Message Template

```
{Hi|Hello|Hey} [Customer Name]! {It's|This is} John from ABC Motors. We're interested in your [Models]. {Would you be open to|Are you interested in} a trade-in offer?
```

This could output:
```
Hello Ryan! This is John from ABC Motors. We're interested in your 2012 Mercedes-Benz CLS-Class. Are you interested in a trade-in offer?
```

## Scraped Elements

| Field | Selector | Example |
|-------|----------|---------|
| Name | `h3 a[href^="/o-profile/"]` | `<a href="/o-profile/123">Ryan</a>` |
| Model | `<p>` after "Model" label | `<p>2012 Mercedes-Benz CLS-Class</p>` |
| Phone | `a[href^="tel:"]` | `<a href="tel:+1-780-399-4363">+1-780-399-4363</a>` |

## File Structure

```
TradeInExtension/
├── manifest.json      # Chrome extension manifest (v3)
├── background.js      # Service worker for side panel
├── sidepanel.html     # Sidebar panel UI
├── sidepanel.css      # Styling
├── sidepanel.js       # UI logic and scraping
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Development

To modify the scraping logic, edit the `scrapeKijijiData()` function in `sidepanel.js`.

## Future Enhancements

The **Send Lead** button is currently a placeholder. Future functionality could include:
- Sending data to a CRM API
- Exporting to CSV
- Integration with email/SMS services
