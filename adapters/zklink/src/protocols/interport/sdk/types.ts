export type UserTVLData = {
    userAddress: string;
    tokenAddress: string;
    poolAddress: string;
    balance: bigint;
    blockNumber: number;
    timestamp: number;
}

export type StakeData = {
    id: string;
    user: string;
    pid: string;
    amount: string;
    timestamp: string;
    blocknumber: string;
}

export type UserStakes = {
    userStakes: StakeData[];
}

export type Response = {
    data: UserStakes;
}

export type Call = {
    target: string;
    callData: string;
};

export type MulticallResult = {
    success: boolean;
    returnData: string;
};
