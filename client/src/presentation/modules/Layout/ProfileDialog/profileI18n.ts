import { pickLocalizedText, type AppLang } from '@/core/utils/i18n';

export function getProfileDialogText(lang: AppLang | string | null | undefined) {
  return {
    profileUpdated: pickLocalizedText(lang, 'Cập nhật hồ sơ thành công!', 'Profile updated successfully!'),
    avatarUpdated: pickLocalizedText(lang, 'Cập nhật ảnh đại diện thành công!', 'Avatar updated successfully!'),
    passwordsDoNotMatch: pickLocalizedText(lang, 'Mật khẩu xác nhận không khớp', 'Passwords do not match'),
    passwordChanged: pickLocalizedText(lang, 'Đổi mật khẩu thành công!', 'Password changed successfully!'),
    settingsUpdated: pickLocalizedText(lang, 'Cập nhật cài đặt thành công!', 'Settings updated successfully!'),
  };
}
