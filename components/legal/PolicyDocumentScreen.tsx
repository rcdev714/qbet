import { SEO } from "@/components/SEO";
import type { PolicyDocument } from "@/lib/legal/policy-content";
import { useRouter } from "expo-router";
import React from "react";
import {
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const BRAND_DEEP_BLUE = "#1A2F5C";
const BRAND_MUTED = "#526173";

type PolicyDocumentScreenProps = {
  document: PolicyDocument;
};

export function PolicyDocumentScreen({ document }: PolicyDocumentScreenProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SEO
        title={document.title}
        description={document.seoDescription}
        url={document.route}
        keywords={`AnyMarket, ${document.title}, legal, compliance`}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{document.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.updated}>Last updated: {document.lastUpdated}</Text>

          {document.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
              {section.bullets?.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15, 23, 42, 0.08)",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    minWidth: 72,
  },
  backText: {
    color: BRAND_DEEP_BLUE,
    fontSize: 15,
    fontWeight: "500",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: BRAND_DEEP_BLUE,
    fontSize: 17,
    fontWeight: "600",
  },
  headerSpacer: {
    minWidth: 72,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    gap: 24,
  },
  updated: {
    color: BRAND_MUTED,
    fontSize: 13,
    marginBottom: 4,
  },
  section: {
    gap: 10,
  },
  sectionHeading: {
    color: BRAND_DEEP_BLUE,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
  },
  paragraph: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 23,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    paddingLeft: 4,
  },
  bulletDot: {
    color: BRAND_DEEP_BLUE,
    fontSize: 15,
    lineHeight: 23,
  },
  bulletText: {
    flex: 1,
    color: "#334155",
    fontSize: 15,
    lineHeight: 23,
  },
});
