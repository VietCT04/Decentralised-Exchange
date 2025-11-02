export const FACTORY_ABI = [
  {
    inputs: [
      { internalType: "string", name: "name_", type: "string" },
      { internalType: "string", name: "symbol_", type: "string" },
      { internalType: "uint256", name: "initialSupply_", type: "uint256" }
    ],
    name: "issueToken",
    outputs: [{ internalType: "address", name: "token", type: "address" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "token", type: "address" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "string",  name: "name",  type: "string" },
      { indexed: false, internalType: "string",  name: "symbol",type: "string" },
      { indexed: false, internalType: "uint256", name: "initialSupply", type: "uint256" }
    ],
    name: "TokenIssued",
    type: "event"
  }
];

export const ERC20_ABI = [
  { inputs:[{internalType:"address",name:"account",type:"address"}], name:"balanceOf", outputs:[{internalType:"uint256",name:"",type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"decimals", outputs:[{internalType:"uint8",name:"",type:"uint8"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"symbol", outputs:[{internalType:"string",name:"",type:"string"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"name", outputs:[{internalType:"string",name:"",type:"string"}], stateMutability:"view", type:"function" }
];
