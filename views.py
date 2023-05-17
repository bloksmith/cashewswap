from decimal import Decimal
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.http import require_GET, require_POST
from web3 import Web3, HTTPProvider
from solcx import compile_source
import requests
import json
import os

from .forms import UserForm, ProfileForm, DeployContractForm, AddLiquidityForm
from .models import Token, Pool
from .contracts import contract
from tokens.models import Cryptocurrency
from .utils import get_web3, get_token_balance, import_wallet, create_wallet_obj
from .models import Pool
from eth_account import Account


def my_view(request):
    token_address = '0x1234567890'  # Example token address
    user_address = '0xabcdef1234'  # Example user address
    balance = get_balance(token_address, user_address)
    # ...
# views.py
def add_liquidity_view(request):
    if request.method == 'POST':
        form = AddLiquidityForm(request.POST)
        if form.is_valid():
            # Get form data
            amount1 = int(form.cleaned_data['amount1'] * 10**18)  # Convert to uint256
            amount2 = int(form.cleaned_data['amount2'] * 10**18)  # Convert to uint256
            provider = request.user

            # Call the addLiquidity function of the contract
            tx_hash = contract.functions.addLiquidity(amount1, amount2).transact()

            # Get transaction receipt
            tx_receipt = web3.eth.waitForTransactionReceipt(tx_hash)
            # ... Process the transaction receipt as needed

            # Create a LiquidityPool object and save it to the database
            liquidity_pool = LiquidityPool.objects.create(provider=provider, amount1=amount1, amount2=amount2)
            liquidity_pool.save()

            return redirect('liquidity_pool')  # or wherever you want to redirect on success
    else:
        form = AddLiquidityForm()

    return render(request, 'add_liquidity.html', {'form': form})

