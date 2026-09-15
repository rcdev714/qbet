import React from "react";
import {
  Platform,
  TextInput,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
} from "react-native";

import { getTextStyle } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";

export type ChatMessageInputProps = TextInputProps;

export const ChatMessageInput = React.forwardRef<TextInput, ChatMessageInputProps>(
  function ChatMessageInput({ style, ...props }, ref) {
    const { theme } = useTheme();
    const bodyStyle = getTextStyle("body");

    return (
      <TextInput
        ref={ref}
        {...props}
        style={[
          {
            flex: 1,
            maxHeight: 112,
            paddingTop: 0,
            paddingBottom: 0,
            color: theme.text,
            ...bodyStyle,
          },
          Platform.OS === "web" && ({ cursor: "text", outlineStyle: "none" } as object),
          style as StyleProp<TextStyle>,
        ]}
      />
    );
  },
);
