# PRD Addendum — §21 Frontend Requirements

**Applies to:** EvalStake Chess PRD v2.1
**Reason:** Registration/onboarding review identified a gap — the PRD's Landing screen and Core User Flow (§8) assume a wallet with USDC already available, with no path for a judge or new player connecting a fresh, empty wallet.

## Addition to §21 — Landing screen

Add the following required states to the Landing screen spec:

- **Wallet not connected:** show a single primary "Connect Wallet" action.
  Per §6 (locked decisions), this must use Base-native onboarding (Coinbase
  Smart Wallet via OnchainKit) so a first-time player can create a wallet
  with a passkey/Google/Apple login — no seed phrase required.
- **Wallet connected, wrong network:** show a blocking prompt with a single
  "Switch to Base" action before allowing any further flow. Do not allow
  match creation or joining while on the wrong network.
- **Wallet connected, correct network, zero USDC balance:** show a
  "Get testnet USDC" prompt linking to the official Base Sepolia faucet
  and/or Circle's testnet USDC faucet. This state must be reachable without
  leaving the app, since a judge or new player with an empty fresh wallet
  is the expected common case, not an edge case.
- **Wallet connected, correct network, non-zero USDC balance:** proceed to
  the existing Landing flow (Create Match / Join Match) as already
  specified.

## New non-functional requirement

Add to §21: "The zero-balance faucet-prompt state must be demonstrated as
part of the live demo path (§28), not left as a MUST-EXIST-ONLY code path,
since it is the actual entry point a judge will hit on first use."

## No changes to locked decisions (§2)

This addendum adds a UI requirement only. It does not alter
`STAKE_ASSET`, `NETWORK`, `PLATFORM_FEE_BPS`, or any other locked value.
