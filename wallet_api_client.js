document.getElementById('createWalletBtn').addEventListener('click', async () => {
  const response = await fetch(`${walletApiUrl}/create_wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const wallet = await response.json();
  displayWallet(wallet);
});

document.getElementById('importWalletBtn').addEventListener('click', async () => {
  const privateKey = prompt('Enter the private key to import the wallet:');
  const response = await fetch(`${walletApiUrl}/import_wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ privateKey: privateKey })
  });

  const wallet = await response.json();
  displayWallet(wallet);
});

document.getElementById('getBalanceBtn').addEventListener('click', async () => {
  const address = prompt('Enter the wallet address to get the balance:');
  const response = await fetch(`${walletApiUrl}/get_balance/${address}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const balanceData = await response.json();
  displayBalance(address, balanceData.balance);
});

function displayWallet(wallet) {
  const walletData = document.getElementById('walletData');
  walletData.innerHTML = `
    <h3>Wallet</h3>
    <p>Address: ${wallet.address}</p>
    <p>Private Key: ${wallet.privateKey}</p>
  `;
}

function displayBalance(address, balance) {
  const walletData = document.getElementById('walletData');
  walletData.innerHTML = `
    <h3>Balance</h3>
    <p>Address: ${address}</p>
    <p>Balance: ${balance} ETH</p>
  `;
}

const walletApiUrl = '/api';

async function fetchTransactionHistory(address) {
  const response = await fetch(`${walletApiUrl}/get_transaction_history/${address}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  return data.transactions;
}

async function displayTransactionHistory(address) {
  const transactionList = document.getElementById('transaction-list');
  const transactions = await fetchTransactionHistory(address);

  transactions.forEach(tx => {
    const li = document.createElement("li");
    li.textContent = `From: ${tx.from}, To: ${tx.to}, Value: ${tx.value} ETH`;
    transactionList.appendChild(li);
  });
}

async function updateWalletInfo() {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const walletAddress = accounts[0];
        const walletAddressSpan = document.getElementById('wallet-address');
        walletAddressSpan.textContent = walletAddress;

        const walletInfo = document.getElementById('wallet-info');
        walletInfo.style.display = "block";

        // Get balance on page load
        const response = await fetch(`/api/get-balance/${walletAddress}`);
        const data = await response.json();
        const walletBalanceSpan = document.getElementById('wallet-balance');
        walletBalanceSpan.textContent = data.balance;
      }
    } catch (err) {
      console.log(err);
    }
  }
}

// Call updateWalletInfo function when page loads
window.addEventListener("load", async () => {
  await updateWalletInfo();
});

const globalConnectMetamaskBtn = document.getElementById("global-connect-metamask-btn");
const globalWalletDropdown = document.getElementById("global-wallet-dropdown");

globalConnectMetamaskBtn.addEventListener("click", async () => {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      const walletAddress = accounts[0];

      // Update the wallet address on the page
      const walletAddressSpan = document.getElementById("walletAddress");
      walletAddressSpan.textContent = `Wallet Address: ${walletAddress}`;

            updateWalletInfo(walletAddress);
      globalWalletDropdown.style.display = "block";
    } catch (err) {
      console.log(err);
      alert("Failed to connect to MetaMask.");
    }
  } else {
    alert("MetaMask not found. Please install it to connect to a wallet.");
  }
});

