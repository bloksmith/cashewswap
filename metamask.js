// Declare walletAddress variable
let walletAddress;
async function getBRCBalance() {
  try {
    console.log('getBRCBalance called');

    // Check if MetaMask is connected
    if (window.ethereum) {
      // Get account
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const account = accounts[0];

      console.log("Account: ", account);

      // Setup Web3
      const web3 = new Web3(window.ethereum);

      // ERC-20 Token Contract ABI (Application Binary Interface)
      const minABI = [
          // balanceOf
          {
            "constant":true,
            "inputs":[{"name":"_owner","type":"address"}],
            "name":"balanceOf",
            "outputs":[{"name":"balance","type":"uint256"}],
            "type":"function"
          },
          // decimals
          {
            "constant":true,
            "inputs":[],
            "name":"decimals",
            "outputs":[{"name":"","type":"uint8"}],
            "type":"function"
          }
      ];

      // BRC Contract Address
      const tokenAddress = '0x948d653f014d02AAa56C0fce794443ecC827Ab28';

      // Create Contract
      const contract = new web3.eth.Contract(minABI, tokenAddress);

      console.log("Contract: ", contract);

      // Get Balance
      const balance = await contract.methods.balanceOf(account).call();

      console.log("Raw Balance: ", balance.toString());

      // Get Decimals
      const decimals = await contract.methods.decimals().call();

      console.log("Decimals: ", decimals.toString());

      // Adjust for decimals
      const adjustedBalance = balance / (10 ** decimals);

      console.log("Adjusted Balance: ", adjustedBalance);

      // Set Balance in UI
      document.getElementById("brc-balance").textContent = adjustedBalance;
    } else {
      alert("MetaMask not found. Please install it to fetch BRC balance.");
    }
  } catch (err) {
    console.error(err);
    alert("Failed to fetch BRC balance.");
  }
}
async function displayTransactionHistory(walletAddress) {
  const response = await fetch(`/api/get-transaction-history/${walletAddress}`);
  const data = await response.json();
  const transactionList = document.getElementById("transaction-list");

  // Clear the current list of transactions
  transactionList.innerHTML = "";

  // Loop through the transactions and create a new list item for each one
  for (const transaction of data.transactions) {
    const listItem = document.createElement("li");
    listItem.textContent = `Transaction Hash: ${transaction.hash}, Value: ${transaction.value} ETH`;
    transactionList.appendChild(listItem);
  }
}

async function connectMetamask() {
  if (typeof window.ethereum !== "undefined") {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      walletAddress = accounts[0];
      await updateWalletInfo();
    } catch (error) {
      console.error("User rejected the request:", error);
    }
  } else {
    alert("MetaMask is not installed. Please consider installing it!");
  }
}

const globalConnectMetamaskBtn = document.getElementById("dropdownMenuButton");
globalConnectMetamaskBtn.addEventListener("click", async () => {
  await connectMetamask();
  await updateWalletInfo();
});

