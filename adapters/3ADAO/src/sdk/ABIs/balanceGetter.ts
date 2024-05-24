export const balanceGetterABI = [
  { inputs: [], stateMutability: "payable", type: "constructor" },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address[]", name: "tokens", type: "address[]" },
    ],
    name: "getBalances",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
];
