import {
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from "@expo-google-fonts/source-sans-3";
import {
  SourceSerif4_400Regular,
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from "@expo-google-fonts/source-serif-4";
import { useFonts } from "expo-font";

export function useLegalDocumentFonts() {
  const [loaded, error] = useFonts({
    LegalSerif: SourceSerif4_400Regular,
    LegalSerifSemiBold: SourceSerif4_600SemiBold,
    LegalSerifBold: SourceSerif4_700Bold,
    LegalSans: SourceSans3_400Regular,
    LegalSansSemiBold: SourceSans3_600SemiBold,
    LegalSansBold: SourceSans3_700Bold,
  });

  return { loaded, error };
}
