/**
 * Validação rigorosa de senha segundo a política de segurança do Florescer Devocional:
 * - Entre 8 e 16 caracteres
 * - Pelo menos 1 letra maiúscula (A-Z)
 * - Pelo menos 1 número (0-9)
 */

export interface PasswordValidationResult {
  isValid: boolean;
  message: string;
  criteria: {
    hasLength: boolean; // Entre 8 e 16 caracteres
    hasUppercase: boolean; // Pelo menos 1 letra maiúscula
    hasNumber: boolean; // Pelo menos 1 número
  };
}

export function validatePassword(password: string): PasswordValidationResult {
  const hasLength = password.length >= 8 && password.length <= 16;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const isValid = hasLength && hasUppercase && hasNumber;

  let message = '';
  if (!isValid) {
    if (password.length === 0) {
      message = 'A senha é obrigatória.';
    } else if (password.length < 8) {
      message = 'A senha deve ter no mínimo 8 caracteres.';
    } else if (password.length > 16) {
      message = 'A senha deve ter no máximo 16 caracteres.';
    } else if (!hasUppercase && !hasNumber) {
      message = 'A senha deve conter pelo menos uma letra maiúscula e um número.';
    } else if (!hasUppercase) {
      message = 'A senha deve conter pelo menos uma letra maiúscula.';
    } else if (!hasNumber) {
      message = 'A senha deve conter pelo menos um número.';
    } else {
      message = 'A senha deve ter entre 8 e 16 caracteres, incluindo uma letra maiúscula e um número.';
    }
  }

  return {
    isValid,
    message,
    criteria: {
      hasLength,
      hasUppercase,
      hasNumber
    }
  };
}
