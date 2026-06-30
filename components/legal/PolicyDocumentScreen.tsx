import { SEO } from "@/components/SEO";
import { PolicyFrameworkToggle } from "@/components/legal/PolicyFrameworkToggle";
import { PolicyRichText } from "@/components/legal/PolicyRichText";
import { useLegalDocumentFonts } from "@/hooks/useLegalDocumentFonts";
import type { PolicyDocument } from "@/lib/legal/policy-content";
import { policyRouteWithJurisdiction } from "@/lib/legal/policy-content";
import type { PolicyRichText as PolicyRichTextType } from "@/lib/legal/policy-links";
import {
    LEGAL_COLORS,
    LEGAL_FORMAL_SECTION_HEADINGS,
    LEGAL_LAYOUT,
    LEGAL_TYPE,
    legalFont,
} from "@/lib/legal/typography";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

type PolicyDocumentScreenProps = {
  document: PolicyDocument;
};

export function PolicyDocumentScreen({ document }: PolicyDocumentScreenProps) {
  const router = useRouter();
  const { t } = useTranslation("compliance");
  const { width } = useWindowDimensions();
  const { loaded: fontsLoaded } = useLegalDocumentFonts();
  const isCompact = width < 768;
  const documentUrl = policyRouteWithJurisdiction(document.route, document.jurisdiction);
  const frameworkLabel =
    document.jurisdiction === "EC" ? t("frameworkEc") : t("frameworkUs");

  const type = useMemo(
    () => ({
      orgLine: { ...LEGAL_TYPE.orgLine, fontFamily: legalFont("uiSemiBold", fontsLoaded) },
      docTitle: { ...LEGAL_TYPE.docTitle, fontFamily: legalFont("bodyBold", fontsLoaded) },
      framework: { ...LEGAL_TYPE.framework, fontFamily: legalFont("ui", fontsLoaded) },
      meta: { ...LEGAL_TYPE.meta, fontFamily: legalFont("ui", fontsLoaded) },
      sectionHeading: {
        ...LEGAL_TYPE.sectionHeading,
        fontFamily: legalFont("uiBold", fontsLoaded),
      },
      paragraph: { ...LEGAL_TYPE.paragraph, fontFamily: legalFont("body", fontsLoaded) },
      clauseLabel: { ...LEGAL_TYPE.clauseLabel, fontFamily: legalFont("bodySemiBold", fontsLoaded) },
      bullet: { ...LEGAL_TYPE.bullet, fontFamily: legalFont("body", fontsLoaded) },
      utility: { ...LEGAL_TYPE.utility, fontFamily: legalFont("ui", fontsLoaded) },
    }),
    [fontsLoaded],
  );

  const renderRichText = (content: PolicyRichTextType, style: object) => (
    <PolicyRichText
      content={content}
      jurisdiction={document.jurisdiction}
      style={style as any}
      fontsLoaded={fontsLoaded}
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SEO
        title={document.title}
        description={document.seoDescription}
        url={documentUrl}
        keywords={`Anymarkt, ${document.title}, legal, compliance, ${document.jurisdiction}`}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.utilityBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
            accessibilityRole="button"
            accessibilityLabel={t("policyReturn")}
          >
            <Text style={type.utility}>{t("policyReturn")}</Text>
          </TouchableOpacity>
          <PolicyFrameworkToggle fontsLoaded={fontsLoaded} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === "web"}
        >
          <View
            style={[
              styles.paperCard,
              {
                paddingHorizontal: isCompact ? 20 : LEGAL_LAYOUT.paperPaddingH,
                paddingVertical: isCompact ? 28 : LEGAL_LAYOUT.paperPaddingV,
              },
            ]}
          >
            <View style={styles.masthead}>
              <Text style={type.orgLine}>{t("policyOrgLine")}</Text>
              <Text style={type.docTitle}>{document.title.toUpperCase()}</Text>
              <Text style={type.framework}>{frameworkLabel}</Text>
              <Text style={type.meta}>
                {t("policyVersionMeta", { version: document.version, date: document.lastUpdated })}
              </Text>
              <View style={styles.ruleDouble}>
                <View style={styles.ruleThick} />
                <View style={styles.ruleThin} />
              </View>
            </View>

            {document.sections.map((section, sectionIndex) => (
              <View
                key={section.heading}
                style={[
                  styles.section,
                  LEGAL_FORMAL_SECTION_HEADINGS.has(section.heading) && styles.formalSection,
                  sectionIndex > 0 && styles.sectionSpacing,
                ]}
              >
                <Text style={type.sectionHeading}>{section.heading}</Text>

                {section.paragraphs?.map((paragraph, index) => (
                  <View
                    key={`${section.heading}-p-${index}`}
                    style={index > 0 ? styles.paragraphSpacing : undefined}
                  >
                    {renderRichText(paragraph, type.paragraph)}
                  </View>
                ))}

                {section.bullets?.map((bullet, index) => (
                  <View key={`${section.heading}-b-${index}`} style={styles.bulletRow}>
                    <Text style={[type.bullet, styles.bulletMarker]}>•</Text>
                    <View style={styles.bulletTextWrap}>
                      {renderRichText(bullet, type.bullet)}
                    </View>
                  </View>
                ))}

                {section.clauses?.map((clause, clauseIndex) => (
                  <View
                    key={`${section.heading}-c-${clauseIndex}-${clause.label ?? "clause"}`}
                    style={[styles.clause, clauseIndex > 0 ? styles.clauseSpacing : undefined]}
                  >
                    <Text style={[type.paragraph, styles.clauseParagraph]}>
                      {clause.label ? (
                        <Text style={type.clauseLabel}>{clause.label} </Text>
                      ) : null}
                      <PolicyRichText
                        content={clause.text}
                        jurisdiction={document.jurisdiction}
                        fontsLoaded={fontsLoaded}
                        inline
                      />
                    </Text>
                    {clause.bullets?.map((bullet, index) => (
                      <View
                        key={`${section.heading}-cb-${clauseIndex}-${index}`}
                        style={styles.bulletRow}
                      >
                        <Text style={[type.bullet, styles.bulletMarker]}>•</Text>
                        <View style={styles.bulletTextWrap}>
                          {renderRichText(bullet, type.bullet)}
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.footerRule}>
              <View style={styles.ruleThin} />
            </View>
            <Text style={[type.meta, styles.footerNote]}>
              {t("policyFooterFramework", { framework: document.jurisdiction })}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LEGAL_COLORS.pageBg,
  },
  safeArea: {
    flex: 1,
  },
  utilityBar: {
    backgroundColor: LEGAL_COLORS.utilityBarBg,
    borderBottomWidth: 1,
    borderBottomColor: LEGAL_COLORS.rule,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backButton: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: LEGAL_LAYOUT.pagePaddingH,
    paddingVertical: 24,
    alignItems: "center",
  },
  paperCard: {
    width: "100%",
    maxWidth: LEGAL_LAYOUT.paperMaxWidth,
    backgroundColor: LEGAL_COLORS.paperBg,
  },
  masthead: {
    alignItems: "center",
    marginBottom: 8,
  },
  ruleDouble: {
    width: "100%",
    marginTop: 20,
    marginBottom: 8,
    gap: 3,
  },
  ruleThick: {
    height: 2,
    backgroundColor: LEGAL_COLORS.ruleDark,
    width: "100%",
  },
  ruleThin: {
    height: 1,
    backgroundColor: LEGAL_COLORS.rule,
    width: "100%",
  },
  section: {
    gap: LEGAL_LAYOUT.paragraphGap,
  },
  sectionSpacing: {
    marginTop: LEGAL_LAYOUT.sectionGap,
    paddingTop: 4,
  },
  formalSection: {
    borderTopWidth: 1,
    borderTopColor: LEGAL_COLORS.rule,
    paddingTop: LEGAL_LAYOUT.sectionGap,
    marginTop: LEGAL_LAYOUT.sectionGap,
  },
  paragraphSpacing: {
    marginTop: LEGAL_LAYOUT.paragraphGap,
  },
  clause: {
    gap: LEGAL_LAYOUT.paragraphGap,
  },
  clauseSpacing: {
    marginTop: LEGAL_LAYOUT.paragraphGap,
  },
  clauseParagraph: {
    paddingLeft: LEGAL_LAYOUT.clauseIndent,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
    paddingLeft: LEGAL_LAYOUT.clauseIndent,
  },
  bulletMarker: {
    width: 12,
    color: LEGAL_COLORS.ink,
  },
  bulletTextWrap: {
    flex: 1,
  },
  footerRule: {
    marginTop: LEGAL_LAYOUT.sectionGap + 8,
    marginBottom: 12,
  },
  footerNote: {
    textAlign: "center",
    paddingBottom: 4,
  },
});
