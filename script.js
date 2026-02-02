/**
 * Crypto Live Ticker - BTC & ETH
 * Auto-refreshes every 5 minutes
 * Uses CoinGecko API (free, no API key required)
 */

// Configuration
const CONFIG = {
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    apiBaseUrl: 'https://api.coingecko.com/api/v3',
    currency: 'usd',
    cryptos: ['bitcoin', 'ethereum']
};

// DOM Elements
const elements = {
    lastUpdated: document.getElementById('last-updated'),
    loading: document.getElementById('loading'),
    btc: {
        price: document.getElementById('btc-price'),
        change: document.getElementById('btc-change'),
        high: document.getElementById('btc-high'),
        low: document.getElementById('btc-low'),
        marketCap: document.getElementById('btc-market-cap'),
        volume: document.getElementById('btc-volume'),
        chart: document.getElementById('btc-chart')
    },
    eth: {
        price: document.getElementById('eth-price'),
        change: document.getElementById('eth-change'),
        high: document.getElementById('eth-high'),
        low: document.getElementById('eth-low'),
        marketCap: document.getElementById('eth-market-cap'),
        volume: document.getElementById('eth-volume'),
        chart: document.getElementById('eth-chart')
    }
};

// Format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

// Format large numbers (billions, millions)
function formatLargeNumber(value) {
    if (value >= 1e12) {
        return '$' + (value / 1e12).toFixed(2) + 'T';
    } else if (value >= 1e9) {
        return '$' + (value / 1e9).toFixed(2) + 'B';
    } else if (value >= 1e6) {
        return '$' + (value / 1e6).toFixed(2) + 'M';
    }
    return formatCurrency(value);
}

// Format timestamp
function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Fetch crypto data
async function fetchCryptoData(cryptoId) {
    try {
        const response = await fetch(
            `${CONFIG.apiBaseUrl}/coins/${cryptoId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
        );
        
        if (!response.ok) throw new Error(`Failed to fetch ${cryptoId}`);
        
        const data = await response.json();
        return data.market_data;
    } catch (error) {
        console.error(`Error fetching ${cryptoId}:`, error);
        return null;
    }
}

// Fetch price history
async function fetchPriceHistory(cryptoId) {
    try {
        const response = await fetch(
            `${CONFIG.apiBaseUrl}/coins/${cryptoId}/market_chart?vs_currency=${CONFIG.currency}&days=1`
        );
        
        if (!response.ok) throw new Error(`Failed to fetch ${cryptoId} history`);
        
        const data = await response.json();
        return data.prices;
    } catch (error) {
        console.error(`Error fetching ${cryptoId} history:`, error);
        return [];
    }
}

// Update crypto UI
function updateCryptoUI(cryptoType, marketData) {
    if (!marketData) return;
    
    const els = elements[cryptoType];
    const currentPrice = marketData.current_price[CONFIG.currency];
    const priceChangePercent = marketData.price_change_percentage_24h;
    
    // Update price
    els.price.textContent = formatCurrency(currentPrice);
    
    // Update price change
    const isPositive = priceChangePercent >= 0;
    els.change.className = 'price-change ' + (isPositive ? 'positive' : 'negative');
    els.change.innerHTML = `
        <span class="change-indicator">${isPositive ? '▲' : '▼'}</span>
        <span class="change-percent">${Math.abs(priceChangePercent).toFixed(2)}%</span>
    `;
    
    // Update stats
    els.high.textContent = formatCurrency(marketData.high_24h[CONFIG.currency]);
    els.low.textContent = formatCurrency(marketData.low_24h[CONFIG.currency]);
    els.marketCap.textContent = formatLargeNumber(marketData.market_cap[CONFIG.currency]);
    els.volume.textContent = formatLargeNumber(marketData.total_volume[CONFIG.currency]);
}

// Draw chart
function drawChart(canvas, priceData, color) {
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (priceData.length === 0) return;
    
    // Get price values
    const prices = priceData.map(p => p[1]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    
    // Padding
    const padding = { top: 15, right: 15, bottom: 25, left: 15 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Helper functions
    const getY = (price) => padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
    const getX = (index) => padding.left + (index / (prices.length - 1)) * chartWidth;
    
    // Determine trend
    const isUp = prices[prices.length - 1] >= prices[0];
    const lineColor = color || (isUp ? '#00d084' : '#ff4757');
    
    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, isUp ? 'rgba(0, 208, 132, 0.25)' : 'rgba(255, 71, 87, 0.25)');
    gradient.addColorStop(1, isUp ? 'rgba(0, 208, 132, 0.03)' : 'rgba(255, 71, 87, 0.03)');
    
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(prices[0]));
    
    for (let i = 1; i < prices.length; i++) {
        const x = getX(i);
        const y = getY(prices[i]);
        const prevX = getX(i - 1);
        const prevY = getY(prices[i - 1]);
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
    }
    
    ctx.lineTo(getX(prices.length - 1), getY(prices[prices.length - 1]));
    ctx.lineTo(getX(prices.length - 1), height - padding.bottom);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(prices[0]));
    
    for (let i = 1; i < prices.length; i++) {
        const x = getX(i);
        const y = getY(prices[i]);
        const prevX = getX(i - 1);
        const prevY = getY(prices[i - 1]);
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
    }
    
    ctx.lineTo(getX(prices.length - 1), getY(prices[prices.length - 1]));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Draw end point
    const endX = getX(prices.length - 1);
    const endY = getY(prices[prices.length - 1]);
    ctx.beginPath();
    ctx.arc(endX, endY, 5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    
    // Time labels
    ctx.fillStyle = '#a0a0b0';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    const labels = ['24h ago', '12h', '4h', 'Now'];
    const positions = [0, 0.5, 0.83, 1];
    
    positions.forEach((pos, i) => {
        const x = padding.left + pos * chartWidth;
        ctx.fillText(labels[i], x, height - 8);
    });
}

// Main update function
async function updateData() {
    console.log('Fetching crypto data...');
    
    // Fetch all data
    const [btcData, ethData, btcHistory, ethHistory] = await Promise.all([
        fetchCryptoData('bitcoin'),
        fetchCryptoData('ethereum'),
        fetchPriceHistory('bitcoin'),
        fetchPriceHistory('ethereum')
    ]);
    
    // Update UI
    if (btcData) {
        updateCryptoUI('btc', btcData);
        if (btcHistory.length > 0) {
            drawChart(elements.btc.chart, btcHistory, '#f7931a');
        }
    }
    
    if (ethData) {
        updateCryptoUI('eth', ethData);
        if (ethHistory.length > 0) {
            drawChart(elements.eth.chart, ethHistory, '#627eea');
        }
    }
    
    // Update timestamp
    elements.lastUpdated.textContent = formatTime(new Date());
    
    // Hide loading
    elements.loading.classList.add('hidden');
}

// Initialize
async function init() {
    await updateData();
    
    // Auto-refresh
    setInterval(updateData, CONFIG.refreshInterval);
    
    // Handle resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(async () => {
            const [btcHistory, ethHistory] = await Promise.all([
                fetchPriceHistory('bitcoin'),
                fetchPriceHistory('ethereum')
            ]);
            if (btcHistory.length > 0) drawChart(elements.btc.chart, btcHistory, '#f7931a');
            if (ethHistory.length > 0) drawChart(elements.eth.chart, ethHistory, '#627eea');
        }, 250);
    });
    
    console.log(`Crypto ticker initialized. Refreshing every ${CONFIG.refreshInterval / 1000 / 60} minutes.`);
}

// Start
document.addEventListener('DOMContentLoaded', init);