def deploy_contract_view(request):
    if request.method == 'POST':
        form = DeployContractForm(request.POST)
        if form.is_valid():
            # Connect to Infura
            w3 = Web3(Web3.HTTPProvider('https://eth-sepolia.g.alchemy.com/v2/eG1gg2c2gOFJmlaRLtLxMNu-xJKh-1CH'))

            # Get account details from form
            private_key = form.cleaned_data['0f87228fa664758769fbc29525a285035b27428837cfc8ceb882c6f3d3a6dd2b']
            account = form.cleaned_data['0x705c860B5f62A43974582E328c926db5f4a17b08']

            # Define the contract source code
            contract_source_code = """
            pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract LiquidityPool is ERC20 {
    using SafeMath for uint256;

    IERC20 public token1;
    IERC20 public token2;
    address public owner;
    uint256 public constant FEE_PRECISION = 1000;
    uint256 public constant OWNER_FEE = 3; // 0.3% fee for the owner

    event LiquidityAdded(address provider, uint256 amount1, uint256 amount2);
    event LiquidityRemoved(address provider, uint256 amount);
    event TokensSwapped(address user, uint256 amountIn, uint256 amountOut);

    constructor(IERC20 _token1, IERC20 _token2) ERC20("LiquidityPool", "LP") {
        token1 = _token1;
        token2 = _token2;
        owner = msg.sender;
    }

    function addLiquidity(uint256 amount1, uint256 amount2) public {
        require(token1.transferFrom(msg.sender, address(this), amount1), "Transfer of token1 failed");
        require(token2.transferFrom(msg.sender, address(this), amount2), "Transfer of token2 failed");
        _mint(msg.sender, amount1.add(amount2));
        emit LiquidityAdded(msg.sender, amount1, amount2);
    }

    function removeLiquidity(uint256 amount) public {
        require(balanceOf(msg.sender) >= amount, "Not enough LP tokens");
        uint256 totalSupply = totalSupply();
        _burn(msg.sender, amount);
        token1.transfer(msg.sender, token1.balanceOf(address(this)).mul(amount).div(totalSupply));
        token2.transfer(msg.sender, token2.balanceOf(address(this)).mul(amount).div(totalSupply));
        emit LiquidityRemoved(msg.sender, amount);
    }

    function swap1for2(uint256 amountIn, uint256 minAmountOut) public {
        require(token1.balanceOf(msg.sender) >= amountIn, "Not enough token1");
        uint256 amountOut = getSwapOutput(amountIn, token1.balanceOf(address(this)), token2.balanceOf(address(this)));
        require(amountOut >= minAmountOut, "Price impact too high");
        token1.transferFrom(msg.sender, address(this), amountIn);
        uint256 feeAmount = amountIn.mul(OWNER_FEE).div(FEE_PRECISION);
        token2.transfer(msg.sender, amountOut.sub(feeAmount));
        token2.transfer(owner, feeAmount);
        emit TokensSwapped(msg.sender, amountIn, amountOut);
    }

    function swap2for1(uint256 amountIn, uint256 minAmountOut) public {
        require(token2.balanceOf(msg.sender) >= amountIn, "Not enough token2");
        uint256 amountOut = getSwapOutput(amountIn, token2.balanceOf(address(this)), token1.balanceOf(address(this)));
        require(amountOut >= minAmountOut, "Price impact too high");
        token2.transferFrom(msg.sender, address(this), amountIn);
        uint256 feeAmount = amountIn.mul(OWNER_FEE).div(FEE_PRECISION);
        token1.transfer(msg.sender, amountOut.sub(feeAmount));
        token1.transfer(owner, feeAmount);
        emit TokensSwapped(msg.sender, amountIn, amountOut);
    }

    function getSwapOutput(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
require(amountIn > 0, "Invalid input amount");
require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
uint256 amountInWithFee = amountIn.mul(FEE_PRECISION.sub(OWNER_FEE));
uint256 numerator = amountInWithFee.mul(reserveOut);
uint256 denominator = reserveIn.mul(FEE_PRECISION).add(amountInWithFee);
uint256 amountOut = numerator.div(denominator);
require(amountOut > 0, "Insufficient output amount");
return amountOut;
}
}

            """

            # Compile the contract
            compiled_sol = compile_source(contract_source_code)
            contract_id, contract_interface = compiled_sol.popitem()

            # Get the ABI from the contract interface
            abi = contract_interface['abi']

            # Save the ABI to a JSON file
            file_dir = os.path.dirname(os.path.realpath('__file__'))
            file_name = os.path.join(file_dir, 'contract_abi.json')

            try:
                with open(file_name, 'w') as f:
                    json.dump(abi, f)
                print(f'ABI saved to {file_name}')
            except Exception as e:
                print(f'Failed to save ABI: {e}')

            # Get transaction details
            nonce = w3.eth.getTransactionCount(account)
            gas_estimate = w3.eth.estimateGas({'data': contract_interface['bin']})
            transaction = {
                'to': '',  # Leave empty to create a new contract
                'value': 0,  # No ether is being sent
                'gas': gas_estimate,
                'gasPrice': w3.eth.gasPrice,
                'nonce': nonce,
                'data': contract_interface['bin'],
                'chainId': 1  # Mainnet
            }

            # Sign the transaction
            signed = Account.sign_transaction(transaction, private_key)

            # Send the transaction
            try:
                tx_hash = w3.eth.sendRawTransaction(signed.rawTransaction)
            except ValueError as err:
                print(f"Error sending transaction: {err}")
                return HttpResponse("Error sending transaction", status=500)

            # Get transaction receipt to get contract address
            tx_receipt = w3.eth.waitForTransactionReceipt(tx_hash)
            contract_address = tx_receipt['contractAddress']
            # Print the contract address
            print(f"Contract deployed at {contract_address}")
            return redirect('deploy_success')  # or wherever you want to redirect on success

def filter_tokens(request):
    search_query = request.GET.get('search', '')
    tokens = Cryptocurrency.objects.filter(Q(name__icontains=search_query) | Q(symbol__icontains=search_query))
    filtered_tokens = [token.to_dict() for token in tokens]
    return JsonResponse(filtered_tokens, safe=False)



from .blockchain import get_balance

def pool(request):
    pools = []

    for pool in Pool.objects.all():
        pool_data = {}
        pool_data['provider'] = pool.provider.username
        pool_data['token1'] = pool.token1
        pool_data['amount1'] = get_balance(pool.token1, pool.provider.address)
        pool_data['token2'] = pool.token2
        pool_data['amount2'] = get_balance(pool.token2, pool.provider.address)

        pools.append(pool_data)

    return render(request, 'pool.html', {'pools': pools})



def get_transaction_history(request, address):
    url = f'https://api.polygonscan.com/api?module=account&action=txlist&address={address}&startblock=0&endblock=99999999&sort=asc&apikey=52DD6ER6Q612YE1QDFAIAHS479YKPF8G14'
    response = requests.get(url)
    data = response.json()
    return JsonResponse(data)

ALCHEMY_API_KEY = '5UwNkag0nUFiag5r-bCztS7zfPjvk-cn'
ALCHEMY_API_URL = 'https://polygonzkevm-testnet.g.alchemy.com/v2/5UwNkag0nUFiag5r-bCztS7zfPjvk-cn'
def token_search(request):
    context = {'ALCHEMY_API_KEY': settings.ALCHEMY_API_KEY}
    return render(request, 'dex_app/token_search.html', context)

