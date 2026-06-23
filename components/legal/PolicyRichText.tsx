import type { ComplianceJurisdiction } from "@/lib/compliance/jurisdiction";
import type { PolicyKind } from "@/lib/compliance/policy";
import {
    getPolicyDocuments,
    policyRouteWithJurisdiction,
} from "@/lib/legal/policy-content";
import type { PolicyInlineNode, PolicyRichText as PolicyRichTextContent } from "@/lib/legal/policy-links";
import { LEGAL_TYPE, legalFont } from "@/lib/legal/typography";
import { useRouter } from "expo-router";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import React, { useMemo } from "react";
import {
    Linking,
    Platform,
    StyleSheet,
    Text,
    type TextStyle,
} from "react-native";

type PolicyRichTextProps = {
  content: PolicyRichTextContent;
  jurisdiction: ComplianceJurisdiction;
  style?: TextStyle;
  linkStyle?: TextStyle;
  fontsLoaded?: boolean;
  inline?: boolean;
};

type WebLinkTextProps = {
  href: string;
  label: string;
  linkStyle?: TextStyle;
  target?: string;
  rel?: string;
};

function WebLinkText({ href, label, linkStyle, target, rel }: WebLinkTextProps) {
  return (
    <Text
      {...({
        style: [linkStyle, styles.webLink],
        accessibilityRole: "link",
        href,
        target,
        rel,
      } as object)}
    >
      {label}
    </Text>
  );
}

function isRichText(content: PolicyRichTextContent): content is PolicyInlineNode | PolicyInlineNode[] {
  return typeof content !== "string";
}

function normalizeNodes(content: PolicyInlineNode | PolicyInlineNode[]): PolicyInlineNode[] {
  return Array.isArray(content) ? content : [content];
}

export function PolicyRichText({
  content,
  jurisdiction,
  style,
  linkStyle,
  fontsLoaded = true,
  inline = false,
}: PolicyRichTextProps) {
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const resolvedLinkStyle = useMemo(
    () => ({
      ...LEGAL_TYPE.link,
      fontFamily: legalFont("body", fontsLoaded),
      ...(linkStyle as object),
    }),
    [fontsLoaded, linkStyle],
  );

  const openExternal = async (url: string) => {
    if (isWeb) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      await openBrowserAsync(url, {
        presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
      });
    } catch {
      await Linking.openURL(url);
    }
  };

  const openPolicy = (kind: PolicyKind) => {
    const documents = getPolicyDocuments(jurisdiction);
    router.push(policyRouteWithJurisdiction(documents[kind].route, jurisdiction) as any);
  };

  const policyHref = (kind: PolicyKind) => {
    const documents = getPolicyDocuments(jurisdiction);
    return policyRouteWithJurisdiction(documents[kind].route, jurisdiction);
  };

  const openEmail = (address: string) => {
    void Linking.openURL(`mailto:${address}`);
  };

  const renderNodes = () =>
    normalizeNodes(isRichText(content) ? content : []).map((node, index) => {
      const key = `${node.type}-${index}-${"value" in node ? node.value : node.label}`;

      if (node.type === "text") {
        return <Text key={key}>{node.value}</Text>;
      }

      if (node.type === "policy") {
        if (isWeb) {
          return (
            <WebLinkText
              key={key}
              href={policyHref(node.kind)}
              label={node.label}
              linkStyle={resolvedLinkStyle}
            />
          );
        }

        return (
          <Text
            key={key}
            style={resolvedLinkStyle}
            accessibilityRole="link"
            onPress={() => openPolicy(node.kind)}
          >
            {node.label}
          </Text>
        );
      }

      if (node.type === "email") {
        if (isWeb) {
          return (
            <WebLinkText
              key={key}
              href={`mailto:${node.address}`}
              label={node.label}
              linkStyle={resolvedLinkStyle}
            />
          );
        }

        return (
          <Text
            key={key}
            style={resolvedLinkStyle}
            accessibilityRole="link"
            onPress={() => openEmail(node.address)}
          >
            {node.label}
          </Text>
        );
      }

      if (isWeb) {
        return (
          <WebLinkText
            key={key}
            href={node.url}
            label={node.label}
            linkStyle={resolvedLinkStyle}
            target="_blank"
            rel="noopener noreferrer"
          />
        );
      }

      return (
        <Text
          key={key}
          style={resolvedLinkStyle}
          accessibilityRole="link"
          onPress={() => void openExternal(node.url)}
        >
          {node.label}
        </Text>
      );
    });

  if (!isRichText(content)) {
    return <Text style={style}>{content}</Text>;
  }

  if (inline) {
    return <>{renderNodes()}</>;
  }

  return <Text style={style}>{renderNodes()}</Text>;
}

const styles = StyleSheet.create({
  webLink: Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined,
});
