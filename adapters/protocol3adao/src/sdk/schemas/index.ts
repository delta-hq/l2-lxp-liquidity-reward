export const schemas = {
  VAULTFACTORY_COLLATERAL_ADDED: `
      query {
        unstake(first: 5) {
          id
          owner
          spender
          value
        }
      }
    `,
  VAULTFACTORY_LOAN_ISSUED: `
      query {
        unstake(first: 5) {
          id
          owner
          spender
          value
        }
      }
    `,
  VAULTFACTORY_LOAN_REPAYED: `
      query {
        unstake(first: 5) {
          id
          owner
          spender
          value
        }
      }
    `,
  VAULTFACTORY_REDEEMED: `
      query {
        unstake(first: 5) {
          id
          owner
          spender
          value
        }
      }
    `,
  VAULTFACTORY_LIQUIDATED: `
      query {
        unstake(first: 5) {
          id
          owner
          spender
          value
        }
      }
    `,
  A3A_STAKED: `
      query {
        transfers(where: { to: "0xa1bDB7f6B749Ab887Bd712c7198aFaE6F25a3c12"}) {
          from
          id
          timestamp_
          to
          value
          contractId_
          block_number
        }
    }
    `,
  EURO3_STAKED: `
      query {
        transfers(where: { to: "0x51c3db485e3b21193636a83f05b3517f691cd68c"}) {
          from
          id
          timestamp_
          to
          value
          contractId_
          block_number
        }
      }
    `,
  MINTABLE_TRANSFERRED: `
      query {
        unstake(first: 5) {
          id
          owner
          spender
          value
        }
      }
    `,
  MINTABLE_SUPPLY: `
      query {
        unstake(first: 5) {
          id
          owner
          spender
          value
        }
      }
    `,
  A3A_SUPPLY: `
      query {
        unstake(first: 5) {
          id
          owner
          spender
          value
        }
      }
    `,
};
