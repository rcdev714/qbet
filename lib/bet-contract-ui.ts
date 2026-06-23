import type { BetContractPipelineResult } from "@/services/betContract.service";
import type { Router } from "expo-router";
import { Alert } from "react-native";

export function alertBetPlacedWithContract(options: {
  router: Router;
  betId?: string;
  isPlayMode: boolean;
  contractPipeline?: BetContractPipelineResult;
  onDismiss?: () => void;
}) {
  const { router, betId, isPlayMode, contractPipeline, onDismiss } = options;

  if (isPlayMode || !betId) {
    Alert.alert("Bet placed", "Your prediction is in. Prices and balance are updating now.", [
      { text: "OK", onPress: onDismiss },
    ]);
    return;
  }

  if (contractPipeline?.status === "sent" || contractPipeline?.status === "skipped") {
    Alert.alert(
      "Bet placed",
      "Your live wager agreement was emailed. You can also view or download it anytime.",
      [
        {
          text: "View agreement",
          onPress: () => {
            onDismiss?.();
            router.push(`/contract/${betId}` as any);
          },
        },
        { text: "OK", onPress: onDismiss },
      ],
    );
    return;
  }

  if (contractPipeline?.contractId) {
    Alert.alert(
      "Bet placed",
      contractPipeline.error
        ? `Your bet is in, but the agreement email failed: ${contractPipeline.error}`
        : "Your bet is in. Your wager agreement is being prepared.",
      [
        {
          text: "View agreement",
          onPress: () => {
            onDismiss?.();
            router.push(`/contract/${betId}` as any);
          },
        },
        { text: "OK", onPress: onDismiss },
      ],
    );
    return;
  }

  Alert.alert(
    "Bet placed",
    contractPipeline?.error ??
      "Your prediction is in. Wager agreements are available for live private group bets.",
    [{ text: "OK", onPress: onDismiss }],
  );
}
