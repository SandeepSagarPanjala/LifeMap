/**
 * Prefetch the You screen module graph after the map is interactive so the
 * first tap is not blocked by Metro inlineRequires + first evaluate.
 */
export function warmYouScreen(): void {
  void import('@/screens/you/YouScreen');
}
