export const BeefyClmStrategyAbi = [
  {
    type: "function",
    name: "price",
    inputs: [],
    outputs: [{ name: "_price", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "range",
    inputs: [],
    outputs: [
      { name: "lowerPrice", type: "uint256", internalType: "uint256" },
      { name: "upperPrice", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;
