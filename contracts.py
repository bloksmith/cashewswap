import json
import os
from web3 import Web3

web3 = Web3(Web3.HTTPProvider('https://eth-sepolia.g.alchemy.com/v2/eG1gg2c2gOFJmlaRLtLxMNu-xJKh-1CH'))

# Read the ABI from the file
file_dir = os.path.dirname(os.path.realpath('__file__'))
file_name = os.path.join(file_dir, 'contract_abi.json')

if os.path.exists(file_name):
    with open(file_name, 'r') as f:
        contract_abi = json.load(f)
else:
    print(f'{file_name} not found')
    contract_abi = []  # Or some other default value

contract_address = '0x705c860B5f62A43974582E328c926db5f4a17b08'

contract = web3.eth.contract(address=contract_address, abi=contract_abi)

def get_balance(token_address, user_address):
    return contract.functions.balanceOf(token_address, user_address).call()

# ... and other functions as needed