async function fetchTransactionHistory(walletAddress) {
  // Replace YOUR_ETHERSCAN_API_KEY with your actual Etherscan API key
  const apiKey = 'IZVCZX7A5MYXGQ6MFXW19H84138AFD38Q2';
  const network = 'mainnet'; // Change this to the desired network, e.g., 'ropsten' for the Ropsten testnet
  const apiUrl = `https://${network}.etherscan.io/api?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;

  try {
    const response = await axios.get(apiUrl);
    if (response.data.status === '1') {
      return response.data.result;
    } else {
      console.error('Error fetching transaction history:', response.data.message);
      return [];
    }
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return [];
  }
}
async function fetchTokenBalances(provider, account, tokenList) {
  const abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const tokenBalances = [];

  for (const token of tokenList) {
    try {
      const contract = new ethers.Contract(token.address, abi, provider);
      const balance = await contract.balanceOf(account);
      const decimals = await contract.decimals();
      const symbol = await contract.symbol();

      const formattedBalance = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(4);
      console.log(`Fetched balance for ${symbol}: ${formattedBalance}`);

      if (parseFloat(formattedBalance) > 0) {
        tokenBalances.push({
          symbol,
          balance: formattedBalance,
        });
      }
    } catch (error) {
      console.error('Error fetching token balance for', token.symbol, ':', error);
    }
  }

  return tokenBalances;
}

async function fetchTokenList(networkName) {
  let tokenListUrl;

  switch (networkName) {
    case 'polygon':
      tokenListUrl = 'https://tokens.polygonscan.com/tokens';
      break;
    case 'bsc':
      tokenListUrl = 'https://api.bsc.0x.org/swap/v1/tokens';
      break;
    default:
      tokenListUrl = 'https://tokens.uniswap.org/';
      break;
  }

  const response = await fetch(tokenListUrl);
  const data = await response.json();

  // Process token data differently for different networks
  let tokens;
  if (networkName === 'polygon') {
    tokens = data.tokens.map((token) => ({
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
    }));
  } else {
    tokens = data.tokens || data;
  }

  // Manually add Babyrottweiler (BRC) if on the Polygon mainnet
  if (networkName === 'polygon') {
    tokens.push({
      address: '0x948d653f014d02AAa56C0fce794443ecC827Ab28', // Babyrottweiler (BRC) contract address
      symbol: 'BRC',
      decimals: 18, // Replace with the correct number of decimals if different
    });
  }

  console.log('Fetched token list:', tokens);
  return tokens;
}
async function connectMetamask() {
    if (window.ethereum) { // Checking if Web3 has been injected by the browser (MetaMask)
        try {
            // Request account access
            await window.ethereum.enable();
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            const account = accounts[0];
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const balance = await provider.getBalance(account);
            updateUI(account, ethers.utils.formatEther(balance));
        } catch (error) {
            // User denied account access...
            console.error("User denied account access")
        }
    }
    // Non-DApp Browsers
    else {
        console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    }
}

function updateUI(account, balance) {
    document.getElementById('walletAddress').innerText = `Wallet Address: ${account}`;
    document.getElementById('walletAmount').innerText = `Wallet Balance: ${balance} ETH`;
}

async function updateWalletInfo() {
console.log('window.ethereum:', window.ethereum); // Debugging log

  if (!window.ethereum) {
    document.querySelector('#networkName').textContent = 'Network: Not connected';
    return;
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
  const network = await provider.getNetwork();
  let networkName = network.name === 'homestead' ? 'mainnet' : network.name;

  // Add support for Polygon mainnet
  if (network.chainId === 137) {
    networkName = 'polygon';
  }

  // Add support for Binance Smart Chain mainnet
  if (network.chainId === 56) {
    networkName = 'bsc';
  }

  // Add support for Binance Smart Chain testnet
  if (network.chainId === 97) {
    networkName = 'bsc-testnet';
  }
console.log('Network Name:', networkName); // Debugging log
document.querySelector('#networkName').textContent = `Network: Connected (${networkName})`;

  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

  if (accounts.length === 0) {
    document.querySelector('#networkName').textContent = `Network: Connected (${networkName}), Wallet: Not connected`;
  } else {
    const networkElement = document.querySelector('#networkName');
    console.log('Network Element:', networkElement); // Debugging log
    networkElement.textContent = `Network: Connected (${networkName})`;

    const account = accounts[0];
    document.querySelector('#walletAddress').textContent = `Wallet Address: ${account}`;

    const balance = await provider.getBalance(account);
    const formattedBalance = ethers.utils.formatEther(balance);

    // Display correct token symbol based on the connected network
    let tokenSymbol;
    if (network.chainId === 137) {
      tokenSymbol = 'MATIC';
    } else if (network.chainId === 56 || network.chainId === 97) {
      tokenSymbol = 'BNB';
    } else {
      tokenSymbol = 'ETH';
    }

    document.querySelector('#walletAmount').textContent = `Wallet Amount: ${formattedBalance} ${tokenSymbol}`;

    // Fetch token list
    const tokenList = await fetchTokenList(networkName);

    // Fetch and display token balances
    const tokenBalances = await fetchTokenBalances(provider, account, tokenList);
    const tokenBalancesList = document.getElementById("token-balances");
    tokenBalancesList.innerHTML = "";
    tokenBalances.forEach(token => {
      const listItem = document.createElement("li");
      listItem.textContent = `${token.symbol}: ${token.balance}`;
      tokenBalancesList.appendChild(listItem);
    });
  }
}





// Call the function when the page loads
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await updateWalletInfo();
    await getBRCBalance();
    console.log("Page loaded");
  } catch (err) {
    console.error("Error in DOMContentLoaded event listener:", err);
  }
});

// Add event listener for when the wallet address changes
window.ethereum.on("accountsChanged", async (accounts) => {
    walletAddress = accounts[0];
    await updateWalletInfo();
    await getBRCBalance();  // Add this line

});

// Add event listener for when the network changes
window.ethereum.on("chainChanged", async () => {
  await updateWalletInfo();
  await getBRCBalance();  // Add this line

});







