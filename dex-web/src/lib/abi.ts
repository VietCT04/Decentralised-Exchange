// FACTORY (issueToken + event)
export const FACTORY_ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'name_', type: 'string' },
      { internalType: 'string', name: 'symbol_', type: 'string' },
      { internalType: 'uint256', name: 'initialSupply_', type: 'uint256' }
    ],
    name: 'issueToken',
    outputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: false, internalType: 'string', name: 'name', type: 'string' },
      { indexed: false, internalType: 'string', name: 'symbol', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'initialSupply', type: 'uint256' }
    ],
    name: 'TokenIssued',
    type: 'event'
  }
] as const;

// Minimal ERC20 used in UI
export const ERC20_ABI = [
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol',   outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name',     outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }
] as const;

// DEX (Sprint 2)
export const DEX_ABI = [
  {
    inputs: [
      { name: 'sellToken', type: 'address' },
      { name: 'buyToken',  type: 'address' },
      { name: 'sellAmount', type: 'uint256' },
      { name: 'buyAmount',  type: 'uint256' }
    ],
    name: 'createOrder',
    outputs: [{ name: 'id', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  { inputs: [{ name: 'id', type: 'uint256' }], name: 'cancelOrder', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  {
    inputs: [{ name: 'id', type: 'uint256' }], name: 'getOrder', stateMutability: 'view', type: 'function',
    outputs: [{
      components: [
        { name: 'owner', type: 'address' },
        { name: 'sellToken', type: 'address' },
        { name: 'buyToken',  type: 'address' },
        { name: 'sellAmount', type: 'uint256' },
        { name: 'buyAmount',  type: 'uint256' },
        { name: 'remainingSell', type: 'uint256' },
        { name: 'active', type: 'bool' }
      ],
      type: 'tuple'
    }]
  },
  {
    "type": "function",
    "name": "fillOrder",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "id", "type": "uint256" },
      { "name": "sellAmountToTake", "type": "uint256" }
    ],
    "outputs": []
  },

  // optional: new event
  {
    "type": "event",
    "name": "OrderFilled",
    "inputs": [
      { "name": "id", "type": "uint256", "indexed": true },
      { "name": "maker", "type": "address", "indexed": true },
      { "name": "taker", "type": "address", "indexed": true },
      { "name": "sellTaken", "type": "uint256", "indexed": false },
      { "name": "buyPaid", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  { inputs: [], name: 'getOrdersLength', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }
] as const;
