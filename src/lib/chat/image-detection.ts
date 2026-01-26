/**
 * Image Request Detection Utility
 * 
 * Detects when a user is asking for image generation in regular chat mode
 * so we can automatically route them to the image generation API.
 */

// Patterns that indicate an image generation request
const IMAGE_REQUEST_PATTERNS = [
  // Direct creation requests: "create/generate/make/draw an image of..."
  /\b(create|generate|make|draw|design|produce|render|paint|sketch|illustrate)\b.{0,30}\b(image|picture|illustration|graphic|photo|artwork|visual|icon|logo|diagram|chart|infographic)\b/i,
  
  // Requests starting with image type: "an image of...", "a picture showing..."
  /\b(an?\s+)?(image|picture|illustration|graphic|photo|artwork|visual|icon|logo)\b.{0,20}\b(of|showing|depicting|with|featuring|that shows)\b/i,
  
  // Show me/give me patterns: "show me an image of...", "give me a picture of..."
  /\b(show\s+me|give\s+me|can\s+you\s+(create|make|draw|generate)|i\s+need|i\s+want)\b.{0,20}\b(an?\s+)?(image|picture|illustration|graphic|photo|artwork|visual)\b/i,
  
  // Imperative patterns: "draw me a...", "design a logo..."
  /\b(draw\s+me|design\s+me|create\s+me|make\s+me|generate\s+me)\b.{0,10}\b(an?\s+)?/i,
  
  // Vision/visualization requests
  /\b(visualize|visualization\s+of|visual\s+representation)\b/i,
];

// Patterns that indicate this is NOT an image request (even if it matches above)
const NOT_IMAGE_PATTERNS = [
  // Questions about images
  /\b(what\s+is|explain|describe|tell\s+me\s+about|how\s+to)\b.{0,20}\b(image|picture)\b/i,
  
  // Image analysis requests (asking about existing images)
  /\b(analyze|identify|recognize|what\s+is\s+in|describe\s+this)\b.{0,10}\b(image|picture|photo)\b/i,
  
  // Code/technical discussions about images
  /\b(image\s+(processing|format|compression|resolution|file|type|tag|url|src|path))\b/i,
  
  // Docker/container images
  /\b(docker|container|pull|push|build)\b.{0,20}\b(image)\b/i,
];

/**
 * Detects if a message is requesting image generation
 * @param message - The user's message
 * @returns true if the message appears to be an image generation request
 */
export function detectImageRequest(message: string): boolean {
  // First check if any negative patterns match
  for (const pattern of NOT_IMAGE_PATTERNS) {
    if (pattern.test(message)) {
      return false;
    }
  }
  
  // Then check if any positive patterns match
  for (const pattern of IMAGE_REQUEST_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extracts the image prompt from a message that contains an image request
 * This attempts to clean up the prompt for better image generation
 * @param message - The user's message
 * @returns The cleaned prompt for image generation
 */
export function extractImagePrompt(message: string): string {
  // Remove common prefixes that aren't useful for the image model
  let prompt = message
    .replace(/^(please\s+)?(can\s+you\s+)?(create|generate|make|draw|design|produce)\s+(me\s+)?(an?\s+)?/i, '')
    .replace(/^(show\s+me|give\s+me)\s+(an?\s+)?/i, '')
    .replace(/^(i\s+(need|want)\s+(an?\s+)?)/i, '')
    .replace(/\b(image|picture|illustration|graphic|photo|artwork|visual)\s+(of|showing|depicting|with|featuring)\s+/i, '')
    .trim();
  
  // If the prompt is now empty or too short, use the original message
  if (prompt.length < 5) {
    prompt = message;
  }
  
  return prompt;
}
