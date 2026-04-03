export class SendPasswordResetDto {
  // This DTO is used when requesting a password change verification code
  // The endpoint will be POST /auth/password-reset/send-code
  // No fields needed as it uses the authenticated user's email
}
