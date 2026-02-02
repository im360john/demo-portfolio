/**
 * Bitcoin Live Ticker
 * Auto-refreshes every 5 minutes
 * Uses CoinGecko API (free, no API key required)
 */

// Configuration
const CONFIG = {
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    apiBaseUrl: 'https://api.coingecko.com/api/v3',
    currency: 'usd',
    cryptoId: 'bitcoin'
};

// State
let priceHistory = [];
let lastPrice = 0;

// DOM Elements
const elements = {
    price: document.getElementById('btc-price'),
    priceChange: document.getElementById('price-change'),
    changeIndicator: document.querySelector('.change-indicator'),
    changePercent: document.querySelector('.change-percent'),
    lastUpdated: document.getElementById('last-updated'),
    high24h: document.getElementById('high-24h'),
    low24h: document.getElementById('low-24h'),
    marketCap: document.getElementById('market-cap'),
    volume: document.getElementById('volume'),
    chart: document.getElementById('price-chart'),
    loading: document.getElementById('loading')
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

// Fetch current Bitcoin data
async function fetchBitcoinData() {
    try {
        const response = await fetch(
            `${CONFIG.apiBaseUrl}/coins/${CONFIG.cryptoId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
        );
        
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        return data.market_data;
    } catch (error) {
        console.error('Error fetching Bitcoin data:', error);
        return null;
    }
}

// Fetch 24h price history for chart
async function fetchPriceHistory() {
    try {
        const response = await fetch(
            `${CONFIG.apiBaseUrl}/coins/${CONFIG.cryptoId}/market_chart?vs_currency=${CONFIG.currency}&days=1`
        );
        
        if (!response.ok) throw new Error('Failed to fetch history');
        
        const data = await response.json();
        return data.prices;
    } catch (error) {
        console.error('Error fetching price history:', error);
        return [];
    }
}

// Update UI with new data
function updateUI(marketData) {
    if (!marketData) return;
    
    const currentPrice = marketData.current_price[CONFIG.currency];
    const priceChange24h = marketData.price_change_24h;
    const priceChangePercent = marketData.price_change_percentage_24h;
    
    // Update price
    elements.price.textContent = formatCurrency(currentPrice);
    
    // Update price change
    const isPositive = priceChangePercent >= 0;
    elements.priceChange.className = 'price-change ' + (isPositive ? 'positive' : 'negative');
    elements.changeIndicator.textContent = isPositive ? '▲' : '▼';
    elements.changePercent.textContent = Math.abs(priceChangePercent).toFixed(2) + '%';
    
    // Update stats
    elements.high24h.textContent = formatCurrency(marketData.high_24h[CONFIG.currency]);
    elements.low24h.textContent = formatCurrency(marketData.low_24h[CONFIG.currency]);
    elements.marketCap.textContent = formatLargeNumber(marketData.market_cap[CONFIG.currency]);
    elements.volume.textContent = formatLargeNumber(marketData.total_volume[CONFIG.currency]);
    
    // Update timestamp
    elements.lastUpdated.textContent = formatTime(new Date());
    
    // Store for history
    lastPrice = currentPrice;
}

// Draw price chart
function drawChart(priceData) {
    const canvas = elements.chart;
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
    const priceRange = maxPrice - minPrice;
    
    // Padding
    const padding = { top: 20, right: 20, bottom: 30, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Helper to map price to Y coordinate
    const getY = (price) => {
        return padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
    };
    
    // Helper to map index to X coordinate
    const getX = (index) => {
        return padding.left + (index / (prices.length - 1)) * chartWidth;
    };
    
    // Determine trend color
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const isUp = endPrice >= startPrice;
    const color = isUp ? '#00d084' : '#ff4757';
    
    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, isUp ? 'rgba(0, 208, 132, 0.3)' : 'rgba(255, 71, 87, 0.3)');
    gradient.addColorStop(1, isUp ? 'rgba(0, 208, 132, 0.05)' : 'rgba(255, 71, 87, 0.05)');
    
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(prices[0]));
    
    // Draw smooth curve
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
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Draw end point dot
    const endX = getX(prices.length - 1);
    const endY = getY(prices[prices.length - 1]);
    ctx.beginPath();
    ctx.arc(endX, endY, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(endX, endY, 10, 0, Math.PI * 2);
    ctx.fillStyle = isUp ? 'rgba(0, 208, 132, 0.3)' : 'rgba(255, 71, 87, 0.3)';
    ctx.fill();
    
    // Draw time labels
    ctx.fillStyle = '#a0a0b0';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    const timeLabels = ['24h ago', '12h ago', '4h ago', 'Now'];
    const labelPositions = [0, 0.5, 0.83, 1];
    
    labelPositions.forEach((pos, i) => {
        const x = padding.left + pos * chartWidth;
        ctx.fillText(timeLabels[i], x, height - 8);
    });
}

// Main update function
async function updateData() {
    console.log('Fetching Bitcoin data...');
    
    // Fetch current data and history
    const [marketData, history] = await Promise.all([
        fetchBitcoinData(),
        fetchPriceHistory()
    ]);
    
    if (marketData) {
        updateUI(marketData);
        
        if (history.length > 0) {
            drawChart(history);
        }
        
        // Hide loading
        elements.loading.classList.add('hidden');
    }
}

// Initialize
async function init() {
    // Initial load
    await updateData();
    
    // Set up auto-refresh every 5 minutes
    setInterval(updateData, CONFIG.refreshInterval);
    
    // Handle window resize for chart
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            fetchPriceHistory().then(drawChart);
        }, 250);
    });
    
    console.log(`Bitcoin ticker initialized. Auto-refreshing every ${CONFIG.refreshInterval / 1000 / 60} minutes.`);
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
