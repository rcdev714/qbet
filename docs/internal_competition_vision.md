# Internal Competition Strategy: "Measured Futures"

**Vision**: If it can be measured in the future, we can create a market.

## Executive Summary

This document outlines a strategic application of **AnyMarket** designed
specifically for high-performance sales teams. By leveraging private group
functionality and internal betting markets, we transform standard performance
metrics into engaging, high-energy competitions.

## The Core Concept: "Skin in the Game"

Sales agents thrive on competition. Traditional leaderboards are static and
often lose their motivational power mid-month. **AnyMarket** introduces a
dynamic, real-time financial layer to performance tracking.

### 1. The Mechanism: Monthly Active Pools

Instead of a passive bonus structure, we implement an active participation
model:

- **The Buy-In**: A set percentage (e.g., x%) is deducted from commissions or
  contributed monthly to a localized **Group Pool**.
- **The Market**: This pool becomes the liquidity for internal predictions.
- **The Wager**: Agents don't just work for targets; they _bet_ on them.
  - _"Will the team hit $500k by Friday?"_
  - _"Will Agent X close the Enterprise deal?"_

### 2. Group Chat Functionality

The app's `GroupScreen` serves as the digital "Sales Floor":

- **Integrated Markets**: Prediction markets live directly inside the chat
  stream, not on a separate dashboard.
- **Real-Time Banter**: Bets trigger notifications, driving engagement and
  friendly rivalry.
- **Discrete & Secure**: Groups are private. Data and conversations remain
  internal to the organization.

### 3. Psychological Driver: Performance & Energy

This system aligns incentives in two ways:

1. **Direct Performance**: Winners of the metrics take the bulk of the pool.
2. **Market Intelligence**: Agents who honestly assess the floor's reality
   (e.g., betting _against_ an unrealistic target) provide valuable signal to
   management.

## Fee Structure & Transparency

We prioritize a transparent, fair economy model (referenced in `TopUpScreen`):

- **Fair Withdrawal Curve**: We utilize a smooth curve algorithm for
  withdrawals.
  - **Low fees for high volume**: The percentage decreases as the volume
    increases (clamped between 2% - 15%).
  - **Logic**: `Fee % = 0.41 / Amount^0.44`. This ensures small casual players
    aren't priced out, while high-stakes traders (your top sales agents) keep
    more of their winnings.
- **No Hidden Costs**: The "deductions" go to the **Pool**, not the platform.
  The platform only takes a fee on withdrawal, ensuring the "house" (the team)
  keeps the majority of the value.

## Implementation Path

1. **Setup**: Manager creates a Private Group.
2. **Onboard**: Team members join via Invite Code.
3. **Fund**: Users top up (or allocate x%) to their wallet.
4. **Execute**: Manager posts the monthly markets; the game begins.

## Digital Ecosystem Structure

```mermaid
graph TD
    subgraph Setup ["1. The Setup"]
        M[Manager] -->|Creates Private Group| G[Group "Sales Floor"]
        A[Sales Agents] -->|Join via Code| G
        A -->|Buy-In %| P[(Pool Liquidity)]
    end

    subgraph Action ["2. The Action"]
        M -->|Posts Target| Q{Prediction Market<br/>"Will we hit $500k?"}
        A -->|Wager on Outcome| Q
        Q -.->|Signal| I[Management Insight<br/>"Real Sentiment"]
    end

    subgraph Result ["3. The Outcome"]
        Q -->|Resolve| R[Real World Result]
        R -->|Winners| W[$$$ Payout]
        W -->|Withdraw| F[Fee <br/>(Reinvested/Platform)]
    end

    style G fill:#f9f,stroke:#333,stroke-width:2px
    style P fill:#ff9,stroke:#333,stroke-width:2px
    style W fill:#9f9,stroke:#333,stroke-width:2px
```

---

_Powered by AnyMarket – Turning Metrics into Markets._
