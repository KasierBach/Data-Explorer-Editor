import { MailTemplates } from './mail.templates';

describe('MailTemplates', () => {
  it('renders English verification copy when lang=en', () => {
    const html = MailTemplates.getVerificationEmail('Alex', '123456', 'en');

    expect(html).toContain('Verify your account');
    expect(html).toContain('Welcome to <strong>Data Explorer</strong>');
  });

  it('keeps Vietnamese invitation copy by default', () => {
    const html = MailTemplates.getTeamInvitationEmail(
      'Data Guild',
      'Minh',
      'ADMIN',
      'https://example.com/login',
    );

    expect(html).toContain('Lời mời tham gia team');
  });
});
