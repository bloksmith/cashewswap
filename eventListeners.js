// eventListeners.js
let tokenListCache;

document.addEventListener('DOMContentLoaded', async () => {
  const tokenSearchInput = document.querySelector("#tokenSearchModal #token-search");
  tokenSearchInput.addEventListener("input", (event) => {
    console.log('Search input event triggered:', event.target.value);
    filterTokens(event.target.value);
  });

  tokenSearchInput.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  tokenListCache = await fetchTokenList();
  console.log('Token list fetched:', tokenListCache);

  document.getElementById("tokenInButton").addEventListener("click", async function () {
    await handleButtonClick("tokenInButton", "tokenInAddress");
  });

  document.getElementById("tokenOutButton").addEventListener("click", async function () {
    await handleButtonClick("tokenOutButton", "tokenOutAddress");
  });
});

async function handleButtonClick(buttonId, addressInputId) {
  const tokenSearchModal = document.getElementById("tokenSearchModal");
  tokenSearchModal.style.display = "block";

  const tokenSearchResults = document.getElementById("tokenSearchResults");

  tokenSearchResults.onclick = (event) => {
    let targetElement = event.target;
    while (targetElement !== null && !targetElement.matches(".token-item")) {
      targetElement = targetElement.parentElement;
    }

    if (targetElement !== null) {
      const tokenSymbol = targetElement.getAttribute("data-symbol");
      const tokenAddress = targetElement.getAttribute("data-address");
      document.getElementById(buttonId).innerText = tokenSymbol;
      document.getElementById(addressInputId).value = tokenAddress;
      tokenSearchModal.style.display = "none";
    }
  };

  const tokenList = displayTokenList(tokenListCache);
  tokenSearchResults.innerHTML = '';
  tokenSearchResults.appendChild(tokenList);
}

async function fetchTokenList(network = '') {
  const response = await fetch(`http://192.168.112.133:3000/tokenlist?network=${network}`);
  const data = await response.json();
  console.log('Token list data:', data);
  return data.tokens;
}

function displayTokenList(tokens) {
  const tokenList = document.createElement('ul');
  tokenList.classList.add('list-group');

  tokens.forEach(token => {
    const listItem = document.createElement('li');
    listItem.classList.add('list-group-item', 'token-item');

    const logo = document.createElement('img');
    logo.src = token.logoURI;
    logo.width = 20;
    logo.height = 20;
    logo.style.marginRight = '10px';

    const tokenInfo = document.createElement('span');
    tokenInfo.textContent = `${token.symbol} - ${token.name}`;

    listItem.appendChild(logo);
    listItem.appendChild(tokenInfo);

    listItem.setAttribute('data-symbol', token.symbol);
getCoinGeckoId(token.address).then((coingeckoId) => {
  if (coingeckoId) {
    listItem.setAttribute('data-address', coingeckoId);
  } else {
    listItem.setAttribute('data-address', '');
  }
});

    // Add hover event listener
    listItem.addEventListener('mouseover', async () => {
      await displayPriceChart(token.address);
    });

    tokenList.appendChild(listItem);
  });

  return tokenList;
}

let priceChart; // Declare a variable to store the chart instance

async function displayPriceChart(id) {
  try {
    const response = await fetch(`/coingecko-market-chart?id=${id}&vs_currency=usd&days=max&interval=daily`);
    const data = await response.json();

    if (data && data.prices) {
      console.log('Price data:', data);
      renderPriceChart(data.prices);
    } else {
      console.error('The response data does not have a "prices" property. Skipping chart display.');
    }
  } catch (error) {
    console.error('Error parsing JSON:', error, 'Response text:', responseText);
  }
}

function renderPriceChart(prices) {
  const labels = prices.map((dataPoint) => dataPoint[0]);
  const priceData = prices.map((dataPoint) => dataPoint[1]);

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Token Price',
        data: priceData,
        borderColor: 'rgba(75, 192, 192, 1)',
        tension: 0.1,
      },
    ],
  };

  if (priceChart) {
    priceChart.destroy();
  }

  const ctx = document.getElementById('price-chart').getContext('2d');
  priceChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
          },
        },
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}







async function filterTokens(searchValue) {
  console.log('Filtering tokens with search value:', searchValue);

  const filteredTokens = tokenListCache.filter(token => {
    return token.symbol.toLowerCase().includes(searchValue.toLowerCase()) ||
           token.name.toLowerCase().includes(searchValue.toLowerCase());
  });

  console.log('Filtered tokens:', filteredTokens);

  const tokenSearchResults = document.getElementById("tokenSearchResults");
  const tokenList = displayTokenList(filteredTokens);
  tokenSearchResults.innerHTML = '';
  tokenSearchResults.appendChild(tokenList);
}
async function getCoinGeckoId(address) {
  try {
    const response = await fetch(`/coingecko-search?query=${address}`);
    const data = await response.json();

    if (data && data.coins && data.coins.length > 0) {
      return data.coins[0].item.id;
    } else {
      console.error('Unable to find CoinGecko ID for address:', address);
      return null;
    }
  } catch (error) {
    console.error('Error fetching CoinGecko ID:', error);
    return null;
  }
}

async function fetchPriceData(address) {
  try {
    const response = await fetch(`http://192.168.112.133:3000/historical-price?address=${address}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      console.error(`Error fetching price data: ${response.statusText}`);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching price data: ${error.message}`);
    return [];
  }
}


const networkSelect = document.getElementById("networkFilter");
networkSelect.addEventListener("change", async (event) => {
  console.log('Network filter change event triggered');
  const selectedNetwork = event.target.value;
  tokenListCache = await fetchTokenList(selectedNetwork);
  console.log('Token list updated for network', selectedNetwork);
  document.getElementById("token-search").value = '';
  filterTokens('');
});

// Close the token search modal when the user clicks outside of it
window.onclick = function (event) {
  const tokenSearchModal = document.getElementById("tokenSearchModal");
  if (event.target === tokenSearchModal) {
    tokenSearchModal.style.display = "none";
  }
};

