import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileDialog } from './index';

vi.mock('./hooks/useProfileLogic', async () => {
  const ReactModule = await import('react');

  return {
    useProfileLogic: (_isOpen: boolean, initialTab?: string) => {
      const [activeTab, setActiveTab] = ReactModule.useState(initialTab || 'profile');

      return {
        user: null,
        isLoading: false,
        profileState: {},
        appearanceState: {
          language: 'en',
        },
        notificationsState: {},
        securityState: {},
        activeTab,
        setActiveTab,
        actions: {},
      };
    },
  };
});

vi.mock('./components/ProfileTab', () => ({
  ProfileTab: () => (
    <div style={{ height: '1200px' }}>
      <div>Profile content</div>
    </div>
  ),
}));

vi.mock('./components/AppearanceTab', () => ({
  AppearanceTab: () => <div>Appearance content</div>,
}));

vi.mock('./components/BillingTab', () => ({
  BillingTab: () => <div>Billing content</div>,
}));

vi.mock('./components/NotificationsTab', () => ({
  NotificationsTab: () => <div>Notifications content</div>,
}));

vi.mock('./components/SecurityTab', () => ({
  SecurityTab: () => <div>Security content</div>,
}));

vi.mock('./components/AiConfigTab', () => ({
  AiConfigTab: () => <div>AI config content</div>,
}));

vi.mock('./components/AdvancedTab', () => ({
  AdvancedTab: () => <div>Advanced content</div>,
}));

describe('ProfileDialog', () => {
  it('resets the content scroll position when switching tabs', () => {
    render(<ProfileDialog isOpen={true} onClose={vi.fn()} initialTab="profile" />);

    const profileContent = screen.getByText('Profile content');
    const contentArea = profileContent.parentElement?.parentElement as HTMLDivElement;

    contentArea.scrollTop = 240;
    expect(contentArea.scrollTop).toBe(240);

    fireEvent.click(screen.getByRole('button', { name: /advanced settings/i }));

    const advancedContent = screen.getByText('Advanced content');
    const updatedContentArea = advancedContent.parentElement as HTMLDivElement;

    expect(updatedContentArea.scrollTop).toBe(0);
  });
});
