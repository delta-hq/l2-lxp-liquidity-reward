## Overview
This repository is dedicated to tracking the balances of users on the zklink network, a Layer 3 (L3) network that operates with Linea as its primary chain. The contract `0x5Cb18b6e4e6F3b46Ce646b0f4704D53724C5Df05` is crucial as it locks the ETH of users engaged with the zklink nova cross-chain bridge on Linea.

## Purpose
The primary purpose of this repository is to aggregate and calculate the balance of ETH held by users in various protocols on the zklink network. It ensures that users participating in liquidity staking continue to receive corresponding credit rewards, even as their ETH is staked in different protocols.

## Components
The repository utilizes a multi-source approach to gather data:

- Subgraph: Retrieves all zklink ETH holding users and their staked balances in protocols such as aqua, layerbank, linkswap, and zkdx.
- izumi SDK: A script that fetches the staking balances of users in the izumi protocol.

These data points are then consolidated to reflect the total balance of each user.

## BlockNumber

The block number needs to be obtained from the zklink network ([zklink explorer](https://explorer.zklink.io/blocks/))






