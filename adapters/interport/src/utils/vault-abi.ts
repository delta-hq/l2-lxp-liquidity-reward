export const vaultAbi = [
    {
        type: 'event',
        name: 'Deposit',
        inputs: [
            {
                indexed: true,
                name: 'caller',
                type: 'address',
            },
            {
                indexed: false,
                name: 'assetAmount',
                type: 'uint256',
            },
        ],
    },
    {
        type: 'event',
        name: 'Withdraw',
        inputs: [
            {
                indexed: true,
                name: 'caller',
                type: 'address',
            },
            {
                indexed: false,
                name: 'assetAmount',
                type: 'uint256',
            },
        ],
    },
]
