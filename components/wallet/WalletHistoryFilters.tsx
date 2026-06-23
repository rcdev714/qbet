import React, { useMemo } from "react";

import { FilterChipBar } from "@/components/ui/FilterChipBar";

export type WalletHistoryFilter = "all" | "transfers" | "deposits" | "withdrawals" | "bets";

interface WalletHistoryFiltersProps {
  value: WalletHistoryFilter;
  onChange: (next: WalletHistoryFilter) => void;
}

const FILTERS: { key: WalletHistoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "transfers", label: "Transfers" },
  { key: "deposits", label: "Deposits" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "bets", label: "Bets" },
];

export function WalletHistoryFilters({ value, onChange }: WalletHistoryFiltersProps) {
  const options = useMemo(
    () => FILTERS.map((filter) => ({ key: filter.key, label: filter.label })),
    [],
  );

  return (
    <FilterChipBar
      options={options}
      value={value}
      onChange={onChange}
      accessibilityLabel="Transaction filters"
      style={{ borderBottomWidth: 0 }}
    />
  );
}