def search_token(request):
    if request.method == 'GET':
        token_address = request.GET.get('token_address', None)
        print("Token Address:", token_address)

        if token_address:
            try:
                # Get token info from Alchemy API
                response = requests.get(f"{ALCHEMY_API_URL}/tokens/{token_address}",
                                        headers={'Alchemy-Api-Key': ALCHEMY_API_KEY})
                if response.status_code != 200:
                    raise ValueError(f"Failed to retrieve token info: {response.json().get('error', 'Unknown error')}")

                token_data = response.json()
                token = Token.objects.update_or_create(
                    address=token_address,
                    defaults={
                        'name': token_data.get('name'),
                        'symbol': token_data.get('symbol'),
                        'decimals': token_data.get('decimals'),
                        'logo_uri': token_data.get('logoURI')
                    }
                )[0]
                print("Token Found:", token)
                return render(request, 'search_results.html', {'token': token})
            except Exception as e:
                messages.error(request, f'Failed to retrieve token info: {e}')
                print("Token Not Found")
                return render(request, 'search_token.html')
        else:
            return render(request, 'search_token.html')


@require_POST
def address_search(request):
    if request.method == 'POST':
        address = request.POST['address']
        return render(request, 'address_search.html', {'address': address})
    else:
        return render(request, 'address_search.html')
def trading_pairs_list(request):
    # Your logic here

    return render(request, 'dex_app/trading_pairs_list.html')


def token_listings(request):
    tokens = Cryptocurrency.objects.all()
    context = {"tokens": tokens}
    return render(request, "tokens/listings.html", context)


def token_balances(request):
    web3 = get_web3()
    wallet_address = request.user.profile.wallet_address
    tokens = Cryptocurrency.objects.all()
    balances = []

    for token in tokens:
        balance = get_token_balance(web3, token.contract_address, wallet_address)
        balances.append({"token": token, "balance": balance})

    context = {"balances": balances}
    return render(request, "tokens/balances.html", context)


def import_wallet_view(request):
    private_key = request.GET.get('private_key')
    if not private_key:
        return JsonResponse({"error": "Private key is required"}, status=400)

    try:
        wallet = import_wallet(private_key)
        request.user.profile.wallet_address = wallet.address
        request.user.profile.save()
    except ValueError:
        return JsonResponse({"error": "Invalid private key"}, status=400)

    return JsonResponse({"address": wallet.address})


@require_GET
def create_wallet_view(request):
    wallet = create_wallet_obj()
    request.user.profile.wallet_address = wallet.address
    request.user.profile.save()
    return JsonResponse({"address": wallet.address, "private_key": wallet.key.hex()})


@require_GET
def get_balance(request, address):
    api_key = '52DD6ER6Q612YE1QDFAIAHS479YKPF8G14'
    url = f'https://api.polygonscan.com/api?module=account&action=balance&address={address}&tag=latest&apikey={api_key}'
    response = requests.get(url)
    balance = int(response.json()['result']) / 10 ** 18  # convert to decimal format
    return JsonResponse({'balance': balance})


@login_required
def profile(request):
    profile = Profile.objects.get(user=request.user)
    wallet_address = request.user.profile.wallet_address
    context = {'profile': profile, 'wallet_address': wallet_address}
    return render(request, 'dex_app/profile.html', context)



def contact(request):
    return render(request, 'contact.html')

def home(request):
    if request.user.is_authenticated:
        profile = request.user.profile
        wallet_address = profile.wallet_address
        context = {'wallet_address': wallet_address}
        return render(request, 'home.html', context)
    else:
        return render(request, 'home.html')

def about(request):
    return render(request, 'about.html')

from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm
from .forms import ProfileForm
from .models import Profile

# views.py
# views.py
def register(request):
    if request.method == 'POST':
        user_form = UserForm(request.POST)
        profile_form = ProfileForm(request.POST)
        if user_form.is_valid() and profile_form.is_valid():
            user = user_form.save()
            profile, created = Profile.objects.get_or_create(user=user)
            if created:
                profile_form = ProfileForm(request.POST, instance=profile)
                profile_form.save()
            return redirect('dex_app:profile')
    else:
        user_form = UserForm()
        profile_form = ProfileForm()

    context = {'user_form': user_form, 'profile_form': profile_form}
    return render(request, 'registration/register.html', context)






