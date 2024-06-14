export function isOwnerOrAdmin(currentUser) {
  return currentUser.role === 'admin' || currentUser.role === 'owner';
}
