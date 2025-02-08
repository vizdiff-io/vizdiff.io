export function jsonToFile(json, fileName) {
  const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
  const file = new File([blob], fileName, {
    type: 'application/json',
  });
  return file;
}
