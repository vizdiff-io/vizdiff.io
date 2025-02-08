const specialChars = [
  '+',
  '-',
  '_',
  '?',
  '<',
  '>',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
];

export function validatePassword(pw) {
  const hasLetter = /\d/.test(pw);
  let hasNumber = false;
  let hasSpecial = false;

  for (let i = 0; i < pw.length; i++) {
    const char = pw.charAt(i);
    if (!isNaN(char) && !(char === ' ')) {
      hasNumber = true;
    }
    for (const specialChar of specialChars) {
      if (specialChar === char) {
        hasSpecial = true;
      }
    }
  }
  return pw.length >= 8 && hasNumber && hasLetter && hasSpecial;
}
