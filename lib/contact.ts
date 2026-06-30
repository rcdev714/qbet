import { BRAND_NAME } from '@/lib/brand';
import { Linking } from 'react-native';

export const WHATSAPP_CONTACT_DISPLAY = '+593939800968';
const WHATSAPP_CONTACT_E164 = '593939800968';

export function openWhatsAppContact() {
  const message = encodeURIComponent(`Hi, I would like to request ${BRAND_NAME} beta access.`);
  void Linking.openURL(`https://wa.me/${WHATSAPP_CONTACT_E164}?text=${message}`);
}
