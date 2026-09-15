// Fallback for using MaterialIcons on Android and web.

import { MaterialIcons } from '@expo/vector-icons';
import { SymbolWeight } from 'expo-symbols';
import React, { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

const MAPPING = {
  'house': 'home',
  'house.fill': 'home',
  'paperplane': 'send',
  'paperplane.fill': 'send',
  'message': 'chat-bubble-outline',
  'message.fill': 'chat-bubble',
  'plus': 'add',
  'plus.circle': 'add-circle-outline',
  'plus.circle.fill': 'add-circle',
  'wallet': 'payments',
  'wallet.outline': 'account-balance-wallet',
  'wallet.fill': 'account-balance-wallet',
  'creditcard': 'credit-card',
  'person': 'person-outline',
  'person.fill': 'person',
  'person.2': 'people-outline',
  'person.2.fill': 'people',
  'person.3': 'groups',
  'person.3.fill': 'groups',
  'magnifyingglass': 'search',
  'link': 'link',
  'gearshape': 'settings',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'list.bullet': 'list',
  'list.bullet.rectangle': 'view-agenda',
  'number': 'tag',
  'dollarsign': 'attach-money',
  'dollarsign.circle.fill': 'monetization-on',
  'clock': 'access-time',
  'trash': 'delete',
  'chart.bar': 'bar-chart',
  'chart.bar.fill': 'bar-chart',
  'sparkles': 'auto-awesome',
  // Social icons for viral sharing
  'heart': 'favorite-outline',
  'heart.fill': 'favorite',
  'bubble.left.fill': 'chat-bubble',
  'arrowshape.turn.up.right.fill': 'share',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'photo.fill': 'photo',
  'checkmark': 'check',
  'minus.circle.fill': 'remove-circle',
  'trophy.fill': 'emoji-events',
  'clock.fill': 'schedule',
  'calendar': 'event',
  'paperclip': 'attach-file',
  'arrow.up.right.circle': 'open-in-new',
  'arrow.up.right.circle.fill': 'open-in-new',
  'info.circle': 'info-outline',
  'shield': 'security',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'arrow.left.arrow.right': 'swap-horiz',
  'doc.text': 'description',
  'bell': 'notifications',
  'mic.fill': 'mic',
  'rectangle.portrait.and.arrow.right': 'logout',
} as const;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name];
  if (!iconName) {
    console.warn(`Icon "${name}" not found in mapping`);
    return <MaterialIcons color={color} size={size} name="help-outline" style={style} />;
  }
  return <MaterialIcons color={color} size={size} name={iconName as ComponentProps<typeof MaterialIcons>['name']} style={style} />;
}
