# Contributing to AgentKit

Thank you for your interest in contributing to AgentKit! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and considerate in communications
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- Node.js 18 or higher
- Docker and Docker Compose
- Git
- A code editor (VS Code recommended)
- API keys for at least one LLM provider (OpenAI, Anthropic, or Ollama)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/agentkit.git
   cd agentkit
   ```

3. Add the upstream remote:

   ```bash
   git remote add upstream https://github.com/ORIGINAL_ORG/agentkit.git
   ```

---

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Database

```bash
cd docker
docker compose up -d
cd ..
```

### 3. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### 5. Verify Setup

- Open the app in your browser
- Try sending a chat message
- Check the admin panel at `/admin`

---

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-new-agent` - For new features
- `fix/memory-retrieval-bug` - For bug fixes
- `docs/update-api-reference` - For documentation
- `refactor/simplify-retriever` - For refactoring

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, missing semicolons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(agents): add sustainability domain agent

fix(memory): resolve vector search timeout on large datasets

docs(api): update chat endpoint documentation
```

---

## Pull Request Process

### Before Submitting

1. **Sync with upstream**:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests**:

   ```bash
   npm run test
   ```

3. **Run linter**:

   ```bash
   npm run lint
   ```

4. **Build successfully**:

   ```bash
   npm run build
   ```

### Submitting

1. Push your branch to your fork
2. Open a Pull Request against the `main` branch
3. Fill out the PR template completely
4. Link any related issues

### PR Review

- Address reviewer feedback promptly
- Keep the PR focused on a single concern
- Squash commits if requested
- Be patient - reviews take time

---

## Code Style

### TypeScript

- Use TypeScript for all new code
- Define explicit types for function parameters and returns
- Prefer interfaces over type aliases for object shapes
- Use `const` by default, `let` when necessary

```typescript
// Good
interface AgentConfig {
  name: string;
  category: AgentCategory;
  enabled: boolean;
}

function createAgent(config: AgentConfig): Promise<Agent> {
  // ...
}

// Avoid
function createAgent(config: any) {
  // ...
}
```

### React Components

- Use functional components with hooks
- Co-locate related files (component, styles, tests)
- Use named exports for components

```typescript
// Good
export function ChatMessage({ message, isUser }: ChatMessageProps) {
  return (
    <div className={cn("message", isUser && "message--user")}>
      {message.content}
    </div>
  );
}
```

### File Organization

- Keep files focused and reasonably sized
- Group related functionality in directories
- Use index files for public exports

### Formatting

We use ESLint and Prettier. Run before committing:

```bash
npm run lint
npm run format
```

---

## Testing

### Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Specific file
npm run test -- path/to/test.ts
```

### Writing Tests

- Place tests next to the code they test or in `tests/`
- Use descriptive test names
- Test behavior, not implementation
- Mock external dependencies

```typescript
import { describe, it, expect, vi } from 'vitest';
import { classifyMode } from './mode-classifier';

describe('classifyMode', () => {
  it('should return quick mode for simple questions', async () => {
    const result = await classifyMode('What time is it?');
    expect(result.recommendedMode).toBe('quick');
  });

  it('should return research mode for complex analysis requests', async () => {
    const result = await classifyMode(
      'Analyze our market position compared to competitors over the last 5 years'
    );
    expect(result.recommendedMode).toBe('research');
  });
});
```

### Test Coverage

- Aim for meaningful coverage, not 100%
- Focus on critical paths and edge cases
- All bug fixes should include a test

---

## Documentation

### Code Documentation

- Document public APIs with JSDoc
- Include examples for complex functions
- Keep comments up to date

```typescript
/**
 * Retrieves domain context for a user query.
 * 
 * @param query - The user's question
 * @param options - Retrieval configuration
 * @returns Aggregated context from relevant domain agents
 * 
 * @example
 * const context = await retrieveDomainContext(
 *   'What are our top customers?',
 *   { maxResults: 10, enableGraph: true }
 * );
 */
export async function retrieveDomainContext(
  query: string,
  options: RetrievalOptions
): Promise<DomainContext> {
  // ...
}
```

### README and Docs

- Update README for user-facing changes
- Add to `docs/` for detailed documentation
- Include screenshots for UI changes

---

## Questions?

- Open a [Discussion](https://github.com/ORIGINAL_ORG/agentkit/discussions) for questions
- Check existing [Issues](https://github.com/ORIGINAL_ORG/agentkit/issues) before creating new ones
- Join our community chat (if available)

---

Thank you for contributing to AgentKit!
